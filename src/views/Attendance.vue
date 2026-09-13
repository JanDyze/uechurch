<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAttendance } from '../composables/useAttendance'
import { useAttendanceStats } from '../composables/useAttendanceStats'
import { useMembers } from '../composables/useMembers'
import { usePermissions } from '../composables/usePermissions'
import { useEventStatus } from '../composables/useEventStatus'
import { useToast } from '../composables/useToast'
import AttendanceWarnings from '../components/attendance/AttendanceWarnings.vue'
import AttendanceListItem from '../components/attendance/AttendanceListItem.vue'
import EventStatusSheet from '../components/events/EventStatusSheet.vue'
import ConfirmationModal from '../components/common/ConfirmationModal.vue'

// No toolbar, and no add button either. Attendance follows the calendar rather
// than the other way round: a gathering is created on Events or in Settings,
// and this page is where its turnout gets written down. Everything past and
// unrecorded is already sitting in the list, so there is nothing here to
// invent — the amber warning is the way in to the oldest of them.

const router = useRouter()
const toast = useToast()
const { canManage } = usePermissions()

const { aggregatedAttendance, loading, skipRecording, resumeRecording, removeAttendance } =
  useAttendance()
const { members } = useMembers()
const { setStatus } = useEventStatus()

const { stats } = useAttendanceStats(aggregatedAttendance, members)

// Grouped on the raw 'YYYY-MM' prefix rather than a parsed Date, for the same
// reason the warnings are: `new Date('2026-08-01')` is UTC midnight and would
// file the first of the month under the previous one west of Greenwich. The
// two have to agree, or "this month" would report on a different set of
// gatherings than the month header directly beneath it.
const attendanceByMonth = computed(() => {
  const grouped = new Map()

  aggregatedAttendance.value.forEach((record) => {
    const key = String(record.date || '').slice(0, 7)
    if (!key) return

    if (!grouped.has(key)) {
      const [year, month] = key.split('-')
      grouped.set(key, {
        key,
        label: new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('en-US', {
          month: 'long',
          year: 'numeric',
        }),
        records: [],
      })
    }
    grouped.get(key).records.push(record)
  })

  return [...grouped.values()].sort((a, b) => b.key.localeCompare(a.key))
})

// Recording is a screen of its own: the route carries only a key, and the
// record page looks the rest up from the same live list this page renders.
const openRecorder = (query = {}) => router.push({ name: 'RecordAttendance', query })

const handleRecordAttendance = (record) => openRecorder({ key: record?.occurrenceKey || record?.id })

const handleEditAttendance = (record) => openRecorder({ id: record?.firestoreId || record?.id })

// Calling a gathering off, or deciding not to count it, from the list itself —
// the same sheet the Events page opens, so the answer means the same thing on
// both. A row is marked far more often from here, where the unrecorded ones
// are piling up, than from the calendar.
const showStatusSheet = ref(false)
const statusTarget = ref(null)

// Cancelling and postponing are calendar facts, and only a row that came from
// the calendar has somewhere to write them. A meeting or an already-saved
// record can still be left out of the count.
const statusAllowed = computed(() => {
  const row = statusTarget.value
  return row?.rowType === 'event' || row?.rowType === 'recurring'
})

// A write is in flight. Marking is one tap on a small button and the sheet
// stays put while Firestore answers, so without this a double tap writes twice.
const marking = ref(false)

const openStatusSheet = (record) => {
  if (!canManage('attendance')) return
  statusTarget.value = record
  showStatusSheet.value = true
}

const closeStatusSheet = () => {
  showStatusSheet.value = false
  statusTarget.value = null
}

// A row carries the shape of whatever generated it, which is not the shape the
// calendar works in: the status writer wants the event or occurrence behind it.
const asCalendarEntry = (row) => ({
  ...row,
  id: row.occurrenceKey || row.id,
  firestoreId: row.rowType === 'recurring' ? null : row.firestoreId,
  isVirtual: row.rowType === 'recurring',
  title: row.eventTitle,
  type: row.eventType,
})

const applyStatus = async (change) => {
  const row = statusTarget.value
  if (!row || marking.value) return
  marking.value = true
  try {
    await setStatus(asCalendarEntry(row), change)
    closeStatusSheet()
  } catch (error) {
    console.error('Error changing status:', error)
    toast.error('Could not change that. Please try again.')
  } finally {
    marking.value = false
  }
}

const skipRow = async () => {
  const row = statusTarget.value
  if (!row || marking.value) return
  marking.value = true
  try {
    await skipRecording(row)
    closeStatusSheet()
    toast.success("Left out — it won't be asked for again")
  } catch (error) {
    console.error('Error skipping gathering:', error)
    toast.error('Could not skip that. Please try again.')
  } finally {
    marking.value = false
  }
}

// Deleting the count itself, which is nothing like calling a gathering off:
// the gathering happened, what goes is the record of who was there. It returns
// to the list as "Not recorded", ready to be done again — so this is also the
// way out of a count taken against the wrong Sunday.
const pendingDelete = ref(null)
const showConfirmDelete = ref(false)

const askDelete = (record) => {
  if (!canManage('attendance')) return
  pendingDelete.value = record
  showConfirmDelete.value = true
}

// Built here rather than inline: a `:message="..."` attribute cannot hold a
// straight double quote, and ConfirmationModal renders text, not HTML.
const confirmDeleteMessage = computed(() => {
  const row = pendingDelete.value
  const title = row?.eventTitle || 'this gathering'
  const when = row?.date ? ` on ${row.date}` : ''
  return `Delete the attendance recorded for "${title}"${when}? Everyone marked is wiped and it goes back to the list ready to record again. The gathering itself is untouched.`
})

const deleteRow = async () => {
  const row = pendingDelete.value
  if (!row) return
  try {
    await removeAttendance(row)
    toast.success('Attendance deleted')
  } catch (error) {
    console.error('Error deleting attendance:', error)
    toast.error('Could not delete that. Please try again.')
  } finally {
    pendingDelete.value = null
  }
}

const unskipRow = async () => {
  const row = statusTarget.value
  if (!row || marking.value) return
  marking.value = true
  try {
    await resumeRecording(row)
    closeStatusSheet()
  } catch (error) {
    console.error('Error restoring gathering:', error)
    toast.error('Could not undo that. Please try again.')
  } finally {
    marking.value = false
  }
}
</script>

<template>
  <div class="relative flex h-full flex-col">
    <!-- A column, so the warnings sit above the scroller rather than inside
         it: a warning that scrolls away is only a warning for the first
         screenful. -->
    <div
      class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
    >
      <AttendanceWarnings
        v-if="!loading"
        :stats="stats"
        :can-record="canManage('attendance')"
        @record="(key) => openRecorder({ key })"
      />

      <div class="min-h-0 flex-1 overflow-y-auto pb-20">
        <div v-if="loading" class="divide-y divide-gray-200 dark:divide-gray-700">
          <div v-for="i in 10" :key="`skeleton-${i}`" class="flex items-center gap-3 px-4 py-3">
            <div class="h-9 w-12 shrink-0 animate-pulse rounded bg-gray-200 dark:bg-gray-600"></div>
            <div class="flex-1 space-y-2">
              <div class="h-4 w-32 animate-pulse rounded bg-gray-200 dark:bg-gray-600"></div>
              <div class="h-3 w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-600"></div>
            </div>
            <div class="h-6 w-12 shrink-0 animate-pulse rounded bg-gray-200 dark:bg-gray-600"></div>
          </div>
        </div>

        <p
          v-else-if="attendanceByMonth.length === 0"
          class="p-8 text-center text-sm text-gray-500 dark:text-gray-400"
        >
          Nothing to show yet. Once an event, meeting or service has passed it appears here ready
          to record.
        </p>

        <div v-else class="divide-y divide-gray-200 dark:divide-gray-700">
          <template v-for="monthGroup in attendanceByMonth" :key="monthGroup.key">
            <div
              class="sticky top-0 z-10 border-b border-gray-200 bg-gray-100 px-4 py-2 dark:border-gray-600 dark:bg-gray-700"
            >
              <h3
                class="text-sm font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-300"
              >
                {{ monthGroup.label }}
              </h3>
            </div>
            <AttendanceListItem
              v-for="record in monthGroup.records"
              :key="record.id"
              :record="record"
              :members="members"
              :can-manage="canManage('attendance')"
              @record-attendance="handleRecordAttendance(record)"
              @edit-attendance="handleEditAttendance(record)"
              @mark="openStatusSheet(record)"
              @delete="askDelete(record)"
            />
          </template>
        </div>
      </div>
    </div>

    <!-- Cancelled, postponed, or simply not being counted. The same sheet the
         calendar opens, plus the one option only this page has. -->
    <EventStatusSheet
      :show="showStatusSheet"
      :event="statusTarget"
      :allow-skip="true"
      :allow-status="statusAllowed"
      :busy="marking"
      :skipped="Boolean(statusTarget?.skipped)"
      @close="closeStatusSheet"
      @apply="applyStatus"
      @skip="skipRow"
      @unskip="unskipRow"
    />

    <ConfirmationModal
      :show="showConfirmDelete"
      title="Delete attendance"
      :message="confirmDeleteMessage"
      confirm-text="Delete"
      cancel-text="Keep"
      confirm-button-class="bg-red-600 text-white hover:bg-red-700"
      @update:show="showConfirmDelete = $event"
      @confirm="deleteRow"
    />
  </div>
</template>

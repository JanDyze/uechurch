<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { useRoute, useRouter } from 'vue-router'
import AttendanceChecker from '../components/attendance/AttendanceChecker.vue'
import { useAttendance } from '../composables/useAttendance'
import { useEvents } from '../composables/useEvents'
import { useMinutes } from '../composables/useMinutes'
import { useToast } from '../composables/useToast'
import ConfirmationModal from '../components/common/ConfirmationModal.vue'
import { provenanceForRow, ATTENDANCE_SOURCES } from '../../lib/attendance'

// Taking attendance is a task, not a side panel. A hundred names, a swipe deck
// and several rounds of latecomers need the whole screen — on a phone the
// drawer left barely enough room for one card.
//
// The route carries only a key, never the record itself:
//   ?key=<occurrenceKey>  record against a service, event or meeting
//   ?id=<attendanceId>    edit what was already recorded
//   (neither)             a one-off tied to nothing
//
// Everything else is looked up from the live aggregated list, so a refresh or
// a shared link lands on exactly the same thing.

const route = useRoute()
const router = useRouter()
const toast = useToast()

const {
  aggregatedAttendance,
  loading,
  addAttendanceToFirestore,
  updateAttendanceInFirestore,
  removeAttendance,
} = useAttendance()

const { removeEvent } = useEvents()
const { removeMinute } = useMinutes()

// Autosave. Marking attendance is dozens of small decisions, and a Save button
// turns every one of them into something that can be lost — close the tab
// mid-service and the morning is gone. Writes are debounced instead, because a
// swipe deck can fire a change every few hundred milliseconds and each one
// would otherwise be a Firestore round trip.
const SAVE_DEBOUNCE_MS = 1200
// Even while someone keeps swiping, never let unsaved work get older than this.
const SAVE_MAX_WAIT_MS = 5000

const attendanceData = ref(null)
/** 'clean' | 'pending' | 'saving' | 'saved' | 'error' */
const saveState = ref('clean')
// The record we created ourselves, held until the live list catches up —
// without it a second debounce would fire before `target` flips and create a
// duplicate record.
const createdRecord = ref(null)

let saveTimer = null
let maxWaitTimer = null

/** Nothing worth writing until it has a name and a date. */
const canSave = computed(() =>
  Boolean(attendanceData.value?.eventTitle?.trim() && attendanceData.value?.date)
)

const persist = async () => {
  clearTimeout(saveTimer)
  clearTimeout(maxWaitTimer)
  maxWaitTimer = null
  if (!attendanceData.value || !canSave.value) return

  const payload = {
    ...attendanceData.value,
    totalAttendees: attendanceData.value.attendees?.length || 0,
  }
  const existing = createdRecord.value || (isEdit.value ? target.value : null)

  saveState.value = 'saving'
  try {
    if (existing) {
      await updateAttendanceInFirestore(existing, payload)
    } else {
      const id = await addAttendanceToFirestore(payload)
      createdRecord.value = { id, firestoreId: id }
    }
    saveState.value = 'saved'
  } catch (error) {
    console.error('Error saving attendance:', error)
    saveState.value = 'error'
    toast.error('Could not save. Your marks are still on screen — try again.')
  }
}

const scheduleSave = () => {
  if (!canSave.value) return
  saveState.value = 'pending'
  clearTimeout(saveTimer)
  saveTimer = setTimeout(persist, SAVE_DEBOUNCE_MS)
  // A continuous run of swipes keeps resetting the debounce, so this is the
  // backstop that gets work to the server anyway.
  if (!maxWaitTimer) maxWaitTimer = setTimeout(persist, SAVE_MAX_WAIT_MS)
}

/** Every change to the form comes through here. */
const handleChange = (next) => {
  attendanceData.value = next
  scheduleSave()
}

// Leaving with a pending write must not lose it.
onBeforeRouteLeave(async () => {
  if (saveState.value === 'pending') await persist()
})
onBeforeUnmount(() => {
  clearTimeout(saveTimer)
  clearTimeout(maxWaitTimer)
})

// Local date, not `toISOString()`: that is UTC, and a service recorded before
// 8am in Manila would file itself under yesterday. There is no date field on
// this screen any more, so nobody would be able to correct it.
const today = () => {
  const d = new Date()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${month}-${day}`
}

const blank = () => ({
  source: ATTENDANCE_SOURCES.ADHOC,
  sourceId: null,
  occurrenceKey: null,
  eventId: '',
  eventType: '',
  eventTitle: '',
  date: today(),
  time: '',
  location: '',
  attendees: [],
  notes: '',
  expectedAttendees: 0,
  // A one-off tied to nothing is for everyone until somebody says otherwise.
  audienceTags: [],
  excludeTags: [],
})

/** The row this page is recording against, once the live list has loaded. */
const target = computed(() => {
  const { key, id } = route.query
  if (!key && !id) return null
  return (
    aggregatedAttendance.value.find((row) => {
      if (id) return String(row.firestoreId || row.id) === String(id)
      return String(row.occurrenceKey || row.id) === String(key)
    }) || null
  )
})

const isEdit = computed(() => target.value?.rowType === 'attendance')
/** A saved record owns its own title and date; a placeholder inherits them. */
const eventData = computed(() => (isEdit.value ? null : target.value))
const detailsLocked = computed(() => Boolean(target.value) && !isEdit.value)

const notFound = computed(
  () => !loading.value && (route.query.key || route.query.id) && !target.value
)

// Seed the form once the target resolves — the list arrives asynchronously, so
// this cannot happen at setup.
watch(
  [target, loading],
  () => {
    if (attendanceData.value) return
    if (!route.query.key && !route.query.id) {
      attendanceData.value = blank()
      return
    }
    const row = target.value
    if (!row) return

    if (row.rowType === 'attendance') {
      attendanceData.value = {
        source: row.source || ATTENDANCE_SOURCES.ADHOC,
        sourceId: row.sourceId ?? null,
        occurrenceKey: row.occurrenceKey ?? null,
        eventId: row.eventId || '',
        eventType: row.eventType || '',
        eventTitle: row.eventTitle || '',
        date: row.date || '',
        time: row.time || '',
        location: row.location || '',
        attendees: [...(row.attendees || [])],
        notes: row.notes || '',
        // Both already recounted off the live event or schedule's tags, so
        // reopening a record refreshes the audience it was saved with rather
        // than writing yesterday's snapshot back.
        expectedAttendees: row.expectedAttendees || 0,
        audienceTags: [...(row.audienceTags || [])],
        excludeTags: [...(row.excludeTags || [])],
      }
      return
    }

    // A generated row: capture what it was synthesised from before that fact
    // is flattened into the saved document.
    const provenance = provenanceForRow(row)
    attendanceData.value = {
      ...provenance,
      eventId: provenance.source === ATTENDANCE_SOURCES.EVENT ? provenance.sourceId : '',
      eventType: row.eventType || row.type || '',
      eventTitle: row.eventTitle || row.title || '',
      date: row.date || '',
      time: row.time || '',
      location: row.location || '',
      // A meeting already knows who was there; everything else starts empty.
      attendees: row.rowType === 'minute' ? [...(row.attendees || [])] : [],
      notes: '',
      expectedAttendees: row.expectedAttendees || row.attendees?.length || 0,
      // Copied off the event or schedule at the moment of recording, so the
      // record still knows who it was for if that source is later deleted.
      audienceTags: [...(row.audienceTags || [])],
      excludeTags: [...(row.excludeTags || [])],
    }
  },
  { immediate: true }
)

// A "Not recorded" row is generated from an event or meeting, so the only way
// to make it go away is to delete the thing generating it. Recurring
// occurrences come from a Settings schedule with no document behind them and
// so offer no delete — they are managed in Settings instead.
const placeholderKind = computed(() => {
  const kind = target.value?.rowType
  return kind === 'event' || kind === 'minute' ? kind : null
})

// Two different destructive actions, deliberately kept apart: one throws away
// the attendance that was recorded, the other deletes the event or meeting
// itself. Confusing them would be expensive.
const showConfirmDelete = ref(false)
const showConfirmClear = ref(false)

// Not "delete": nothing the user authored goes away. The marks are wiped and
// the gathering returns to the list as "Not recorded", ready to do again.
const handleClear = async () => {
  const record = createdRecord.value || target.value
  if (!record) return
  try {
    await removeAttendance(record)
    toast.success('Attendance cleared')
    leave()
  } catch (error) {
    console.error('Error clearing attendance:', error)
    toast.error('Could not clear that. Please try again.')
  }
}

// Built here rather than inline in the template: a `:message="..."` attribute
// cannot hold a straight double quote, and escaping it as &quot; put the
// entity itself on screen - ConfirmationModal renders the text, not HTML.
const confirmClearMessage = computed(() => {
  const title = attendanceData.value?.eventTitle || 'this gathering'
  return `Wipe everyone marked for "${title}"? It goes back to the list ready to record again — the event itself is untouched.`
})

const confirmDeleteMessage = computed(() => {
  const title = target.value?.eventTitle || target.value?.title || 'this item'
  return placeholderKind.value === 'minute'
    ? `Delete the meeting "${title}"? This also removes it and its minutes from the Minutes page. This cannot be undone.`
    : `Delete the event "${title}"? This also removes it from the Events page. This cannot be undone.`
})

const handleDeleteSource = async () => {
  const record = target.value
  if (!record) return
  const isMeeting = placeholderKind.value === 'minute'
  try {
    if (isMeeting) await removeMinute(record)
    else await removeEvent(record)
    toast.success(isMeeting ? 'Meeting deleted' : 'Event deleted')
    leave()
  } catch (error) {
    console.error('Error deleting source item:', error)
    toast.error(`Failed to delete ${isMeeting ? 'meeting' : 'event'}. Please try again.`)
  }
}

const leave = () => {
  if (window.history.state?.back) router.back()
  else router.push('/attendance')
}


</script>

<template>
  <div class="h-full min-h-0 flex flex-col overflow-hidden">
    <div v-if="loading && !attendanceData" class="flex-1 flex items-center justify-center">
      <div class="w-full max-w-sm px-6 space-y-3">
        <div class="h-8 rounded-lg bg-gray-100 dark:bg-gray-700 animate-pulse"></div>
        <div class="h-64 rounded-2xl bg-gray-100 dark:bg-gray-700 animate-pulse"></div>
      </div>
    </div>

    <div v-else-if="notFound" class="flex-1 flex items-center justify-center px-6 text-center">
      <div>
        <p class="text-sm font-semibold text-gray-900 dark:text-white">
          That gathering is no longer on the list
        </p>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          It may have been recorded already, or the event was removed.
        </p>
        <button
          @click="leave"
          class="mt-4 h-11 px-5 rounded-lg bg-primary text-white text-sm font-semibold"
        >
          Back to attendance
        </button>
      </div>
    </div>

    <AttendanceChecker
      v-else-if="attendanceData"
      variant="page"
      :show="true"
      :is-edit="isEdit"
      :attendance-data="attendanceData"
      :event-data="eventData"
      :details-locked="detailsLocked"
      :placeholder-kind="placeholderKind"
      :save-state="saveState"
      @update:attendance-data="handleChange"
      @clear="showConfirmClear = true"
      @delete-source="showConfirmDelete = true"
      @cancel="leave"
    />

    <ConfirmationModal
      :show="showConfirmClear"
      title="Clear attendance"
      :message="confirmClearMessage"
      confirm-text="Clear"
      cancel-text="Cancel"
      confirm-button-class="bg-red-600 text-white hover:bg-red-700"
      @update:show="showConfirmClear = $event"
      @confirm="handleClear"
    />

    <ConfirmationModal
      :show="showConfirmDelete"
      :title="placeholderKind === 'minute' ? 'Delete Meeting' : 'Delete Event'"
      :message="confirmDeleteMessage"
      confirm-text="Delete"
      cancel-text="Cancel"
      confirm-button-class="bg-red-600 text-white hover:bg-red-700"
      @update:show="showConfirmDelete = $event"
      @confirm="handleDeleteSource"
    />
  </div>
</template>

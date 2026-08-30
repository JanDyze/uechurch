<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { Plus } from '../icons'
import { useAttendance } from '../composables/useAttendance'
import { useAttendanceStats } from '../composables/useAttendanceStats'
import { useMembers } from '../composables/useMembers'
import { usePermissions } from '../composables/usePermissions'
import AttendanceSummary from '../components/attendance/AttendanceSummary.vue'
import AttendanceListItem from '../components/attendance/AttendanceListItem.vue'

// No toolbar. Every gathering is already grouped under its month and stamped
// with its date, and the summary above answers the question people actually
// arrive with — how full was it — without anyone typing anything. Recording
// is the one action, so it gets a button of its own rather than a bar.

const router = useRouter()
const { canManage } = usePermissions()

const { aggregatedAttendance, loading } = useAttendance()
const { members } = useMembers()

const rosterSize = computed(() => members.value?.length || 0)
const { stats, recentBars } = useAttendanceStats(aggregatedAttendance, rosterSize)

// Grouped on the raw 'YYYY-MM' prefix rather than a parsed Date, for the same
// reason the summary is: `new Date('2026-08-01')` is UTC midnight and would
// file the first of the month under the previous one west of Greenwich. The
// two have to agree, or "This month" would report on a different set of
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
</script>

<template>
  <div class="relative flex h-full flex-col">
    <div
      class="flex-1 overflow-y-auto rounded-lg border border-gray-200 bg-white pb-20 dark:border-gray-700 dark:bg-gray-800"
    >
      <AttendanceSummary :stats="stats" :recent-bars="recentBars" :loading="loading" />

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
        Nothing to show yet. Once an event, meeting or service has passed it appears here ready to
        record.
      </p>

      <div v-else class="divide-y divide-gray-200 dark:divide-gray-700">
        <template v-for="monthGroup in attendanceByMonth" :key="monthGroup.key">
          <div
            class="sticky top-0 z-10 border-b border-gray-200 bg-gray-100 px-4 py-2 dark:border-gray-600 dark:bg-gray-700"
          >
            <h3 class="text-sm font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-300">
              {{ monthGroup.label }}
            </h3>
          </div>
          <AttendanceListItem
            v-for="record in monthGroup.records"
            :key="record.id"
            :record="record"
            :members="members"
            @record-attendance="handleRecordAttendance(record)"
            @edit-attendance="handleEditAttendance(record)"
          />
        </template>
      </div>
    </div>

    <!-- One action on this page, so it is a button rather than a menu. -->
    <button
      v-if="canManage('attendance')"
      @click="openRecorder()"
      aria-label="Record attendance"
      title="Record attendance"
      class="absolute bottom-4 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg shadow-primary/30 transition-transform hover:bg-primary-hover active:scale-95"
    >
      <Plus class="h-6 w-6" />
    </button>
  </div>
</template>

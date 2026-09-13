<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  Users,
  CalendarDays,
  ClipboardCheck,
  HeartHandshake,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  ArrowRight,
} from '../icons'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from '../composables/useToast'
import { usePermissions } from '../composables/usePermissions'
import { useMembers } from '../composables/useMembers'
import { useMemberStats } from '../composables/useMemberStats'
import { useEvents } from '../composables/useEvents'
import { useBirthdayEvents } from '../composables/useBirthdayEvents'
import { useRecurringEvents } from '../composables/useRecurringEvents'
import { useEventStats } from '../composables/useEventStats'
import { useAttendance } from '../composables/useAttendance'
import { useAttendanceStats } from '../composables/useAttendanceStats'
import { useMinutes } from '../composables/useMinutes'
import { usePrayerConcerns } from '../composables/usePrayerConcerns'
import { useTasks } from '../composables/useTasks'
import { useMemberClaims } from '../composables/useMemberClaims'
import { useAllLineups } from '../composables/useLineups'
import { subscribeToNotifications } from '../api/notifyService'
import { getDisplayName } from '../utils/memberUtils'
import { getEventTypeBar } from '../utils/eventColors'
import { isCalledOff, eventStatusLabel, readEventStatus } from '../../lib/eventStatus'
import { isRecorded } from '../../lib/attendance'
import { memberKey } from '../utils/sgUtils'
import { formatServiceDate } from '../utils/lineupUtils'
import { peopleOnService } from '../data/scheduleRoles'
import { isAssignedTo, isDueToday, isOverdue } from '../utils/taskUtils'
import MemberAvatar from '../components/members/MemberAvatar.vue'

// The dashboard answers four questions before anyone taps anything: are people
// still coming, what is on this week, who are we, and what is waiting on me.
//
// Deliberately not a wall of collection totals. "132 events" counts every
// service since the app was set up and tells nobody anything; "6 this week"
// and "64% of the church came in August, up 6 points" are the same data asked
// a question worth answering. Every tile is either a rate, a comparison, or a
// count of something in a window someone actually cares about.
//
// Everything is gated on the same capabilities as the page it summarises, so a
// member without the attendance tag sees a dashboard about their own church
// rather than a row of empty admin tiles.

const route = useRoute()
const router = useRouter()
const toast = useToast()

// The router bounces anyone without the capability for a page back to here.
// Say so, rather than leaving them wondering why the tap did nothing.
onMounted(() => {
  if (!route.query.denied) return
  toast.warning(
    `You do not have access to ${route.query.denied}. Ask an administrator for the right ministry tag.`,
    5000
  )
  router.replace({ query: {} })
})

const { can, canManage, isAdmin, myMember } = usePermissions()

/* ------------------------------------------------------------------ data */

const { members } = useMembers()
const { stats: people } = useMemberStats(members)

const { events: storedEvents } = useEvents()
const { birthdayEvents } = useBirthdayEvents(members, storedEvents)
const { recurringEvents } = useRecurringEvents(storedEvents, members)

// The calendar is not the `events` collection: the weekly schedules and the
// birthdays are generated, exactly as the Events page builds them. A dashboard
// counting only stored documents would report a week with a Sunday service in
// it as empty.
const calendarEvents = computed(() =>
  [
    // A called-off gathering stays in the week ahead, struck through: somebody
    // checking whether there is a service on Sunday needs to be told there is
    // not. Only the two that were taken off the calendar outright — a hidden
    // birthday, a deleted occurrence — drop out silently.
    ...storedEvents.value.filter(
      (e) =>
        !e.hidden && !(e.isCancelled && String(e.overrideOf || '').startsWith('birthday-'))
    ),
    ...birthdayEvents.value,
    ...recurringEvents.value,
  ].sort((a, b) => String(a.date).localeCompare(String(b.date)))
)

const viewedMonth = ref(new Date())
// Counted tiles report on what is actually happening; the lists below still
// show what was called off, because that is news in its own right.
const countableEvents = computed(() => calendarEvents.value.filter((e) => !isCalledOff(e)))
const { stats: eventStats } = useEventStats(countableEvents, viewedMonth)

const { aggregatedAttendance } = useAttendance()
const rosterSize = computed(() => members.value?.length || 0)
// The roster itself, not just its size: the summary names the people it has
// not seen in a while, which needs the members rather than a count of them.
const { stats: attendance, recentBars } = useAttendanceStats(aggregatedAttendance, members)

const { minutes } = useMinutes()
const { prayerConcerns } = usePrayerConcerns()
const { tasks: churchTasks } = useTasks()
const { pendingClaims } = useMemberClaims()
const { nextService } = useAllLineups()

const notifications = ref([])
let stopNotifications = null
onMounted(() => {
  stopNotifications = subscribeToNotifications((d) => (notifications.value = d))
})
onUnmounted(() => stopNotifications && stopNotifications())

/* ------------------------------------------------------------ date helpers */

const pad = (value) => String(value).padStart(2, '0')

// Built from local parts, never parsed from the string: `new Date('2026-08-01')`
// is UTC midnight, which is still July anywhere west of Greenwich.
const keyOf = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

const today = keyOf(new Date())
const weekEnd = (() => {
  const date = new Date()
  date.setDate(date.getDate() + 6)
  return keyOf(date)
})()

const dayLabel = (key, options) => {
  if (!key) return '—'
  const [year, month, day] = String(key).split('-').map(Number)
  if (!year || !month || !day) return String(key)
  return new Date(year, month - 1, day).toLocaleDateString(undefined, options)
}

const shortDate = (key) => dayLabel(key, { month: 'short', day: 'numeric' })

const timeLabel = (time) => {
  if (!time) return ''
  const [h, m] = String(time).split(':')
  const hour = Number(h)
  if (!Number.isFinite(hour)) return ''
  return `${hour % 12 === 0 ? 12 : hour % 12}:${m ?? '00'} ${hour >= 12 ? 'PM' : 'AM'}`
}

/* ---------------------------------------------------------------- metrics */

// What the person reading this still owes the church. Only their own: a
// dashboard that opened with everyone else's to-do list would be a page about
// other people, and the shared list is one tap away for that.
const myTaskId = computed(() => (myMember.value ? memberKey(myMember.value) : null))

const myOpenTasks = computed(() => {
  if (!can('tasks.view') || !myTaskId.value) return []
  return churchTasks.value.filter((task) => !task.done && isAssignedTo(task, myTaskId.value))
})

const myOverdueTasks = computed(() => myOpenTasks.value.filter((task) => isOverdue(task)))
const myTasksDueToday = computed(() => myOpenTasks.value.filter((task) => isDueToday(task)))

const openPrayers = computed(
  () => prayerConcerns.value.filter((c) => c.status !== 'answered').length
)
const answeredPrayers = computed(
  () => prayerConcerns.value.filter((c) => c.status === 'answered').length
)

// A gathering that has already happened and nobody has counted. Whether it has
// been counted is lib/attendance.js's question — a meeting's register lives on
// its minute, so "did this row come from the attendance collection" called
// every marked meeting unrecorded.
const unrecorded = computed(
  () =>
    aggregatedAttendance.value.filter(
      (row) =>
        !isRecorded(row) && !row.skipped && row.date && row.date < today && !isCalledOff(row)
    ).length
)

const thisWeek = computed(() =>
  calendarEvents.value
    .filter((e) => e.date >= today && e.date <= weekEnd)
    .sort(
      (a, b) =>
        String(a.date).localeCompare(String(b.date)) ||
        String(a.time || '').localeCompare(String(b.time || ''))
    )
    .slice(0, 6)
)

/**
 * What is waiting on the person reading this, and nothing else. The panel is
 * omitted entirely when the list is empty — a dashboard that always shows an
 * "all clear" card trains people to stop reading the space it occupies.
 */
const attentionItems = computed(() => {
  const items = []

  // Late first, then due today, never both: two lines about the same list
  // would crowd out everything else waiting on this person.
  if (myOverdueTasks.value.length) {
    const n = myOverdueTasks.value.length
    items.push({
      key: 'tasks-overdue',
      label: `${n} of your ${n === 1 ? 'task is' : 'tasks are'} overdue`,
      detail: myOverdueTasks.value.map((task) => task.title).slice(0, 2).join(' · '),
      to: '/tasks',
    })
  } else if (myTasksDueToday.value.length) {
    const n = myTasksDueToday.value.length
    items.push({
      key: 'tasks-today',
      label: `${n} of your ${n === 1 ? 'task is' : 'tasks are'} due today`,
      detail: myTasksDueToday.value.map((task) => task.title).slice(0, 2).join(' · '),
      to: '/tasks',
    })
  }

  if ((isAdmin.value || canManage('members')) && pendingClaims.value.length) {
    const n = pendingClaims.value.length
    items.push({
      key: 'claims',
      label: `${n} member link ${n === 1 ? 'request' : 'requests'} waiting`,
      detail: 'Approve or decline them under Accounts.',
      to: '/accounts',
    })
  }

  if (canManage('attendance') && unrecorded.value) {
    const n = unrecorded.value
    items.push({
      key: 'attendance',
      label: `${n} ${n === 1 ? 'gathering has' : 'gatherings have'} no attendance recorded`,
      detail: 'They stay on the list until someone records or dismisses them.',
      to: '/attendance',
    })
  }

  return items
})

/* ------------------------------------------------------ worship lineup */

// The one thing the team checks on a Saturday night: who is leading tomorrow
// and what is being sung. Planners see draft months too; everyone else waits
// for the schedule to be published.
const canSeeLineups = computed(() => can('lineups.view'))
const upcomingService = computed(() => nextService(canManage('lineups')))

const serviceLeader = computed(() => {
  const id = upcomingService.value?.leaderId
  if (!id) return null
  return (
    members.value.find(
      (m) => memberKey(m) === String(id) || String(m.firestoreId) === String(id)
    ) || null
  )
})

// Whether the signed-in member is on that service in any role — the reason a
// song leader, or an usher, opens the app on a Saturday night.
const isMyService = computed(() => {
  const service = upcomingService.value
  if (!service || !myMember.value) return false
  const me = new Set([memberKey(myMember.value), String(myMember.value.firestoreId)])
  return peopleOnService(service).some((id) => me.has(id))
})

/* --------------------------------------------------------- recent activity */

const latestAttendance = computed(
  () =>
    [...aggregatedAttendance.value]
      .filter((r) => isRecorded(r) && !r.skipped && r.date)
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))[0]
)
const latestMinutes = computed(
  () => [...minutes.value].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))[0]
)
const recentNotifications = computed(() => notifications.value.slice(0, 4))

const notifTime = (ts) =>
  ts?.toDate ? ts.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'just now'

const showActivityRow = computed(
  () => can('attendance.view') || can('minutes.view') || isAdmin.value
)

/** A share of the roster as a height inside the 84px track above. */
// Bars are already scaled against the busiest of them (useAttendanceStats), so
// the tallest fills the track and the rest read against it.
const barHeight = (width) => `${Math.max(3, Math.round((Number(width) || 0) * 0.84))}px`

// People, not percentage points: "nine more people than last month" is a
// sentence somebody can repeat out loud.
const reachDelta = computed(() => {
  const reach = attendance.value.reach
  if (!reach || reach.priorCount === null) return null
  return reach.count - reach.priorCount
})
</script>

<template>
  <div class="h-full overflow-y-auto">
    <div class="flex flex-col gap-4 pb-10">
      <!-- Headline metrics. Each is a rate or a window, never an all-time total. -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <!-- Attendance: the church health number, as a share of the roster -->
        <router-link
          v-if="can('attendance.view')"
          to="/attendance"
          class="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 hover:border-primary/40 transition-colors"
        >
          <div class="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-gray-400">
            <ClipboardCheck class="w-3.5 h-3.5 text-primary dark:text-primary-light" /> Attendance
          </div>
          <!-- How many different people we saw at all this month. A count
               rather than a share: it can be checked against the roster
               everybody already knows the size of. -->
          <div class="mt-1.5 flex items-baseline gap-1.5">
            <span class="text-2xl font-black text-gray-900 dark:text-white tabular-nums">
              {{ attendance.reach ? attendance.reach.count : '—' }}
            </span>
            <span
              v-if="reachDelta !== null && reachDelta !== 0"
              class="flex items-center gap-0.5 text-[11px] font-black tabular-nums"
              :class="reachDelta > 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-[#bc1c09] dark:text-red-400'"
            >
              <TrendingUp v-if="reachDelta > 0" class="w-3 h-3" />
              <TrendingDown v-else class="w-3 h-3" />
              {{ Math.abs(reachDelta) }}
            </span>
          </div>
          <div class="text-[11px] font-bold text-gray-400 truncate">
            {{
              attendance.reach
                ? `of ${rosterSize} people came in ${attendance.reach.monthLabel}`
                : 'nothing recorded yet'
            }}
          </div>
        </router-link>

        <!-- This week: the only event count anyone acts on -->
        <router-link
          v-if="can('events.view')"
          to="/events"
          class="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 hover:border-primary/40 transition-colors"
        >
          <div class="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-gray-400">
            <CalendarDays class="w-3.5 h-3.5 text-primary dark:text-primary-light" /> This week
          </div>
          <div class="mt-1.5 text-2xl font-black text-gray-900 dark:text-white tabular-nums">
            {{ eventStats.weekCount }}
          </div>
          <div class="text-[11px] font-bold text-gray-400 truncate">
            {{
              eventStats.weekCount
                ? `through ${eventStats.weekEndLabel}`
                : 'nothing scheduled'
            }}
          </div>
        </router-link>

        <!-- People -->
        <router-link
          v-if="can('members.view')"
          to="/members"
          class="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 hover:border-primary/40 transition-colors"
        >
          <div class="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-gray-400">
            <Users class="w-3.5 h-3.5 text-primary dark:text-primary-light" /> People
          </div>
          <div class="mt-1.5 text-2xl font-black text-gray-900 dark:text-white tabular-nums">
            {{ people.total }}
          </div>
          <div class="text-[11px] font-bold text-gray-400 truncate">
            {{ people.members }} member{{ people.members === 1 ? '' : 's' }} ·
            {{ people.attendees }} attendee{{ people.attendees === 1 ? '' : 's' }}
          </div>
        </router-link>

        <!-- Prayer: the open ones, not every concern ever raised -->
        <router-link
          v-if="can('prayer.view')"
          to="/prayer-concerns"
          class="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 hover:border-primary/40 transition-colors"
        >
          <div class="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-gray-400">
            <HeartHandshake class="w-3.5 h-3.5 text-primary dark:text-primary-light" /> Open prayers
          </div>
          <div class="mt-1.5 text-2xl font-black text-gray-900 dark:text-white tabular-nums">
            {{ openPrayers }}
          </div>
          <div class="text-[11px] font-bold text-gray-400 truncate">
            {{ answeredPrayers }} answered
          </div>
        </router-link>
      </div>

      <!-- Needs attention — rendered only when something actually does -->
      <div
        v-if="attentionItems.length"
        class="bg-white dark:bg-gray-800 rounded-2xl border border-amber-300/70 dark:border-amber-500/30 overflow-hidden"
      >
        <div class="flex items-center gap-2 px-5 pt-4 pb-2">
          <AlertCircle class="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          <h3 class="text-sm font-bold text-amber-700 dark:text-amber-400">Needs your attention</h3>
        </div>
        <router-link
          v-for="item in attentionItems"
          :key="item.key"
          :to="item.to"
          class="flex items-center gap-3 px-5 py-3 border-t border-gray-100 dark:border-gray-700/60 hover:bg-amber-50/60 dark:hover:bg-amber-900/10 transition-colors"
        >
          <div class="min-w-0 flex-1">
            <p class="text-sm font-bold text-gray-900 dark:text-white">{{ item.label }}</p>
            <p class="text-[11px] font-bold text-gray-400">{{ item.detail }}</p>
          </div>
          <ArrowRight class="w-4 h-4 shrink-0 text-gray-300 dark:text-gray-600" />
        </router-link>
      </div>

      <!-- Up next in worship -->
      <div
        v-if="canSeeLineups"
        class="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5"
      >
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-sm font-bold text-primary">Up next in worship</h3>
          <router-link
            :to="
              upcomingService
                ? { path: `/schedules/${upcomingService.month}`, query: { date: upcomingService.date } }
                : '/schedules'
            "
            class="text-xs font-bold text-gray-400 hover:text-primary transition-colors"
          >
            View schedule
          </router-link>
        </div>

        <template v-if="upcomingService">
          <div class="flex items-center gap-3">
            <MemberAvatar v-if="serviceLeader" :member="serviceLeader" alt="" size="h-10 w-10" />
            <div class="min-w-0">
              <p class="text-sm font-black text-gray-900 dark:text-white truncate">
                {{ serviceLeader ? getDisplayName(serviceLeader) : 'No leader assigned' }}
              </p>
              <p class="text-[11px] font-bold text-gray-400 truncate">
                {{ formatServiceDate(upcomingService.date)
                }}{{ upcomingService.theme ? ' · ' + upcomingService.theme : '' }}
              </p>
            </div>
            <span
              v-if="isMyService"
              class="ml-auto shrink-0 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-primary/10 text-primary dark:bg-primary-light/10 dark:text-primary-light"
            >
              You&rsquo;re on
            </span>
            <span
              v-else-if="upcomingService.status !== 'published'"
              class="ml-auto shrink-0 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400"
            >
              Draft
            </span>
          </div>

          <ol v-if="upcomingService.songs.length" class="mt-3 flex flex-col">
            <li
              v-for="(song, i) in upcomingService.songs"
              :key="`${song.songId}-${i}`"
              class="flex items-baseline gap-2 py-1.5 border-b border-gray-100 dark:border-gray-700/60 last:border-b-0"
            >
              <span class="shrink-0 w-4 text-[11px] font-black text-gray-300 dark:text-gray-600 tabular-nums">
                {{ i + 1 }}
              </span>
              <span class="min-w-0 flex-1 text-sm font-bold text-gray-700 dark:text-gray-200 truncate">
                {{ song.title }}
              </span>
              <span
                v-if="song.key"
                class="shrink-0 px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-[11px] font-black text-gray-700 dark:text-gray-200"
              >
                {{ song.key }}
              </span>
            </li>
          </ol>
          <p v-else class="mt-3 text-sm font-semibold text-gray-400">Songs not chosen yet</p>
        </template>

        <p v-else class="py-6 text-center text-sm font-semibold text-gray-400">
          No schedule published yet
        </p>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <!-- The week ahead, spelled out -->
        <div
          v-if="can('events.view')"
          class="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5"
        >
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-sm font-bold text-primary">The week ahead</h3>
            <router-link
              to="/events"
              class="text-xs font-bold text-gray-400 hover:text-primary transition-colors"
            >
              View calendar
            </router-link>
          </div>
          <div v-if="thisWeek.length" class="flex flex-col">
            <div
              v-for="e in thisWeek"
              :key="e.id"
              class="flex items-baseline gap-3 py-2 border-b border-gray-100 dark:border-gray-700/60 last:border-b-0"
            >
              <span class="shrink-0 w-14 text-[11px] font-black text-primary dark:text-primary-light tabular-nums">
                {{ e.date === today ? 'Today' : shortDate(e.date) }}
              </span>
              <span
                :class="[
                  'min-w-0 flex-1 text-sm font-bold truncate',
                  isCalledOff(e)
                    ? 'text-gray-400 line-through dark:text-gray-500'
                    : 'text-gray-900 dark:text-white',
                ]"
              >
                {{ e.title }}
              </span>
              <span
                v-if="isCalledOff(e)"
                class="shrink-0 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-black uppercase text-red-700 dark:bg-red-500/15 dark:text-red-300"
              >
                {{ eventStatusLabel(readEventStatus(e)) }}
              </span>
              <span
                v-else-if="timeLabel(e.time)"
                class="shrink-0 text-[11px] font-bold text-gray-400 tabular-nums"
              >
                {{ timeLabel(e.time) }}
              </span>
            </div>
          </div>
          <p v-else class="py-6 text-center text-sm font-semibold text-gray-400">
            Nothing on the calendar this week
          </p>
        </div>

        <!-- The shape behind the attendance number -->
        <div
          v-if="can('attendance.view')"
          class="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5"
        >
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-sm font-bold text-primary">Recent gatherings</h3>
            <span class="text-[11px] font-black uppercase tracking-widest text-gray-400">
              how many came
            </span>
          </div>
          <!-- Bar heights are computed in pixels rather than percentages: a
               percentage would have to resolve against a flex item with no
               definite height, which browsers disagree about. -->
          <div v-if="recentBars.length" class="flex items-end gap-1.5">
            <div
              v-for="bar in recentBars"
              :key="bar.key"
              class="flex-1 flex flex-col items-center gap-1 min-w-0"
              :title="`${bar.title} · ${bar.count} of ${bar.expected}`"
            >
              <span class="text-[10px] font-black text-gray-500 dark:text-gray-400 tabular-nums">
                {{ bar.count }}
              </span>
              <span class="w-full h-[84px] flex items-end rounded bg-gray-100 dark:bg-gray-700/40">
                <!-- The calendar's colour for that kind of gathering, so a
                     prayer meeting is never mistaken for a thin Sunday. -->
                <span
                  :class="['w-full rounded opacity-80', getEventTypeBar(bar.type)]"
                  :style="{ height: barHeight(bar.width) }"
                ></span>
              </span>
              <span class="text-[9px] font-bold text-gray-400 truncate w-full text-center">
                {{ bar.dateLabel }}
              </span>
            </div>
          </div>
          <p v-else class="py-6 text-center text-sm font-semibold text-gray-400">
            No gatherings recorded yet
          </p>
        </div>
      </div>

      <!-- Latest of each thing worth glancing at -->
      <div v-if="showActivityRow" class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div
          v-if="can('attendance.view')"
          class="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5"
        >
          <h3 class="text-sm font-bold text-primary mb-3">Latest attendance</h3>
          <template v-if="latestAttendance">
            <p class="text-sm font-black text-gray-900 dark:text-white truncate">
              {{ latestAttendance.eventTitle || 'Session' }}
            </p>
            <p class="text-[11px] font-bold text-gray-400 mt-1">
              {{ shortDate(latestAttendance.date) }} ·
              {{ latestAttendance.totalAttendees ?? latestAttendance.attendees?.length ?? 0 }} present
            </p>
          </template>
          <p v-else class="text-sm font-semibold text-gray-400 py-3">No sessions yet</p>
        </div>

        <div
          v-if="can('minutes.view')"
          class="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5"
        >
          <h3 class="text-sm font-bold text-primary mb-3">Latest minutes</h3>
          <template v-if="latestMinutes">
            <p class="text-sm font-black text-gray-900 dark:text-white truncate">
              {{ latestMinutes.title || 'Untitled' }}
            </p>
            <p class="text-[11px] font-bold text-gray-400 mt-1">
              {{ shortDate(latestMinutes.date) }}
              {{ latestMinutes.location ? '· ' + latestMinutes.location : '' }}
            </p>
          </template>
          <p v-else class="text-sm font-semibold text-gray-400 py-3">No minutes yet</p>
        </div>

        <div
          v-if="isAdmin"
          class="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5"
        >
          <h3 class="text-sm font-bold text-primary mb-3">Recent notifications</h3>
          <div v-if="recentNotifications.length" class="flex flex-col gap-2">
            <div v-for="n in recentNotifications" :key="n.id" class="min-w-0">
              <p class="text-sm font-bold text-gray-900 dark:text-white truncate">{{ n.title }}</p>
              <p class="text-[11px] font-bold text-gray-400">{{ notifTime(n.sentAt) }}</p>
            </div>
          </div>
          <p v-else class="text-sm font-semibold text-gray-400 py-3">Nothing sent yet</p>
        </div>
      </div>
    </div>
  </div>
</template>

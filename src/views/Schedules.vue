<script setup>
/**
 * Who is serving each Sunday of the month, and what is being sung.
 *
 * This was the worship lineup: a song leader, a band, the songs. But the same
 * Sunday also needs ushers, a preacher, Sunday school teachers and WLA coaches,
 * and those were being arranged on paper and in group chats beside it. So a
 * service now carries the church's own list of roles, with the worship team as
 * two of them and the songs still attached.
 *
 * The shape of the page did not change, because the reasons for it did not:
 * nobody's visit is about a month. Somebody arrives to staff the next service,
 * or to find out when they are on. So one service is open and the rest of the
 * month is a line each, with past services folded away.
 *
 * "When am I on" is now asked by a lot more people than the song leaders, and
 * the answer can be in any month — so the search bar reaches across every
 * schedule on file rather than the one on screen.
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  FileText,
  ListChecks,
  SearchX,
} from '../icons'
import { useAllLineups, useLineup, isSundayPlanned } from '../composables/useLineups'
import { useMembers } from '../composables/useMembers'
import { usePermissions } from '../composables/usePermissions'
import { useAppSettings } from '../composables/useAppSettings'
import { useToast } from '../composables/useToast'
import { subscribeToSongs } from '../api/songsService'
import {
  formatMonthLabel,
  formatServiceDate,
  isValidMonthKey,
  monthKeyOf,
  scheduleMatches,
  servingLoad,
  shiftMonth,
  todayIso,
} from '../utils/lineupUtils'
import { assignmentsOf } from '../data/scheduleRoles'
import { memberKey } from '../utils/sgUtils'
import { copyText } from '../utils/clipboard'
import { formatLyricsSheet, songLyricsText } from '../utils/songUtils'
import ScheduleServicePanel from '../components/schedules/ScheduleServicePanel.vue'
import ScheduleServiceRow from '../components/schedules/ScheduleServiceRow.vue'
import ScheduleEditorDrawer from '../components/schedules/ScheduleEditorDrawer.vue'
import ScheduleRolesSheet from '../components/schedules/ScheduleRolesSheet.vue'
import ScheduleRosterSheet from '../components/schedules/ScheduleRosterSheet.vue'
import SchedulesFab from '../components/schedules/SchedulesFab.vue'
import SchedulesToolbar from '../components/schedules/SchedulesToolbar.vue'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const { canManage, isAdmin, myMember } = usePermissions()
const { members } = useMembers()
const { scheduleRoles: roles } = useAppSettings()

// One permission for the whole page: whoever is granted Schedules in Settings
// plans it, people and songs alike, and administrators bypass the check
// entirely. There is deliberately no second tier — being on the rota this week
// is not a permission, it is just which Sunday is yours. The capability keeps
// its old `lineups` key because that is what the grants already on file say.
const canPlan = computed(() => canManage('lineups'))

// Which jobs a Sunday has is the church's structure rather than one month's
// plan, so shaping it is an administrator's call.
const canEditRoles = computed(() => isAdmin.value)

/**
 * The roles this account holds on a given service.
 *
 * Used only to decide what the page shows and where it opens — never what
 * anyone is allowed to change. Being on a Sunday earns a better view of that
 * Sunday, not more rights than the rest of the team.
 */
const myRolesOn = (sunday) => {
  const mine = myMember.value
  if (!mine || !sunday) return []
  const ids = new Set([memberKey(mine), String(mine.firestoreId)])
  const assignments = assignmentsOf(sunday)
  return roles.value.filter((role) => (assignments[role.id] || []).some((id) => ids.has(id)))
}
const isMyService = (sunday) => myRolesOn(sunday).length > 0

// The month lives in the URL so a schedule can be linked to and shared.
const month = computed(() =>
  isValidMonthKey(route.params.month) ? route.params.month : monthKeyOf()
)

const goToMonth = (key) => router.replace(`/schedules/${key}`)

const { loading, sundays, isPublished, saveSunday, clearSunday, setStatus } = useLineup(month)

// Songs are read straight from the song list, so a schedule always offers what
// the church currently sings.
const songs = ref([])
let unsubscribeSongs = null
onMounted(() => {
  unsubscribeSongs = subscribeToSongs((data) => {
    songs.value = data
  })
})
onUnmounted(() => unsubscribeSongs?.())

/** A draft is the planners' workspace; everyone else sees it as unpublished. */
const isHiddenDraft = computed(() => !isPublished.value && !canPlan.value)

const plannedCount = computed(() => sundays.value.filter(isSundayPlanned).length)

/* -------------------------------------------------------------------------
 * Which service is open
 * ---------------------------------------------------------------------- */

const upcoming = computed(() => sundays.value.filter((s) => s.date >= todayIso()))
const past = computed(() => sundays.value.filter((s) => s.date < todayIso()).reverse())

// A search result links here with ?date=, so the Sunday it found is the one
// that opens.
const focusedDate = ref(String(route.query.date || ''))

/**
 * What to open on arrival, in order of what the visitor most likely came for:
 * the next service they are on themselves, then simply the next service, then
 * the most recent one if the month is already over.
 */
const defaultFocus = computed(() => {
  const mineUpcoming = upcoming.value.find(isMyService)
  if (mineUpcoming) return mineUpcoming.date
  if (upcoming.value.length) return upcoming.value[0].date
  return past.value[0]?.date || ''
})

watch(
  [sundays, defaultFocus, loading],
  () => {
    // Not while the month is still arriving: a date stored off a Sunday is not
    // in the list until the document is, and would be replaced too early.
    if (loading.value) return
    // Only choose for them while nothing is chosen, or when paging to a month
    // that does not contain the open service.
    const stillHere = sundays.value.some((s) => s.date === focusedDate.value)
    if (!stillHere) focusedDate.value = defaultFocus.value
  },
  { immediate: true }
)

watch(
  () => route.query.date,
  (date) => {
    if (date) focusedDate.value = String(date)
  }
)

const focused = computed(() => sundays.value.find((s) => s.date === focusedDate.value) || null)

/** The other services still to come — the ones worth a row. */
const otherUpcoming = computed(() => upcoming.value.filter((s) => s.date !== focusedDate.value))
const otherPast = computed(() => past.value.filter((s) => s.date !== focusedDate.value))

const showPast = ref(false)

const focus = (date) => {
  focusedDate.value = date
  // Opening a service from the past list should not then hide it again.
  if (date < todayIso()) showPast.value = true
}

/* -------------------------------------------------------------------------
 * Search
 * Across every month on file, not the one on screen. A month is one document
 * and a year is twelve, so reading them all is cheap — and the question being
 * asked ("when am I next on", "who is preaching at Christmas") rarely stays
 * inside the month that happens to be open.
 * ---------------------------------------------------------------------- */

const { lineups: allMonths } = useAllLineups()
const searchOpen = ref(false)
const searchQuery = ref('')

const openSearch = () => {
  searchOpen.value = true
}
const closeSearch = () => {
  searchOpen.value = false
  searchQuery.value = ''
}

const searching = computed(() => searchOpen.value && searchQuery.value.trim().length > 0)

const searchResults = computed(() => {
  if (!searching.value) return { upcoming: [], past: [] }
  const today = todayIso()
  const rows = allMonths.value
    // Drafts stay the planners' own here too.
    .filter((m) => canPlan.value || m.status === 'published')
    .flatMap((m) => m.sundays.map((sunday) => ({ sunday, month: m.month })))
    .filter(({ sunday }) => sunday.date && isSundayPlanned(sunday))
    .map((row) => ({
      ...row,
      matches: scheduleMatches(row.sunday, searchQuery.value, roles.value, members.value),
    }))
    .filter((row) => row.matches)
  return {
    upcoming: rows
      .filter((r) => r.sunday.date >= today)
      .sort((a, b) => a.sunday.date.localeCompare(b.sunday.date)),
    // Most recent first: last month's answer is worth more than last year's.
    past: rows
      .filter((r) => r.sunday.date < today)
      .sort((a, b) => b.sunday.date.localeCompare(a.sunday.date)),
  }
})

const resultCount = computed(
  () => searchResults.value.upcoming.length + searchResults.value.past.length
)

const openResult = (row) => {
  closeSearch()
  router.replace({ path: `/schedules/${row.month}`, query: { date: row.sunday.date } })
  focusedDate.value = row.sunday.date
}

/* -------------------------------------------------------------------------
 * Sheets opened from the floating button
 * ---------------------------------------------------------------------- */

const showRoster = ref(false)
const showRoles = ref(false)

const roster = computed(() => servingLoad(sundays.value, members.value, roles.value))

/* -------------------------------------------------------------------------
 * Editing
 * In a drawer rather than on the panel. Reading a month and changing one
 * service are different jobs: the panel is laid out to be read, and the drawer
 * gives the editing a screen of its own, with room for the pickers, then closes
 * and gets out of the way.
 * ---------------------------------------------------------------------- */

const showEditor = ref(false)
const editingSunday = ref(null)
const saving = ref(false)

const openEditor = (sunday) => {
  if (!canPlan.value) return
  editingSunday.value = sunday
  showEditor.value = true
}

const handleSave = async (sunday) => {
  saving.value = true
  try {
    await saveSunday(sunday)
    showEditor.value = false
    toast.success('Service saved')
  } catch (error) {
    console.error('Error saving schedule service:', error)
    toast.error('Could not save the service. Please try again.')
  } finally {
    saving.value = false
  }
}

const handleClear = async (date) => {
  saving.value = true
  try {
    await clearSunday(date)
    showEditor.value = false
    toast.success('Service cleared')
  } catch (error) {
    console.error('Error clearing schedule service:', error)
    toast.error('Could not clear the service.')
  } finally {
    saving.value = false
  }
}

const togglePublished = async () => {
  // Read the target once: the snapshot may land before the toast is composed.
  const next = isPublished.value ? 'draft' : 'published'
  try {
    await setStatus(next)
    toast.success(next === 'published' ? 'Schedule published' : 'Schedule unpublished')
  } catch (error) {
    console.error('Error changing schedule status:', error)
    toast.error('Could not change the status.')
  }
}

/* -------------------------------------------------------------------------
 * Lyrics for the tech team
 * The words live on the song, so a service sheet is assembled on the fly from
 * whatever the schedule currently points at — rename or re-key a song and the
 * next copy is already right. The schedule's own key wins over the song's,
 * because that is the key this Sunday is actually sung in.
 * ---------------------------------------------------------------------- */
const lyricsCopiedDate = ref(null)

const copySundayLyrics = async (sunday) => {
  const entries = (sunday.songs || []).map((item) => {
    const song = songs.value.find((s) => s.id === item.songId)
    return {
      title: item.title || song?.title || 'Untitled',
      key: item.key || '',
      lyrics: song?.lyrics || '',
    }
  })

  if (!entries.length) {
    toast.warning('No songs picked for this service yet.')
    return
  }

  const heading = [formatServiceDate(sunday.date), sunday.theme].filter(Boolean).join(' — ')
  if (!(await copyText(formatLyricsSheet(entries, heading)))) {
    toast.error('Could not copy the lyrics.')
    return
  }

  lyricsCopiedDate.value = sunday.date
  setTimeout(() => {
    if (lyricsCopiedDate.value === sunday.date) lyricsCopiedDate.value = null
  }, 2000)

  const missing = entries.filter((entry) => !songLyricsText(entry)).length
  if (missing) {
    toast.warning(`Lyrics copied — ${missing} song${missing > 1 ? 's have' : ' has'} none saved yet.`)
  } else {
    toast.success(`Lyrics copied — ${entries.length} song${entries.length > 1 ? 's' : ''}`)
  }
}
</script>

<template>
  <div class="relative flex h-full">
    <div class="mx-auto flex h-full min-w-0 max-w-2xl flex-1 flex-col">
      <SchedulesToolbar
        :search-query="searchQuery"
        :open="searchOpen"
        :result-count="resultCount"
        @update:search-query="searchQuery = $event"
        @close="closeSearch"
      />

      <!-- Month navigator. Publishing stays up here rather than in the
           floating menu: it is a state as much as an action, and a state you
           cannot see is one you re-open a menu just to check. -->
      <div v-if="!searching" class="flex shrink-0 items-center gap-1 pb-3">
        <button
          @click="goToMonth(shiftMonth(month, -1))"
          class="shrink-0 rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
          aria-label="Previous month"
        >
          <ChevronLeft class="h-5 w-5" />
        </button>

        <button
          @click="goToMonth(monthKeyOf())"
          class="min-w-0 flex-1 text-center"
          :title="month === monthKeyOf() ? 'Current month' : 'Back to this month'"
        >
          <span class="block truncate text-base font-bold text-gray-900 dark:text-white sm:text-lg">
            {{ formatMonthLabel(month) }}
          </span>
          <span
            v-if="month !== monthKeyOf()"
            class="block text-[11px] font-semibold text-primary dark:text-primary-light"
          >
            Back to this month
          </span>
        </button>

        <button
          @click="goToMonth(shiftMonth(month, 1))"
          class="shrink-0 rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
          aria-label="Next month"
        >
          <ChevronRight class="h-5 w-5" />
        </button>

        <button
          v-if="canPlan"
          @click="togglePublished"
          :aria-label="isPublished ? 'Published — tap to unpublish' : 'Draft — tap to publish'"
          :class="[
            'inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-bold transition-colors',
            isPublished
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
              : 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
          ]"
        >
          <component :is="isPublished ? Eye : EyeOff" class="h-4 w-4" />
          {{ isPublished ? 'Published' : 'Draft' }}
        </button>
      </div>

      <!-- pb-20 keeps the last row clear of the floating button. -->
      <div class="custom-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto pb-20">
        <!-- ============ Search results, across every month ============ -->
        <template v-if="searching">
          <div v-if="!resultCount" class="px-6 py-16 text-center">
            <SearchX class="mx-auto mb-3 h-10 w-10 text-gray-300 dark:text-gray-600" />
            <p class="text-sm font-medium text-gray-600 dark:text-gray-300">
              No service matches that.
            </p>
            <p class="mx-auto mt-1 max-w-xs text-xs text-gray-400 dark:text-gray-500">
              Try a first name, a role like &ldquo;ushers&rdquo;, or a song title.
            </p>
          </div>

          <div v-if="searchResults.upcoming.length" class="space-y-0.5">
            <p class="px-1 pb-0.5 text-[11px] font-bold uppercase tracking-wide text-gray-400">
              Coming up
            </p>
            <ScheduleServiceRow
              v-for="row in searchResults.upcoming"
              :key="row.sunday.date"
              :sunday="row.sunday"
              :members="members"
              :matches="row.matches"
              :is-mine="isMyService(row.sunday)"
              show-month
              @focus="openResult(row)"
            />
          </div>

          <div v-if="searchResults.past.length" class="space-y-0.5 pt-1">
            <p class="px-1 pb-0.5 text-[11px] font-bold uppercase tracking-wide text-gray-400">
              Earlier
            </p>
            <ScheduleServiceRow
              v-for="row in searchResults.past"
              :key="row.sunday.date"
              :sunday="row.sunday"
              :members="members"
              :matches="row.matches"
              is-past
              show-month
              @focus="openResult(row)"
            />
          </div>
        </template>

        <!-- ============ The month ============ -->
        <template v-else>
          <!-- Loading -->
          <div v-if="loading" class="space-y-3">
            <div class="h-64 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
            <div
              v-for="i in 3"
              :key="i"
              class="h-14 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800"
            />
          </div>

          <!-- Nothing to show a non-planner while the month is still a draft -->
          <div v-else-if="isHiddenDraft" class="p-8 text-center text-gray-500 dark:text-gray-400">
            <EyeOff class="mx-auto mb-4 h-12 w-12 text-gray-300 dark:text-gray-600" />
            <p class="font-medium text-gray-700 dark:text-gray-300">Not published yet</p>
            <p class="mt-1 text-sm">
              The schedule for {{ formatMonthLabel(month) }} is still being put together.
            </p>
          </div>

          <template v-else>
            <!-- Nothing at all, and nobody able to fix it here -->
            <div
              v-if="!canPlan && plannedCount === 0"
              class="p-8 text-center text-gray-500 dark:text-gray-400"
            >
              <ListChecks class="mx-auto mb-4 h-12 w-12 text-gray-300 dark:text-gray-600" />
              Nobody has been scheduled for this month yet.
            </div>

            <template v-else>
              <!-- The service you came for -->
              <template v-if="focused">
                <ScheduleServicePanel
                  :sunday="focused"
                  :members="members"
                  :roles="roles"
                  :can-edit="canPlan"
                  :my-roles="myRolesOn(focused)"
                  :is-next="focused.date === upcoming[0]?.date"
                  :is-past="focused.date < todayIso()"
                  @edit="openEditor"
                />

                <!-- Tech grabs the whole service's words in one go, in order. -->
                <div v-if="focused.songs?.length" class="flex justify-end">
                  <button
                    type="button"
                    @click="copySundayLyrics(focused)"
                    class="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-bold text-gray-500 transition-colors hover:bg-gray-100 hover:text-primary dark:text-gray-400 dark:hover:bg-gray-700"
                  >
                    <Check
                      v-if="lyricsCopiedDate === focused.date"
                      class="h-3.5 w-3.5 text-emerald-500"
                    />
                    <FileText v-else class="h-3.5 w-3.5" />
                    {{ lyricsCopiedDate === focused.date ? 'Lyrics copied' : 'Copy lyrics' }}
                  </button>
                </div>
              </template>

              <!-- The rest of the month, a line each -->
              <div v-if="otherUpcoming.length" class="space-y-0.5 pt-1">
                <p class="px-1 pb-0.5 text-[11px] font-bold uppercase tracking-wide text-gray-400">
                  Rest of the month
                </p>
                <ScheduleServiceRow
                  v-for="sunday in otherUpcoming"
                  :key="sunday.date"
                  :sunday="sunday"
                  :members="members"
                  :is-mine="isMyService(sunday)"
                  :show-gaps="canPlan"
                  @focus="focus"
                />
              </div>

              <!-- Services already run. Folded away: mid-month they were
                   costing half the scroll for Sundays nobody can change. -->
              <div v-if="otherPast.length" class="pt-1">
                <button
                  @click="showPast = !showPast"
                  class="flex w-full items-center gap-1 rounded-lg px-1 py-1.5 text-[11px] font-bold uppercase tracking-wide text-gray-400 transition-colors hover:text-primary"
                >
                  <ChevronDown
                    :class="[
                      'h-3.5 w-3.5 transition-transform',
                      showPast ? 'rotate-180' : '-rotate-90',
                    ]"
                  />
                  Past services ({{ otherPast.length }})
                </button>
                <div v-if="showPast" class="space-y-0.5">
                  <ScheduleServiceRow
                    v-for="sunday in otherPast"
                    :key="sunday.date"
                    :sunday="sunday"
                    :members="members"
                    :is-mine="isMyService(sunday)"
                    is-past
                    @focus="focus"
                  />
                </div>
              </div>
            </template>
          </template>
        </template>
      </div>
    </div>

    <ScheduleEditorDrawer
      v-model:show="showEditor"
      :sunday="editingSunday"
      :members="members"
      :songs="songs"
      :roles="roles"
      :saving="saving"
      @save="handleSave"
      @clear="handleClear"
    />

    <SchedulesFab
      v-if="!showEditor"
      :can-plan="canPlan"
      :can-edit-roles="canEditRoles"
      @search="openSearch"
      @roster="showRoster = true"
      @roles="showRoles = true"
      @present="router.push('/present')"
    />

    <ScheduleRosterSheet
      :show="showRoster"
      :rows="roster"
      :sunday-count="sundays.length"
      :month-label="formatMonthLabel(month)"
      @close="showRoster = false"
    />

    <ScheduleRolesSheet :show="showRoles" @close="showRoles = false" />
  </div>
</template>

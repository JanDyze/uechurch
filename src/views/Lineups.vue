<script setup>
/**
 * The month's worship plan, built around one service at a time.
 *
 * This page was a scrolling stack of fully expanded Sunday cards. Nobody's
 * visit is about a month, though: the worship ministry head arrives to staff
 * the next service, and a song leader arrives to plan hers. Both had to scroll
 * past three irrelevant services to reach the one they came for, and each card
 * carried a leader, a theme, five songs with keys, a band of ten and a note —
 * the densest possible presentation of the least urgent information.
 *
 * So one service is open and editable, and the rest of the month is a line
 * each. Past services fold away entirely; mid-month they were costing half the
 * scroll for services already run.
 *
 * The two jobs are still split the way they were: the head sets who serves,
 * the named leader plans the songs. What changed is that neither now needs a
 * drawer or a Save button to do it.
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
  Mic2,
  Users,
  Play,
} from '../icons'
import { useLineup, isSundayPlanned } from '../composables/useLineups'
import { useMembers } from '../composables/useMembers'
import { usePermissions } from '../composables/usePermissions'
import { useToast } from '../composables/useToast'
import { subscribeToSongs } from '../api/songsService'
import { getAvatarUrl } from '../utils/memberUtils'
import {
  formatMonthLabel,
  formatServiceDate,
  isValidMonthKey,
  monthKeyOf,
  bandLoad,
  leaderLoad,
  shiftMonth,
  todayIso,
} from '../utils/lineupUtils'
import { memberKey } from '../utils/sgUtils'
import { copyText } from '../utils/clipboard'
import { formatLyricsSheet, songLyricsText } from '../utils/songUtils'
import LineupServicePanel from '../components/lineups/LineupServicePanel.vue'
import LineupServiceRow from '../components/lineups/LineupServiceRow.vue'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const { canManage, myMember } = usePermissions()
const { members } = useMembers()

// Two jobs on one page, and they belong to two different people.
//
// The worship ministry head decides who serves: who leads a Sunday and who is
// on the band with them. That is the whole month's shape and it is theirs.
//
// The leader of a given Sunday then chooses that Sunday's songs. She does not
// need — and should not have — the run of the month to do it, so being named as
// its leader is what grants it. She can see the band she is playing with, and
// cannot change it.
const canPlan = computed(() => canManage('lineups'))

/** Whether this account is the person leading a given service. */
const isMyService = (sunday) => {
  const mine = myMember.value
  if (!mine || !sunday?.leaderId) return false
  const id = String(sunday.leaderId)
  return memberKey(mine) === id || String(mine.firestoreId) === id
}

const canEditSongs = (sunday) => canPlan.value || isMyService(sunday)

// The month lives in the URL so a lineup can be linked to and shared.
const month = computed(() =>
  isValidMonthKey(route.params.month) ? route.params.month : monthKeyOf()
)

const goToMonth = (key) => router.replace(`/lineups/${key}`)

const {
  loading,
  sundays,
  isPublished,
  saveSunday,
  clearSunday,
  setStatus,
} = useLineup(month)

// Songs are read straight from the song list, so a lineup always offers what
// the church currently sings.
const songs = ref([])
let unsubscribeSongs = null
onMounted(() => {
  unsubscribeSongs = subscribeToSongs((data) => {
    songs.value = data
  })
})

/** The services this account is leading this month. */
const myServices = computed(() => sundays.value.filter(isMyService))

/**
 * A draft is the planners' workspace; everyone else sees it as unpublished.
 *
 * Except a leader who has been given a service in it. The head staffs the
 * month first and publishes it once it is settled, which would otherwise leave
 * the leaders unable to choose their songs until the congregation could already
 * read the lineup. Being named on a service is what lets her in early — the
 * same thing that lets her edit it.
 */
const isHiddenDraft = computed(
  () => !isPublished.value && !canPlan.value && !myServices.value.length
)

const plannedCount = computed(() => sundays.value.filter(isSundayPlanned).length)

/** Sundays with nobody leading them — the head's outstanding work. */
const unassignedCount = computed(
  () => sundays.value.filter((s) => !s.leaderId && s.date >= todayIso()).length
)

const load = computed(() => leaderLoad(sundays.value, members.value))
// A lineup is a roster as much as a set list, so the month has to answer
// "who is playing how often" and not only "who is leading how often".
const band = computed(() => bandLoad(sundays.value, members.value))

// The fairness check matters to whoever is assigning, and to nobody else every
// time they open the page. It was two wrapped rows of a dozen chips; now it is
// a line you can open.
const showRoster = ref(false)

/* -------------------------------------------------------------------------
 * Which service is open
 * ---------------------------------------------------------------------- */

const upcoming = computed(() => sundays.value.filter((s) => s.date >= todayIso()))
const past = computed(() => sundays.value.filter((s) => s.date < todayIso()).reverse())

const focusedDate = ref('')

/**
 * What to open on arrival, in order of what the visitor most likely came for:
 * the next service they are leading themselves, then simply the next service,
 * then the most recent one if the month is already over.
 */
const defaultFocus = computed(() => {
  const mineUpcoming = myServices.value.find((s) => s.date >= todayIso())
  if (mineUpcoming) return mineUpcoming.date
  if (upcoming.value.length) return upcoming.value[0].date
  return past.value[0]?.date || ''
})

watch(
  [sundays, defaultFocus],
  () => {
    // Only choose for them while nothing is chosen, or when paging to a month
    // that does not contain the open service.
    const stillHere = sundays.value.some((s) => s.date === focusedDate.value)
    if (!stillHere) focusedDate.value = defaultFocus.value
  },
  { immediate: true }
)

const focused = computed(
  () => sundays.value.find((s) => s.date === focusedDate.value) || null
)

/** The other services still to come — the ones worth a row. */
const otherUpcoming = computed(() => upcoming.value.filter((s) => s.date !== focusedDate.value))
const otherPast = computed(() => past.value.filter((s) => s.date !== focusedDate.value))

const showPast = ref(false)

/**
 * Forces the open panel to rebuild.
 *
 * The panel keeps a local copy of the service and deliberately does not
 * re-seed when the same date changes underneath — that change is usually its
 * own edit coming back, and replacing the form would move the cursor out of
 * whatever is being typed. Clearing a service is the exception: the date does
 * not change but everything in it just went, and without this the panel would
 * go on showing the songs it no longer has.
 */
const panelNonce = ref(0)

const focus = (date) => {
  focusedDate.value = date
  // Opening a service from the past list should not then hide it again.
  if (date < todayIso()) showPast.value = true
}

/* -------------------------------------------------------------------------
 * Saving
 * The panel has no Save button. Edits arrive here as they are made and are
 * written a beat later, the way the presenter's run sheet works — a Sunday
 * morning is no time to remember to press something.
 * ---------------------------------------------------------------------- */

const saving = ref(false)

/** What is stored, as a string, so a write that would change nothing is not
 *  sent — including this page's own write arriving back from Firestore. */
const signatureOf = (sunday) => JSON.stringify(sunday || null)

let savedSignature = ''
let saveTimer = null
/** The edit waiting to be written, held out of `sundays` so the panel is never
 *  re-seeded from a half-typed value. */
let pending = null

const persistNow = async () => {
  const edited = pending
  if (!edited) return

  // A leader writes back only what is hers to write, merged onto what is
  // stored right now — so saving her songs cannot overwrite a band the head
  // reassigned while her panel sat open.
  const live = sundays.value.find((s) => s.date === edited.date) || edited
  const next = canPlan.value
    ? edited
    : { ...live, songs: edited.songs, theme: edited.theme, notes: edited.notes }

  const signature = signatureOf(next)
  if (signature === savedSignature) {
    pending = null
    return
  }

  saving.value = true
  try {
    await saveSunday(next)
    savedSignature = signature
    pending = null
  } catch (error) {
    // Left pending on purpose: the next edit retries the whole service rather
    // than leaving a gap in it.
    console.error('Error saving lineup service:', error)
    toast.error('Could not save. Your next change will try again.')
  } finally {
    saving.value = false
  }
}

/**
 * Called by the panel on every change.
 *
 * Debounced hard enough to cover typing a theme or a key, which would
 * otherwise be a write per keystroke.
 */
const onPanelChange = (edited) => {
  if (!canEditSongs(edited)) return
  pending = edited
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveTimer = null
    persistNow()
  }, 800)
}

// Switching service or leaving the page must not drop what was just typed.
watch(focusedDate, () => {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
    persistNow()
  }
  savedSignature = ''
})

onUnmounted(() => {
  if (saveTimer) {
    clearTimeout(saveTimer)
    persistNow()
  }
  unsubscribeSongs?.()
})

const handleClear = async (date) => {
  clearTimeout(saveTimer)
  saveTimer = null
  pending = null
  saving.value = true
  try {
    await clearSunday(date)
    savedSignature = ''
    panelNonce.value += 1
    toast.success('Service cleared')
  } catch (error) {
    console.error('Error clearing lineup service:', error)
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
    toast.success(next === 'published' ? 'Lineup published to the team' : 'Lineup unpublished')
  } catch (error) {
    console.error('Error changing lineup status:', error)
    toast.error('Could not change the status.')
  }
}

/* -------------------------------------------------------------------------
 * Lyrics for the tech team
 * The words live on the song, so a service sheet is assembled on the fly from
 * whatever the lineup currently points at — rename or re-key a song and the
 * next copy is already right. The lineup's own key wins over the song's,
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
  <div class="mx-auto flex h-full max-w-2xl flex-col">
    <!-- Month navigator -->
    <div class="flex shrink-0 items-center gap-1 pb-3">
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

      <!-- Into the tech booth. Viewing is enough: presenting shows what the
           worship team planned, it does not change it. -->
      <button
        @click="router.push('/present')"
        class="shrink-0 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-bold text-primary transition-colors hover:bg-primary/10"
        title="Open the presenter"
      >
        <Play class="h-4 w-4" />
        <span class="hidden sm:inline">Present</span>
      </button>

      <button
        v-if="canPlan"
        @click="togglePublished"
        :class="[
          'shrink-0 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-bold transition-colors',
          isPublished
            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
            : 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
        ]"
      >
        <component :is="isPublished ? Eye : EyeOff" class="h-4 w-4" />
        <span class="hidden sm:inline">{{ isPublished ? 'Published' : 'Draft' }}</span>
      </button>
    </div>

    <div class="custom-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto pb-4">
      <!-- Loading -->
      <div v-if="loading" class="space-y-3">
        <div class="h-64 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
        <div v-for="i in 3" :key="i" class="h-14 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
      </div>

      <!-- Nothing to show a non-planner while the month is still a draft -->
      <div v-else-if="isHiddenDraft" class="p-8 text-center text-gray-500 dark:text-gray-400">
        <EyeOff class="mx-auto mb-4 h-12 w-12 text-gray-300 dark:text-gray-600" />
        <p class="font-medium text-gray-700 dark:text-gray-300">Not published yet</p>
        <p class="mt-1 text-sm">
          The worship team is still putting {{ formatMonthLabel(month) }} together.
        </p>
      </div>

      <template v-else>
        <!-- One line about the month, addressed to whoever is reading: the head
             is short of leaders, a leader is looking for her own Sundays. The
             roster behind it is the fairness check, which matters when
             assigning and not on every visit. -->
        <div class="rounded-xl bg-gray-50 px-3 py-2 dark:bg-gray-800/60">
          <div class="flex items-center justify-between gap-2">
            <p class="min-w-0 truncate text-xs font-semibold text-gray-600 dark:text-gray-300">
              {{ plannedCount }} of {{ sundays.length }} planned
              <template v-if="canPlan && unassignedCount">
                <span class="text-amber-600 dark:text-amber-400">
                  · {{ unassignedCount }} still
                  {{ unassignedCount === 1 ? 'needs a leader' : 'need a leader' }}
                </span>
              </template>
              <template v-else-if="myServices.length">
                <span class="text-primary dark:text-primary-light">
                  · you&rsquo;re leading {{ myServices.length }}
                </span>
              </template>
            </p>
            <button
              v-if="load.length || band.length"
              @click="showRoster = !showRoster"
              class="flex shrink-0 items-center gap-0.5 text-[11px] font-bold text-gray-400 transition-colors hover:text-primary"
            >
              Roster
              <ChevronDown :class="['h-3.5 w-3.5 transition-transform', showRoster ? 'rotate-180' : '']" />
            </button>
          </div>

          <div v-if="showRoster" class="mt-2 space-y-2 border-t border-gray-200 pt-2 dark:border-gray-700">
            <div v-if="load.length">
              <p class="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-gray-400">
                <Mic2 class="h-3 w-3" /> Leading
              </p>
              <div class="flex flex-wrap gap-1">
                <span
                  v-for="row in load"
                  :key="row.id"
                  class="inline-flex items-center gap-1 rounded-full bg-primary/10 py-0.5 pl-0.5 pr-2 text-[11px] font-medium text-gray-700 dark:text-gray-200"
                >
                  <img v-if="row.member" :src="getAvatarUrl(row.member)" alt="" class="h-4 w-4 rounded-full object-cover" />
                  {{ row.name }}
                  <span class="text-gray-400">×{{ row.count }}</span>
                </span>
              </div>
            </div>

            <div v-if="band.length">
              <p class="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-gray-400">
                <Users class="h-3 w-3" /> On the band
              </p>
              <div class="flex flex-wrap gap-1">
                <span
                  v-for="row in band"
                  :key="row.id"
                  class="inline-flex items-center gap-1 rounded-full bg-gray-100 py-0.5 pl-0.5 pr-2 text-[11px] font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-200"
                >
                  <img v-if="row.member" :src="getAvatarUrl(row.member)" alt="" class="h-4 w-4 rounded-full object-cover" />
                  {{ row.name }}
                  <span class="text-gray-400">×{{ row.count }}</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- The service you came for -->
        <template v-if="focused">
          <LineupServicePanel
            :key="`${focused.date}-${panelNonce}`"
            :sunday="focused"
            :members="members"
            :songs="songs"
            :can-edit-roster="canPlan"
            :can-edit-songs="canEditSongs(focused)"
            :is-mine="isMyService(focused)"
            :is-next="focused.date === upcoming[0]?.date"
            :is-past="focused.date < todayIso()"
            :saving="saving"
            @change="onPanelChange"
            @clear="handleClear"
          />

          <!-- Tech grabs the whole service's words in one go, in service order. -->
          <div v-if="focused.songs?.length" class="flex justify-end">
            <button
              type="button"
              @click="copySundayLyrics(focused)"
              class="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-bold text-gray-500 transition-colors hover:bg-gray-100 hover:text-primary dark:text-gray-400 dark:hover:bg-gray-700"
            >
              <Check v-if="lyricsCopiedDate === focused.date" class="h-3.5 w-3.5 text-emerald-500" />
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
          <LineupServiceRow
            v-for="sunday in otherUpcoming"
            :key="sunday.date"
            :sunday="sunday"
            :members="members"
            :is-mine="isMyService(sunday)"
            :show-gaps="canPlan"
            @focus="focus"
          />
        </div>

        <!-- Services already run. Folded away: mid-month they were costing
             half the scroll for Sundays nobody can change. -->
        <div v-if="otherPast.length" class="pt-1">
          <button
            @click="showPast = !showPast"
            class="flex w-full items-center gap-1 rounded-lg px-1 py-1.5 text-[11px] font-bold uppercase tracking-wide text-gray-400 transition-colors hover:text-primary"
          >
            <ChevronDown :class="['h-3.5 w-3.5 transition-transform', showPast ? 'rotate-180' : '-rotate-90']" />
            Past services ({{ otherPast.length }})
          </button>
          <div v-if="showPast" class="space-y-0.5">
            <LineupServiceRow
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

        <!-- Nothing at all, and nobody able to fix it here -->
        <p
          v-if="!canPlan && plannedCount === 0"
          class="p-8 text-center text-gray-500 dark:text-gray-400"
        >
          <Mic2 class="mx-auto mb-4 h-12 w-12 text-gray-300 dark:text-gray-600" />
          No services have been planned for this month yet.
        </p>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Mic2,
  Music4,
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
  monthKeyOfIso,
  leaderLoad,
  shiftMonth,
  todayIso,
} from '../utils/lineupUtils'
import { copyText } from '../utils/clipboard'
import { formatLyricsSheet, songLyricsText } from '../utils/songUtils'
import LineupSundayCard from '../components/lineups/LineupSundayCard.vue'
import SundayEditorDrawer from '../components/lineups/SundayEditorDrawer.vue'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const { canManage } = usePermissions()
const { members } = useMembers()

const canPlan = computed(() => canManage('lineups'))

// The month lives in the URL so a lineup can be linked to and shared.
const month = computed(() =>
  isValidMonthKey(route.params.month) ? route.params.month : monthKeyOf()
)

const goToMonth = (key) => router.replace(`/lineups/${key}`)

const {
  lineup,
  loading,
  sundays,
  isPublished,
  saveSunday,
  clearSunday,
  addServiceDate,
  setStatus,
  setNotes,
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
onUnmounted(() => unsubscribeSongs?.())

/** A draft is the planners' workspace; everyone else sees it as unpublished. */
const isHiddenDraft = computed(() => !isPublished.value && !canPlan.value)

const plannedCount = computed(() => sundays.value.filter(isSundayPlanned).length)

const nextServiceDate = computed(() => {
  const today = todayIso()
  return sundays.value.find((s) => s.date >= today)?.date || null
})

const load = computed(() => leaderLoad(sundays.value, members.value))

// Editor
const showEditor = ref(false)
const editingSunday = ref(null)
const saving = ref(false)

const openEditor = (sunday) => {
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
    console.error('Error saving lineup service:', error)
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

// Extra service dates — Christmas Eve, a revival week, anything off-Sunday.
const showDatePicker = ref(false)
const extraDate = ref('')

const monthBounds = computed(() => {
  const [y, m] = month.value.split('-').map(Number)
  const last = new Date(y, m, 0).getDate()
  return { min: `${month.value}-01`, max: `${month.value}-${String(last).padStart(2, '0')}` }
})

const confirmExtraDate = async () => {
  const date = extraDate.value
  if (!date || monthKeyOfIso(date) !== month.value) {
    toast.error('Pick a date inside this month.')
    return
  }
  try {
    await addServiceDate(date)
    showDatePicker.value = false
    extraDate.value = ''
    toast.success('Service date added')
  } catch (error) {
    console.error('Error adding service date:', error)
    toast.error('Could not add the date.')
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

// Month notes
const notesDraft = ref('')
watch(
  () => lineup.value?.notes,
  (notes) => {
    notesDraft.value = notes || ''
  },
  { immediate: true }
)
const notesDirty = computed(() => notesDraft.value !== (lineup.value?.notes || ''))

const saveMonthNotes = async () => {
  try {
    await setNotes(notesDraft.value.trim())
    toast.success('Notes saved')
  } catch (error) {
    console.error('Error saving lineup notes:', error)
    toast.error('Could not save the notes.')
  }
}
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Month navigator -->
    <div class="shrink-0 flex items-center gap-2 pb-3">
      <button
        @click="goToMonth(shiftMonth(month, -1))"
        class="shrink-0 p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        aria-label="Previous month"
      >
        <ChevronLeft class="h-5 w-5" />
      </button>

      <button
        @click="goToMonth(monthKeyOf())"
        class="min-w-0 flex-1 text-center"
        :title="month === monthKeyOf() ? 'Current month' : 'Back to this month'"
      >
        <span class="block text-base sm:text-lg font-bold text-gray-900 dark:text-white truncate">
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
        class="shrink-0 p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        aria-label="Next month"
      >
        <ChevronRight class="h-5 w-5" />
      </button>

      <button
        v-if="canPlan"
        @click="togglePublished"
        :class="[
          'shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-colors',
          isPublished
            ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
            : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400',
        ]"
      >
        <component :is="isPublished ? Eye : EyeOff" class="h-4 w-4" />
        <span class="hidden sm:inline">{{ isPublished ? 'Published' : 'Draft' }}</span>
      </button>
    </div>

    <div class="flex-1 overflow-hidden flex relative">
      <div class="flex-1 overflow-y-auto pb-4 space-y-3">
        <!-- Loading -->
        <div v-if="loading" class="space-y-3">
          <div
            v-for="i in 4"
            :key="`skeleton-${i}`"
            class="h-28 rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse"
          />
        </div>

        <!-- Nothing to show a non-planner while the month is still a draft -->
        <div
          v-else-if="isHiddenDraft"
          class="p-8 text-center text-gray-500 dark:text-gray-400"
        >
          <EyeOff class="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600 mb-4" />
          <p class="font-medium text-gray-700 dark:text-gray-300">Not published yet</p>
          <p class="text-sm mt-1">
            The worship team is still putting {{ formatMonthLabel(month) }} together.
          </p>
        </div>

        <template v-else>
          <!-- Month summary -->
          <div class="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 sm:p-4">
            <div class="flex items-center justify-between gap-3">
              <p class="text-sm font-semibold text-gray-900 dark:text-white">
                {{ plannedCount }} of {{ sundays.length }} service{{ sundays.length === 1 ? '' : 's' }} planned
              </p>
              <span
                v-if="canPlan && !isPublished"
                class="shrink-0 text-[10px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400"
              >
                Team can&rsquo;t see this yet
              </span>
            </div>

            <div v-if="load.length" class="mt-3 flex flex-wrap gap-1.5">
              <span
                v-for="row in load"
                :key="row.id"
                class="inline-flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-xs font-medium text-gray-700 dark:text-gray-200"
              >
                <img
                  v-if="row.member"
                  :src="getAvatarUrl(row.member)"
                  alt=""
                  class="h-5 w-5 rounded-full object-cover"
                />
                {{ row.name }}
                <span class="text-gray-400 dark:text-gray-500">×{{ row.count }}</span>
              </span>
            </div>
            <p v-else class="mt-2 text-xs text-gray-500 dark:text-gray-400">
              No leaders assigned this month yet.
            </p>
          </div>

          <!-- Sundays -->
          <LineupSundayCard
            v-for="sunday in sundays"
            :key="sunday.date"
            :sunday="sunday"
            :members="members"
            :can-manage="canPlan"
            :is-next="sunday.date === nextServiceDate"
            :is-past="sunday.date < todayIso()"
            :lyrics-copied="lyricsCopiedDate === sunday.date"
            @edit="openEditor"
            @copy-lyrics="copySundayLyrics"
          />

          <!-- Extra service date -->
          <div v-if="canPlan">
            <button
              v-if="!showDatePicker"
              @click="showDatePicker = true"
              class="w-full py-3 rounded-2xl border border-dashed border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-500 dark:text-gray-400 hover:border-primary hover:text-primary transition-colors inline-flex items-center justify-center gap-2"
            >
              <CalendarPlus class="h-4 w-4" />
              Add another service date
            </button>
            <div
              v-else
              class="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 flex items-center gap-2"
            >
              <input
                v-model="extraDate"
                type="date"
                :min="monthBounds.min"
                :max="monthBounds.max"
                aria-label="Extra service date"
                class="flex-1 min-w-0 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              <button
                @click="confirmExtraDate"
                class="shrink-0 px-3 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary-hover transition-colors"
              >
                Add
              </button>
              <button
                @click="showDatePicker = false"
                class="shrink-0 px-3 py-2 rounded-lg text-sm font-semibold text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>

          <!-- Month notes -->
          <div
            v-if="canPlan || lineup?.notes"
            class="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 sm:p-4"
          >
            <div class="flex items-center gap-2 mb-2">
              <Music4 class="h-4 w-4 text-gray-400" />
              <h3 class="text-sm font-semibold text-gray-900 dark:text-white">Month notes</h3>
            </div>
            <textarea
              v-if="canPlan"
              v-model="notesDraft"
              rows="2"
              placeholder="Rehearsal nights, series theme, anything for the whole month"
              class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
            />
            <p v-else class="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-line">
              {{ lineup.notes }}
            </p>
            <button
              v-if="canPlan && notesDirty"
              @click="saveMonthNotes"
              class="mt-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary-hover transition-colors"
            >
              Save notes
            </button>
          </div>

          <!-- Nothing at all, and nobody able to fix it here -->
          <p
            v-if="!canPlan && plannedCount === 0"
            class="p-8 text-center text-gray-500 dark:text-gray-400"
          >
            <Mic2 class="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600 mb-4" />
            No services have been planned for this month yet.
          </p>
        </template>
      </div>

      <SundayEditorDrawer
        v-model:show="showEditor"
        :sunday="editingSunday"
        :members="members"
        :songs="songs"
        :saving="saving"
        @save="handleSave"
        @clear="handleClear"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { Repeat, Plus, Pencil, Trash2, X, CalendarClock } from '../../icons'
import {
  useRecurringSchedules,
  WEEKDAYS,
  OCCURRENCES,
  sortOccurrences,
  SHOW_BEFORE_OPTIONS,
  DEFAULT_SHOW_BEFORE,
  showBeforeLabel,
} from '../../composables/useRecurringSchedules'
import { addDays, formatShortDate, scheduleFallsOn } from '../../../lib/occurrences'
import { useToast } from '../../composables/useToast'
import ConfirmationModal from '../common/ConfirmationModal.vue'
import AudiencePicker from '../common/AudiencePicker.vue'
import { useMembers } from '../../composables/useMembers'
import { audienceLabel, expectedAttendance } from '../../utils/audience'
import { useAppSettings } from '../../composables/useAppSettings'
import { useScrollLock } from '../../composables/useScrollLock'

const { categories: appCategories, church } = useAppSettings()
const eventTypes = computed(() => appCategories.value.eventTypes)

// Recurring events: the standing gatherings the calendar expands every week,
// and the sheet they are written in. Lifted out of Settings.vue whole — it was
// most of that file, and a settings page that is mostly one of its sections
// is a hard place to find the other seven.

const toast = useToast()
const { schedules, loading, addSchedule, updateSchedule, removeSchedule } =
  useRecurringSchedules()

// The roster the audience picker counts against: a service for the choir
// expects however many people carry that tag today.
const { members } = useMembers()

const expectedFor = (schedule) => expectedAttendance(schedule, members.value)

const blankSchedule = () => ({
  title: '',
  type: 'worship',
  weekday: 0,
  occurrences: [],
  time: '09:00',
  location: '',
  description: '',
  icon: 'Calendar',
  enabled: true,
  showBefore: DEFAULT_SHOW_BEFORE,
  // Whether the Minutes list offers the next occurrence of this gathering.
  keepsMinutes: false,
  // Whether this gathering's turnout is listed on people's profiles.
  showInProfile: false,
  // Empty means everyone, which is what a Sunday service is.
  audienceTags: [],
  excludeTags: [],
  // What this gathering additionally is on certain weeks — communion on the
  // first Sunday, the birthday bash on the last.
  occasions: [],
})

const showEditor = ref(false)
const editing = ref(null)

// The schedule editor is a sheet over the settings list, so the list holds.
useScrollLock(showEditor)
const form = ref(blankSchedule())
const saving = ref(false)

const isFormValid = computed(() => form.value.title.trim().length > 0)

const openAdd = () => {
  editing.value = null
  form.value = blankSchedule()
  showEditor.value = true
}

const openEdit = (schedule) => {
  editing.value = schedule
  form.value = {
    title: schedule.title,
    type: schedule.type,
    weekday: schedule.weekday,
    occurrences: [...(schedule.occurrences || [])],
    time: schedule.time,
    location: schedule.location,
    description: schedule.description,
    icon: schedule.icon,
    enabled: schedule.enabled,
    showBefore: schedule.showBefore ?? DEFAULT_SHOW_BEFORE,
    keepsMinutes: schedule.keepsMinutes === true,
    showInProfile: schedule.showInProfile === true,
    audienceTags: [...(schedule.audienceTags || [])],
    excludeTags: [...(schedule.excludeTags || [])],
    occasions: (schedule.occasions || []).map((occasion) => ({
      label: occasion.label,
      occurrences: [...(occasion.occurrences || [])],
      dates: [...(occasion.dates || [])],
    })),
  }
  occasionDraft.value = blankOccasion()
  occasionDateDraft.value = ''
  showEditor.value = true
}

const closeEditor = () => {
  showEditor.value = false
  editing.value = null
  occasionDraft.value = blankOccasion()
  occasionDateDraft.value = ''
}

/* Occasions — communion on the first Sunday, the birthday bash on the last,
   the Christmas party on the Sunday before it.
   Deliberately not separate schedules: they happen inside this gathering, and
   a second schedule would put a second entry on the calendar and a second row
   on the attendance page for the same room of people. */
const blankOccasion = () => ({ label: '', occurrences: [], dates: [] })
const occasionDraft = ref(blankOccasion())

const toggleDraftOccurrence = (value) => {
  const list = [...occasionDraft.value.occurrences]
  const index = list.indexOf(value)
  if (index > -1) list.splice(index, 1)
  else list.push(value)
  occasionDraft.value.occurrences = sortOccurrences(list)
}

/* The other way to say when: the day itself. Grandparents Day, the
   anniversary and Pastor's Appreciation are not "the fourth Sunday" in any way
   that survives to next year, so they are pinned to the dates they fall on. */
const occasionDateDraft = ref('')

const addDraftDate = () => {
  const date = occasionDateDraft.value
  if (!date || occasionDraft.value.dates.includes(date)) return
  occasionDraft.value.dates = [...occasionDraft.value.dates, date].sort()
  occasionDateDraft.value = ''
}

const removeDraftDate = (date) => {
  occasionDraft.value.dates = occasionDraft.value.dates.filter((d) => d !== date)
}

// Christmas Day 2026 is a Friday. A date this gathering does not meet on saves
// happily and then marks nothing, so it is caught while it is being typed
// rather than discovered in December.
const draftDateMisses = computed(
  () => Boolean(occasionDateDraft.value) && !scheduleFallsOn(form.value, occasionDateDraft.value)
)

/** The closest day this gathering does meet, to offer instead. */
const nearestOccurrence = computed(() => {
  if (!draftDateMisses.value) return ''
  for (let offset = 1; offset <= 31; offset += 1) {
    for (const direction of [-1, 1]) {
      const candidate = addDays(occasionDateDraft.value, offset * direction)
      if (scheduleFallsOn(form.value, candidate)) return candidate
    }
  }
  return ''
})

// A label with neither rule would mark every service, which is not an
// occasion — it is just a different name for the gathering.
const canAddOccasion = computed(
  () =>
    occasionDraft.value.label.trim().length > 0 &&
    (occasionDraft.value.occurrences.length > 0 || occasionDraft.value.dates.length > 0)
)

const addOccasion = () => {
  if (!canAddOccasion.value) return
  form.value.occasions = [
    ...form.value.occasions,
    {
      label: occasionDraft.value.label.trim(),
      occurrences: [...occasionDraft.value.occurrences],
      dates: [...occasionDraft.value.dates],
    },
  ]
  occasionDraft.value = blankOccasion()
  occasionDateDraft.value = ''
}

const removeOccasion = (index) => {
  form.value.occasions = form.value.occasions.filter((_, i) => i !== index)
}

/** "Sun 20 Dec 2026" — the year is shown because a dated occasion is that
    year's only: next year the same Sunday falls on a different date. */
const formatOccasionDate = (date) => `${formatShortDate(date)} ${String(date).slice(0, 4)}`

/** "1st Sunday" / "Last Sunday" / "Sun 20 Dec 2026" / both, joined */
const describeOccasion = (occasion) => {
  const day = weekdayLabel(form.value.weekday)
  const parts = []

  if (occasion.occurrences?.length) {
    const ordinals = sortOccurrences(occasion.occurrences)
      .map((o) => OCCURRENCES.find((x) => x.value === o)?.label)
      .filter(Boolean)
      .join(', ')
    parts.push(`${ordinals} ${day}`)
  }

  // A year of anniversaries would run off the end of one line, so the tail is
  // counted rather than listed.
  if (occasion.dates?.length) {
    const shown = occasion.dates.slice(0, 3).map(formatOccasionDate).join(', ')
    const rest = occasion.dates.length - 3
    parts.push(rest > 0 ? `${shown} +${rest} more` : shown)
  }

  return parts.length ? parts.join(' · ') : `Every ${day}`
}

// Empty selection means "every occurrence"
const toggleOccurrence = (value) => {
  const list = [...form.value.occurrences]
  const index = list.indexOf(value)
  if (index > -1) list.splice(index, 1)
  else list.push(value)
  // Not a plain numeric sort any more: "Last" is a word, and subtracting it
  // from a number gives NaN, which leaves the chips in whatever order they
  // were tapped.
  form.value.occurrences = sortOccurrences(list)
}

const handleSave = async () => {
  if (!isFormValid.value || saving.value) return
  saving.value = true
  try {
    const payload = { ...form.value, title: form.value.title.trim() }
    if (editing.value) {
      await updateSchedule(editing.value, payload)
      toast.success('Recurring event updated')
    } else {
      await addSchedule(payload)
      toast.success('Recurring event added')
    }
    closeEditor()
  } catch (error) {
    console.error('Error saving recurring schedule:', error)
    toast.error('Failed to save. Please try again.')
  } finally {
    saving.value = false
  }
}

const toggleEnabled = async (schedule) => {
  try {
    await updateSchedule(schedule, { enabled: !schedule.enabled })
  } catch (error) {
    console.error('Error toggling schedule:', error)
    toast.error('Failed to update. Please try again.')
  }
}

/* Delete confirmation */
const showConfirmation = ref(false)
const confirmationConfig = ref({
  title: '',
  message: '',
  confirmText: 'Delete',
  cancelText: 'Cancel',
  confirmButtonClass: 'bg-red-600 text-white hover:bg-red-700',
  onConfirm: null,
})

const handleDelete = (schedule) => {
  confirmationConfig.value = {
    ...confirmationConfig.value,
    title: 'Delete Recurring Event',
    message: `Stop generating "${schedule.title}" on the calendar? Events you already edited or saved individually are kept.`,
    onConfirm: async () => {
      try {
        await removeSchedule(schedule)
        toast.success('Recurring event removed')
      } catch (error) {
        console.error('Error deleting schedule:', error)
        toast.error('Failed to delete. Please try again.')
      }
    },
  }
  showConfirmation.value = true
}

/* Display helpers */
const weekdayLabel = (value) =>
  WEEKDAYS.find((d) => d.value === value)?.label || 'Sunday'

const describe = (schedule) => {
  const day = weekdayLabel(schedule.weekday)
  if (!schedule.occurrences?.length) return `Every ${day}`
  const ordinals = sortOccurrences(schedule.occurrences)
    .map((o) => OCCURRENCES.find((x) => x.value === o)?.label)
    .filter(Boolean)
    .join(', ')
  return `${ordinals} ${day} of the month`
}

// Spells the rule out with the schedule's real numbers, so an admin can see
// that "1 hour before" on a 9:00 AM service means 8:00 AM without doing the
// arithmetic themselves.
const describeVisibility = (schedule) => {
  const start = formatTime(schedule.time)
  if (schedule.showBefore === 'sameDay') {
    return `Ready to record all day, from midnight. Starts ${start}.`
  }
  if (!schedule.showBefore) {
    return `Ready to record from ${start}, when it starts.`
  }

  const [hours, minutes] = (schedule.time || '00:00').split(':').map(Number)
  // An arbitrary reference day - only the time of day and how many days back
  // the lead time reaches are used.
  const startsAt = new Date(2000, 5, 15, hours || 0, minutes || 0)
  const opensAt = new Date(startsAt.getTime() - schedule.showBefore * 60 * 1000)
  const clock = formatTime(
    `${String(opensAt.getHours()).padStart(2, '0')}:${String(opensAt.getMinutes()).padStart(2, '0')}`
  )
  const midnightOf = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const daysEarlier = Math.round(
    (midnightOf(startsAt) - midnightOf(opensAt)) / (24 * 60 * 60 * 1000)
  )
  const when =
    daysEarlier === 0
      ? clock
      : daysEarlier === 1
        ? `${clock} the day before`
        : `${clock}, ${daysEarlier} days before`
  return `Ready to record from ${when}. Starts ${start}.`
}

const formatTime = (time) => {
  if (!time) return ''
  const [h, m] = time.split(':')
  const hour = Number(h)
  const suffix = hour >= 12 ? 'PM' : 'AM'
  const display = hour % 12 === 0 ? 12 : hour % 12
  return `${display}:${m} ${suffix}`
}
</script>

<template>
  <div>
    <!-- Recurring events -->
    <section
      class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden"
    >
      <div
        class="flex items-start justify-between gap-3 px-4 py-4 border-b border-gray-100 dark:border-gray-700"
      >
        <div class="flex items-start gap-3 min-w-0">
          <div class="p-2 rounded-lg bg-primary/10 shrink-0">
            <Repeat class="h-5 w-5 text-primary dark:text-primary-light" />
          </div>
          <div class="min-w-0">
            <h2 class="text-sm font-semibold text-gray-900 dark:text-white">
              Recurring events
            </h2>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Services and meetings that repeat every week are added to the calendar
              automatically
            </p>
          </div>
        </div>
        <button
          @click="openAdd"
          class="shrink-0 flex h-10 items-center gap-1.5 rounded-lg bg-primary px-3 text-white shadow-sm transition-transform active:scale-95"
        >
          <Plus class="h-5 w-5" />
          <span class="text-sm font-medium">Add</span>
        </button>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="p-4 space-y-3">
        <div
          v-for="i in 2"
          :key="`skeleton-${i}`"
          class="h-16 rounded-lg bg-gray-100 dark:bg-gray-700 animate-pulse"
        ></div>
      </div>

      <!-- Empty -->
      <div v-else-if="schedules.length === 0" class="px-4 py-10 text-center">
        <CalendarClock class="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600" />
        <p class="mt-3 text-sm font-medium text-gray-700 dark:text-gray-300">
          No recurring events yet
        </p>
        <p class="mt-1 text-xs text-gray-500 dark:text-gray-400 max-w-xs mx-auto">
          Add one for your Sunday service or midweek prayer meeting and it will appear
          on the calendar every week.
        </p>
        <button
          @click="openAdd"
          class="mt-4 inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-white shadow-sm transition-transform active:scale-95"
        >
          <Plus class="h-5 w-5" />
          <span class="text-sm font-medium">Add recurring event</span>
        </button>
      </div>

      <!-- List -->
      <ul v-else class="divide-y divide-gray-100 dark:divide-gray-700">
        <li
          v-for="schedule in schedules"
          :key="schedule.id"
          class="flex items-center gap-3 px-4 py-3"
        >
          <div class="min-w-0 flex-1">
            <p
              :class="[
                'text-sm font-medium truncate',
                schedule.enabled
                  ? 'text-gray-900 dark:text-white'
                  : 'text-gray-400 dark:text-gray-500',
              ]"
            >
              {{ schedule.title }}
            </p>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
              {{ describe(schedule) }} &middot; {{ formatTime(schedule.time) }}
              <span v-if="schedule.location"> &middot; {{ schedule.location }}</span>
            </p>
            <p class="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">
              {{ audienceLabel(schedule.audienceTags, schedule.excludeTags) }} &middot;
              {{ expectedFor(schedule) }} expected &middot;
              attendance {{ showBeforeLabel(schedule.showBefore).toLowerCase() }}
            </p>
          </div>

          <button
            @click="toggleEnabled(schedule)"
            :class="[
              'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
              schedule.enabled ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600',
            ]"
            role="switch"
            :aria-checked="schedule.enabled"
            :aria-label="`Turn ${schedule.title} ${schedule.enabled ? 'off' : 'on'}`"
          >
            <span
              :class="[
                'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                schedule.enabled ? 'translate-x-6' : 'translate-x-1',
              ]"
            ></span>
          </button>

          <button
            @click="openEdit(schedule)"
            class="shrink-0 flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            :aria-label="`Edit ${schedule.title}`"
          >
            <Pencil class="h-4 w-4" />
          </button>
          <button
            @click="handleDelete(schedule)"
            class="shrink-0 flex h-9 w-9 items-center justify-center rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            :aria-label="`Delete ${schedule.title}`"
          >
            <Trash2 class="h-4 w-4" />
          </button>
        </li>
      </ul>
    </section>

    <!-- Editor -->
    <Teleport to="body">
      <Transition name="sheet">
        <div v-if="showEditor" class="fixed inset-0 z-80 flex flex-col justify-end sm:items-center sm:justify-center">
          <div class="absolute inset-0 bg-black/50" @click="closeEditor" />

          <div
            class="sheet-panel relative z-10 w-full sm:max-w-lg max-h-[92dvh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-white dark:bg-gray-800 shadow-2xl border-t sm:border border-gray-200 dark:border-gray-700"
          >
            <div
              class="shrink-0 flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700"
            >
              <h3 class="text-base font-semibold text-gray-900 dark:text-white">
                {{ editing ? 'Edit recurring event' : 'New recurring event' }}
              </h3>
              <button
                @click="closeEditor"
                class="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                aria-label="Close"
              >
                <X class="h-5 w-5" />
              </button>
            </div>

            <div class="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              <div>
                <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Name *
                </label>
                <input
                  v-model="form.title"
                  type="text"
                  placeholder="e.g. Sunday Service"
                  class="w-full h-11 px-3 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-1 focus:ring-primary focus:border-primary"
                />
              </div>

              <div>
                <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                  Repeats on
                </label>
                <div class="grid grid-cols-7 gap-1">
                  <button
                    v-for="day in WEEKDAYS"
                    :key="day.value"
                    @click="form.weekday = day.value"
                    :class="[
                      'h-11 rounded-lg text-xs font-medium transition-colors',
                      form.weekday === day.value
                        ? 'bg-primary text-white shadow-sm'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
                    ]"
                  >
                    {{ day.short }}
                  </button>
                </div>
              </div>

              <div>
                <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                  Which weeks
                </label>
                <div class="flex gap-1">
                  <button
                    @click="form.occurrences = []"
                    :class="[
                      'h-11 flex-1 rounded-lg text-xs font-medium transition-colors',
                      !form.occurrences.length
                        ? 'bg-primary text-white shadow-sm'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
                    ]"
                  >
                    Every
                  </button>
                  <button
                    v-for="occurrence in OCCURRENCES"
                    :key="occurrence.value"
                    @click="toggleOccurrence(occurrence.value)"
                    :class="[
                      'h-11 flex-1 rounded-lg text-xs font-medium transition-colors',
                      form.occurrences.includes(occurrence.value)
                        ? 'bg-primary text-white shadow-sm'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
                    ]"
                  >
                    {{ occurrence.label }}
                  </button>
                </div>
                <p class="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
                  {{ describe(form) }}
                </p>
              </div>

              <!-- Occasions. Communion on the first Sunday is the Sunday
                   service, so it renames that week rather than adding a second
                   entry to the calendar and a second row to record. -->
              <div>
                <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Occasions
                </label>
                <p class="text-xs text-gray-400 dark:text-gray-500 mb-2">
                  Something this gathering also is — communion, a birthday bash,
                  Pastor's Appreciation. Set it by week of the month, or pin it
                  to a date. It marks the same service; there is still one entry
                  on the calendar and one attendance sheet.
                </p>

                <ul v-if="form.occasions.length" class="mb-2 space-y-1.5">
                  <li
                    v-for="(occasion, index) in form.occasions"
                    :key="`${occasion.label}-${index}`"
                    class="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-900"
                  >
                    <div class="min-w-0 flex-1">
                      <p class="truncate text-sm font-medium text-gray-900 dark:text-white">
                        {{ occasion.label }}
                      </p>
                      <p class="text-xs text-gray-400 dark:text-gray-500">
                        {{ describeOccasion(occasion) }}
                      </p>
                    </div>
                    <button
                      @click="removeOccasion(index)"
                      :aria-label="`Remove ${occasion.label}`"
                      class="shrink-0 rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-red-500 dark:hover:bg-gray-700"
                    >
                      <Trash2 class="h-4 w-4" />
                    </button>
                  </li>
                </ul>

                <div
                  class="space-y-2 rounded-lg border border-dashed border-gray-200 p-2 dark:border-gray-600"
                >
                  <input
                    v-model="occasionDraft.label"
                    type="text"
                    placeholder="e.g. Communion"
                    class="w-full h-11 px-3 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-1 focus:ring-primary focus:border-primary"
                  />
                  <div class="flex gap-1">
                    <button
                      v-for="occurrence in OCCURRENCES"
                      :key="`occasion-${occurrence.value}`"
                      @click="toggleDraftOccurrence(occurrence.value)"
                      :class="[
                        'h-10 flex-1 rounded-lg text-xs font-medium transition-colors',
                        occasionDraft.occurrences.includes(occurrence.value)
                          ? 'bg-primary text-white shadow-sm'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
                      ]"
                    >
                      {{ occurrence.label }}
                    </button>
                  </div>

                  <!-- ...or on the day itself, for the occasions no ordinal can
                       describe: Christmas, the anniversary, whichever Sunday
                       Teacher's Day is being kept on this year. -->
                  <p class="text-xs text-gray-400 dark:text-gray-500">or on a date</p>

                  <div class="flex gap-1">
                    <input
                      v-model="occasionDateDraft"
                      type="date"
                      class="h-10 min-w-0 flex-1 px-3 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-1 focus:ring-primary focus:border-primary"
                    />
                    <button
                      @click="addDraftDate"
                      :disabled="!occasionDateDraft"
                      :class="[
                        'h-10 shrink-0 rounded-lg px-3 text-xs font-semibold transition-colors',
                        occasionDateDraft
                          ? 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200'
                          : 'cursor-not-allowed bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500',
                      ]"
                    >
                      Add date
                    </button>
                  </div>

                  <!-- Saving a date the gathering does not meet on would mark
                       nothing at all, so say so, and offer the day it does. -->
                  <p
                    v-if="draftDateMisses"
                    class="text-xs text-amber-600 dark:text-amber-400"
                  >
                    {{ weekdayLabel(form.weekday) }}s only — this date is not one.
                    <button
                      v-if="nearestOccurrence"
                      @click="occasionDateDraft = nearestOccurrence"
                      class="font-semibold underline"
                    >
                      Use {{ formatOccasionDate(nearestOccurrence) }}
                    </button>
                  </p>

                  <div v-if="occasionDraft.dates.length" class="flex flex-wrap gap-1">
                    <button
                      v-for="date in occasionDraft.dates"
                      :key="`draft-date-${date}`"
                      @click="removeDraftDate(date)"
                      :aria-label="`Remove ${formatOccasionDate(date)}`"
                      class="flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-1.5 text-xs font-medium text-primary dark:bg-primary-light/15 dark:text-primary-light"
                    >
                      {{ formatOccasionDate(date) }}
                      <X class="h-3 w-3" />
                    </button>
                  </div>

                  <button
                    @click="addOccasion"
                    :disabled="!canAddOccasion"
                    :class="[
                      'h-10 w-full rounded-lg text-xs font-semibold transition-colors',
                      canAddOccasion
                        ? 'bg-primary/10 text-primary hover:bg-primary/20 dark:bg-primary-light/15 dark:text-primary-light'
                        : 'cursor-not-allowed bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500',
                    ]"
                  >
                    Add occasion
                  </button>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Time
                  </label>
                  <input
                    v-model="form.time"
                    type="time"
                    class="w-full h-11 px-3 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-1 focus:ring-primary focus:border-primary"
                  />
                </div>
                <div>
                  <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Type
                  </label>
                  <select
                    v-model="form.type"
                    class="w-full h-11 px-3 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-1 focus:ring-primary focus:border-primary"
                  >
                    <option v-for="type in eventTypes" :key="type" :value="type">
                      {{ type.charAt(0).toUpperCase() + type.slice(1) }}
                    </option>
                  </select>
                </div>
              </div>

              <div>
                <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Show in attendance
                </label>
                <select
                  v-model="form.showBefore"
                  class="w-full h-11 px-3 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-1 focus:ring-primary focus:border-primary"
                >
                  <option
                    v-for="option in SHOW_BEFORE_OPTIONS"
                    :key="String(option.value)"
                    :value="option.value"
                  >
                    {{ option.label }}
                  </option>
                </select>
                <p class="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
                  {{ describeVisibility(form) }} Whoever opens Attendance before then
                  will not see it yet, and may record a separate event instead.
                </p>
              </div>

              <AudiencePicker
                v-model="form.audienceTags"
                v-model:exclude="form.excludeTags"
                :members="members"
                label-class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
              />

              <!-- Sits under the audience because that is what it inherits:
                   a minute started from this gathering opens with the same
                   people already picked out for attendance. Asked for rather
                   than inferred from the type — two gatherings can both be
                   "meeting" and only one of them minuted. -->
              <label
                class="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-3 dark:border-gray-600"
              >
                <input
                  v-model="form.keepsMinutes"
                  type="checkbox"
                  class="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span class="min-w-0">
                  <span class="block text-sm font-medium text-gray-900 dark:text-white">
                    Keep minutes for this gathering
                  </span>
                  <span class="mt-0.5 block text-xs text-gray-400 dark:text-gray-500">
                    The next one shows on the Minutes page as “Not started”. Opening it starts
                    the record with this gathering’s date, time, place and people already in.
                  </span>
                </span>
              </label>

              <label
                class="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-3 dark:border-gray-600"
              >
                <input
                  v-model="form.showInProfile"
                  type="checkbox"
                  class="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span class="min-w-0">
                  <span class="block text-sm font-medium text-gray-900 dark:text-white">
                    Show on people’s profiles
                  </span>
                  <span class="mt-0.5 block text-xs text-gray-400 dark:text-gray-500">
                    Lists whether each person came, under Attendance on their profile. Only the
                    people this gathering is for.
                  </span>
                </span>
              </label>

              <div>
                <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Location
                </label>
                <input
                  v-model="form.location"
                  type="text"
                  :placeholder="`e.g. ${church.shortName}`"
                  class="w-full h-11 px-3 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-1 focus:ring-primary focus:border-primary"
                />
              </div>

              <div>
                <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Description
                </label>
                <textarea
                  v-model="form.description"
                  rows="2"
                  placeholder="Shown on the event details"
                  class="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-1 focus:ring-primary focus:border-primary"
                ></textarea>
              </div>
            </div>

            <div
              class="shrink-0 flex gap-3 px-5 py-4 border-t border-gray-200 dark:border-gray-700 pb-[max(1rem,env(safe-area-inset-bottom))]"
            >
              <button
                @click="closeEditor"
                class="flex-1 h-11 rounded-lg border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                @click="handleSave"
                :disabled="!isFormValid || saving"
                :class="[
                  'flex-1 h-11 rounded-lg text-sm font-semibold transition-colors',
                  isFormValid && !saving
                    ? 'bg-primary text-white shadow-sm hover:bg-primary-hover'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed',
                ]"
              >
                {{ saving ? 'Saving...' : editing ? 'Save changes' : 'Add event' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <ConfirmationModal
      :show="showConfirmation"
      :title="confirmationConfig.title"
      :message="confirmationConfig.message"
      :confirm-text="confirmationConfig.confirmText"
      :cancel-text="confirmationConfig.cancelText"
      :confirm-button-class="confirmationConfig.confirmButtonClass"
      @update:show="showConfirmation = $event"
      @confirm="confirmationConfig.onConfirm?.()"
      @cancel="showConfirmation = false"
    />
  </div>
</template>

<style scoped>
.sheet-enter-active,
.sheet-leave-active {
  transition: opacity 0.25s ease;
}

.sheet-enter-active .sheet-panel,
.sheet-leave-active .sheet-panel {
  transition: transform 0.25s ease;
}

.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
}

.sheet-enter-from .sheet-panel,
.sheet-leave-to .sheet-panel {
  transform: translateY(100%);
}

@media (min-width: 640px) {
  .sheet-enter-from .sheet-panel,
  .sheet-leave-to .sheet-panel {
    transform: scale(0.96);
  }
}
</style>

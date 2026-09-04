<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Repeat, Plus, Pencil, Trash2, X, CalendarClock } from '../icons'
import {
  useRecurringSchedules,
  WEEKDAYS,
  OCCURRENCES,
  sortOccurrences,
  SHOW_BEFORE_OPTIONS,
  DEFAULT_SHOW_BEFORE,
  showBeforeLabel,
} from '../composables/useRecurringSchedules'
import { useToast } from '../composables/useToast'
import { useMediaQuery } from '../composables/useMediaQuery'
import ConfirmationModal from '../components/common/ConfirmationModal.vue'
import AudiencePicker from '../components/common/AudiencePicker.vue'
import { useMembers } from '../composables/useMembers'
import { audienceLabel, expectedAttendance } from '../utils/audience'
import MemberLinkAdmin from '../components/settings/MemberLinkAdmin.vue'
import RolePermissionsAdmin from '../components/settings/RolePermissionsAdmin.vue'
import MinistriesAdmin from '../components/settings/MinistriesAdmin.vue'
import MemberTagsAdmin from '../components/settings/MemberTagsAdmin.vue'
import ChurchSettings from '../components/settings/ChurchSettings.vue'
import EmailDigestAdmin from '../components/settings/EmailDigestAdmin.vue'
import LandingPageAdmin from '../components/settings/LandingPageAdmin.vue'
import { useAppSettings } from '../composables/useAppSettings'
import { useVersionCheck } from '../composables/useVersionCheck'

const { categories: appCategories, church, saveChurch, saveCategories } = useAppSettings()
const eventTypes = computed(() => appCategories.value.eventTypes)

const route = useRoute()
const router = useRouter()

// Settings grew from one section to four, and three of them are tall. Tabs keep
// the phone viewport to one screenful each; the tab lives in the URL so a
// refresh — or a link to a specific tab — lands where you expect.
const TABS = [
  { key: 'church', label: 'Church' },
  { key: 'landing', label: 'Public page' },
  { key: 'schedule', label: 'Schedule' },
  { key: 'ministries', label: 'Ministries' },
  { key: 'tags', label: 'Tags' },
  { key: 'roles', label: 'Roles' },
  { key: 'accounts', label: 'Accounts' },
  { key: 'email', label: 'Email' },
]

// Stamped in from package.json by vite's define. Shown at the foot of
// settings because the app is installed as a PWA: when someone reports a
// bug from their phone, the first thing to establish is which build they
// are actually running, and a cached service worker can be well behind.
const appVersion = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev'

// The version line is where someone already looks to answer "which build is
// this", so it is also where they can re-read what changed in it.
const { open: openWhatsNew } = useVersionCheck()

const activeTab = ref(TABS.some((t) => t.key === route.query.tab) ? route.query.tab : 'schedule')

watch(activeTab, (tab) => {
  router.replace({ query: { ...route.query, tab } })
})

const toast = useToast()
const isMobile = useMediaQuery('(max-width: 1023px)')
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
  // Empty means everyone, which is what a Sunday service is.
  audienceTags: [],
  excludeTags: [],
  // What this gathering additionally is on certain weeks — communion on the
  // first Sunday, the birthday bash on the last.
  occasions: [],
})

const showEditor = ref(false)
const editing = ref(null)
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
    audienceTags: [...(schedule.audienceTags || [])],
    excludeTags: [...(schedule.excludeTags || [])],
    occasions: (schedule.occasions || []).map((occasion) => ({
      label: occasion.label,
      occurrences: [...(occasion.occurrences || [])],
    })),
  }
  occasionDraft.value = blankOccasion()
  showEditor.value = true
}

const closeEditor = () => {
  showEditor.value = false
  editing.value = null
  occasionDraft.value = blankOccasion()
}

/* Occasions — communion on the first Sunday, the birthday bash on the last.
   Deliberately not separate schedules: they happen inside this gathering, and
   a second schedule would put a second entry on the calendar and a second row
   on the attendance page for the same room of people. */
const blankOccasion = () => ({ label: '', occurrences: [] })
const occasionDraft = ref(blankOccasion())

const toggleDraftOccurrence = (value) => {
  const list = [...occasionDraft.value.occurrences]
  const index = list.indexOf(value)
  if (index > -1) list.splice(index, 1)
  else list.push(value)
  occasionDraft.value.occurrences = sortOccurrences(list)
}

// A label with no weeks would mark every service, which is not an occasion —
// it is just a different name for the gathering.
const canAddOccasion = computed(
  () => occasionDraft.value.label.trim().length > 0 && occasionDraft.value.occurrences.length > 0
)

const addOccasion = () => {
  if (!canAddOccasion.value) return
  form.value.occasions = [
    ...form.value.occasions,
    {
      label: occasionDraft.value.label.trim(),
      occurrences: [...occasionDraft.value.occurrences],
    },
  ]
  occasionDraft.value = blankOccasion()
}

const removeOccasion = (index) => {
  form.value.occasions = form.value.occasions.filter((_, i) => i !== index)
}

/** "1st Sunday" / "Last Sunday" / "1st, 3rd Sunday" */
const describeOccasion = (occasion) => {
  const day = weekdayLabel(form.value.weekday)
  if (!occasion.occurrences?.length) return `Every ${day}`
  const ordinals = sortOccurrences(occasion.occurrences)
    .map((o) => OCCURRENCES.find((x) => x.value === o)?.label)
    .filter(Boolean)
    .join(', ')
  return `${ordinals} ${day}`
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
  <!-- A plain block scroll container, deliberately not `flex flex-col`. As a
       flex column, each tab panel is a flex item that defaults to shrink:1, so
       a panel taller than the viewport gets squashed to fit instead of
       overflowing — and since the panels are `overflow-hidden` for their
       rounded corners, the squashed content was simply clipped with nothing to
       scroll. Block layout lets the panels keep their natural height so this
       container actually overflows. -->
  <div class="h-full overflow-y-auto">
    <!-- Header -->
    <div class="mb-4">
      <h1 class="text-xl font-bold text-gray-900 dark:text-white">Settings</h1>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
        Manage how the app works for your church
      </p>
    </div>

    <!-- Tabs: scroll sideways on a narrow phone rather than wrapping.
         No negative-margin bleed here — this column is `overflow-y-auto`, and
         CSS computes the other axis to `auto` alongside it, so anything wider
         than the content box puts a horizontal scrollbar on the whole page. -->
    <div class="mb-4 overflow-x-auto no-scrollbar">
      <div
        class="flex w-max min-w-full gap-1 p-1 rounded-xl bg-gray-100 dark:bg-gray-800"
        role="tablist"
      >
        <button
          v-for="tab in TABS"
          :key="tab.key"
          role="tab"
          :aria-selected="activeTab === tab.key"
          @click="activeTab = tab.key"
          :class="[
            'flex-1 whitespace-nowrap px-4 py-2 text-sm font-semibold rounded-lg transition-colors',
            activeTab === tab.key
              ? 'bg-white dark:bg-gray-700 text-primary dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
          ]"
        >
          {{ tab.label }}
        </button>
      </div>
    </div>

    <!-- Recurring events -->
    <section
      v-show="activeTab === 'schedule'"
      class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden mb-4"
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

    <!-- Member account links -->
    <!-- Church identity and category vocabularies -->
    <ChurchSettings v-show="activeTab === 'church'" class="mb-4" />

    <!-- The visitors' page at "/" -->
    <LandingPageAdmin v-show="activeTab === 'landing'" class="mb-4" />

    <!-- What people do, and what it lets them do -->
    <MinistriesAdmin v-show="activeTab === 'ministries'" class="mb-4" />

    <!-- Descriptive labels that grant nothing -->
    <MemberTagsAdmin v-show="activeTab === 'tags'" class="mb-4" />

    <!-- Tag-based roles -->
    <RolePermissionsAdmin v-show="activeTab === 'roles'" class="mb-4" />

    <!-- Member accounts and administrators -->
    <MemberLinkAdmin v-show="activeTab === 'accounts'" class="mb-4" />

    <!-- Digest subscriptions, manual sends and the activity report -->
    <EmailDigestAdmin v-show="activeTab === 'email'" class="mb-4" />

    <!-- Which build this is. Every tab, because a bug report can come from
         any of them and the version is the first question asked. -->
    <p class="pb-4 text-center text-xs text-gray-400 dark:text-gray-500">
      UEC Church v{{ appVersion }} &middot;
      <button
        @click="openWhatsNew"
        class="underline underline-offset-2 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
      >
        What's new
      </button>
    </p>

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
                  Something this gathering also is on certain weeks — communion,
                  a birthday bash. It marks the same service; there is still one
                  entry on the calendar and one attendance sheet.
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

<script setup>
import { ref, computed } from 'vue'
import { Repeat, Plus, Pencil, Trash2, X, CalendarClock } from 'lucide-vue-next'
import {
  useRecurringSchedules,
  WEEKDAYS,
  OCCURRENCES,
} from '../composables/useRecurringSchedules'
import { useToast } from '../composables/useToast'
import { useMediaQuery } from '../composables/useMediaQuery'
import ConfirmationModal from '../components/common/ConfirmationModal.vue'
import eventTypes from '../data/eventTypes.json'

const toast = useToast()
const isMobile = useMediaQuery('(max-width: 1023px)')
const { schedules, loading, addSchedule, updateSchedule, removeSchedule } =
  useRecurringSchedules()

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
  }
  showEditor.value = true
}

const closeEditor = () => {
  showEditor.value = false
  editing.value = null
}

// Empty selection means "every occurrence"
const toggleOccurrence = (value) => {
  const list = [...form.value.occurrences]
  const index = list.indexOf(value)
  if (index > -1) list.splice(index, 1)
  else list.push(value)
  form.value.occurrences = list.sort((a, b) => a - b)
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
  const ordinals = schedule.occurrences
    .map((o) => OCCURRENCES.find((x) => x.value === o)?.label)
    .filter(Boolean)
    .join(', ')
  return `${ordinals} ${day} of the month`
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
  <div class="flex flex-col h-full overflow-y-auto">
    <!-- Header -->
    <div class="shrink-0 mb-4">
      <h1 class="text-xl font-bold text-gray-900 dark:text-white">Settings</h1>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
        Manage how the app works for your church
      </p>
    </div>

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
                  Location
                </label>
                <input
                  v-model="form.location"
                  type="text"
                  placeholder="e.g. UEC Canubing II"
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

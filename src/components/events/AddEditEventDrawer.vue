<script setup>
import { computed, ref } from 'vue'
import { X, CalendarPlus, Edit2 } from '../../icons'
import IconSelector from './IconSelector.vue'
import AudiencePicker from '../common/AudiencePicker.vue'
import { useMediaQuery } from '../../composables/useMediaQuery'
import { useFocusTrap } from '../../composables/useFocusTrap'

const isMobile = useMediaQuery('(max-width: 1023px)')

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  isEdit: {
    type: Boolean,
    default: false
  },
  eventData: {
    type: Object,
    default: () => ({
      title: '',
      type: 'worship',
      time: '09:00',
      location: '',
      description: '',
      audienceTags: [],
      excludeTags: [],
      icon: 'Calendar'
    })
  },
  eventDate: {
    type: String,
    default: ''
  },
  eventTypes: {
    type: Array,
    default: () => []
  },
  // The roster the expected count is read off. Passed in rather than
  // subscribed to here: the page already has it.
  members: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits([
  'update:show',
  'update:eventData',
  'update:eventDate',
  'save',
  'cancel'
])

// Check if form is valid (required fields filled)
const isFormValid = computed(() => {
  return props.eventData.title && props.eventData.title.trim() !== '' && props.eventDate && props.eventDate.trim() !== ''
})

const dialogRef = ref(null)
useFocusTrap(dialogRef, () => props.show, () => emit('cancel'))
</script>

<template>
  <Teleport to="body" :disabled="!isMobile">
    <Transition :name="isMobile ? 'modal-sheet' : 'drawer'">
    <div
      v-if="show"
      :class="[
        isMobile
          ? 'fixed inset-0 z-80 flex flex-col justify-end'
          : 'add-edit-event-drawer ml-3 flex h-full w-[calc(50%-0.75rem)] shrink-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'
      ]"
    >
      <div
        v-if="isMobile"
        class="absolute inset-0 bg-black/60 backdrop-blur-sm"
        @click="$emit('update:show', false)"
      />
      <div
        ref="dialogRef"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-edit-event-drawer-title"
        tabindex="-1"
        :class="[
          'flex flex-col min-h-0',
          isMobile
            ? 'relative z-10 w-full max-h-[92dvh] overflow-hidden rounded-t-2xl bg-white dark:bg-gray-800 shadow-2xl border-t border-gray-200 dark:border-gray-700'
            : 'h-full w-full'
        ]"
      >
    <!-- Header, in the People page's sheet shape. It was green, a colour
         nothing else on the page used, so adding an event looked like a
         different app from the calendar it was adding to. -->
    <div class="flex shrink-0 items-center justify-between gap-3 border-b border-gray-200 bg-linear-to-r from-primary/10 to-transparent px-4 py-3.5 dark:border-gray-700 dark:from-primary-light/10">
      <div class="flex min-w-0 items-center gap-3">
        <div class="shrink-0 rounded-xl bg-primary p-2.5 shadow-lg shadow-primary/30">
          <component :is="isEdit ? Edit2 : CalendarPlus" class="h-5 w-5 text-white" />
        </div>
        <div class="min-w-0">
          <h2 id="add-edit-event-drawer-title" class="truncate text-base font-bold text-gray-900 dark:text-white">
            {{ isEdit ? 'Edit event' : 'Add event' }}
          </h2>
          <p class="truncate text-xs text-gray-500 dark:text-gray-400">
            {{ isEdit ? eventData.title || 'Untitled' : 'Title and date are required' }}
          </p>
        </div>
      </div>
      <button
        @click="$emit('cancel')"
        aria-label="Close"
        class="shrink-0 rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
      >
        <X class="h-5 w-5" />
      </button>
    </div>

    <!-- Event Form -->
    <div class="flex-1 overflow-y-auto min-h-0 p-4 space-y-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Title <span class="text-red-500">*</span>
        </label>
        <input
          :value="eventData.title"
          @input="$emit('update:eventData', { ...eventData, title: $event.target.value })"
          type="text"
          placeholder="Event title"
          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
        />
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Date <span class="text-red-500">*</span>
          </label>
          <input
            :value="eventDate"
            @input="$emit('update:eventDate', $event.target.value)"
            type="date"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Time
          </label>
          <input
            :value="eventData.time"
            @input="$emit('update:eventData', { ...eventData, time: $event.target.value })"
            type="time"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Type
          </label>
          <select
            :value="eventData.type"
            @change="$emit('update:eventData', { ...eventData, type: $event.target.value })"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
          >
            <option v-for="type in eventTypes" :key="type" :value="type">
              {{ type.charAt(0).toUpperCase() + type.slice(1) }}
            </option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Icon
          </label>
          <IconSelector :model-value="eventData.icon" @update:model-value="$emit('update:eventData', { ...eventData, icon: $event })" />
        </div>
      </div>
      <!-- Who it is for, not how many. The head count follows from the tags,
           so it cannot be typed wrong and cannot go stale. -->
      <AudiencePicker
        :model-value="eventData.audienceTags || []"
        :exclude="eventData.excludeTags || []"
        :members="members"
        @update:model-value="$emit('update:eventData', { ...eventData, audienceTags: $event })"
        @update:exclude="$emit('update:eventData', { ...eventData, excludeTags: $event })"
      />
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Location
        </label>
        <input
          :value="eventData.location"
          @input="$emit('update:eventData', { ...eventData, location: $event.target.value })"
          type="text"
          placeholder="Event location"
          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
        />
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Description
        </label>
        <textarea
          :value="eventData.description"
          @input="$emit('update:eventData', { ...eventData, description: $event.target.value })"
          rows="3"
          placeholder="Event description"
          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
        />
      </div>
    </div>

    <!-- Footer: the same pair of buttons, and the same disabled look, as the
         People page's selection bar -->
    <div class="flex shrink-0 items-center gap-2 border-t border-gray-200 px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:border-gray-700">
      <button
        @click="$emit('cancel')"
        class="inline-flex h-11 shrink-0 items-center justify-center rounded-lg border border-gray-200 px-4 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
      >
        Cancel
      </button>
      <button
        @click="$emit('save')"
        :disabled="!isFormValid"
        :class="[
          'inline-flex h-11 flex-1 items-center justify-center rounded-lg px-4 text-sm font-semibold transition-colors',
          isFormValid
            ? 'bg-primary text-white shadow-lg shadow-primary/25 hover:bg-primary-hover'
            : 'cursor-not-allowed bg-gray-200 text-gray-400 dark:bg-gray-700'
        ]"
      >
        {{ isEdit ? 'Save changes' : 'Save event' }}
      </button>
    </div>
      </div>
    </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.add-edit-event-drawer {
  transition: max-width 0.3s ease-out, opacity 0.3s ease;
}

.drawer-enter-from.add-edit-event-drawer,
.drawer-leave-to.add-edit-event-drawer {
  max-width: 0;
  opacity: 0;
  overflow: hidden;
}

.modal-sheet-enter-active,
.modal-sheet-leave-active {
  transition: opacity 0.25s ease;
}

.modal-sheet-enter-active > div:last-child,
.modal-sheet-leave-active > div:last-child {
  transition: transform 0.25s ease;
}

.modal-sheet-enter-from,
.modal-sheet-leave-to {
  opacity: 0;
}

.modal-sheet-enter-from > div:last-child,
.modal-sheet-leave-to > div:last-child {
  transform: translateY(100%);
}
</style>

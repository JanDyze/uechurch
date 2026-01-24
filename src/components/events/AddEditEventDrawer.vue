<script setup>
import { computed } from 'vue'
import { X } from 'lucide-vue-next'
import * as LucideIcons from 'lucide-vue-next'
import IconSelector from './IconSelector.vue'

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
      attendees: 0,
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
</script>

<template>
  <div
    v-if="show"
    class="m-3 rounded-2xl border-2 border-green-500/30 dark:border-green-400/30 bg-white dark:bg-gray-800 w-[calc(50%-1.5rem)] h-[calc(100%-1.5rem)] flex flex-col flex-shrink-0 shadow-xl shadow-green-500/25 dark:shadow-green-400/20"
  >
    <!-- Header -->
    <div class="flex-shrink-0 bg-gradient-to-r from-green-500/10 to-transparent dark:from-green-400/10 dark:to-transparent rounded-t-2xl border-b border-green-500/20 dark:border-green-400/20 px-5 py-4">
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
          {{ isEdit ? 'Edit Event' : 'Add New Event' }}
        </h3>
        <button
          @click="$emit('cancel')"
          class="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <X class="h-5 w-5" />
        </button>
      </div>
    </div>

    <!-- Event Form -->
    <div class="flex-1 overflow-y-auto min-h-0 p-5 space-y-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Title <span class="text-red-500">*</span>
        </label>
        <input
          :value="eventData.title"
          @input="$emit('update:eventData', { ...eventData, title: $event.target.value })"
          type="text"
          placeholder="Event title"
          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
        />
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Date <span class="text-red-500">*</span>
          </label>
          <input
            :value="eventDate"
            @input="$emit('update:eventDate', $event.target.value)"
            type="date"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
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
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Type
          </label>
          <select
            :value="eventData.type"
            @change="$emit('update:eventData', { ...eventData, type: $event.target.value })"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
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
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Expected Attendees
        </label>
        <input
          :value="eventData.attendees"
          @input="$emit('update:eventData', { ...eventData, attendees: parseInt($event.target.value) || 0 })"
          type="number"
          min="0"
          placeholder="0"
          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
        />
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Location
        </label>
        <input
          :value="eventData.location"
          @input="$emit('update:eventData', { ...eventData, location: $event.target.value })"
          type="text"
          placeholder="Event location"
          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
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
          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
        />
      </div>
    </div>

    <!-- Footer with buttons -->
    <div class="flex-shrink-0 bg-gradient-to-r from-green-500/10 to-transparent dark:from-green-400/10 dark:to-transparent rounded-b-2xl border-t border-green-500/20 dark:border-green-400/20 px-5 py-4">
      <button
        @click="$emit('save')"
        :disabled="!isFormValid"
        :class="[
          'w-full px-4 py-2.5 text-sm font-medium rounded-lg transition-colors',
          isFormValid
            ? 'text-white bg-green-500 hover:bg-green-600 cursor-pointer shadow-lg shadow-green-500/25'
            : 'text-gray-400 dark:text-gray-500 bg-gray-200 dark:bg-gray-700 cursor-not-allowed opacity-50'
        ]"
      >
        {{ isEdit ? 'Save Changes' : 'Save Event' }}
      </button>
    </div>
  </div>
</template>

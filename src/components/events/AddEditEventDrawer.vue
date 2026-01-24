<script setup>
import { computed } from 'vue'
import { X, Settings, Calendar } from 'lucide-vue-next'
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
  },
  eventPresets: {
    type: Array,
    default: () => []
  },
  selectedPreset: {
    type: Object,
    default: null
  }
})

const emit = defineEmits([
  'update:show',
  'update:eventData',
  'update:eventDate',
  'update:selectedPreset',
  'save',
  'cancel',
  'showSelectPreset'
])

const getEventTypeColor = (type) => {
  const colors = {
    worship: 'bg-blue-500 text-white',
    study: 'bg-green-500 text-white',
    youth: 'bg-purple-500 text-white',
    prayer: 'bg-yellow-500 text-white',
    outreach: 'bg-orange-500 text-white',
    music: 'bg-pink-500 text-white',
    birthday: 'bg-red-500 text-white'
  }
  return colors[type] || 'bg-gray-500 text-white'
}

const getIconComponent = (iconName) => {
  return LucideIcons[iconName] || LucideIcons.Calendar
}

// Check if form is valid (required fields filled)
const isFormValid = computed(() => {
  return props.eventData.title && props.eventData.title.trim() !== '' && props.eventDate && props.eventDate.trim() !== ''
})
</script>

<template>
  <Transition name="drawer">
    <div
      v-if="show"
      class="add-edit-event-drawer border-l-4 border-[#01779b] bg-green-50/20 dark:bg-gray-800 w-1/2 h-full flex flex-col flex-shrink-0 shadow-2xl shadow-[#01779b]/20"
    >
      <div class="flex-shrink-0 bg-green-50/20 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
              {{ isEdit ? 'Edit Event' : 'Add New Event' }}
            </h3>
            <div v-if="!isEdit && eventPresets.length > 0">
              <button
                v-if="!selectedPreset"
                @click="$emit('showSelectPreset')"
                class="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <Settings class="h-4 w-4" />
                <span>Use Preset</span>
              </button>
              <div v-else class="flex items-center gap-2 px-3 py-1.5 bg-[#01779b]/10 dark:bg-[#01779b]/20 border border-[#01779b] rounded-lg">
                <component :is="getIconComponent(selectedPreset.icon || 'Calendar')" class="h-4 w-4 text-[#01779b]" />
                <span
                  :class="[
                    'px-2 py-0.5 text-xs rounded-full capitalize',
                    getEventTypeColor(selectedPreset.type),
                  ]"
                >
                  {{ selectedPreset.type }}
                </span>
                <span class="text-sm font-medium text-gray-900 dark:text-white">{{ selectedPreset.title }}</span>
                <button
                  @click="$emit('update:selectedPreset', null)"
                  class="ml-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  <X class="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>
          <button
            @click="$emit('cancel')"
            class="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X class="h-5 w-5" />
          </button>
        </div>
      </div>

      <!-- Event Form -->
      <div class="flex-1 overflow-y-auto min-h-0 p-6">
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Title <span class="text-red-500">*</span>
            </label>
            <input
              :value="eventData.title"
              @input="$emit('update:eventData', { ...eventData, title: $event.target.value })"
              type="text"
              placeholder="Event title"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#01779b] focus:border-transparent"
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
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#01779b] focus:border-transparent"
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
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#01779b] focus:border-transparent"
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
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#01779b] focus:border-transparent"
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
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#01779b] focus:border-transparent"
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
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#01779b] focus:border-transparent"
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
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#01779b] focus:border-transparent"
            />
          </div>
        </div>
      </div>

      <!-- Footer with buttons -->
      <div class="flex-shrink-0 bg-green-50/20 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-6 py-4">
        <div class="flex justify-end gap-3">
          <div class="flex-1 relative group">
            <button
              @click="$emit('save')"
              :disabled="!isFormValid"
              :class="[
                'w-full px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                isFormValid
                  ? 'text-white bg-[#01779b] dark:bg-[#01779b] hover:bg-[#015a77] dark:hover:bg-[#015a77] cursor-pointer'
                  : 'text-gray-400 dark:text-gray-500 bg-gray-200 dark:bg-gray-700 cursor-not-allowed opacity-50'
              ]"
            >
              {{ isEdit ? 'Save Changes' : 'Save Event' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.add-edit-event-drawer {
  transition: max-width 0.3s ease-out, opacity 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease;
}

.drawer-enter-active,
.drawer-leave-active {
  transition: transform 0.3s ease-out, max-width 0.3s ease-out, opacity 0.3s ease;
}

.drawer-enter-from {
  transform: translateX(100%);
  max-width: 0;
  opacity: 0;
  overflow: hidden;
}

.drawer-leave-to {
  transform: translateX(100%);
  max-width: 0;
  opacity: 0;
  overflow: hidden;
}
</style>


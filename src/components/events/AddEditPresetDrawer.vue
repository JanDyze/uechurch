<script setup>
import { computed } from 'vue'
import { X } from 'lucide-vue-next'
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
  presetData: {
    type: Object,
    required: true
  },
  eventTypes: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['update:show', 'update:presetData', 'save', 'cancel'])

const isFormValid = computed(() => {
  return props.presetData.title && props.presetData.title.trim().length > 0
})
</script>

<template>
  <Transition name="drawer">
    <div
      v-if="show"
      class="add-edit-preset-drawer border-l-4 border-[#01779b] bg-green-50/20 dark:bg-gray-800 w-1/2 h-full flex flex-col flex-shrink-0 shadow-2xl shadow-[#01779b]/20"
    >
      <!-- Header -->
      <div class="flex-shrink-0 bg-green-50/20 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
          {{ isEdit ? 'Edit Preset' : 'Add New Preset' }}
        </h3>
        <button
          @click="$emit('update:show', false)"
          class="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <X class="h-5 w-5" />
        </button>
      </div>

      <!-- Preset Form -->
      <div class="flex-1 overflow-y-auto min-h-0 p-6">
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Title <span class="text-red-500">*</span>
            </label>
            <input
              :value="presetData.title"
              @input="$emit('update:presetData', { ...presetData, title: $event.target.value })"
              type="text"
              placeholder="Preset title"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#01779b] focus:border-transparent"
            />
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Type
              </label>
              <select
                :value="presetData.type"
                @change="$emit('update:presetData', { ...presetData, type: $event.target.value })"
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
              <IconSelector :model-value="presetData.icon" @update:model-value="$emit('update:presetData', { ...presetData, icon: $event })" />
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Time
            </label>
            <input
              :value="presetData.time"
              @input="$emit('update:presetData', { ...presetData, time: $event.target.value })"
              type="time"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#01779b] focus:border-transparent"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Location
            </label>
            <input
              :value="presetData.location"
              @input="$emit('update:presetData', { ...presetData, location: $event.target.value })"
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
              :value="presetData.description"
              @input="$emit('update:presetData', { ...presetData, description: $event.target.value })"
              rows="3"
              placeholder="Event description"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#01779b] focus:border-transparent"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Expected Attendees
            </label>
            <input
              :value="presetData.attendees"
              @input="$emit('update:presetData', { ...presetData, attendees: parseInt($event.target.value) || 0 })"
              type="number"
              min="0"
              placeholder="0"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#01779b] focus:border-transparent"
            />
          </div>
        </div>
      </div>

      <!-- Footer -->
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
              {{ isEdit ? 'Save Changes' : 'Save Preset' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.add-edit-preset-drawer {
  transition: max-width 0.3s ease-out, opacity 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease;
}

.drawer-enter-from.add-edit-preset-drawer,
.drawer-leave-to.add-edit-preset-drawer {
  max-width: 0;
  opacity: 0;
  overflow: hidden;
}
</style>




<script setup>
import { X, Plus, Settings, Edit2, Trash2, Clock, MapPin, Users } from 'lucide-vue-next'
import * as LucideIcons from 'lucide-vue-next'

defineProps({
  show: {
    type: Boolean,
    default: false
  },
  presets: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['update:show', 'addPreset', 'editPreset', 'usePreset', 'deletePreset'])

const getIconComponent = (iconName) => {
  return LucideIcons[iconName] || LucideIcons.Calendar
}

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
</script>

<template>
  <Transition name="drawer">
    <div
      v-if="show"
      class="manage-presets-drawer border-l-4 border-[#01779b] bg-green-50/20 dark:bg-gray-800 max-w-xl w-[28rem] h-full flex flex-col flex-shrink-0 shadow-2xl shadow-[#01779b]/20"
    >
      <!-- Header -->
      <div class="flex-shrink-0 bg-green-50/20 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Manage Event Presets</h3>
        <button
          @click="$emit('update:show', false)"
          class="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <X class="h-5 w-5" />
        </button>
      </div>

      <!-- Presets List Header -->
      <div class="flex-shrink-0 px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300">
          Existing Presets ({{ presets.length }})
        </h4>
        <button
          @click="$emit('addPreset')"
          class="flex items-center gap-2 px-3 py-1.5 text-sm bg-[#01779b] text-white rounded-lg hover:bg-[#015a77] transition-colors"
        >
          <Plus class="h-4 w-4" />
          <span>Add Preset</span>
        </button>
      </div>

      <!-- Presets List (Scrollable) -->
      <div class="flex-1 overflow-y-auto min-h-0 p-6">
        <div
          v-if="presets.length === 0"
          class="text-center text-gray-500 dark:text-gray-400 py-8"
        >
          No presets yet. Click "Add Preset" to create one!
        </div>
        <div v-else class="space-y-3">
          <div
            v-for="preset in presets"
            :key="preset.id || preset.firestoreId"
            class="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          >
            <div class="flex items-start justify-between">
              <div class="flex-1">
                <div class="flex items-center gap-2 mb-2">
                  <component :is="getIconComponent(preset.icon || 'Calendar')" class="h-4 w-4 text-gray-600 dark:text-gray-400" />
                  <span
                    :class="[
                      'px-2 py-0.5 text-xs rounded-full capitalize',
                      getEventTypeColor(preset.type),
                    ]"
                  >
                    {{ preset.type }}
                  </span>
                  <h4 class="font-semibold text-gray-900 dark:text-white">
                    {{ preset.title }}
                  </h4>
                </div>
                <div class="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <div class="flex items-center gap-4">
                    <span class="flex items-center gap-1">
                      <Clock class="h-3 w-3" />
                      {{ preset.time }}
                    </span>
                    <span v-if="preset.location" class="flex items-center gap-1">
                      <MapPin class="h-3 w-3" />
                      {{ preset.location }}
                    </span>
                    <span v-if="preset.attendees" class="flex items-center gap-1">
                      <Users class="h-3 w-3" />
                      {{ preset.attendees }}
                    </span>
                  </div>
                  <p v-if="preset.description" class="text-xs mt-1">
                    {{ preset.description }}
                  </p>
                </div>
              </div>
              <div class="flex items-center gap-2 ml-4">
                <button
                  @click="$emit('usePreset', preset)"
                  class="p-2 text-[#01779b] hover:bg-[#01779b]/10 dark:hover:bg-[#01779b]/20 rounded-lg transition-colors"
                  title="Use this preset"
                >
                  <Settings class="h-4 w-4" />
                </button>
                <button
                  @click="$emit('editPreset', preset)"
                  class="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  title="Edit preset"
                >
                  <Edit2 class="h-4 w-4" />
                </button>
                <button
                  @click="$emit('deletePreset', preset)"
                  class="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  title="Delete preset"
                >
                  <Trash2 class="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.manage-presets-drawer {
  transition: max-width 0.3s ease-out, opacity 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease;
}

.drawer-enter-from.manage-presets-drawer,
.drawer-leave-to.manage-presets-drawer {
  max-width: 0;
  opacity: 0;
  overflow: hidden;
}
</style>




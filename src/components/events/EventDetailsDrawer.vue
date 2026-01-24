<script setup>
import { ArrowLeft, Calendar, Clock, MapPin, Users, Trash2, Edit2 } from 'lucide-vue-next'
import * as LucideIcons from 'lucide-vue-next'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  event: {
    type: Object,
    default: null
  },
  isEditable: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['update:show', 'edit', 'delete', 'back'])

const getEventTypeColor = (type) => {
  const colors = {
    worship: 'bg-blue-500 text-white',
    prayer: 'bg-purple-500 text-white',
    meeting: 'bg-slate-500 text-white',
    fellowship: 'bg-teal-500 text-white',
    outreach: 'bg-orange-500 text-white',
    training: 'bg-green-500 text-white',
    celebration: 'bg-pink-500 text-white',
    special: 'bg-amber-500 text-white',
  }
  return colors[type] || 'bg-gray-500 text-white'
}

const getIconComponent = (iconName) => {
  return LucideIcons[iconName] || LucideIcons.Calendar
}

const formatDate = (dateStr) => {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}
</script>

<template>
  <div
    v-if="show && event"
    class="m-3 rounded-2xl border-2 border-[#01779b]/30 dark:border-[#22b8cf]/30 bg-white dark:bg-gray-800 w-[calc(50%-1.5rem)] h-[calc(100%-1.5rem)] flex flex-col flex-shrink-0 shadow-xl shadow-[#01779b]/25 dark:shadow-[#22b8cf]/20"
  >
    <!-- Header with Back Button -->
    <div class="flex-shrink-0 bg-gradient-to-r from-[#01779b]/10 to-transparent dark:from-[#22b8cf]/10 dark:to-transparent rounded-t-2xl border-b border-[#01779b]/20 dark:border-[#22b8cf]/20 px-5 py-4">
      <button
        @click="$emit('back')"
        class="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors mb-3"
      >
        <ArrowLeft class="h-4 w-4" />
        <span class="text-sm font-medium">Back to Events</span>
      </button>
      
      <div class="flex items-center gap-4">
        <div
          :class="[
            'w-14 h-14 rounded-xl flex items-center justify-center shadow-lg',
            getEventTypeColor(event.type),
          ]"
        >
          <component :is="getIconComponent(event.icon || 'Calendar')" class="h-7 w-7" />
        </div>
        <div class="flex-1 min-w-0">
          <h2 class="text-xl font-bold text-gray-900 dark:text-white truncate">
            {{ event.title }}
          </h2>
          <p class="text-sm text-gray-500 dark:text-gray-400 capitalize">
            {{ event.type }} Event
          </p>
        </div>
      </div>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto p-5 space-y-5">
      <!-- Date & Time Card -->
      <div class="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 space-y-3">
        <div class="flex items-center gap-3">
          <div class="p-2 bg-[#01779b]/10 dark:bg-[#22b8cf]/10 rounded-lg">
            <Calendar class="h-5 w-5 text-[#01779b] dark:text-[#22b8cf]" />
          </div>
          <div>
            <p class="text-xs text-gray-500 dark:text-gray-400">Date</p>
            <p class="text-sm font-medium text-gray-900 dark:text-white">
              {{ formatDate(event.date) }}
            </p>
          </div>
        </div>
        
        <div class="flex items-center gap-3">
          <div class="p-2 bg-[#01779b]/10 dark:bg-[#22b8cf]/10 rounded-lg">
            <Clock class="h-5 w-5 text-[#01779b] dark:text-[#22b8cf]" />
          </div>
          <div>
            <p class="text-xs text-gray-500 dark:text-gray-400">Time</p>
            <p class="text-sm font-medium text-gray-900 dark:text-white">
              {{ event.time }}
            </p>
          </div>
        </div>
      </div>

      <!-- Location Card -->
      <div v-if="event.location" class="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
        <div class="flex items-center gap-3">
          <div class="p-2 bg-[#01779b]/10 dark:bg-[#22b8cf]/10 rounded-lg">
            <MapPin class="h-5 w-5 text-[#01779b] dark:text-[#22b8cf]" />
          </div>
          <div>
            <p class="text-xs text-gray-500 dark:text-gray-400">Location</p>
            <p class="text-sm font-medium text-gray-900 dark:text-white">
              {{ event.location }}
            </p>
          </div>
        </div>
      </div>

      <!-- Attendees Card -->
      <div v-if="event.attendees" class="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
        <div class="flex items-center gap-3">
          <div class="p-2 bg-[#01779b]/10 dark:bg-[#22b8cf]/10 rounded-lg">
            <Users class="h-5 w-5 text-[#01779b] dark:text-[#22b8cf]" />
          </div>
          <div>
            <p class="text-xs text-gray-500 dark:text-gray-400">Expected Attendees</p>
            <p class="text-sm font-medium text-gray-900 dark:text-white">
              {{ event.attendees }} people
            </p>
          </div>
        </div>
      </div>

      <!-- Description -->
      <div v-if="event.description" class="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
        <h3 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
          Description
        </h3>
        <p class="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          {{ event.description }}
        </p>
      </div>

    </div>

    <!-- Footer Actions -->
    <div v-if="isEditable" class="flex-shrink-0 bg-gradient-to-r from-[#01779b]/10 to-transparent dark:from-[#22b8cf]/10 dark:to-transparent rounded-b-2xl border-t border-[#01779b]/20 dark:border-[#22b8cf]/20 px-5 py-4">
      <div class="flex justify-end gap-2">
        <button
          @click="$emit('edit')"
          class="p-2 text-white bg-[#01779b] dark:bg-[#22b8cf] rounded-lg hover:bg-[#015a77] dark:hover:bg-[#1a9aab] transition-colors shadow-lg shadow-[#01779b]/25 dark:shadow-[#22b8cf]/25"
          :title="event.isVirtual ? 'Override' : 'Edit'"
        >
          <Edit2 class="h-5 w-5" />
        </button>
        <button
          @click="$emit('delete')"
          class="p-2 text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors shadow-lg shadow-red-500/25"
          :title="event.isVirtual ? 'Cancel Event' : 'Delete'"
        >
          <Trash2 class="h-5 w-5" />
        </button>
      </div>
    </div>
  </div>
</template>

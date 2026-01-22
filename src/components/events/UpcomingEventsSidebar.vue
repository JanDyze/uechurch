<script setup>
import { Clock, MapPin } from 'lucide-vue-next'
import * as LucideIcons from 'lucide-vue-next'
import EventCardSkeleton from './EventCardSkeleton.vue'

const props = defineProps({
  loading: {
    type: Boolean,
    default: false
  },
  upcomingEvents: {
    type: Array,
    default: () => []
  },
  eventTypeFilter: {
    type: String,
    default: null
  },
  upcomingDaysFilter: {
    type: Number,
    default: 7
  },
  allEventTypes: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['update:eventTypeFilter', 'update:upcomingDaysFilter', 'eventClick'])

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
</script>

<template>
  <div class="flex flex-col bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
    <div class="flex-shrink-0 p-4 border-b border-gray-200 dark:border-gray-700">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Upcoming Events</h2>
      </div>
      
      <!-- Days Filter -->
      <div class="mb-3">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-xs text-gray-500 dark:text-gray-400">Period:</span>
          <button
            v-for="days in [7, 14, 30]"
            :key="days"
            @click="emit('update:upcomingDaysFilter', days)"
            :class="[
              'px-3 py-1 text-xs rounded-full transition-colors',
              upcomingDaysFilter === days
                ? 'bg-[#01779b] text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600',
            ]"
          >
            {{ days }} days
          </button>
        </div>
      </div>
      
      <!-- Event Type Filter -->
      <div class="space-y-2">
        <div class="flex flex-wrap gap-2">
          <button
            @click="emit('update:eventTypeFilter', null)"
            :class="[
              'px-3 py-1 text-xs rounded-full transition-colors',
              eventTypeFilter === null
                ? 'bg-[#01779b] text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600',
            ]"
          >
            All
          </button>
          <button
            v-for="type in allEventTypes"
            :key="type"
            @click="emit('update:eventTypeFilter', eventTypeFilter === type ? null : type)"
            :class="[
              'px-3 py-1 text-xs rounded-full transition-colors capitalize',
              eventTypeFilter === type
                ? 'bg-[#01779b] text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600',
            ]"
          >
            {{ type }}
          </button>
        </div>
      </div>
    </div>
    <div class="flex-1 overflow-y-auto p-4 space-y-3">
      <div
        v-if="loading"
        class="space-y-3"
      >
        <EventCardSkeleton v-for="i in 5" :key="i" />
      </div>
      <div
        v-else-if="upcomingEvents.length === 0"
        class="text-center text-gray-500 dark:text-gray-400 py-8"
      >
        No upcoming events
      </div>
      <button
        v-else
        v-for="event in upcomingEvents"
        :key="event.id"
        @click="emit('eventClick', event)"
        class="w-full text-left p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
      >
        <div class="flex items-start gap-3">
          <div
            :class="[
              'w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0',
              getEventTypeColor(event.type),
            ]"
          >
            <component :is="getIconComponent(event.icon || 'Calendar')" class="h-6 w-6" />
          </div>
          <div class="flex-1 min-w-0">
            <h3 class="font-medium text-sm text-gray-900 dark:text-white truncate">
              {{ event.title }}
            </h3>
            <div class="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
              <span>{{ new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }}</span>
              <span>•</span>
              <span>{{ event.time }}</span>
            </div>
            <div class="flex items-center gap-1 mt-1 text-xs text-gray-500 dark:text-gray-400">
              <MapPin class="h-3 w-3" />
              <span class="truncate">{{ event.location }}</span>
            </div>
          </div>
        </div>
      </button>
    </div>
  </div>
</template>




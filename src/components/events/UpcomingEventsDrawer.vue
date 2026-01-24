<script setup>
import { Clock, MapPin, Users, X } from 'lucide-vue-next'
import * as LucideIcons from 'lucide-vue-next'
import EventCardSkeleton from './EventCardSkeleton.vue'
import eventTypesData from '../../data/eventTypes.json'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
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
  }
})

const eventTypes = eventTypesData

const emit = defineEmits([
  'update:show',
  'update:eventTypeFilter',
  'update:upcomingDaysFilter',
  'eventClick'
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
</script>

<template>
  <Transition name="drawer">
    <div
      v-if="show"
      class="upcoming-events-drawer border-l-4 border-[#01779b] bg-gray-50 dark:bg-gray-900 w-1/2 h-full flex flex-col flex-shrink-0 shadow-2xl shadow-[#01779b]/20"
    >
      <div class="flex-shrink-0 p-6 border-b border-gray-200 dark:border-gray-700">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-xl font-bold text-gray-900 dark:text-white">Upcoming Events</h2>
          <button
            @click="$emit('update:show', false)"
            class="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <X class="h-5 w-5" />
          </button>
        </div>
        
        <!-- Filters in same row -->
        <div class="grid grid-cols-2 gap-3">
          <!-- Days Filter -->
          <div>
            <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
              Period
            </label>
            <select
              :value="upcomingDaysFilter"
              @change="$emit('update:upcomingDaysFilter', parseInt($event.target.value))"
              class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#01779b] focus:border-transparent"
            >
              <option :value="7">7 days</option>
              <option :value="14">14 days</option>
              <option :value="30">30 days</option>
            </select>
          </div>
          
          <!-- Event Type Filter -->
          <div>
            <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
              Filter by Type
            </label>
            <select
              :value="eventTypeFilter || ''"
              @change="$emit('update:eventTypeFilter', $event.target.value === '' ? null : $event.target.value)"
              class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#01779b] focus:border-transparent"
            >
              <option value="">All Types</option>
              <option v-for="type in eventTypes" :key="type" :value="type">
                {{ type.charAt(0).toUpperCase() + type.slice(1) }}
              </option>
            </select>
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
          @click="$emit('eventClick', event)"
          class="w-full text-left p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors bg-white dark:bg-gray-800"
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
              <div class="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
                <span>{{ new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }}</span>
                <span>•</span>
                <span>{{ event.time }}</span>
                <span v-if="event.location" class="flex items-center gap-1">
                  <span>•</span>
                  <MapPin class="h-3 w-3" />
                  <span class="truncate">{{ event.location }}</span>
                </span>
              </div>
            </div>
          </div>
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.upcoming-events-drawer {
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


<script setup>
import { Clock, MapPin, X, Plus, ArrowLeft } from 'lucide-vue-next'
import * as LucideIcons from 'lucide-vue-next'
import EventCardSkeleton from './EventCardSkeleton.vue'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  loading: {
    type: Boolean,
    default: false
  },
  selectedDay: {
    type: Date,
    default: null
  },
  formattedSelectedDay: {
    type: String,
    default: ''
  },
  dayEvents: {
    type: Array,
    default: () => []
  },
  holiday: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['update:show', 'eventClick', 'addEvent', 'back'])

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
</script>

<template>
  <div
    v-if="show"
    class="m-0 lg:m-3 rounded-none lg:rounded-2xl border-0 lg:border-2 border-primary/30 dark:border-primary-light/30 bg-white dark:bg-gray-800 w-full lg:w-[calc(50%-1.5rem)] h-full lg:h-[calc(100%-1.5rem)] flex flex-col shrink-0 shadow-none lg:shadow-xl lg:shadow-primary/25 dark:lg:shadow-primary-light/20 transition-all duration-300"
  >
    <!-- Header -->
    <div class="shrink-0 bg-linear-to-r from-primary/10 to-transparent dark:from-primary-light/10 dark:to-transparent lg:rounded-t-2xl border-b border-primary/20 dark:border-primary-light/20 px-4 sm:px-5 py-4">
      <div class="flex items-center justify-between mb-3 border-b border-primary/10 dark:border-primary-light/10 pb-3">
        <button
          @click="$emit('back')"
          class="flex items-center gap-1.5 text-primary dark:text-primary-light hover:opacity-80 transition-opacity"
        >
          <ArrowLeft class="h-4 w-4" />
          <span class="text-xs font-semibold uppercase tracking-wider">Month Events</span>
        </button>
        <button
          @click="$emit('update:show', false)"
          class="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <X class="h-4 w-4" />
        </button>
      </div>
      <div>
        <h2 class="text-lg font-bold text-gray-900 dark:text-white">{{ formattedSelectedDay }}</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          {{ dayEvents.length }} event{{ dayEvents.length !== 1 ? 's' : '' }}
        </p>
      </div>
    </div>
    
    <!-- Content -->
    <div class="flex-1 overflow-y-auto p-4 space-y-3">
      <div v-if="loading" class="space-y-3">
        <EventCardSkeleton v-for="i in 3" :key="i" />
      </div>
      <template v-else>
        <div
          v-if="holiday"
          class="flex items-center gap-3 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800/50"
        >
          <div class="w-9 h-9 rounded-lg bg-yellow-500 flex items-center justify-center shrink-0 text-white text-xs font-bold">
            🎉
          </div>
          <div class="min-w-0">
            <p class="text-xs font-semibold text-yellow-700 dark:text-yellow-400 uppercase tracking-wide">Holiday</p>
            <p class="text-sm font-medium text-gray-900 dark:text-white truncate">{{ holiday.name }}</p>
          </div>
        </div>
        <div
          v-if="!holiday && dayEvents.length === 0"
          class="text-center text-gray-500 dark:text-gray-400 py-8"
        >
          No events scheduled for this day
        </div>
        <button
          v-for="event in dayEvents"
          :key="event.id"
          @click="
            $emit('update:show', false);
            $emit('eventClick', event);
          "
          class="w-full text-left p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors bg-gray-50 dark:bg-gray-700/50"
        >
          <div class="flex items-start gap-3">
            <div
              :class="[
                'w-12 h-12 rounded-lg flex items-center justify-center shrink-0',
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
                <Clock class="h-3 w-3" />
                <span>{{ event.time }}</span>
              </div>
              <div v-if="event.location" class="flex items-center gap-1 mt-1 text-xs text-gray-500 dark:text-gray-400">
                <MapPin class="h-3 w-3" />
                <span class="truncate">{{ event.location }}</span>
              </div>
            </div>
          </div>
        </button>
      </template>
    </div>

    <!-- Footer -->
    <div class="shrink-0 bg-linear-to-r from-primary/10 to-transparent dark:from-primary-light/10 dark:to-transparent lg:rounded-b-2xl border-t border-primary/20 dark:border-primary-light/20 px-4 sm:px-5 py-4">
      <button
        @click="$emit('addEvent')"
        class="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary dark:bg-primary-light text-white rounded-lg hover:bg-primary-hover dark:hover:bg-[#1a9aab] transition-colors shadow-lg shadow-primary/25 dark:shadow-primary-light/25"
      >
        <Plus class="h-5 w-5" />
        <span>Add Event</span>
      </button>
    </div>
  </div>
</template>

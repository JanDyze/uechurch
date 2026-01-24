<script setup>
import { Clock, MapPin, X, Plus } from 'lucide-vue-next'
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
  }
})

const emit = defineEmits(['update:show', 'eventClick', 'addEvent'])

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
    class="m-3 rounded-2xl border-2 border-[#01779b]/30 dark:border-[#22b8cf]/30 bg-white dark:bg-gray-800 w-[calc(50%-1.5rem)] h-[calc(100%-1.5rem)] flex flex-col flex-shrink-0 shadow-xl shadow-[#01779b]/25 dark:shadow-[#22b8cf]/20"
  >
    <!-- Header -->
    <div class="flex-shrink-0 bg-gradient-to-r from-[#01779b]/10 to-transparent dark:from-[#22b8cf]/10 dark:to-transparent rounded-t-2xl border-b border-[#01779b]/20 dark:border-[#22b8cf]/20 px-5 py-4">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-lg font-bold text-gray-900 dark:text-white">{{ formattedSelectedDay }}</h2>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {{ dayEvents.length }} event{{ dayEvents.length !== 1 ? 's' : '' }}
          </p>
        </div>
        <button
          @click="$emit('update:show', false)"
          class="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <X class="h-5 w-5" />
        </button>
      </div>
    </div>
    
    <!-- Content -->
    <div class="flex-1 overflow-y-auto p-4 space-y-3">
      <div v-if="loading" class="space-y-3">
        <EventCardSkeleton v-for="i in 3" :key="i" />
      </div>
      <div
        v-else-if="dayEvents.length === 0"
        class="text-center text-gray-500 dark:text-gray-400 py-8"
      >
        No events scheduled for this day
      </div>
      <button
        v-else
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
    </div>

    <!-- Footer -->
    <div class="flex-shrink-0 bg-gradient-to-r from-[#01779b]/10 to-transparent dark:from-[#22b8cf]/10 dark:to-transparent rounded-b-2xl border-t border-[#01779b]/20 dark:border-[#22b8cf]/20 px-5 py-4">
      <button
        @click="$emit('addEvent')"
        class="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#01779b] dark:bg-[#22b8cf] text-white rounded-lg hover:bg-[#015a77] dark:hover:bg-[#1a9aab] transition-colors shadow-lg shadow-[#01779b]/25 dark:shadow-[#22b8cf]/25"
      >
        <Plus class="h-5 w-5" />
        <span>Add Event</span>
      </button>
    </div>
  </div>
</template>

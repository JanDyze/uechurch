<script setup>
import { Calendar, Clock, MapPin, Users, FileText } from 'lucide-vue-next'

const props = defineProps({
  minute: {
    type: Object,
    required: true
  },
  selected: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['click'])

const formatDate = (dateString) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

const formatTime = (startTime, endTime) => {
  if (!startTime) return ''
  return endTime ? `${startTime} - ${endTime}` : startTime
}
</script>

<template>
  <div 
    @click="emit('click', minute)"
    :class="[
      'p-4 transition-all cursor-pointer border-l-4',
      selected
        ? 'bg-[#01779b]/10 dark:bg-[#01779b]/20 border-[#01779b]'
        : 'hover:bg-gray-50 dark:hover:bg-gray-700 border-transparent'
    ]"
  >
    <div class="flex items-center gap-4">
      <div class="flex-shrink-0 h-12 w-12 rounded-lg bg-[#01779b]/10 dark:bg-[#01779b]/20 flex items-center justify-center">
        <FileText class="h-6 w-6 text-[#01779b]" />
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-3 flex-wrap">
          <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
            {{ minute.title || 'Untitled Meeting' }}
          </p>
        </div>
        <div class="mt-1 space-y-1">
          <div class="flex flex-col sm:flex-row sm:items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <span v-if="minute.date" class="flex items-center gap-1">
              <Calendar class="h-3.5 w-3.5" />
              {{ formatDate(minute.date) }}
            </span>
            <span v-if="minute.startTime" class="hidden sm:inline">•</span>
            <span v-if="minute.startTime" class="flex items-center gap-1">
              <Clock class="h-3.5 w-3.5" />
              {{ formatTime(minute.startTime, minute.endTime) }}
            </span>
            <span v-if="minute.location" class="hidden sm:inline">•</span>
            <span v-if="minute.location" class="flex items-center gap-1">
              <MapPin class="h-3.5 w-3.5" />
              <span class="truncate">{{ minute.location }}</span>
            </span>
          </div>
          <div v-if="minute.attendees && minute.attendees.length > 0" class="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
            <Users class="h-3.5 w-3.5" />
            <span>{{ minute.attendees.length }} attendee{{ minute.attendees.length !== 1 ? 's' : '' }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>







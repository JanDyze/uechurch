<script setup>
import { Clock, MapPin, Users, Calendar } from 'lucide-vue-next'

defineProps({
  minute: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['click'])

const formatDate = (dateString) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}
</script>

<template>
  <button
    @click="$emit('click', minute)"
    class="w-full text-left p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors bg-white dark:bg-gray-800"
  >
    <div class="flex items-start justify-between gap-4">
      <div class="flex-1 min-w-0">
        <h3 class="font-semibold text-gray-900 dark:text-white mb-2 truncate">
          {{ minute.title }}
        </h3>
        <div class="flex flex-wrap items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
          <span class="flex items-center gap-1">
            <Calendar class="h-4 w-4" />
            {{ formatDate(minute.date) }}
          </span>
          <span v-if="minute.startTime" class="flex items-center gap-1">
            <Clock class="h-4 w-4" />
            {{ minute.startTime }}<span v-if="minute.endTime"> - {{ minute.endTime }}</span>
          </span>
          <span v-if="minute.location" class="flex items-center gap-1">
            <MapPin class="h-4 w-4" />
            {{ minute.location }}
          </span>
          <span v-if="minute.attendees && minute.attendees.length > 0" class="flex items-center gap-1">
            <Users class="h-4 w-4" />
            {{ minute.attendees.length }} attendee{{ minute.attendees.length !== 1 ? 's' : '' }}
          </span>
        </div>
        <div v-if="minute.actionItems && minute.actionItems.length > 0" class="mt-2">
          <span class="text-xs text-[#01779b] font-medium">
            {{ minute.actionItems.length }} action item{{ minute.actionItems.length !== 1 ? 's' : '' }}
          </span>
        </div>
      </div>
    </div>
  </button>
</template>




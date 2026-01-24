<script setup>
import { Users } from 'lucide-vue-next'

const props = defineProps({
  record: {
    type: Object,
    required: true
  },
  members: {
    type: Array,
    default: () => []
  },
  selected: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['delete', 'record-attendance', 'edit-attendance', 'click'])

const handleClick = () => {
  if (props.record.source === 'attendance') {
    emit('edit-attendance', props.record)
  } else if (props.record.source === 'event' || props.record.source === 'minute') {
    emit('record-attendance', props.record)
  } else {
    emit('click', props.record)
  }
}

const getDay = (dateString) => {
  if (!dateString) return '--'
  return new Date(dateString).getDate()
}

const getDayName = (dateString) => {
  if (!dateString) return ''
  return new Date(dateString).toLocaleDateString('en-US', { weekday: 'short' })
}

const getCategory = () => {
  if (props.record.source === 'minute') return 'Meeting'
  if (props.record.eventType) {
    return props.record.eventType.charAt(0).toUpperCase() + props.record.eventType.slice(1)
  }
  return 'Event'
}

const hasAttendance = () => props.record.totalAttendees > 0
</script>

<template>
  <div 
    @click="handleClick"
    :class="[
      'px-4 py-3 flex items-center gap-4 cursor-pointer transition-colors select-none',
      selected
        ? 'bg-[#01779b]/10 dark:bg-[#01779b]/20'
        : 'hover:bg-gray-50 dark:hover:bg-gray-750'
    ]"
  >
    <!-- Big Day Display -->
    <div class="flex-shrink-0 w-14 text-center">
      <div class="text-2xl font-bold text-gray-900 dark:text-white leading-none">
        {{ getDay(record.date) }}
      </div>
      <div class="text-xs text-gray-400 dark:text-gray-500 uppercase mt-0.5">
        {{ getDayName(record.date) }}
      </div>
    </div>
    
    <!-- Content -->
    <div class="flex-1 min-w-0">
      <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
        {{ record.eventTitle || 'Untitled' }}
      </p>
      <div class="flex items-center gap-2 mt-0.5">
        <span class="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
          {{ getCategory() }}
        </span>
        <span 
          v-if="hasAttendance()"
          class="text-xs text-green-600 dark:text-green-400 flex items-center gap-1"
        >
          <Users class="h-3 w-3" />
          {{ record.totalAttendees }}
        </span>
        <span v-else class="text-xs text-gray-400 italic">No attendance</span>
      </div>
    </div>

    <!-- Status indicator -->
    <div 
      :class="[
        'w-2 h-2 rounded-full flex-shrink-0',
        hasAttendance() ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
      ]"
    />
  </div>
</template>


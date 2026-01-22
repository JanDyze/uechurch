<script setup>
import { Calendar, Clock, MapPin, Users, FileText, CheckCircle2, AlertCircle } from 'lucide-vue-next'

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

const formatDate = (dateString) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

const getMemberName = (memberId) => {
  if (!memberId) return 'Unknown'
  const member = props.members.find(m => 
    String(m.id) === String(memberId) || 
    String(m.firestoreId) === String(memberId)
  )
  return member ? `${member.firstName || ''} ${member.lastName || ''}`.trim() : 'Unknown'
}

const getSourceIcon = () => {
  if (props.record.source === 'minute') return FileText
  if (props.record.source === 'event') return Calendar
  return Users
}

const getSourceColor = () => {
  if (props.record.source === 'minute') return 'bg-blue-500'
  if (props.record.source === 'event') return 'bg-purple-500'
  return 'bg-[#01779b]'
}

const getSourceLabel = () => {
  if (props.record.source === 'minute') return 'Meeting'
  if (props.record.source === 'event') return 'Event'
  return 'Attendance'
}
</script>

<template>
  <div 
    @click="handleClick"
    :class="[
      'p-4 transition-all cursor-pointer border-l-4',
      selected
        ? 'bg-[#01779b]/10 dark:bg-[#01779b]/20 border-[#01779b]'
        : 'hover:bg-gray-50 dark:hover:bg-gray-700 border-transparent'
    ]"
  >
    <div class="flex items-start gap-4">
      <div :class="[
        'flex-shrink-0 h-12 w-12 rounded-lg flex items-center justify-center',
        getSourceColor(),
        'text-white'
      ]">
        <component :is="getSourceIcon()" class="h-6 w-6" />
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-start justify-between gap-2">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap mb-1">
              <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
                {{ record.eventTitle || 'Untitled' }}
              </p>
              <span :class="[
                'px-2 py-0.5 text-xs rounded-full capitalize',
                getSourceColor(),
                'text-white'
              ]">
                {{ getSourceLabel() }}
              </span>
              <!-- Attendance status badge (only for events) -->
              <span 
                v-if="record.source === 'event'"
                :class="[
                  'px-2 py-0.5 text-xs rounded-full flex items-center gap-1 font-medium',
                  record.totalAttendees > 0
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800'
                    : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800'
                ]"
              >
                <component 
                  :is="record.totalAttendees > 0 ? CheckCircle2 : AlertCircle" 
                  class="h-3 w-3"
                />
                {{ record.totalAttendees > 0 ? 'Recorded' : 'Not Recorded' }}
              </span>
              <span v-if="record.eventType && record.eventType !== 'meeting'" class="px-2 py-0.5 text-xs rounded-full bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 capitalize">
                {{ record.eventType }}
              </span>
            </div>
            <div class="mt-1 space-y-1">
              <div class="flex flex-col sm:flex-row sm:items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <span v-if="record.date" class="flex items-center gap-1">
                  <Calendar class="h-3.5 w-3.5" />
                  {{ formatDate(record.date) }}
                </span>
                <span v-if="record.time" class="hidden sm:inline">•</span>
                <span v-if="record.time" class="flex items-center gap-1">
                  <Clock class="h-3.5 w-3.5" />
                  {{ record.time }}
                </span>
                <span v-if="record.location" class="hidden sm:inline">•</span>
                <span v-if="record.location" class="flex items-center gap-1">
                  <MapPin class="h-3.5 w-3.5" />
                  <span class="truncate">{{ record.location }}</span>
                </span>
              </div>
              <div class="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                <!-- For events with recorded attendance: show "X / Y (Z%)" -->
                <span v-if="record.source === 'event' && record.expectedAttendees > 0 && record.totalAttendees > 0" class="flex items-center gap-2">
                  <Users class="h-3.5 w-3.5" />
                  <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#01779b]/10 dark:bg-[#01779b]/20 border border-[#01779b]/20">
                    <span class="font-semibold text-[#01779b] dark:text-[#01779b]">{{ record.totalAttendees || 0 }}</span>
                    <span class="text-[#01779b]/60 dark:text-[#01779b]/60">/</span>
                    <span class="font-semibold text-[#01779b] dark:text-[#01779b]">{{ record.expectedAttendees }}</span>
                    <span class="text-xs text-[#01779b]/70 dark:text-[#01779b]/70 ml-0.5">
                      ({{ Math.round(((record.totalAttendees || 0) / record.expectedAttendees) * 100) }}%)
                    </span>
                  </span>
                </span>
                <!-- For events without recorded attendance: show expected -->
                <span v-else-if="record.source === 'event'" class="flex items-center gap-1">
                  <Users class="h-3.5 w-3.5" />
                  <span class="font-medium text-gray-900 dark:text-white">{{ record.expectedAttendees || 0 }}</span>
                  <span class="text-gray-400 dark:text-gray-500">expected</span>
                </span>
                <!-- For minutes/attendance without expected: show actual recorded attendance -->
                <span v-else-if="record.totalAttendees > 0" class="flex items-center gap-1">
                  <Users class="h-3.5 w-3.5" />
                  <span class="font-medium text-gray-900 dark:text-white">{{ record.totalAttendees }}</span>
                  <span>attendee{{ record.totalAttendees !== 1 ? 's' : '' }}</span>
                </span>
                <span v-else class="flex items-center gap-1 text-gray-400 dark:text-gray-500 italic">
                  <Users class="h-3.5 w-3.5" />
                  No attendance recorded
                </span>
              </div>
              <!-- Member List (if available) -->
              <div v-if="record.attendees && record.attendees.length > 0 && record.attendees.length <= 10" class="flex flex-wrap gap-1.5 mt-2">
                <span
                  v-for="attendeeId in record.attendees"
                  :key="attendeeId"
                  class="px-2 py-0.5 text-xs bg-[#01779b]/10 dark:bg-[#01779b]/20 text-[#01779b] rounded-full"
                >
                  {{ getMemberName(attendeeId) }}
                </span>
              </div>
              <div v-else-if="record.attendees && record.attendees.length > 10" class="mt-2">
                <span class="text-xs text-gray-500 dark:text-gray-400">
                  {{ record.attendees.length }} members attended
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>


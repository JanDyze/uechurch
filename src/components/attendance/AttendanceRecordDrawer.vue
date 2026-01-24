<script setup>
import { computed, ref } from 'vue'
import { X, Save, Calendar, Clock, MapPin, Search, Users, Check } from 'lucide-vue-next'
import { useMembers } from '../../composables/useMembers'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  isEdit: {
    type: Boolean,
    default: false
  },
  attendanceData: {
    type: Object,
    default: () => ({
      eventId: '',
      eventType: '',
      eventTitle: '',
      date: '',
      time: '',
      location: '',
      attendees: [],
      notes: ''
    })
  },
  eventData: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['update:show', 'update:attendanceData', 'save', 'cancel'])

const { members } = useMembers()
const searchQuery = ref('')

// Initialize form data
const formData = computed({
  get: () => {
    if (props.eventData && !props.isEdit) {
      // Pre-fill from event if creating new record for an event
      return {
        eventId: props.eventData.firestoreId || props.eventData.id || '',
        eventType: props.eventData.eventType || props.eventData.type || '',
        eventTitle: props.eventData.eventTitle || props.eventData.title || '',
        date: props.eventData.date || '',
        time: props.eventData.time || '',
        location: props.eventData.location || '',
        attendees: props.attendanceData.attendees || [],
        notes: props.attendanceData.notes || ''
      }
    }
    return props.attendanceData
  },
  set: (value) => {
    emit('update:attendanceData', value)
  }
})

const isFormValid = computed(() => {
  return formData.value.eventTitle && formData.value.eventTitle.trim().length > 0 &&
         formData.value.date && formData.value.date.length > 0
})

// Filter members by search
const filteredMembers = computed(() => {
  if (!searchQuery.value.trim()) {
    return members.value || []
  }
  const query = searchQuery.value.toLowerCase()
  return (members.value || []).filter(member => {
    const fullName = `${member.firstName || ''} ${member.lastName || ''}`.trim().toLowerCase()
    const nickname = (member.nickname || '').toLowerCase()
    return fullName.includes(query) || nickname.includes(query)
  })
})

// Toggle member attendance
const toggleAttendee = (memberId) => {
  const attendees = [...(formData.value.attendees || [])]
  const index = attendees.findIndex(id => 
    String(id) === String(memberId) || 
    id === memberId
  )
  if (index > -1) {
    attendees.splice(index, 1)
  } else {
    attendees.push(memberId)
  }
  emit('update:attendanceData', { ...formData.value, attendees })
}

// Check if member is present
const isPresent = (memberId) => {
  return (formData.value.attendees || []).some(id => 
    String(id) === String(memberId) || 
    id === memberId
  )
}

const handleSave = () => {
  if (isFormValid.value) {
    emit('save')
  }
}

const handleCancel = () => {
  emit('cancel')
}
</script>

<template>
  <Transition name="drawer">
    <div
      v-if="show"
      class="attendance-record-drawer border-l-4 border-[#01779b] bg-white dark:bg-gray-800 w-1/2 h-full flex flex-col flex-shrink-0 shadow-2xl shadow-[#01779b]/20"
    >
      <!-- Header -->
      <div class="flex-shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Users class="h-5 w-5" />
          {{ isEdit ? 'Edit Attendance' : 'Record Attendance' }}
        </h3>
        <button
          @click="handleCancel"
          class="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <X class="h-5 w-5" />
        </button>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto min-h-0 p-6">
        <div class="space-y-6">
          <!-- Event Title -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Event Title
            </label>
            <input
              :value="formData.eventTitle"
              @input="emit('update:attendanceData', { ...formData, eventTitle: $event.target.value })"
              type="text"
              placeholder="Event or meeting name"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#01779b] focus:border-transparent"
            />
          </div>

          <!-- Date and Time -->
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
                <Calendar class="h-4 w-4" />
                Date
              </label>
              <input
                :value="formData.date"
                @input="emit('update:attendanceData', { ...formData, date: $event.target.value })"
                type="date"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#01779b] focus:border-transparent"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
                <Clock class="h-4 w-4" />
                Time
              </label>
              <input
                :value="formData.time"
                @input="emit('update:attendanceData', { ...formData, time: $event.target.value })"
                type="time"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#01779b] focus:border-transparent"
              />
            </div>
          </div>

          <!-- Location -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
              <MapPin class="h-4 w-4" />
              Location
            </label>
            <input
              :value="formData.location"
              @input="emit('update:attendanceData', { ...formData, location: $event.target.value })"
              type="text"
              placeholder="Event location"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#01779b] focus:border-transparent"
            />
          </div>

          <!-- Notes -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notes
            </label>
            <textarea
              :value="formData.notes"
              @input="emit('update:attendanceData', { ...formData, notes: $event.target.value })"
              rows="2"
              placeholder="Additional notes..."
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#01779b] focus:border-transparent resize-none"
            ></textarea>
          </div>

          <!-- Members List -->
          <div>
            <div class="flex items-center justify-between mb-3">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Mark Members Present
              </label>
              <span class="text-xs text-gray-500 dark:text-gray-400">
                {{ formData.attendees?.length || 0 }} selected
              </span>
            </div>

            <!-- Search -->
            <div class="relative mb-3">
              <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                v-model="searchQuery"
                type="text"
                placeholder="Search members..."
                class="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#01779b] focus:border-transparent"
              />
            </div>

            <!-- Members List -->
            <div class="border border-gray-200 dark:border-gray-700 rounded-lg max-h-96 overflow-y-auto">
              <div v-if="filteredMembers.length === 0" class="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
                No members found
              </div>
              <button
                v-for="member in filteredMembers"
                :key="member.id || member.firestoreId"
                @click="toggleAttendee(member.id || member.firestoreId)"
                :class="[
                  'w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-b border-gray-100 dark:border-gray-800 last:border-b-0',
                  isPresent(member.id || member.firestoreId) ? 'bg-[#01779b]/5 dark:bg-[#01779b]/10' : ''
                ]"
              >
                <div :class="[
                  'flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors',
                  isPresent(member.id || member.firestoreId)
                    ? 'bg-[#01779b] border-[#01779b]'
                    : 'border-gray-300 dark:border-gray-600'
                ]">
                  <Check v-if="isPresent(member.id || member.firestoreId)" class="h-3 w-3 text-white" />
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-gray-900 dark:text-white">
                    {{ `${member.firstName || ''} ${member.lastName || ''}`.trim() || 'Unknown' }}
                  </p>
                  <p v-if="member.nickname" class="text-xs text-gray-500 dark:text-gray-400">
                    {{ member.nickname }}
                  </p>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-end gap-3">
        <button
          @click="handleCancel"
          class="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          Cancel
        </button>
        <button
          @click="handleSave"
          :disabled="!isFormValid"
          :class="[
            'px-4 py-2 rounded-lg transition-colors flex items-center gap-2',
            isFormValid
              ? 'bg-[#01779b] text-white hover:bg-[#015a77]'
              : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
          ]"
        >
          <Save class="h-4 w-4" />
          {{ isEdit ? 'Update' : 'Save' }}
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.drawer-enter-active,
.drawer-leave-active {
  transition: max-width 0.3s ease-out, opacity 0.3s ease;
}

.drawer-enter-from,
.drawer-leave-to {
  max-width: 0;
  opacity: 0;
  overflow: hidden;
}
</style>


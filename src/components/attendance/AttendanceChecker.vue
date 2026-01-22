<script setup>
import { computed, ref } from 'vue'
import { X, Save, Calendar, Clock, MapPin, Search, Users, Check, CheckCircle2, User } from 'lucide-vue-next'
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
    required: true
  },
  eventData: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['update:show', 'update:attendanceData', 'save', 'cancel'])

const { members } = useMembers()
const searchQuery = ref('')
const showOnlyPresent = ref(false)
const showOnlyAbsent = ref(false)

// Initialize form data
const formData = computed({
  get: () => {
    if (props.eventData && !props.isEdit) {
      return {
        eventId: props.eventData.firestoreId || props.eventData.id || '',
        eventType: props.eventData.eventType || props.eventData.type || '',
        eventTitle: props.eventData.eventTitle || props.eventData.title || '',
        date: props.eventData.date || '',
        time: props.eventData.time || '',
        location: props.eventData.location || '',
        attendees: props.attendanceData.attendees || [],
        notes: props.attendanceData.notes || '',
        expectedAttendees: props.eventData.expectedAttendees || props.eventData.attendees || 0
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

// Filter members by search and status
const filteredMembers = computed(() => {
  let filtered = members.value || []
  
  // Search filter
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(member => {
      const fullName = `${member.firstName || ''} ${member.lastName || ''}`.trim().toLowerCase()
      const nickname = (member.nickname || '').toLowerCase()
      return fullName.includes(query) || nickname.includes(query)
    })
  }
  
  // Status filter
  if (showOnlyPresent.value) {
    filtered = filtered.filter(member => isPresent(member.id || member.firestoreId))
  } else if (showOnlyAbsent.value) {
    filtered = filtered.filter(member => !isPresent(member.id || member.firestoreId))
  }
  
  return filtered
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

// Select all / Deselect all
const selectAll = () => {
  const allMemberIds = filteredMembers.value.map(m => m.id || m.firestoreId)
  emit('update:attendanceData', { ...formData.value, attendees: allMemberIds })
}

const deselectAll = () => {
  emit('update:attendanceData', { ...formData.value, attendees: [] })
}

const handleSave = () => {
  if (isFormValid.value) {
    emit('save')
  }
}

const handleCancel = () => {
  emit('cancel')
}

const presentCount = computed(() => {
  return formData.value.attendees?.length || 0
})

const totalCount = computed(() => {
  return members.value?.length || 0
})
</script>

<template>
  <Transition name="drawer">
    <div
      v-if="show"
      class="attendance-checker border-l-4 border-[#01779b] bg-white dark:bg-gray-800 max-w-3xl w-[48rem] h-full flex flex-col flex-shrink-0 shadow-2xl shadow-[#01779b]/20"
    >
      <!-- Header -->
      <div class="flex-shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Users class="h-6 w-6" />
            {{ isEdit ? 'Edit Attendance' : 'Record Attendance' }}
          </h3>
          <button
            @click="handleCancel"
            class="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X class="h-5 w-5" />
          </button>
        </div>
        
        <!-- Event Info Summary -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-3 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
          <div class="flex items-center gap-2">
            <Calendar class="h-4 w-4 text-[#01779b]" />
            <div>
              <p class="text-xs text-gray-500 dark:text-gray-400">Event</p>
              <p class="text-sm font-medium text-gray-900 dark:text-white truncate">{{ formData.eventTitle || 'Untitled' }}</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <Calendar class="h-4 w-4 text-[#01779b]" />
            <div>
              <p class="text-xs text-gray-500 dark:text-gray-400">Date</p>
              <p class="text-sm font-medium text-gray-900 dark:text-white">{{ formData.date || 'Not set' }}</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <Clock class="h-4 w-4 text-[#01779b]" />
            <div>
              <p class="text-xs text-gray-500 dark:text-gray-400">Time</p>
              <p class="text-sm font-medium text-gray-900 dark:text-white">{{ formData.time || 'Not set' }}</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <MapPin class="h-4 w-4 text-[#01779b]" />
            <div>
              <p class="text-xs text-gray-500 dark:text-gray-400">Location</p>
              <p class="text-sm font-medium text-gray-900 dark:text-white truncate">{{ formData.location || 'Not set' }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-hidden flex flex-col">
        <!-- Stats Bar -->
        <div class="flex-shrink-0 px-6 py-3 bg-[#01779b]/5 dark:bg-[#01779b]/10 border-b border-gray-200 dark:border-gray-700">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-4">
              <div class="flex items-center gap-2">
                <CheckCircle2 class="h-5 w-5 text-green-600 dark:text-green-400" />
                <span class="text-sm font-semibold text-gray-900 dark:text-white">{{ presentCount }}</span>
                <span class="text-sm text-gray-600 dark:text-gray-400">present</span>
              </div>
              <div class="flex items-center gap-2">
                <User class="h-5 w-5 text-gray-400" />
                <span class="text-sm text-gray-600 dark:text-gray-400">{{ totalCount - presentCount }}</span>
                <span class="text-sm text-gray-600 dark:text-gray-400">absent</span>
              </div>
              <div class="text-sm text-gray-600 dark:text-gray-400">
                of <span class="font-semibold text-gray-900 dark:text-white">{{ totalCount }}</span> total
              </div>
            </div>
            <div class="flex items-center gap-2">
              <button
                @click="selectAll"
                class="px-3 py-1.5 text-xs font-medium text-[#01779b] hover:bg-[#01779b]/10 dark:hover:bg-[#01779b]/20 rounded-lg transition-colors"
              >
                Select All
              </button>
              <button
                @click="deselectAll"
                class="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>

        <!-- Search and Filters -->
        <div class="flex-shrink-0 px-6 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div class="flex items-center gap-3">
            <div class="relative flex-1">
              <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                v-model="searchQuery"
                type="text"
                placeholder="Search members..."
                class="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#01779b] focus:border-transparent"
              />
            </div>
            <button
              @click="showOnlyPresent = !showOnlyPresent; showOnlyAbsent = false"
              :class="[
                'px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                showOnlyPresent
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              ]"
            >
              Present
            </button>
            <button
              @click="showOnlyAbsent = !showOnlyAbsent; showOnlyPresent = false"
              :class="[
                'px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                showOnlyAbsent
                  ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              ]"
            >
              Absent
            </button>
          </div>
        </div>

        <!-- Members List -->
        <div class="flex-1 overflow-y-auto min-h-0">
          <div class="p-6">
            <div v-if="filteredMembers.length === 0" class="text-center py-12 text-gray-500 dark:text-gray-400">
              <Users class="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p class="text-sm">No members found</p>
            </div>
            <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-2">
              <button
                v-for="member in filteredMembers"
                :key="member.id || member.firestoreId"
                @click="toggleAttendee(member.id || member.firestoreId)"
                :class="[
                  'px-4 py-3 rounded-lg border-2 transition-all text-left',
                  isPresent(member.id || member.firestoreId)
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-[#01779b]/50 dark:hover:border-[#01779b]/50'
                ]"
              >
                <div class="flex items-center gap-3">
                  <div :class="[
                    'flex-shrink-0 w-6 h-6 rounded border-2 flex items-center justify-center transition-colors',
                    isPresent(member.id || member.firestoreId)
                      ? 'bg-green-500 border-green-500'
                      : 'border-gray-300 dark:border-gray-600'
                  ]">
                    <Check v-if="isPresent(member.id || member.firestoreId)" class="h-4 w-4 text-white" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {{ `${member.firstName || ''} ${member.lastName || ''}`.trim() || 'Unknown' }}
                    </p>
                    <p v-if="member.nickname" class="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {{ member.nickname }}
                    </p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
        <div class="text-sm text-gray-600 dark:text-gray-400">
          <span class="font-semibold text-gray-900 dark:text-white">{{ presentCount }}</span> of 
          <span class="font-semibold text-gray-900 dark:text-white">{{ totalCount }}</span> members present
        </div>
        <div class="flex items-center gap-3">
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
              'px-6 py-2 rounded-lg transition-colors flex items-center gap-2 font-medium',
              isFormValid
                ? 'bg-[#01779b] text-white hover:bg-[#015a77]'
                : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
            ]"
          >
            <Save class="h-4 w-4" />
            {{ isEdit ? 'Update Attendance' : 'Save Attendance' }}
          </button>
        </div>
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


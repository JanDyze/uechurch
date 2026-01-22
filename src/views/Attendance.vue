<script setup>
import { ref, computed } from 'vue'
import { useAttendance } from '../composables/useAttendance'
import { useMembers } from '../composables/useMembers'
import { useEvents } from '../composables/useEvents'
import AttendanceToolbar from '../components/attendance/AttendanceToolbar.vue'
import FilterDrawer from '../components/attendance/FilterDrawer.vue'
import AttendanceChecker from '../components/attendance/AttendanceChecker.vue'
import AttendanceListItem from '../components/attendance/AttendanceListItem.vue'
import ConfirmationModal from '../components/common/ConfirmationModal.vue'

const { aggregatedAttendance, loading, addAttendanceToFirestore, updateAttendanceInFirestore, removeAttendance } = useAttendance()
const { members } = useMembers()
const { events } = useEvents()

const searchQuery = ref('')
const showFilters = ref(false)
const showRecordAttendance = ref(false)
const dateFilter = ref(null)
const eventTypeFilter = ref(null)
const memberFilter = ref(null)
const editingAttendance = ref(null)
const selectedEvent = ref(null)
const newAttendanceData = ref({
  eventId: '',
  eventType: '',
  eventTitle: '',
  date: '',
  time: '',
  location: '',
  attendees: [],
  notes: '',
  expectedAttendees: 0
})

// Confirmation modal state
const showConfirmation = ref(false)
const confirmationConfig = ref({
  title: 'Confirm Action',
  message: '',
  confirmText: 'Confirm',
  cancelText: 'Cancel',
  confirmButtonClass: 'bg-[#01779b] text-white hover:bg-[#015a77]',
  onConfirm: null
})

const showConfirmModal = (config) => {
  confirmationConfig.value = { ...confirmationConfig.value, ...config }
  showConfirmation.value = true
}

const handleConfirmation = () => {
  if (confirmationConfig.value.onConfirm) {
    confirmationConfig.value.onConfirm()
  }
}

// Filter attendance records
const filteredAttendance = computed(() => {
  let filtered = aggregatedAttendance.value

  // Search filter
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(record =>
      record.eventTitle?.toLowerCase().includes(query) ||
      record.location?.toLowerCase().includes(query) ||
      record.notes?.toLowerCase().includes(query)
    )
  }

  // Date filter
  if (dateFilter.value) {
    const filterDate = new Date(dateFilter.value).toISOString().split('T')[0]
    filtered = filtered.filter(record => record.date === filterDate)
  }

  // Event type filter
  if (eventTypeFilter.value) {
    filtered = filtered.filter(record => record.eventType === eventTypeFilter.value)
  }

  // Member filter
  if (memberFilter.value) {
    filtered = filtered.filter(record => {
      if (Array.isArray(record.attendees)) {
        return record.attendees.some(attendeeId => {
          const memberId = String(memberFilter.value)
          return String(attendeeId) === memberId
        })
      }
      return false
    })
  }

  return filtered
})

// Group attendance by month
const attendanceByMonth = computed(() => {
  const grouped = {}
  
  filteredAttendance.value.forEach(record => {
    if (!record.date) return
    
    const date = new Date(record.date)
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    const monthLabel = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    
    if (!grouped[monthKey]) {
      grouped[monthKey] = {
        label: monthLabel,
        records: []
      }
    }
    
    grouped[monthKey].records.push(record)
  })
  
  // Sort months descending (newest first)
  return Object.entries(grouped)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, value]) => ({ key, ...value }))
})

// Get unique event types
const eventTypes = computed(() => {
  const types = new Set()
  aggregatedAttendance.value.forEach(record => {
    if (record.eventType) {
      types.add(record.eventType)
    }
  })
  return Array.from(types).sort()
})

// Statistics (only count actual recorded attendance, not expected from events)
const stats = computed(() => {
  // Filter out events for stats (they only have expected attendees, not actual attendance)
  const recordsWithAttendance = filteredAttendance.value.filter(record => record.source !== 'event')
  const totalRecords = recordsWithAttendance.length
  const totalAttendees = recordsWithAttendance.reduce((sum, record) => {
    return sum + (record.totalAttendees || 0)
  }, 0)
  const uniqueMembers = new Set()
  recordsWithAttendance.forEach(record => {
    if (Array.isArray(record.attendees)) {
      record.attendees.forEach(memberId => uniqueMembers.add(String(memberId)))
    }
  })

  return {
    totalRecords,
    totalAttendees,
    uniqueMembers: uniqueMembers.size,
    averageAttendance: totalRecords > 0 ? Math.round(totalAttendees / totalRecords) : 0
  }
})

const handleDeleteAttendance = (record) => {
  // Only allow deletion of dedicated attendance records (not linked to events), not from events/minutes
  // Check if it's linked to an event by checking if eventId exists and matches an event
  const isLinkedToEvent = record.eventId && events.value.some(e => (e.firestoreId || e.id) === record.eventId)
  
  if (record.source === 'event' || isLinkedToEvent) {
    showConfirmModal({
      title: 'Cannot Delete',
      message: 'This attendance record is linked to an event or meeting. Delete the event or meeting instead.',
      confirmText: 'OK',
      cancelText: '',
      onConfirm: () => {},
    })
    return
  }

  showConfirmModal({
    title: 'Delete Attendance Record',
    message: `Are you sure you want to delete the attendance record for "${record.eventTitle}"?`,
    confirmText: 'Delete',
    cancelText: 'Cancel',
    confirmButtonClass: 'bg-red-600 text-white hover:bg-red-700',
    onConfirm: async () => {
      try {
        await removeAttendance(record)
      } catch (error) {
        console.error('Error deleting attendance:', error)
        showConfirmModal({
          title: 'Error',
          message: 'Failed to delete attendance record. Please try again.',
          confirmText: 'OK',
          cancelText: '',
          onConfirm: () => {},
        })
      }
    }
  })
}

const clearFilters = () => {
  searchQuery.value = ''
  dateFilter.value = null
  eventTypeFilter.value = null
  memberFilter.value = null
}

const hasActiveFilters = computed(() => {
  return !!(
    searchQuery.value.trim() ||
    dateFilter.value ||
    eventTypeFilter.value ||
    memberFilter.value
  )
})

// Selected attendance ID for highlighting
const selectedAttendanceId = computed(() => {
  if (editingAttendance.value) {
    return editingAttendance.value.id || editingAttendance.value.firestoreId || null
  }
  if (selectedEvent.value) {
    return selectedEvent.value.id || selectedEvent.value.firestoreId || null
  }
  return null
})

// Attendance recording
const handleToggleRecordAttendance = () => {
  if (showRecordAttendance.value) {
    // If already open, close it
    showRecordAttendance.value = false
    editingAttendance.value = null
    selectedEvent.value = null
    newAttendanceData.value = {
      eventId: '',
      eventType: '',
      eventTitle: '',
      date: '',
      time: '',
      location: '',
      attendees: [],
      notes: '',
      expectedAttendees: 0
    }
  } else {
    // If closed, open it and reset data
    selectedEvent.value = null
    editingAttendance.value = null
    newAttendanceData.value = {
      eventId: '',
      eventType: '',
      eventTitle: '',
      date: new Date().toISOString().split('T')[0],
      time: '',
      location: '',
      attendees: [],
      notes: '',
      expectedAttendees: 0
    }
    showRecordAttendance.value = true
  }
}

const handleRecordAttendance = (event = null) => {
  if (event) {
    // Set selectedEvent so drawer can use it for pre-filling
    selectedEvent.value = {
      ...event,
      title: event.eventTitle || event.title || '',
      type: event.eventType || event.type || '',
      attendees: event.expectedAttendees || event.attendees || 0
    }
    // Also set newAttendanceData with event/meeting info
    // For meetings, use existing attendees if available
    const existingAttendees = event.source === 'minute' ? (event.attendees || []) : []
    
    newAttendanceData.value = {
      eventId: event.firestoreId || event.id || '',
      eventType: event.eventType || event.type || '',
      eventTitle: event.eventTitle || event.title || '',
      date: event.date || '',
      time: event.time || '',
      location: event.location || '',
      attendees: existingAttendees,
      notes: '',
      expectedAttendees: event.expectedAttendees || event.attendees || 0
    }
  } else {
    selectedEvent.value = null
    newAttendanceData.value = {
      eventId: '',
      eventType: '',
      eventTitle: '',
      date: new Date().toISOString().split('T')[0],
      time: '',
      location: '',
      attendees: [],
      notes: '',
      expectedAttendees: 0
    }
  }
  editingAttendance.value = null
  showRecordAttendance.value = true
}

const handleEditAttendance = (record) => {
  if (record.source !== 'attendance') return
  editingAttendance.value = record
  newAttendanceData.value = {
    eventId: record.eventId || '',
    eventType: record.eventType || '',
    eventTitle: record.eventTitle || '',
    date: record.date || '',
    time: record.time || '',
    location: record.location || '',
    attendees: record.attendees || [],
    notes: record.notes || '',
    expectedAttendees: record.expectedAttendees || 0
  }
  selectedEvent.value = null
  showRecordAttendance.value = true
}

const handleSaveAttendance = async () => {
  try {
    // Get expected attendees from the selected event if it exists
    let expectedAttendees = 0
    if (selectedEvent.value) {
      expectedAttendees = selectedEvent.value.attendees || selectedEvent.value.expectedAttendees || 0
    } else if (editingAttendance.value && editingAttendance.value.expectedAttendees) {
      // Keep existing expected attendees when editing
      expectedAttendees = editingAttendance.value.expectedAttendees
    }
    
    const attendanceData = {
      ...newAttendanceData.value,
      totalAttendees: newAttendanceData.value.attendees?.length || 0,
      expectedAttendees: expectedAttendees
    }
    
    if (editingAttendance.value) {
      await updateAttendanceInFirestore(editingAttendance.value, attendanceData)
    } else {
      await addAttendanceToFirestore(attendanceData)
    }
    
    showRecordAttendance.value = false
    editingAttendance.value = null
    selectedEvent.value = null
    newAttendanceData.value = {
      eventId: '',
      eventType: '',
      eventTitle: '',
      date: '',
      time: '',
      location: '',
      attendees: [],
      notes: '',
      expectedAttendees: 0
    }
  } catch (error) {
    console.error('Error saving attendance:', error)
    showConfirmModal({
      title: 'Error',
      message: 'Failed to save attendance record. Please try again.',
      confirmText: 'OK',
      cancelText: '',
      onConfirm: () => {},
    })
  }
}

const handleCancelAttendance = () => {
  showRecordAttendance.value = false
  editingAttendance.value = null
  selectedEvent.value = null
  newAttendanceData.value = {
    eventId: '',
    eventType: '',
    eventTitle: '',
    date: '',
    time: '',
    location: '',
    attendees: [],
    notes: '',
    expectedAttendees: 0
  }
}
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Toolbar -->
    <AttendanceToolbar
      :search-query="searchQuery"
      :show-filters="showFilters"
      :show-record-attendance="showRecordAttendance"
      :stats="stats"
      :has-active-filters="hasActiveFilters"
      @update:search-query="searchQuery = $event"
      @update:show-filters="showFilters = $event"
      @toggle-record-attendance="handleToggleRecordAttendance"
    />

    <!-- Main Content -->
    <div class="flex-1 overflow-hidden flex relative">
      <!-- Attendance List -->
      <div :class="[
        'overflow-y-auto bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 transition-all',
        showRecordAttendance ? 'flex-1 min-w-0' : 'flex-1'
      ]">
        <div v-if="loading" class="divide-y divide-gray-200 dark:divide-gray-700">
          <div
            v-for="i in 10"
            :key="`skeleton-${i}`"
            class="p-4 flex items-center gap-4"
          >
            <div class="h-12 w-12 rounded-lg bg-gray-200 dark:bg-gray-600 animate-pulse"></div>
            <div class="flex-1 space-y-2">
              <div class="h-4 w-32 bg-gray-200 dark:bg-gray-600 rounded animate-pulse"></div>
              <div class="h-3 w-24 bg-gray-200 dark:bg-gray-600 rounded animate-pulse"></div>
            </div>
          </div>
        </div>
        <div v-else-if="filteredAttendance.length === 0" class="p-8 text-center text-gray-500 dark:text-gray-400">
          <div class="text-gray-400 dark:text-gray-500 mb-4">
            <svg class="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <p class="mb-4">
            {{ hasActiveFilters ? 'No attendance records found matching your filters.' : 'No attendance records yet.' }}
          </p>
          <button
            v-if="hasActiveFilters"
            @click="clearFilters"
            class="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            Clear Filters
          </button>
        </div>
        <div v-else class="divide-y divide-gray-200 dark:divide-gray-700">
          <template v-for="monthGroup in attendanceByMonth" :key="monthGroup.key">
            <!-- Month Header -->
            <div class="sticky top-0 z-10 bg-gray-100 dark:bg-gray-700 px-4 py-2 border-b border-gray-200 dark:border-gray-600">
              <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                {{ monthGroup.label }}
              </h3>
            </div>
            <!-- Attendance records for this month -->
            <AttendanceListItem
              v-for="record in monthGroup.records"
              :key="record.id"
              :record="record"
              :members="members"
              :selected="selectedAttendanceId === (record.id || record.firestoreId)"
              @record-attendance="handleRecordAttendance(record)"
              @edit-attendance="handleEditAttendance(record)"
            />
          </template>
        </div>
      </div>

      <!-- Filter Drawer -->
      <FilterDrawer
        :show-filters="showFilters"
        :date-filter="dateFilter"
        :event-type-filter="eventTypeFilter"
        :member-filter="memberFilter"
        :event-types="eventTypes"
        :members="members"
        :has-active-filters="hasActiveFilters"
        @update:show-filters="showFilters = $event"
        @update:date-filter="dateFilter = $event"
        @update:event-type-filter="eventTypeFilter = $event"
        @update:member-filter="memberFilter = $event"
        @clear-filters="clearFilters"
      />

      <!-- Attendance Checker -->
      <AttendanceChecker
        :show="showRecordAttendance"
        :is-edit="!!editingAttendance"
        :attendance-data="newAttendanceData"
        :event-data="selectedEvent"
        @update:show="showRecordAttendance = $event"
        @update:attendance-data="newAttendanceData = $event"
        @save="handleSaveAttendance"
        @cancel="handleCancelAttendance"
      />
    </div>

    <!-- Confirmation Modal -->
    <ConfirmationModal
      :show="showConfirmation"
      :title="confirmationConfig.title"
      :message="confirmationConfig.message"
      :confirm-text="confirmationConfig.confirmText"
      :cancel-text="confirmationConfig.cancelText"
      :confirm-button-class="confirmationConfig.confirmButtonClass"
      @update:show="showConfirmation = $event"
      @confirm="handleConfirmation"
      @cancel="showConfirmation = false"
    />
  </div>
</template>


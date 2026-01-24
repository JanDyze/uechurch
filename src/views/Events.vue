<script setup>
import { ref, computed, watch } from 'vue'
import { Calendar, Clock, MapPin, Users, X, ChevronRight, Trash2, Plus, Edit2 } from 'lucide-vue-next'
import * as LucideIcons from 'lucide-vue-next'
import { useEvents } from '../composables/useEvents'
import { useMembers } from '../composables/useMembers'
import { useBirthdayEvents } from '../composables/useBirthdayEvents'
import { useRecurringEvents } from '../composables/useRecurringEvents'
import { useEventForm } from '../composables/useEventForm'
import { useEventFilters } from '../composables/useEventFilters'
import { useCalendar } from '../composables/useCalendar'
import EventsToolbar from '../components/events/EventsToolbar.vue'
import CalendarView from '../components/events/CalendarView.vue'
import MonthEventsDrawer from '../components/events/MonthEventsDrawer.vue'
import DayEventsDrawer from '../components/events/DayEventsDrawer.vue'
import AddEditEventDrawer from '../components/events/AddEditEventDrawer.vue'
import ConfirmationModal from '../components/common/ConfirmationModal.vue'
import EventDetailsDrawer from '../components/events/EventDetailsDrawer.vue'

// Events data management
const {
  events: firestoreEvents,
  loading,
  addEventToFirestore,
  updateEventInFirestore,
  removeEvent,
} = useEvents()

// Members data for birthdays
const { members } = useMembers()

// Birthday events from members (pass firestoreEvents to check for overrides)
const { birthdayEvents, todaysBirthdays } = useBirthdayEvents(members, firestoreEvents)

// Recurring events (Sunday Service, etc.) - pass firestoreEvents to check for overrides, members for attendee count
const { recurringEvents } = useRecurringEvents(firestoreEvents, members)

// Merge Firestore events with birthday events and recurring events
const events = computed(() => {
  // Filter out cancelled overrides from display (they exist only to hide virtual events)
  const visibleFirestoreEvents = firestoreEvents.value.filter(e => !e.isCancelled)
  
  return [
    ...visibleFirestoreEvents,
    ...birthdayEvents.value,
    ...recurringEvents.value
  ].sort((a, b) => {
    return new Date(a.date) - new Date(b.date)
  })
})

// Search query
const searchQuery = ref('')

// Calendar logic
const {
  currentDate,
  selectedDate,
  calendarScrollRef,
  currentMonth,
  calendarDays,
  formatDateString,
  isToday,
  getHolidayForDate,
  navigateMonth,
  handleCalendarWheel,
  goToToday
} = useCalendar()

// Event filters
const {
  eventTypeFilter,
  filteredEvents,
  allEventTypes
} = useEventFilters(events, searchQuery)

// Event form
const {
  newEventDate,
  newEventData,
  eventTypes,
  resetEventForm,
} = useEventForm(members)

// Modal states
const showEventDetails = ref(false)
const showEditEvent = ref(false)
const showDayEvents = ref(false)
const showAddEvent = ref(false)
const showMonthEvents = ref(true) // Open by default

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

// Helper function to close all drawers and modals
const closeAllDrawers = () => {
  showAddEvent.value = false
  showEditEvent.value = false
  showDayEvents.value = false
  showMonthEvents.value = false
  showEventDetails.value = false
}

// Helper function to show confirmation modal
const showConfirmModal = (config) => {
  confirmationConfig.value = { ...confirmationConfig.value, ...config }
  showConfirmation.value = true
}

const handleConfirmation = () => {
  if (confirmationConfig.value.onConfirm) {
    confirmationConfig.value.onConfirm()
  }
}

// Month events filter and sort
const monthEventTypeFilter = ref([])
const monthSortBy = ref('date')
const monthSortOrder = ref('asc')

// Selected event/day
const selectedEvent = ref(null)
const editingEvent = ref(null)
const selectedDay = ref(null)

// Get events for a specific date
const getEventsForDate = (date) => {
  const dateString = formatDateString(date)
  const eventsList = searchQuery.value.trim() ? filteredEvents.value : events.value
  return eventsList.filter((event) => event.date === dateString)
}

// Get event type color
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

// Get icon component by name
const getIconComponent = (iconName) => {
  return LucideIcons[iconName] || LucideIcons.Calendar
}

// Event handlers
const openEventDetails = (event) => {
  selectedEvent.value = event
  closeAllDrawers()
  showEventDetails.value = true
}

// All events are editable (virtual events create overrides when edited)
const isEventEditable = computed(() => {
  return selectedEvent.value !== null
})

const closeEventDetails = () => {
  showEventDetails.value = false
  selectedEvent.value = null
}

const deleteEvent = async () => {
  if (!selectedEvent.value) return
  
  const isVirtualEvent = selectedEvent.value.isVirtual
  const eventTitle = selectedEvent.value.title
  
  showConfirmModal({
    title: isVirtualEvent ? 'Cancel Event' : 'Delete Event',
    message: isVirtualEvent 
      ? `Are you sure you want to cancel "${eventTitle}" for this date? This will hide it from the calendar.`
      : `Are you sure you want to delete "${eventTitle}"?`,
    confirmText: isVirtualEvent ? 'Cancel Event' : 'Delete',
    cancelText: 'Keep',
    confirmButtonClass: 'bg-red-600 text-white hover:bg-red-700',
    onConfirm: async () => {
      try {
        if (isVirtualEvent) {
          // Create a "cancelled" override for virtual events
          const cancelData = {
            title: eventTitle,
            type: selectedEvent.value.type,
            date: selectedEvent.value.date,
            time: selectedEvent.value.time,
            location: selectedEvent.value.location || '',
            description: 'Cancelled',
            attendees: 0,
            icon: selectedEvent.value.icon || 'Calendar',
            overrideOf: selectedEvent.value.id,
            isOverride: true,
            isCancelled: true,
          }
          
          // Preserve memberId for birthday events
          if (selectedEvent.value.memberId) {
            cancelData.memberId = selectedEvent.value.memberId
          }
          
          await addEventToFirestore(cancelData)
        } else {
          await removeEvent(selectedEvent.value)
        }
        closeEventDetails()
      } catch (error) {
        console.error('Error deleting event:', error)
        showConfirmModal({
          title: 'Error',
          message: 'Failed to delete event. Please try again.',
          confirmText: 'OK',
          cancelText: '',
          onConfirm: () => {},
        })
      }
    }
  })
}

const handleDayClick = (day) => {
  selectedDay.value = day.fullDate
  selectedDate.value = formatDateString(day.fullDate)
  closeAllDrawers()
  showDayEvents.value = true
}

const handleSetDate = (date) => {
  currentDate.value = date
}

const closeDayEvents = () => {
  showDayEvents.value = false
  selectedDay.value = null
  selectedDate.value = null
}

// Handle add event from day drawer
const handleAddEventFromDay = () => {
  resetEventForm()
  closeAllDrawers()
  showAddEvent.value = true
  newEventDate.value = selectedDayDateString.value || formatDateString(new Date())
}

const startEditEvent = () => {
  if (!selectedEvent.value) return
  editingEvent.value = { ...selectedEvent.value }
  const { firestoreId, id, isVirtual, ...eventData } = selectedEvent.value
  newEventData.value = { ...eventData }
  newEventDate.value = selectedEvent.value.date
  
  // If editing a virtual event, mark that we're creating an override
  if (selectedEvent.value.isVirtual) {
    editingEvent.value.isCreatingOverride = true
    editingEvent.value.overrideOf = selectedEvent.value.id
  }
  
  closeAllDrawers()
  showEditEvent.value = true
}

const cancelEditEvent = () => {
  showEditEvent.value = false
  editingEvent.value = null
  resetEventForm()
}

// Computed properties
const selectedDayEvents = computed(() => {
  if (!selectedDay.value) return []
  return getEventsForDate(selectedDay.value)
})

const formattedSelectedDay = computed(() => {
  if (!selectedDay.value) return ''
  return selectedDay.value.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
})

const selectedDayDateString = computed(() => {
  if (!selectedDay.value) return ''
  return formatDateString(selectedDay.value)
})

const handleAddEvent = () => {
  if (showAddEvent.value) {
    // If drawer is open, close it
    showAddEvent.value = false
  } else {
    // If drawer is closed, open it
    resetEventForm()
    closeAllDrawers()
    showAddEvent.value = true
    newEventDate.value = selectedDayDateString.value || formatDateString(new Date())
  }
}

const handleCancelAddEditEvent = () => {
  showAddEvent.value = false
  showEditEvent.value = false
  resetEventForm()
}

const handleSaveAddEvent = async () => {
  if (!newEventData.value.title.trim()) return
  
  const dateToUse = newEventDate.value || selectedDayDateString.value || formatDateString(new Date())
  
  const newEvent = {
    title: newEventData.value.title,
    type: newEventData.value.type,
    date: dateToUse,
    time: newEventData.value.time || '09:00',
    location: newEventData.value.location || '',
    description: newEventData.value.description || '',
    attendees: newEventData.value.attendees || 0,
    icon: newEventData.value.icon || 'Calendar'
  }
  
  try {
    await addEventToFirestore(newEvent)
    handleCancelAddEditEvent()
  } catch (error) {
    console.error('Error adding event:', error)
    showConfirmModal({
      title: 'Error',
      message: 'Failed to add event. Please try again.',
      confirmText: 'OK',
      cancelText: '',
      onConfirm: () => {},
    })
  }
}

const handleSaveEditEvent = async () => {
  if (!editingEvent.value || !newEventData.value.title.trim()) return
  
  try {
    // Check if we're creating an override for a virtual event
    if (editingEvent.value.isCreatingOverride) {
      // Create a new real event that overrides the virtual one
      const overrideData = {
        ...newEventData.value,
        date: newEventDate.value,
        overrideOf: editingEvent.value.overrideOf, // Reference to virtual event ID
        isOverride: true,
      }
      
      // Preserve memberId for birthday overrides
      if (editingEvent.value.memberId) {
        overrideData.memberId = editingEvent.value.memberId
      }
      
      // Remove virtual event flags
      delete overrideData.isVirtual
      delete overrideData.isRecurring
      delete overrideData.isBirthday
      
      await addEventToFirestore(overrideData)
    } else {
      // Normal update for real Firestore events
      await updateEventInFirestore(editingEvent.value, {
        ...newEventData.value,
        date: newEventDate.value
      })
    }
    
    showEditEvent.value = false
    editingEvent.value = null
    selectedEvent.value = null
    resetEventForm()
  } catch (error) {
    console.error('Error updating event:', error)
    alert('Failed to update event. Please try again.')
  }
}

const handleShowMonthEvents = () => {
  closeAllDrawers()
  showMonthEvents.value = true
}

const handleToggleMonthEvents = () => {
  if (showMonthEvents.value) {
    showMonthEvents.value = false
  } else {
    closeAllDrawers()
    showMonthEvents.value = true
  }
}

// Watch search results and navigate to first result's month
watch([filteredEvents, searchQuery], ([newFilteredEvents, newSearchQuery]) => {
  // Only navigate if there's an active search query
  if (newSearchQuery && newSearchQuery.trim() && newFilteredEvents.length > 0) {
    // Find the first event with a valid date
    const firstEvent = newFilteredEvents.find(event => event.date)
    if (firstEvent) {
      const eventDate = new Date(firstEvent.date)
      const eventYear = eventDate.getFullYear()
      const eventMonth = eventDate.getMonth()
      
      // Check if we're already on that month
      const currentYear = currentDate.value.getFullYear()
      const currentMonthVal = currentDate.value.getMonth()
      
      if (currentYear !== eventYear || currentMonthVal !== eventMonth) {
        // Navigate to the event's month
        currentDate.value = new Date(eventYear, eventMonth, 1)
      }
    }
  }
}, { immediate: false })

// Get events for current month (without filtering/sorting - that's done in the drawer component)
const monthEvents = computed(() => {
  const year = currentDate.value.getFullYear()
  const month = currentDate.value.getMonth()
  
  const eventsList = searchQuery.value.trim() ? filteredEvents.value : events.value
  
  return eventsList.filter((event) => {
    if (!event.date) return false
      const eventDate = new Date(event.date)
    return eventDate.getFullYear() === year && eventDate.getMonth() === month
  })
})
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Toolbar -->
    <EventsToolbar
      :search-query="searchQuery"
      :show-month-events="showMonthEvents"
      :show-add-event="showAddEvent"
      @update:search-query="searchQuery = $event"
      @add-event="handleAddEvent"
      @toggle-month-events="handleToggleMonthEvents"
    />

    <!-- Main Content -->
    <div class="flex-1 overflow-hidden flex relative">
      <!-- Calendar View -->
      <div class="flex-1 overflow-hidden transition-[flex-basis] duration-300 ease-out">
        <CalendarView
          :current-date="currentDate"
          :current-month="currentMonth"
          :calendar-days="calendarDays"
          :selected-date="selectedDate"
          :loading="loading"
          :events="searchQuery.trim() ? filteredEvents : events"
          :calendar-scroll-ref="calendarScrollRef"
          @navigate-month="navigateMonth"
          @day-click="handleDayClick"
          @event-click="openEventDetails"
          @go-to-today="goToToday"
          @calendar-wheel="handleCalendarWheel"
          @set-date="handleSetDate"
        />
        </div>

      <!-- Day Events Drawer -->
      <DayEventsDrawer
        :show="showDayEvents"
        :loading="loading"
        :selected-day="selectedDay"
        :formatted-selected-day="formattedSelectedDay"
        :day-events="selectedDayEvents"
        @update:show="showDayEvents = $event"
        @event-click="openEventDetails"
        @add-event="handleAddEventFromDay"
      />

      <!-- Month Events Drawer -->
      <MonthEventsDrawer
        :show="showMonthEvents"
        :loading="loading"
        :month-events="monthEvents"
        :current-month="currentMonth"
        :event-type-filter="monthEventTypeFilter"
        :sort-by="monthSortBy"
        :sort-order="monthSortOrder"
        @update:show="showMonthEvents = $event"
        @update:event-type-filter="monthEventTypeFilter = $event"
        @update:sort-by="monthSortBy = $event"
        @update:sort-order="monthSortOrder = $event"
        @event-click="openEventDetails"
      />

      <!-- Add/Edit Event Drawer -->
      <AddEditEventDrawer
        :show="showAddEvent || showEditEvent"
        :is-edit="showEditEvent"
        :event-data="newEventData"
        :event-date="newEventDate"
        :event-types="eventTypes"
        @update:show="handleCancelAddEditEvent"
        @update:event-data="newEventData = $event"
        @update:event-date="newEventDate = $event"
        @save="showEditEvent ? handleSaveEditEvent() : handleSaveAddEvent()"
        @cancel="handleCancelAddEditEvent"
      />

      <!-- Event Details Drawer -->
      <EventDetailsDrawer
        :show="showEventDetails"
        :event="selectedEvent"
        :is-editable="isEventEditable"
        @update:show="showEventDetails = $event; if (!$event) selectedEvent = null"
        @edit="startEditEvent"
        @delete="deleteEvent"
        @back="showEventDetails = false; selectedEvent = null; showMonthEvents = true"
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

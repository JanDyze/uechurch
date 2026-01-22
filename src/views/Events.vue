<script setup>
import { ref, computed, watch } from 'vue'
import { Calendar, Clock, MapPin, Users, X, ChevronRight, Trash2, Plus, Settings, Edit2 } from 'lucide-vue-next'
import * as LucideIcons from 'lucide-vue-next'
import { useEvents } from '../composables/useEvents'
import { useEventForm } from '../composables/useEventForm'
import { usePresetForm } from '../composables/usePresetForm'
import { useEventFilters } from '../composables/useEventFilters'
import { useCalendar } from '../composables/useCalendar'
import EventsToolbar from '../components/events/EventsToolbar.vue'
import CalendarView from '../components/events/CalendarView.vue'
import UpcomingEventsDrawer from '../components/events/UpcomingEventsDrawer.vue'
import MonthEventsDrawer from '../components/events/MonthEventsDrawer.vue'
import DayEventsDrawer from '../components/events/DayEventsDrawer.vue'
import AddEditEventDrawer from '../components/events/AddEditEventDrawer.vue'
import ManagePresetsDrawer from '../components/events/ManagePresetsDrawer.vue'
import AddEditPresetDrawer from '../components/events/AddEditPresetDrawer.vue'
import ConfirmationModal from '../components/common/ConfirmationModal.vue'
import IconSelector from '../components/events/IconSelector.vue'
import EventCardSkeleton from '../components/events/EventCardSkeleton.vue'

// Events data management
const {
  events,
  eventPresets,
  loading,
  addEventToFirestore,
  updateEventInFirestore,
  removeEvent,
  addPresetToFirestore,
  updatePresetInFirestore,
  removePreset,
} = useEvents()

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
  upcomingDaysFilter,
  filteredEvents,
  allEventTypes,
  upcomingEvents
} = useEventFilters(events, searchQuery)

// Event form
const {
  newEventDate,
  newEventData,
  selectedPreset,
  eventTypes,
  resetEventForm,
  updateEventFormFromPreset
} = useEventForm()

// Preset form
const {
  newPreset,
  editingPreset,
  resetPresetForm,
  startEditPreset
} = usePresetForm()

// Modal states
const showEventDetails = ref(false)
const showEditEvent = ref(false)
const showDayEvents = ref(false)
const showManagePresets = ref(false)
const showAddPreset = ref(false)
const showAddEvent = ref(false)
const showSelectPreset = ref(false)
const showUpcomingEvents = ref(false)
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
  showUpcomingEvents.value = false
  showMonthEvents.value = false
  showManagePresets.value = false
  showAddPreset.value = false
  showSelectPreset.value = false
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
const monthEventTypeFilter = ref(null)
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
    study: 'bg-green-500 text-white',
    youth: 'bg-purple-500 text-white',
    prayer: 'bg-yellow-500 text-white',
    outreach: 'bg-orange-500 text-white',
    music: 'bg-pink-500 text-white',
    birthday: 'bg-red-500 text-white'
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

const closeEventDetails = () => {
  showEventDetails.value = false
  selectedEvent.value = null
}

const deleteEvent = async () => {
  if (!selectedEvent.value) return
  
  showConfirmModal({
    title: 'Delete Event',
    message: `Are you sure you want to delete "${selectedEvent.value.title}"?`,
    confirmText: 'Delete',
    cancelText: 'Cancel',
    confirmButtonClass: 'bg-red-600 text-white hover:bg-red-700',
    onConfirm: async () => {
      try {
        await removeEvent(selectedEvent.value)
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
  const { firestoreId, id, ...eventData } = selectedEvent.value
  newEventData.value = { ...eventData }
  newEventDate.value = selectedEvent.value.date
  closeAllDrawers()
  showEditEvent.value = true
}


const cancelEditEvent = () => {
  showEditEvent.value = false
  editingEvent.value = null
  resetEventForm()
}


const addPreset = async () => {
  if (!newPreset.value.title.trim()) return
  
  try {
    await addPresetToFirestore(newPreset.value)
    resetPresetForm()
    showAddPreset.value = false
  } catch (error) {
    console.error('Error adding preset:', error)
    showConfirmModal({
      title: 'Error',
      message: 'Failed to add preset. Please try again.',
      confirmText: 'OK',
      cancelText: '',
      onConfirm: () => {},
    })
  }
}

const saveEditedPreset = async () => {
  if (!newPreset.value.title.trim()) return
  
  try {
    await updatePresetInFirestore(editingPreset.value, newPreset.value)
    resetPresetForm()
    showAddPreset.value = false
  } catch (error) {
    console.error('Error updating preset:', error)
    showConfirmModal({
      title: 'Error',
      message: 'Failed to update preset. Please try again.',
      confirmText: 'OK',
      cancelText: '',
      onConfirm: () => {},
    })
  }
}

const deletePreset = async (preset) => {
  showConfirmModal({
    title: 'Delete Preset',
    message: `Are you sure you want to delete "${preset.title}"?`,
    confirmText: 'Delete',
    cancelText: 'Cancel',
    confirmButtonClass: 'bg-red-600 text-white hover:bg-red-700',
    onConfirm: async () => {
      try {
        await removePreset(preset)
      } catch (error) {
        console.error('Error deleting preset:', error)
        showConfirmModal({
          title: 'Error',
          message: 'Failed to delete preset. Please try again.',
          confirmText: 'OK',
          cancelText: '',
          onConfirm: () => {},
        })
      }
    }
  })
}

const cancelEdit = () => {
  resetPresetForm()
  showAddPreset.value = false
  showManagePresets.value = false
}

const usePreset = (preset) => {
  updateEventFormFromPreset(preset)
  closeAllDrawers()
  showAddEvent.value = true
  newEventDate.value = selectedDayDateString.value || formatDateString(new Date())
}

const handleEditPreset = (preset) => {
  startEditPreset(preset)
  closeAllDrawers()
  showAddPreset.value = true
}

const handleAddPreset = () => {
  resetPresetForm()
  closeAllDrawers()
  showAddPreset.value = true
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

const handleManagePresets = () => {
  closeAllDrawers()
  showManagePresets.value = true
}

const handleSavePreset = async () => {
  if (editingPreset.value) {
    await saveEditedPreset()
  } else {
    await addPreset()
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
    await updateEventInFirestore(editingEvent.value, {
      ...newEventData.value,
      date: newEventDate.value
    })
    
    showEditEvent.value = false
    editingEvent.value = null
    selectedEvent.value = null
    resetEventForm()
  } catch (error) {
    console.error('Error updating event:', error)
    alert('Failed to update event. Please try again.')
  }
}

const handleToggleUpcomingEvents = () => {
  if (showUpcomingEvents.value) {
    showUpcomingEvents.value = false
  } else {
    closeAllDrawers()
    showUpcomingEvents.value = true
  }
}

const handleShowMonthEvents = () => {
  closeAllDrawers()
  showMonthEvents.value = true
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
      const currentMonth = currentDate.value.getMonth()
      
      if (currentYear !== eventYear || currentMonth !== eventMonth) {
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
      :show-upcoming-events="showUpcomingEvents"
      :show-add-event="showAddEvent"
      @update:search-query="searchQuery = $event"
      @manage-presets="handleManagePresets"
      @add-event="handleAddEvent"
      @toggle-upcoming-events="handleToggleUpcomingEvents"
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
          @show-month-events="handleShowMonthEvents"
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

      <!-- Upcoming Events Drawer -->
      <UpcomingEventsDrawer
        :show="showUpcomingEvents"
        :loading="loading"
        :upcoming-events="upcomingEvents"
        :event-type-filter="eventTypeFilter"
        :upcoming-days-filter="upcomingDaysFilter"
        @update:show="showUpcomingEvents = $event"
        @update:event-type-filter="eventTypeFilter = $event"
        @update:upcoming-days-filter="upcomingDaysFilter = $event"
        @event-click="openEventDetails"
      />

      <!-- Add/Edit Event Drawer -->
      <AddEditEventDrawer
        :show="showAddEvent || showEditEvent"
        :is-edit="showEditEvent"
        :event-data="newEventData"
        :event-date="newEventDate"
        :event-types="eventTypes"
        :event-presets="eventPresets"
        :selected-preset="selectedPreset"
        @update:show="handleCancelAddEditEvent"
        @update:event-data="newEventData = $event"
        @update:event-date="newEventDate = $event"
        @update:selected-preset="selectedPreset = $event"
        @save="showEditEvent ? handleSaveEditEvent() : handleSaveAddEvent()"
        @cancel="handleCancelAddEditEvent"
        @show-select-preset="closeAllDrawers(); showSelectPreset = true"
      />
    </div>

    <!-- Event Details Modal -->
    <Transition name="modal">
      <div
        v-if="showEventDetails && selectedEvent"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        @click="closeEventDetails"
      >
        <div
          class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto"
          @click.stop
        >
          <div class="p-6">
            <!-- Header -->
            <div class="flex items-start justify-between mb-4">
              <div
                :class="[
                  'w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0',
                  getEventTypeColor(selectedEvent.type),
                ]"
              >
                <component :is="getIconComponent(selectedEvent.icon || 'Calendar')" class="h-6 w-6" />
              </div>
              <button
                @click="closeEventDetails"
                class="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <ChevronRight class="h-5 w-5 rotate-90" />
              </button>
            </div>

            <!-- Event Info -->
            <div>
              <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                {{ selectedEvent.title }}
              </h2>
              <div class="space-y-3">
                <div class="flex items-center gap-3 text-gray-600 dark:text-gray-400">
                  <Calendar class="h-5 w-5 text-gray-400" />
                  <span>
                    {{
                      new Date(selectedEvent.date).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })
                    }}
                  </span>
                </div>
                <div class="flex items-center gap-3 text-gray-600 dark:text-gray-400">
                  <Clock class="h-5 w-5 text-gray-400" />
                  <span>{{ selectedEvent.time }}</span>
                </div>
                <div class="flex items-center gap-3 text-gray-600 dark:text-gray-400">
                  <MapPin class="h-5 w-5 text-gray-400" />
                  <span>{{ selectedEvent.location }}</span>
                </div>
                <div class="flex items-center gap-3 text-gray-600 dark:text-gray-400">
                  <Users class="h-5 w-5 text-gray-400" />
                  <span>{{ selectedEvent.attendees }} expected attendees</span>
                </div>
              </div>

              <div class="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                  Description
                </h3>
                <p class="text-sm text-gray-600 dark:text-gray-400">
                  {{ selectedEvent.description }}
                </p>
              </div>

              <div class="mt-6 flex gap-3">
                <button
                  @click="startEditEvent"
                  class="flex-1 px-4 py-2 bg-[#01779b] text-white rounded-lg hover:bg-[#015a77] transition-colors"
                >
                  Edit Event
                </button>
                <button
                  @click="deleteEvent"
                  class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Trash2 class="h-4 w-4" />
                  Delete
                </button>
                <button
                  @click="closeEventDetails"
                  class="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>


    <!-- Manage Presets Drawer -->
    <ManagePresetsDrawer
      :show="showManagePresets"
      :presets="eventPresets"
      @update:show="showManagePresets = $event"
      @add-preset="handleAddPreset"
      @edit-preset="handleEditPreset"
      @use-preset="usePreset"
      @delete-preset="deletePreset"
    />

    <!-- Add/Edit Preset Drawer -->
    <AddEditPresetDrawer
      :show="showAddPreset"
      :is-edit="!!editingPreset"
      :preset-data="newPreset"
      :event-types="eventTypes"
      @update:show="showAddPreset = $event"
      @update:preset-data="newPreset = $event"
      @save="handleSavePreset"
      @cancel="cancelEdit"
    />

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

    <!-- Select Preset Modal -->
    <Transition name="modal">
      <div
        v-if="showSelectPreset"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        @click="showSelectPreset = false"
      >
        <div
          class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col"
          @click.stop
        >
          <div class="p-6 flex-shrink-0 border-b border-gray-200 dark:border-gray-700">
            <div class="flex items-center justify-between">
              <h2 class="text-xl font-bold text-gray-900 dark:text-white">Select a Preset</h2>
              <button
                @click="showSelectPreset = false"
                class="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <X class="h-5 w-5" />
              </button>
            </div>
          </div>

          <!-- Presets List (Scrollable) -->
          <div class="flex-1 overflow-y-auto px-6 min-h-0 max-h-96">
            <div class="space-y-2 pb-4">
              <div
                v-if="eventPresets.length === 0"
                class="text-center text-gray-500 dark:text-gray-400 py-8"
              >
                No presets available. Create one in Manage Presets!
              </div>
              <button
                v-for="preset in eventPresets"
                :key="preset.id || preset.firestoreId"
                @click="updateEventFormFromPreset(preset); showSelectPreset = false"
                class="w-full text-left p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <div class="flex items-start gap-3">
                  <div
                    :class="[
                      'w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0',
                      getEventTypeColor(preset.type),
                    ]"
                  >
                    <component :is="getIconComponent(preset.icon || 'Calendar')" class="h-6 w-6" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-1">
                      <span
                        :class="[
                          'px-2 py-0.5 text-xs rounded-full capitalize',
                          getEventTypeColor(preset.type),
                        ]"
                      >
                        {{ preset.type }}
                      </span>
                      <h3 class="font-semibold text-sm text-gray-900 dark:text-white">
                        {{ preset.title }}
                      </h3>
                    </div>
                    <div class="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                      <div class="flex items-center gap-4">
                        <span class="flex items-center gap-1">
                          <Clock class="h-3 w-3" />
                          {{ preset.time }}
                        </span>
                        <span v-if="preset.location" class="flex items-center gap-1">
                          <MapPin class="h-3 w-3" />
                          {{ preset.location }}
                        </span>
                        <span v-if="preset.attendees" class="flex items-center gap-1">
                          <Users class="h-3 w-3" />
                          {{ preset.attendees }}
                        </span>
                      </div>
                      <p v-if="preset.description" class="text-xs mt-1">
                        {{ preset.description }}
                      </p>
                    </div>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>

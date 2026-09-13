<script setup>
import { ref, computed, watch } from 'vue'
import { useEvents } from '../composables/useEvents'
import { useMembers } from '../composables/useMembers'
import { useBirthdayEvents } from '../composables/useBirthdayEvents'
import { useRecurringEvents } from '../composables/useRecurringEvents'
import { useEventForm } from '../composables/useEventForm'
import { useEventSearch } from '../composables/useEventSearch'
import { useCalendar } from '../composables/useCalendar'
import EventsToolbar from '../components/events/EventsToolbar.vue'
import EventsFab from '../components/events/EventsFab.vue'
import CalendarView from '../components/events/CalendarView.vue'
import MonthEventsDrawer from '../components/events/MonthEventsDrawer.vue'
import DayEventsDrawer from '../components/events/DayEventsDrawer.vue'
import AddEditEventDrawer from '../components/events/AddEditEventDrawer.vue'
import ConfirmationModal from '../components/common/ConfirmationModal.vue'
import EventDetailsDrawer from '../components/events/EventDetailsDrawer.vue'
import EventStatusSheet from '../components/events/EventStatusSheet.vue'
import { useEventStatus } from '../composables/useEventStatus'

// Events data management
const {
  events: firestoreEvents,
  loading,
  addEventToFirestore,
  updateEventInFirestore,
  removeEvent,
  removeOccurrence,
} = useEvents()

// Members data for birthdays
const { members } = useMembers()

// Birthday events from members (pass firestoreEvents to check for overrides)
const { birthdayEvents } = useBirthdayEvents(members, firestoreEvents)

// Recurring events, expanded from the schedules configured in Settings.
// firestoreEvents is passed so per-date overrides win; members sets attendee count.
const { recurringEvents } = useRecurringEvents(firestoreEvents, members)

// Merge Firestore events with birthday events and recurring events
const events = computed(() => {
  // A called-off gathering STAYS on the calendar, struck through and labelled.
  // It used to be filtered out here, which meant cancelling the Sunday service
  // made it silently disappear — and a service that vanishes without a word is
  // how somebody drives to a locked building.
  //
  // The exceptions are the two overrides that exist only to take something off
  // the calendar: a birthday somebody hid — there is nothing to tell the church
  // about a birthday being off, and a struck-through name would read as
  // something much worse than "not shown" — and an occurrence somebody deleted,
  // where the document is only there to stop the schedule generating that date
  // again.
  const visibleFirestoreEvents = firestoreEvents.value.filter(
    (e) =>
      !e.hidden && !(e.isCancelled && String(e.overrideOf || '').startsWith('birthday-'))
  )

  return [
    ...visibleFirestoreEvents,
    ...birthdayEvents.value,
    ...recurringEvents.value
  ].sort((a, b) => {
    return new Date(a.date) - new Date(b.date)
  })
})

// Search is a mode, opened from the floating button. Closing it clears the
// query, because a bar you cannot see must not still be narrowing the month.
const searchQuery = ref('')
const searchOpen = ref(false)
const openSearch = () => { searchOpen.value = true }
const closeSearch = () => {
  searchOpen.value = false
  searchQuery.value = ''
}

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
  goToToday: baseGoToToday
} = useCalendar()

const goToToday = () => {
  baseGoToToday()
  handleDayClick({ fullDate: new Date() })
}

// Search is the only way the calendar is narrowed - it matches the type,
// month, weekday and whether an event is a birthday or part of a weekly
// series, not just the title.
const { filteredEvents } = useEventSearch(events, searchQuery)

// What the calendar and the month card are actually showing: a search for
// "prayer" narrows both to the prayer meetings.
//
// There is no summary above them any more. Three tiles and a type bar cost a
// phone a fifth of its height on every visit to answer questions the grid
// answers by being looked at — what is next, how busy the week is — and Home
// already reports the month for anyone taking stock.
const visibleEvents = computed(() =>
  searchQuery.value.trim() ? filteredEvents.value : events.value
)

// Event form
const {
  newEventDate,
  newEventData,
  eventTypes,
  resetEventForm,
  expectedFromTags,
} = useEventForm(members)

// Modal states
const showEventDetails = ref(false)
const showEditEvent = ref(false)
const showDayEvents = ref(false)
const showAddEvent = ref(false)
// The calendar is what the page is. A grid of the month answers "what is on,
// and when" in one look — where it falls in the week, which days are empty,
// how the weeks are shaped — and the month list answers only the first half of
// that. The list is one tap away on the floating button for whoever wants it.
const showMonthEvents = ref(false)

// Where "Back" should return to. A day or an event can be reached from the
// calendar or from the month list, and backing out should land where you
// started. It used to force the list open, which was harmless when the list
// was the only way in and wrong the moment the calendar became the default.
const cameFromMonthList = ref(false)

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

// Selected event/day
const selectedEvent = ref(null)
const editingEvent = ref(null)
const selectedDay = ref(null)

// Get events for a specific date
const getEventsForDate = (date) => {
  const dateString = formatDateString(date)
  return visibleEvents.value.filter((event) => event.date === dateString)
}

// Event handlers
const openEventDetails = (event) => {
  selectedEvent.value = event
  // Only when it is the list we are coming from: an event opened out of the
  // day drawer should not send you to the month list on the way back.
  if (showMonthEvents.value) cameFromMonthList.value = true
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

// Calling something off is not deleting it, and the two are deliberately kept
// apart: delete throws the record away, this keeps it and says what happened.
const { setStatus } = useEventStatus()
const showStatusSheet = ref(false)
const statusTarget = ref(null)

const openStatusSheet = () => {
  statusTarget.value = selectedEvent.value
  showStatusSheet.value = true
}

const applyStatus = async (change) => {
  const target = statusTarget.value
  if (!target) return
  try {
    await setStatus(target, change)
    showStatusSheet.value = false
    statusTarget.value = null
    closeEventDetails()
  } catch (error) {
    console.error('Error changing event status:', error)
    showStatusSheet.value = false
    showConfirmModal({
      title: 'Error',
      message: 'Could not change that. Please try again.',
      confirmText: 'OK',
      cancelText: '',
      onConfirm: () => {},
    })
  }
}

// One occurrence of a weekly schedule, whether it is still generated or has
// already been overridden by an edit for that date. Both are deleted the same
// way — see hideOccurrence in eventsService.js — and neither touches the
// schedule itself.
const isOccurrence = (event) =>
  Boolean(event?.isVirtual && event?.isRecurring) ||
  String(event?.overrideOf || '').startsWith('recurring-')

// Three different things behind one button. Deleting a stored event throws the
// record away; a birthday is hidden, because it is generated from a member and
// there is nothing to delete; and a weekly occurrence is not a document at all,
// so deleting it writes the override that stands in for it. Calling it off is
// still the other answer, on its own button — a service that was cancelled
// belongs on the calendar marked, not gone.
const deleteEvent = async () => {
  if (!selectedEvent.value) return

  const isBirthday = Boolean(selectedEvent.value.isBirthday || selectedEvent.value.memberId)
  const isVirtualEvent = selectedEvent.value.isVirtual
  const occurrence = !isBirthday && isOccurrence(selectedEvent.value)
  const eventTitle = selectedEvent.value.title

  showConfirmModal({
    title: isBirthday ? 'Hide Birthday' : occurrence ? 'Delete This Date' : 'Delete Event',
    message: isBirthday
      ? `Hide "${eventTitle}" from the calendar for this date?`
      : occurrence
        ? `Remove "${eventTitle}" from ${selectedEvent.value.date}? Only this date goes — the weekly schedule keeps running. To leave it on the calendar marked as not happening, call it off instead.`
        : `Are you sure you want to delete "${eventTitle}"?`,
    confirmText: isBirthday ? 'Hide' : 'Delete',
    cancelText: 'Keep',
    confirmButtonClass: 'bg-red-600 text-white hover:bg-red-700',
    onConfirm: async () => {
      try {
        if (occurrence) {
          await removeOccurrence(selectedEvent.value)
        } else if (isVirtualEvent) {
          // A birthday is generated from the member, so hiding it is an
          // override that stands in for it and shows nothing.
          const cancelData = {
            title: eventTitle,
            type: selectedEvent.value.type,
            date: selectedEvent.value.date,
            time: selectedEvent.value.time,
            location: selectedEvent.value.location || '',
            description: 'Hidden',
            attendees: 0,
            icon: selectedEvent.value.icon || 'Calendar',
            overrideOf: selectedEvent.value.id,
            isOverride: true,
            isCancelled: true,
          }

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
  cameFromMonthList.value = showMonthEvents.value
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
  // `attendees` is dropped on purpose: the count follows from the tags now, so
  // carrying the stored one through the form would let the picker show one
  // number and the save write another. An event from before audiences existed
  // opens as "Everyone" and picks up the roster rule.
  const { firestoreId, id, isVirtual, attendees, ...eventData } = selectedEvent.value
  newEventData.value = {
    ...eventData,
    audienceTags: eventData.audienceTags || [],
    excludeTags: eventData.excludeTags || [],
  }
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

const selectedDayHoliday = computed(() => {
  if (!selectedDay.value) return null
  return getHolidayForDate(selectedDay.value) || null
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
    audienceTags: newEventData.value.audienceTags || [],
    excludeTags: newEventData.value.excludeTags || [],
    // The count the tags produce, stored alongside them so anything reading the
    // document straight still finds a number. Screens recount it live.
    attendees: expectedFromTags.value,
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
        attendees: expectedFromTags.value,
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
        attendees: expectedFromTags.value,
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

// A search that matches nothing in the month on screen would otherwise look
// like it matched nothing at all, so the calendar follows the first hit.
//
// The month is read off the 'YYYY-MM' prefix rather than a parsed Date -
// `new Date('2026-09-01')` is UTC midnight, still August west of Greenwich,
// and searching for a first-of-the-month event would land a month early.
watch([filteredEvents, searchQuery], ([matches, query]) => {
  if (!query || !query.trim() || matches.length === 0) return

  const earliest = matches
    .map((event) => String(event.date || ''))
    .filter((date) => date.length >= 7)
    .sort()[0]
  if (!earliest) return

  const [year, month] = earliest.split('-').map(Number)
  if (currentDate.value.getFullYear() === year && currentDate.value.getMonth() === month - 1) return

  currentDate.value = new Date(year, month - 1, 1)
}, { immediate: false })

// Events in the month on screen. Matched on the raw 'YYYY-MM' prefix rather
// than a parsed Date: `new Date('2026-08-01')` is UTC midnight, which is still
// July anywhere west of Greenwich, and would file the first of the month under
// the previous one - the same rule useEventStats follows on Home, so the two
// pages can never disagree about what a month holds.
const monthKey = computed(
  () => `${currentDate.value.getFullYear()}-${String(currentDate.value.getMonth() + 1).padStart(2, '0')}`
)

const monthEvents = computed(() =>
  visibleEvents.value.filter((event) => String(event.date || '').slice(0, 7) === monthKey.value)
)

// A drawer or the details card would sit under the button, and each carries
// its own actions anyway.
const showFab = computed(
  () => !showAddEvent.value && !showEditEvent.value && !showEventDetails.value && !showDayEvents.value
)
</script>

<template>
  <div class="relative flex flex-col h-full">
    <!-- Opened from the floating button, alongside adding, switching views
         and jumping to today -->
    <EventsToolbar
      :search-query="searchQuery"
      :open="searchOpen"
      :result-count="filteredEvents.length"
      :total-count="events.length"
      @update:search-query="searchQuery = $event"
      @close="closeSearch"
    />

    <!-- Main Content -->
    <div class="flex-1 overflow-hidden flex flex-col lg:flex-row relative">
      <!-- Calendar View -->
      <div
        :class="[
          'flex-1 overflow-hidden transition-all duration-300 ease-out',
          (showDayEvents || showMonthEvents) ? 'hidden lg:block' : 'block'
        ]"
      >
        <CalendarView
          :current-date="currentDate"
          :current-month="currentMonth"
          :calendar-days="calendarDays"
          :selected-date="selectedDate"
          :loading="loading"
          :events="visibleEvents"
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
        :holiday="selectedDayHoliday"
        @update:show="showDayEvents = $event"
        @event-click="openEventDetails"
        @add-event="handleAddEventFromDay"
        @back="showDayEvents = false; showMonthEvents = cameFromMonthList"
      />

      <!-- Month Events Drawer -->
      <MonthEventsDrawer
        :show="showMonthEvents"
        :loading="loading"
        :month-events="monthEvents"
        :current-month="currentMonth"
        :current-date="currentDate"
        :searching="!!searchQuery.trim()"
        @update:show="showMonthEvents = $event"
        @event-click="openEventDetails"
        @navigate-month="navigateMonth"
        @set-date="handleSetDate"
      />

      <!-- Add/Edit Event Drawer -->
      <AddEditEventDrawer
        :show="showAddEvent || showEditEvent"
        :is-edit="showEditEvent"
        :event-data="newEventData"
        :event-date="newEventDate"
        :event-types="eventTypes"
        :members="members"
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
        :members="members"
        :is-editable="isEventEditable"
        @update:show="showEventDetails = $event; if (!$event) selectedEvent = null"
        @edit="startEditEvent"
        @delete="deleteEvent"
        @status="openStatusSheet"
        @back="showEventDetails = false; selectedEvent = null; showMonthEvents = cameFromMonthList"
      />
    </div>

    <!-- Cancelled or postponed, from wherever you happen to be looking at it.
         The same sheet opens on the Attendance page. -->
    <EventStatusSheet
      :show="showStatusSheet"
      :event="statusTarget"
      @close="showStatusSheet = false"
      @apply="applyStatus"
    />

    <!-- Floating actions -->
    <EventsFab
      v-if="showFab"
      :show-month-events="showMonthEvents"
      @search="openSearch"
      @add="handleAddEvent"
      @toggle-list="handleToggleMonthEvents"
      @today="goToToday"
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
  </div>
</template>

import { ref, onMounted, onUnmounted, computed } from 'vue'
import { subscribeToAttendance, addAttendance, updateAttendance, deleteAttendance } from '../api/attendanceService'
import { useEvents } from './useEvents'
import { useMinutes } from './useMinutes'

export function useAttendance() {
  const attendance = ref([])
  const loading = ref(true)
  let unsubscribe = null

  const { events } = useEvents()
  const { minutes } = useMinutes()

  onMounted(() => {
    unsubscribe = subscribeToAttendance((data) => {
      attendance.value = data
      loading.value = false
    })
  })

  onUnmounted(() => {
    if (unsubscribe) {
      unsubscribe()
    }
  })

  // Helper to check if date is today or in the past
  const isPastOrToday = (dateString) => {
    if (!dateString) return false
    const eventDate = new Date(dateString)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    eventDate.setHours(0, 0, 0, 0)
    return eventDate <= today
  }

  // Aggregate attendance from events and minutes
  const aggregatedAttendance = computed(() => {
    const records = []
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Create a map of attendance records by eventId to check for duplicates
    const attendanceByEventId = new Map()
    attendance.value.forEach(record => {
      if (record.eventId) {
        attendanceByEventId.set(record.eventId, record)
      }
    })

    // Add attendance records from dedicated attendance collection
    attendance.value.forEach(record => {
      // Find the linked event if eventId exists
      let linkedEvent = null
      if (record.eventId) {
        linkedEvent = events.value.find(e => 
          (e.firestoreId || e.id) === record.eventId
        )
      }

      // If linked to an event, keep it as "event" source, otherwise "attendance"
      const source = linkedEvent ? 'event' : 'attendance'

      records.push({
        ...record,
        source: source,
        // Include expected attendees from linked event
        expectedAttendees: linkedEvent ? (linkedEvent.attendees || 0) : (record.expectedAttendees || 0)
      })
    })

    // Add attendance from minutes (only if past or today)
    minutes.value.forEach(minute => {
      if (isPastOrToday(minute.date)) {
        records.push({
          id: `minute-${minute.id || minute.firestoreId}`,
          firestoreId: minute.firestoreId || minute.id,
          eventId: minute.firestoreId || minute.id,
          eventType: 'meeting',
          eventTitle: minute.title || 'Meeting',
          date: minute.date || '',
          time: minute.startTime || '',
          location: minute.location || '',
          attendees: minute.attendees || [],
          totalAttendees: minute.attendees?.length || 0,
          notes: '',
          source: 'minute',
          createdAt: minute.createdAt || new Date(),
          updatedAt: minute.updatedAt || new Date()
        })
      }
    })

    // Add events that are past or today, but only if no attendance record exists for them
    events.value.forEach(event => {
      if (isPastOrToday(event.date)) {
        const eventId = event.firestoreId || event.id
        // Only add event if there's no attendance record for it
        if (!attendanceByEventId.has(eventId)) {
          records.push({
            id: `event-${eventId}`,
            firestoreId: eventId,
            eventId: eventId,
            eventType: event.type || 'event',
            eventTitle: event.title || 'Event',
            date: event.date || '',
            time: event.time || '',
            location: event.location || '',
            attendees: [], // Events don't track individual members
            expectedAttendees: event.attendees || 0, // Expected/planned attendees
            totalAttendees: 0, // Actual recorded attendance (0 for events)
            notes: event.description || '',
            source: 'event',
            createdAt: new Date(),
            updatedAt: new Date()
          })
        }
      }
    })

    // Sort by date descending
    return records.sort((a, b) => {
      const dateA = new Date(a.date || 0)
      const dateB = new Date(b.date || 0)
      return dateB - dateA
    })
  })

  const addAttendanceToFirestore = async (attendanceData) => {
    return await addAttendance(attendanceData)
  }

  const updateAttendanceInFirestore = async (attendance, updatedData) => {
    return await updateAttendance(attendance, updatedData)
  }

  const removeAttendance = async (attendance) => {
    return await deleteAttendance(attendance)
  }

  return {
    attendance,
    aggregatedAttendance,
    loading,
    addAttendanceToFirestore,
    updateAttendanceInFirestore,
    removeAttendance
  }
}


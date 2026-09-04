import { ref, onMounted, onUnmounted, computed } from 'vue'
import { subscribeToAttendance, addAttendance, updateAttendance, deleteAttendance } from '../api/attendanceService'
import { useEvents } from './useEvents'
import { useMembers } from './useMembers'
import { useMinutes } from './useMinutes'
import { useRecurringEvents } from './useRecurringEvents'
import { readProvenance, ATTENDANCE_START_DATE, ATTENDANCE_SOURCES } from '../../lib/attendance'
import { readExpectedAttendance, audienceTagsOf, excludeTagsOf } from '../utils/audience'

export function useAttendance() {
  const attendance = ref([])
  const loading = ref(true)
  let unsubscribe = null
  let clock = null

  // Recurring occurrences appear once their schedule's lead time opens, so the
  // list has to re-evaluate as the clock moves - otherwise someone who opened
  // the app at 8:20 would still see nothing at 8:30 without a refresh.
  const now = ref(Date.now())

  const { events } = useEvents()
  const { minutes } = useMinutes()
  // The roster every expected count is read off: a gathering names the tags it
  // is for, and how many that is depends on who carries them today.
  const { members } = useMembers()
  // Services configured in Settings, expanded into dated occurrences. The
  // schedules themselves are needed too: a recorded service has no event
  // document behind it, so its schedule is the only thing still carrying the
  // tags its expected head is counted off.
  const { recurringEvents, schedules } = useRecurringEvents(events, members)

  onMounted(() => {
    unsubscribe = subscribeToAttendance((data) => {
      attendance.value = data
      loading.value = false
    })
    clock = setInterval(() => {
      now.value = Date.now()
    }, 60 * 1000)
  })

  onUnmounted(() => {
    if (unsubscribe) {
      unsubscribe()
    }
    if (clock) {
      clearInterval(clock)
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

  // A gathering only counts as "still to record" if it happened in the window
  // where recording was actually being done. Everything older is history that
  // was never going to be filled in.
  const awaitsRecording = (dateString) =>
    isPastOrToday(dateString) && String(dateString) >= ATTENDANCE_START_DATE

  // Aggregate attendance from events and minutes
  const aggregatedAttendance = computed(() => {
    const records = []
    const today = new Date(now.value)
    today.setHours(0, 0, 0, 0)

    // Which occurrences already have a record, so the loops below know what
    // still needs recording. Keyed on occurrenceKey rather than the old
    // overloaded eventId — a one-off has no key and so can never collide.
    const minuteIds = new Set(minutes.value.map(m => m.firestoreId || m.id))
    const recordedKeys = new Map()
    attendance.value.forEach(record => {
      const { occurrenceKey } = readProvenance(record, { knownMinuteIds: minuteIds })
      if (occurrenceKey) recordedKeys.set(occurrenceKey, record)
    })

    // Add attendance records from dedicated attendance collection.
    // `rowType` describes where a row LIVES, not what it points at (that is
    // `source`, from lib/attendance.js): every saved
    // attendance document is owned by this page and stays editable/deletable,
    // whether or not it was recorded against an event. Only the placeholder
    // rows synthesised below from events/minutes are read-only here.
    attendance.value.forEach(record => {
      // Find the event or meeting this record was recorded against, if any
      let linkedEvent = null
      let linkedMinute = null
      if (record.eventId) {
        linkedEvent =
          events.value.find(e => (e.firestoreId || e.id) === record.eventId) || null
        if (!linkedEvent) {
          linkedMinute =
            minutes.value.find(m => (m.firestoreId || m.id) === record.eventId) || null
        }
      }

      // A service recorded against a Settings schedule points at no document
      // in `events`, so the lookup above finds nothing and the schedule is
      // what has to be asked for its tags.
      const linkedSchedule =
        record.source === ATTENDANCE_SOURCES.SCHEDULE && record.sourceId
          ? schedules.value.find(s => s.id === record.sourceId) || null
          : null

      // What this record is for, asked of whatever still exists: the event or
      // schedule it was recorded against first, then the tags copied onto the
      // record itself when that source is gone. Only a gathering naming none
      // is read as the whole church.
      //
      // Recounted here rather than trusted from the document, because the
      // stored number is a snapshot of the day it was saved: tag ten people
      // into the choir this morning and last month's practice has to report
      // out of ten, not out of the hundred it was written with.
      const audience = linkedEvent || linkedSchedule || record

      records.push({
        ...record,
        rowType: 'attendance',
        // Title/date belong to the event or meeting, so they are shown read-only
        linkedSource: linkedEvent ? 'event' : linkedMinute ? 'minute' : null,
        expectedAttendees: readExpectedAttendance(audience, members.value),
        // Who the gathering was for, so the recorder shows the same roll and
        // the list the same denominator.
        audienceTags: audienceTagsOf(audience),
        excludeTags: excludeTagsOf(audience)
      })
    })

    // Add attendance from minutes (only if past or today), unless attendance
    // has already been recorded for that meeting - same de-duplication the
    // events loop below does, otherwise the meeting shows up twice.
    minutes.value.forEach(minute => {
      const minuteId = minute.firestoreId || minute.id
      if (awaitsRecording(minute.date) && !recordedKeys.has(minuteId)) {
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
          rowType: 'minute',
          createdAt: minute.createdAt || new Date(),
          updatedAt: minute.updatedAt || new Date()
        })
      }
    })

    // Add events that are past or today, but only if no attendance record exists for them
    events.value.forEach(event => {
      if (awaitsRecording(event.date)) {
        const eventId = event.firestoreId || event.id
        // Only add event if there's no attendance record for it
        if (!recordedKeys.has(eventId)) {
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
            // Counted from the event's tags, not the number stored on it
            expectedAttendees: readExpectedAttendance(event, members.value),
            audienceTags: event.audienceTags || [],
            excludeTags: event.excludeTags || [],
            totalAttendees: 0, // Actual recorded attendance (0 for events)
            notes: event.description || '',
            rowType: 'event',
            createdAt: new Date(),
            updatedAt: new Date()
          })
        }
      }
    })

    // Add recurring services from Settings. Nothing older than the current
    // month, so a weekly service does not flood the list with a year of past
    // dates, and nothing before its lead time opens - a schedule set to "1 hour
    // before" puts the 9:00 service in this list from 8:00, so whoever arrives
    // early records against it instead of creating a duplicate one-off event.
    // The lead time is per schedule: Settings > Schedule > Show in attendance.
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)

    recurringEvents.value.forEach(event => {
      // Local parse: `new Date('2026-08-30')` is UTC midnight, a day off west
      // of Greenwich.
      const eventDate = new Date(`${event.date}T00:00:00`)
      if (Number.isNaN(eventDate.getTime()) || eventDate < monthStart) return
      // The schedule has always existed; recording against it has not.
      if (String(event.date) < ATTENDANCE_START_DATE) return

      if (!event.visibleFrom || now.value < event.visibleFrom.getTime()) return
      // Already recorded, or replaced by a saved event for that date
      if (recordedKeys.has(event.id)) return

      records.push({
        id: event.id,
        firestoreId: null, // Generated from a schedule, not a stored event
        eventId: event.id,
        eventType: event.type || 'worship',
        eventTitle: event.title || 'Service',
        date: event.date || '',
        time: event.time || '',
        location: event.location || '',
        attendees: [],
        expectedAttendees: event.attendees || 0, // already counted from the schedule's tags
        audienceTags: event.audienceTags || [],
        excludeTags: event.excludeTags || [],
        totalAttendees: 0,
        notes: event.description || '',
        rowType: 'recurring',
        createdAt: new Date(),
        updatedAt: new Date()
      })
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


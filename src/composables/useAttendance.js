import { ref, onMounted, onUnmounted, computed } from 'vue'
import { subscribeToAttendance, addAttendance, updateAttendance, deleteAttendance } from '../api/attendanceService'
import { useEvents } from './useEvents'
import { useMembers } from './useMembers'
import { useMinutes } from './useMinutes'
import { useRecurringEvents } from './useRecurringEvents'
import {
  readProvenance,
  provenanceForRow,
  mergeAttendanceRecords,
  hasRegister,
  ATTENDANCE_START_DATE,
  ATTENDANCE_SOURCES,
} from '../../lib/attendance'
import { readEventStatus, isCalledOff } from '../../lib/eventStatus'
import {
  readExpectedAttendance,
  audienceTagsOf,
  excludeTagsOf,
  meetingTagOptions,
  meetingTagOf,
  membersAtMeeting,
} from '../utils/audience'

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
  // Meetings keep their register on the minute itself, so this is a store of
  // attendance as much as it is a list of write-ups — see lib/attendance.js.
  const { minutes, updateMinuteInFirestore } = useMinutes()
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

  /**
   * Every gathering somebody has counted, whichever store holds it: the
   * attendance collection, or a minute's own register. One row per gathering —
   * lib/attendance.js owns the question of which store speaks for it, so no
   * screen can answer it differently and call the same meeting unrecorded.
   */
  const recorded = computed(() => mergeAttendanceRecords(attendance.value, minutes.value))

  // Aggregate what has been recorded with what is still waiting to be
  const aggregatedAttendance = computed(() => {
    const records = []
    const today = new Date(now.value)
    today.setHours(0, 0, 0, 0)

    // Which occurrences are already spoken for, so the loops below know what
    // still needs recording. Keyed on occurrenceKey rather than the old
    // overloaded eventId — a one-off has no key and so can never collide.
    const recordedKeys = new Set(
      recorded.value.map((record) => record.occurrenceKey).filter(Boolean)
    )

    // The vocabulary a meeting's group is read against — every tag and
    // ministry anybody carries. Built once: it is the same for every row.
    const meetingTags = meetingTagOptions(members.value)

    // `rowType` describes where a row LIVES, not what it points at (that is
    // `source`, from lib/attendance.js): 'attendance' is a saved document this
    // page owns and may edit or delete, 'minute' is a meeting whose register is
    // written on the minute. Whether either has been COUNTED is a different
    // question again, and `isRecorded` is the only thing allowed to answer it.
    recorded.value.forEach(record => {
      if (record.derived) {
        // A minute can carry names before the meeting happens - they are who
        // is expected, not who came - so a meeting joins this list on its own
        // day and not before.
        if (!isPastOrToday(record.date)) return
        // And a meeting nobody has marked is a prompt rather than a record: it
        // belongs here only while it is work still owed.
        if (!hasRegister(record) && !awaitsRecording(record.date)) return
      }

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

      // A meeting's group is read exactly as the minute itself reads it: the
      // tag stored on it, or the one its title plainly names, matched across
      // tags and ministries because that is the vocabulary a minute picks from
      // (utils/audience.js). Without this the CSL monthly meeting was counted
      // out of its own register — twelve of twelve — instead of out of the
      // nine people it is for.
      const meetingTag =
        record.source === ATTENDANCE_SOURCES.MINUTE
          ? meetingTagOf(linkedMinute || record, meetingTags)
          : ''

      records.push({
        ...record,
        rowType: record.derived ? 'minute' : 'attendance',
        // Title/date belong to the event or meeting, so they are shown read-only
        linkedSource: linkedEvent ? 'event' : (linkedMinute || record.derived) ? 'minute' : null,
        expectedAttendees: meetingTag
          ? membersAtMeeting(members.value, meetingTag).length
          : readExpectedAttendance(audience, members.value),
        // Who the gathering was for, so the recorder shows the same roll and
        // the list the same denominator.
        audienceTags: meetingTag ? [meetingTag] : audienceTagsOf(audience),
        excludeTags: meetingTag ? [] : excludeTagsOf(audience)
      })
    })

    // Add events that are past or today, but only if no attendance record exists for them
    events.value.forEach(event => {
      // An override written only to take a date off the calendar. The document
      // exists so the schedule stops generating that occurrence; asking anyone
      // to record attendance for it would be asking about a gathering that was
      // deleted.
      if (event.hidden) return
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
            // Cancelled or postponed, carried through so the list can say so
            // and the summary can stop counting it as work owed.
            status: readEventStatus(event),
            statusNote: event.statusNote || '',
            postponedTo: event.postponedTo || '',
            // A cancelled weekly service is a stored override standing in for
            // the generated occurrence. Both fields come along so putting it
            // back on from this page removes the override rather than leaving
            // an empty duplicate of the occurrence behind.
            overrideOf: event.overrideOf || null,
            statusOnly: event.statusOnly || false,
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
        status: readEventStatus(event),
        statusNote: event.statusNote || '',
        postponedTo: event.postponedTo || '',
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

  /**
   * "It happened; we are not counting it." Not a cancellation — the calendar is
   * untouched — and not a record either: the document holds no attendees and is
   * left out of every figure. It exists so the page stops asking.
   *
   * Written as an attendance document rather than a flag on the event because
   * it is a decision about the paperwork, and because it then rides the same
   * de-duplication every real record does: the prompt disappears by the same
   * mechanism, for both stored events and generated occurrences.
   */
  const skipRecording = async (row) => {
    if (!row) return

    // Already marked — a second tap, or another phone got there first. Writing
    // again would put the same gathering on the list twice, which is exactly
    // what this is meant to stop.
    const { occurrenceKey } = provenanceForRow(row)
    if (occurrenceKey) {
      const existing = attendance.value.find(
        (record) => readProvenance(record).occurrenceKey === occurrenceKey
      )
      if (existing) return existing.firestoreId || existing.id
    }

    return await addAttendance({
      ...provenanceForRow(row),
      eventId: row.eventId || '',
      eventType: row.eventType || '',
      eventTitle: row.eventTitle || 'Untitled',
      date: row.date || '',
      time: row.time || '',
      location: row.location || '',
      attendees: [],
      totalAttendees: 0,
      expectedAttendees: row.expectedAttendees || 0,
      audienceTags: row.audienceTags || [],
      excludeTags: row.excludeTags || [],
      notes: '',
      skipped: true,
    })
  }

  /**
   * Undo the above: the gathering goes back on the list to record.
   *
   * Every skip marker for that occurrence goes, not just the one behind the
   * row. A duplicate written before this was guarded is invisible in the list,
   * and leaving it behind would mean un-skipping appeared to do nothing.
   */
  const resumeRecording = async (row) => {
    if (!row?.firestoreId && !row?.id) return

    const key = row.occurrenceKey || readProvenance(row).occurrenceKey
    const markers = key
      ? attendance.value.filter(
          (record) => record.skipped && readProvenance(record).occurrenceKey === key
        )
      : []

    const targets = markers.length ? markers : [row]
    for (const target of targets) {
      await deleteAttendance(target)
    }
  }

  const updateAttendanceInFirestore = async (attendance, updatedData) => {
    return await updateAttendance(attendance, updatedData)
  }

  /**
   * True when this row's register lives on a minute rather than in a document
   * of its own — the one question that decides where a write has to go.
   */
  const isMeetingRegister = (row) =>
    Boolean(row?.derived) && row?.source === ATTENDANCE_SOURCES.MINUTE

  /**
   * The single way a meeting's attendance is written, whether it is being
   * marked on the minute itself or recorded from the Attendance page.
   *
   * There is deliberately no second copy in the `attendance` collection: two
   * stores for one fact is what made a meeting read "Not recorded" on the list
   * while its minute showed thirty names.
   */
  const saveMeetingRegister = async (row, attendees = []) => {
    const id = row?.sourceId || row?.firestoreId || row?.id
    const minute = minutes.value.find((m) => (m.firestoreId || m.id) === id)
    if (!minute) throw new Error('That meeting is no longer on the Minutes page')
    return await updateMinuteInFirestore(minute, {
      attendees: (attendees || []).map(String),
    })
  }

  const removeAttendance = async (record) => {
    // Wiping a meeting's count means emptying its register: there is no
    // document to delete, and deleting the minute would take the write-up with
    // it.
    if (isMeetingRegister(record)) return await saveMeetingRegister(record, [])
    return await deleteAttendance(record)
  }

  return {
    attendance,
    aggregatedAttendance,
    loading,
    addAttendanceToFirestore,
    updateAttendanceInFirestore,
    removeAttendance,
    isMeetingRegister,
    saveMeetingRegister,
    skipRecording,
    resumeRecording
  }
}


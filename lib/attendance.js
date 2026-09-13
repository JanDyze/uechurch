// What an attendance record was recorded against.
//
// This replaces a single `eventId` string that meant four different things at
// once: a stored event's document id, a meeting's document id, a synthesised
// id for a recurring service occurrence that exists nowhere, or an empty
// string for a one-off. Because those cases were indistinguishable, a deleted
// event and a typo looked identical, and "how many came to the Sunday service
// this year" could not be asked at all.
//
// Three fields now, each meaning exactly one thing:
//
//   source        what kind of thing this was recorded against
//   sourceId      which one — a real document id, or null
//   occurrenceKey the de-duplication key: what the Attendance page uses to
//                 tell "already recorded" from "still needs recording"
//
// Dependency-free so both the app and the serverless digest can use it.

/**
 * The day attendance went into use. Gatherings before it are real history, but
 * nobody was ever going to record them, so they must not be counted as work
 * still owed - otherwise "To record" reports a backlog the size of the events
 * calendar and never empties.
 *
 * Compared as a plain 'YYYY-MM-DD' string on purpose: `new Date('2026-08-30')`
 * is UTC midnight and lands on the 29th west of Greenwich.
 */
export const ATTENDANCE_START_DATE = '2026-08-30'

export const ATTENDANCE_SOURCES = {
  /** A recurring service from Settings > Schedule. sourceId is the schedule id. */
  SCHEDULE: 'schedule',
  /** A stored document in `events`. sourceId is the event id. */
  EVENT: 'event',
  /** A meeting in `minutes`. sourceId is the minute id. */
  MINUTE: 'minute',
  /**
   * Small group sessions keep their own attendance inline on the sgSessions
   * document, alongside the lesson and prayer requests, and are not stored
   * here — a ten-person cell group averaged with a sixty-person service is a
   * meaningless number. Reserved so the vocabulary is complete if they are
   * ever surfaced on this page.
   */
  SG_SESSION: 'sgSession',
  /** Typed straight into Attendance, tied to nothing. sourceId is null. */
  ADHOC: 'adhoc',
}

const VALID_SOURCES = new Set(Object.values(ATTENDANCE_SOURCES))

/** `recurring-<scheduleId>-<YYYY-MM-DD>` — the generated occurrence id. */
export const RECURRING_ID = /^recurring-(.+)-(\d{4}-\d{2}-\d{2})$/

/**
 * Reads provenance off a record, falling back to parsing the legacy `eventId`
 * when the typed fields are absent.
 *
 * The fallback matters: it means records written before this change keep
 * working untouched, and a backfill is optional rather than a prerequisite.
 * `knownEventIds` lets a caller distinguish a stored event from a meeting;
 * without it an unrecognised id is assumed to be an event, which is what the
 * old page did.
 */
export const readProvenance = (record = {}, { knownMinuteIds } = {}) => {
  if (record.source && VALID_SOURCES.has(record.source)) {
    return {
      source: record.source,
      sourceId: record.sourceId ?? null,
      occurrenceKey: record.occurrenceKey ?? null,
    }
  }

  const legacy = record.eventId || ''
  if (!legacy) {
    return { source: ATTENDANCE_SOURCES.ADHOC, sourceId: null, occurrenceKey: null }
  }

  const recurring = legacy.match(RECURRING_ID)
  if (recurring) {
    return {
      source: ATTENDANCE_SOURCES.SCHEDULE,
      sourceId: recurring[1],
      occurrenceKey: legacy,
    }
  }

  const isMinute = knownMinuteIds ? knownMinuteIds.has(legacy) : false
  return {
    source: isMinute ? ATTENDANCE_SOURCES.MINUTE : ATTENDANCE_SOURCES.EVENT,
    sourceId: legacy,
    occurrenceKey: legacy,
  }
}

/**
 * Builds the provenance for a row the Attendance page synthesised from an
 * event, a meeting or a recurring occurrence — the moment the user presses
 * "record", this is what gets saved.
 */
export const provenanceForRow = (row = {}) => {
  if (!row || (!row.id && !row.firestoreId)) {
    return { source: ATTENDANCE_SOURCES.ADHOC, sourceId: null, occurrenceKey: null }
  }

  if (row.source === 'minute') {
    const id = row.firestoreId || row.id
    return { source: ATTENDANCE_SOURCES.MINUTE, sourceId: id, occurrenceKey: id }
  }

  // A generated occurrence has no stored document, so its key is the only
  // handle on it — but the schedule id inside is a real, queryable reference.
  const recurring = String(row.id || '').match(RECURRING_ID)
  if (recurring) {
    return {
      source: ATTENDANCE_SOURCES.SCHEDULE,
      sourceId: recurring[1],
      occurrenceKey: row.id,
    }
  }

  const id = row.firestoreId || row.id
  return { source: ATTENDANCE_SOURCES.EVENT, sourceId: id, occurrenceKey: id }
}

/** True when a record is one occurrence of a recurring service. */
export const isScheduleAttendance = (record) =>
  readProvenance(record).source === ATTENDANCE_SOURCES.SCHEDULE

/**
 * Every attendance record for one recurring service, oldest first — the query
 * the old shape made impossible, because the schedule id was buried inside a
 * string.
 */
export const attendanceForSchedule = (records = [], scheduleId) =>
  records
    .filter((r) => {
      const { source, sourceId } = readProvenance(r)
      return source === ATTENDANCE_SOURCES.SCHEDULE && sourceId === scheduleId
    })
    .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')))

/* ------------------------------------------------------- who holds the register */

/**
 * A meeting's register is the minute's own `attendees` array — not a document
 * in `attendance`.
 *
 * This is the rule that was missing. Attendance for a meeting is marked on the
 * minute, mid-meeting, as people arrive; the Attendance page separately wrote
 * its own document when somebody recorded the same meeting there. Two stores
 * for one fact, and no rule about which one spoke for it, so a meeting whose
 * register had been taken still read "Not recorded" on the list — and a count
 * corrected on one screen never reached the other.
 *
 * So: one store per kind of gathering. Meetings live on their minute,
 * everything else lives in `attendance`, and `mergeAttendanceRecords` below is
 * the only place the two are put together. Nothing else is allowed to decide
 * for itself which one to believe.
 */
export const meetingAttendanceRecord = (minute = {}) => {
  const id = minute?.firestoreId || minute?.id
  if (!id) return null

  const attendees = Array.isArray(minute.attendees) ? minute.attendees : []
  // The group the meeting is for, so a council meeting is counted out of the
  // council and never lands on the rest of the church's record as an absence.
  // Unset means nobody has said — which is not the same as "everyone".
  const tag = typeof minute.attendanceTag === 'string' ? minute.attendanceTag.trim() : ''

  return {
    id,
    firestoreId: id,
    // Synthesised from the minute rather than read out of `attendance`. What
    // tells a caller that writing to it means writing to the minute.
    derived: true,
    source: ATTENDANCE_SOURCES.MINUTE,
    sourceId: id,
    occurrenceKey: id,
    // Legacy field, kept so anything still reading it sees the same meeting.
    eventId: id,
    eventType: 'meeting',
    eventTitle: minute.title || 'Meeting',
    date: minute.date || '',
    time: minute.startTime || '',
    location: minute.location || '',
    attendees,
    totalAttendees: attendees.length,
    // No `expectedAttendees`, deliberately: it is counted off the tags by
    // whoever shows the record, because the roster changes and a number
    // stored here would not. A meeting with no tag falls back to the size of
    // its own register, which is the only honest denominator there is for a
    // gathering nobody said who was invited to.
    audienceTags: tag ? [tag] : [],
    excludeTags: [],
    notes: '',
    skipped: false,
    createdAt: minute.createdAt || null,
    updatedAt: minute.updatedAt || minute.createdAt || null,
  }
}

/** Somebody wrote down who was there, or how many. */
export const hasRegister = (record = {}) =>
  (Array.isArray(record.attendees) && record.attendees.length > 0) ||
  Number(record.totalAttendees) > 0

/**
 * Has this gathering been counted?
 *
 * The one definition, because every screen used to answer it for itself with
 * `rowType === 'attendance'` — which says where a row LIVES, not whether
 * anybody counted it. A meeting's register lives on its minute, so by that
 * test a meeting with thirty names on it read "Not recorded".
 *
 * A saved attendance document is a record even when it is empty: somebody
 * opened the recorder and saved. A skip marker is not a count and is filtered
 * out separately, wherever counts are added up.
 */
export const isRecorded = (row = {}) =>
  hasRegister(row) || (row.rowType === 'attendance' && !row.skipped)

const recordTime = (record = {}) =>
  new Date(record.updatedAt || record.createdAt || 0).getTime()

/**
 * Of two rows describing the same gathering, the one that speaks for it.
 *
 * A count always wins: somebody counted the room, and neither a stray "not
 * counted" marker nor an empty stand-in may hide it. Between two counts of a
 * meeting it is the minute's own register, because that is where a meeting's
 * attendance is kept and every screen now writes it there. Between two of the
 * same kind, the one saved last is the one they meant.
 */
const preferred = (held, next) => {
  if (hasRegister(held) !== hasRegister(next)) return hasRegister(next) ? next : held

  if (hasRegister(next)) {
    // Both counted. A meeting's register outranks any document left behind by
    // the days when the Attendance page wrote a second copy of it.
    if (Boolean(held.derived) !== Boolean(next.derived)) return next.derived ? next : held
    return recordTime(next) > recordTime(held) ? next : held
  }

  // Neither counted. "Not counting this one" is a decision somebody took and
  // outranks a bare prompt; and a stored document, which can be opened and
  // deleted, outranks a row synthesised from a minute.
  if (Boolean(held.skipped) !== Boolean(next.skipped)) return next.skipped ? next : held
  if (Boolean(held.derived) !== Boolean(next.derived)) return next.derived ? held : next
  return recordTime(next) > recordTime(held) ? next : held
}

/**
 * Every gathering's attendance from both stores, one row per gathering.
 *
 * Keyed on occurrenceKey, so the three ways the same Sunday can arrive — a
 * document, a duplicate written from a second phone, a meeting's own register
 * — collapse to the single row `preferred` picks. A one-off tied to nothing
 * has no key and is always its own row.
 *
 * Callers get records, not prompts: what still NEEDS recording is a question
 * about the calendar, and useAttendance answers it.
 */
export const mergeAttendanceRecords = (records = [], minutes = []) => {
  const knownMinuteIds = new Set(
    (minutes || []).map((minute) => minute?.firestoreId || minute?.id).filter(Boolean)
  )

  const byKey = new Map()
  const loose = []

  const keep = (row) => {
    if (!row.occurrenceKey) {
      loose.push(row)
      return
    }
    const held = byKey.get(row.occurrenceKey)
    byKey.set(row.occurrenceKey, held ? preferred(held, row) : row)
  }

  ;(records || []).forEach((record) => {
    const provenance = readProvenance(record, { knownMinuteIds })
    // A document written before meetings had a source of their own says
    // "event", because nothing in the collection could tell the two apart. The
    // minutes can, so the correction is made here rather than left to every
    // reader to notice — it is what decides whether a record is read as the
    // whole church's or one committee's.
    if (
      provenance.source === ATTENDANCE_SOURCES.EVENT &&
      knownMinuteIds.has(provenance.sourceId)
    ) {
      provenance.source = ATTENDANCE_SOURCES.MINUTE
    }
    keep({ ...record, ...provenance })
  })

  ;(minutes || []).forEach((minute) => {
    const meeting = meetingAttendanceRecord(minute)
    if (meeting) keep(meeting)
  })

  return [...loose, ...byKey.values()]
}

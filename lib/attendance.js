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
const RECURRING_ID = /^recurring-(.+)-(\d{4}-\d{2}-\d{2})$/

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

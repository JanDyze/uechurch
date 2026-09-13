import { computed, onMounted, onUnmounted, ref } from 'vue'
import { subscribeToAttendance } from '../api/attendanceService'
import { useMinutes } from './useMinutes'
import { useEvents } from './useEvents'
import { useRecurringSchedules } from './useRecurringSchedules'
import {
  audienceLabel,
  audienceTagsOf,
  excludeTagsOf,
  membersInAudience,
  meetingTagOptions,
  meetingTagOf,
  carriesTag,
} from '../utils/audience'
import { isCalledOff } from '../../lib/eventStatus'
import { mergeAttendanceRecords, ATTENDANCE_SOURCES, RECURRING_ID } from '../../lib/attendance'
import { OCCASION_SEPARATOR } from '../../lib/occurrences'

/**
 * One person's turnout, for the gatherings they were actually expected at.
 *
 * This reads the two stores attendance actually lives in — the collection, and
 * the minutes, where a meeting's register is written and never copied. A
 * profile that read only the collection had a hole in it exactly where the
 * meetings were.
 *
 * The events and schedules are asked too, and only about one thing: who the
 * gathering was for. The tags copied onto a record are a snapshot of the day it
 * was saved, and they are the fallback rather than the answer — a record
 * written before the event was narrowed, or through the MCP connector, which
 * saves a head count and no audience at all, would otherwise put a Sunday
 * service on the profile of a child the service explicitly excludes.
 *
 * "Expected" is the same rule the rest of the app counts by (utils/audience.js):
 * a gathering names the member tags it is for, and naming none means everyone.
 * So a choir practice appears on a chorister's profile and on nobody else's,
 * and a Sunday service appears on everybody's.
 *
 * Three states, not two, and the third is the important one. The `attendees`
 * array holds member ids, but only gatherings where somebody actually ticked
 * names in the recorder have one — an event or a recurring service saved as a
 * head count stores `attendees: []` with a `totalAttendees` of ninety. Drawing
 * that as absent would invent a fact: we do not know they were away, we know
 * nobody wrote down who came. It gets its own hollow square and is never
 * counted.
 *
 *   present     their id is on the register
 *   absent      there is a register, and they are not on it
 *   unrecorded  no register was kept for this gathering
 *
 * Cancelled, postponed and deliberately-skipped gatherings are left out
 * entirely: nobody failed to attend a thing that did not happen. So is every
 * standing gathering whose schedule has not been switched to show on profiles
 * (Settings) — off by default, and a schedule since deleted cannot say yes.
 */
export function useMemberAttendance(member, options = {}) {
  const { limit = 14 } = options

  const documents = ref([])
  const loading = ref(true)
  let unsubscribe = null

  const { minutes } = useMinutes()
  const { events } = useEvents()
  const { schedules } = useRecurringSchedules()

  // One row per gathering, whichever store holds it — lib/attendance.js is the
  // only place that decides which one speaks for a meeting.
  const records = computed(() => mergeAttendanceRecords(documents.value, minutes.value))

  onMounted(() => {
    unsubscribe = subscribeToAttendance((rows) => {
      documents.value = rows
      loading.value = false
    })
  })

  onUnmounted(() => {
    if (unsubscribe) unsubscribe()
  })

  const sameId = (a, b) => String(a) === String(b)

  /**
   * Who a gathering was for, asked of whatever still exists: the event or the
   * schedule it was recorded against first, and only then the tags copied onto
   * the record itself. The same order the Attendance list reads them in, so a
   * person's profile and the list cannot disagree about who a gathering was
   * ever meant for.
   *
   * This is what makes "everyone except the kids" hold on a profile: narrow an
   * event today and last month's record narrows with it, instead of standing
   * on whatever was true the day somebody wrote it down.
   */
  const audienceOf = (record) => {
    const id = record?.sourceId
    if (id && record.source === ATTENDANCE_SOURCES.EVENT) {
      const event = (events.value || []).find((e) => sameId(e.firestoreId || e.id, id))
      if (event) return event
    }
    if (id && record.source === ATTENDANCE_SOURCES.SCHEDULE) {
      const schedule = (schedules.value || []).find((s) => sameId(s.id, id))
      if (schedule) return schedule
    }
    return record
  }

  /**
   * The schedule a record belongs to, from whichever store it came out of: a
   * generated occurrence names it outright, a Sunday edited on the calendar
   * names the occurrence it replaced, and a meeting's minute carries it once it
   * was started from — or bound to — its standing gathering. Empty for a
   * one-off.
   */
  const scheduleIdOf = (record, audience = audienceOf(record)) => {
    if (record.source === ATTENDANCE_SOURCES.SCHEDULE) return record.sourceId || ''
    if (record.source === ATTENDANCE_SOURCES.MINUTE) {
      const minute = (minutes.value || []).find((m) => sameId(m.firestoreId || m.id, record.sourceId))
      return minute?.scheduleId || ''
    }
    return String(audience?.overrideOf || '').match(RECURRING_ID)?.[1] || ''
  }

  /**
   * Which standing gathering a record is one week of, whatever that week was
   * called. Grandparents Day is the Sunday service with a name on it — the same
   * room at the same hour — so it belongs on the Sunday service's row, not on a
   * row of its own that holds one square a year.
   *
   * The schedule is asked first: a generated Sunday names it directly, and a
   * Sunday somebody edited on the calendar names the occurrence it replaced.
   * Anything else — a one-off, or a record from before provenance was kept —
   * falls back to its title with the occasion taken off the end.
   */
  const seriesOf = (record, audience) => {
    const scheduleId = scheduleIdOf(record, audience)
    const schedule = scheduleId
      ? (schedules.value || []).find((s) => sameId(s.id, scheduleId))
      : null
    const title =
      schedule?.title ||
      String(record.eventTitle || 'Gathering').split(OCCASION_SEPARATOR)[0].trim() ||
      'Gathering'
    return { seriesKey: title.toLowerCase(), seriesTitle: title }
  }

  const isOnRegister = (record, m) => {
    const ids = Array.isArray(record.attendees) ? record.attendees : []
    return ids.some((id) => sameId(id, m.id) || sameId(id, m.firestoreId))
  }

  const todayIso = () => {
    const d = new Date()
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  }

  /** Most recent first, and only gatherings whose date has arrived. */
  const history = computed(() => {
    const m = member?.value
    // The record arrives a tick after the page does. Until it has an id there
    // is nobody to match, and an empty object would match every "everyone"
    // gathering on the books.
    if (!m || (m.id === undefined && m.firestoreId === undefined)) return []

    const today = todayIso()

    return (records.value || [])
      .filter((record) => {
        if (!record?.date || record.date > today) return false
        if (record.skipped || isCalledOff(record)) return false
        // Asked before anything else, meetings included: a standing gathering
        // switched off for profiles is off whether its register is kept in the
        // attendance collection or on its minute.
        const scheduleId = scheduleIdOf(record)
        if (scheduleId) {
          const schedule = (schedules.value || []).find((s) => sameId(s.id, scheduleId))
          if (!schedule?.showInProfile) return false
        }
        if (record.source === ATTENDANCE_SOURCES.MINUTE) {
          // The meeting's group, read the way every other screen reads it
          // (utils/audience.js). The vocabulary offered is only this person's
          // own tags and ministries, which is all that is needed to answer
          // "was this meeting theirs?" without pulling the whole roster into
          // a profile page.
          const tag = meetingTagOf(record, meetingTagOptions([m]))
          // And a meeting naming no group at all is about the people who were
          // in the room and nobody else: reading it as "everyone" would mark
          // the whole church absent from a committee they were never asked to.
          return tag ? carriesTag(m, tag) : isOnRegister(record, m)
        }
        const audience = audienceOf(record)
        if (membersInAudience([m], audienceTagsOf(audience), excludeTagsOf(audience)).length) {
          return true
        }
        // Outside the audience — most often left out by name, "everyone except
        // the kids". The gathering is not theirs and an absence against it
        // would be a reproach for missing something they were not asked to.
        // Unless they were ticked present: then they were in the room, and
        // that is a fact about them whatever the tags say.
        return isOnRegister(record, m)
      })
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))
      .slice(0, limit)
      .map((record) => {
        const hasRegister = Array.isArray(record.attendees) && record.attendees.length > 0
        const audience = audienceOf(record)
        const tags = audienceTagsOf(audience)
        return {
          key: record.firestoreId || record.id || `${record.date}-${record.eventTitle}`,
          date: record.date,
          title: record.eventTitle || 'Gathering',
          ...seriesOf(record, audience),
          // What kind of gathering, for its icon: the event's or schedule's own
          // choice first, the type's default after, and a meeting as a meeting.
          type: record.source === ATTENDANCE_SOURCES.MINUTE ? 'meeting' : record.eventType || audience.type || '',
          icon: audience.icon || '',
          // "Everyone" is the right word for a gathering that names no tags,
          // and the wrong one for a meeting: it is on this profile either
          // because of the group it is for, or because this person was in the
          // room.
          audience:
            record.source === ATTENDANCE_SOURCES.MINUTE
              ? meetingTagOf(record, meetingTagOptions([m])) || 'Those present'
              : audienceLabel(tags, excludeTagsOf(audience)),
          state: !hasRegister ? 'unrecorded' : isOnRegister(record, m) ? 'present' : 'absent',
        }
      })
  })

  /**
   * The same list under month headings, newest month first. The year is only
   * spelled out when it is not this one — "September" reads as this September,
   * and "September 2025" is the one that needs saying.
   */
  const byMonth = computed(() => {
    const thisYear = new Date().getFullYear()
    const sections = []
    let current = null

    history.value.forEach((item) => {
      const d = new Date(item.date)
      if (Number.isNaN(d.getTime())) return
      const key = `${d.getFullYear()}-${d.getMonth()}`
      if (!current || current.key !== key) {
        current = {
          key,
          label: d.toLocaleDateString(undefined, {
            month: 'long',
            ...(d.getFullYear() === thisYear ? {} : { year: 'numeric' }),
          }),
          items: [],
        }
        sections.push(current)
      }
      current.items.push(item)
    })

    return sections
  })

  /** Only the gatherings a register was kept for can be counted. */
  const counted = computed(() => history.value.filter((h) => h.state !== 'unrecorded'))
  const presentCount = computed(() => counted.value.filter((h) => h.state === 'present').length)
  const unrecordedCount = computed(
    () => history.value.filter((h) => h.state === 'unrecorded').length
  )

  return { history, byMonth, counted, presentCount, unrecordedCount, loading }
}

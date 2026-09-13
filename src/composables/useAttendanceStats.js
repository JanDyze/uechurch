import { computed } from 'vue'
import { isCalledOff } from '../../lib/eventStatus'
import { isRecorded } from '../../lib/attendance'
import { getDisplayName } from '../utils/memberUtils'

// What the page should say before anybody scrolls.
//
// The test every line here has to pass: the list underneath is already a list
// of gatherings, each row carrying its own count, its own colour and its own
// gauge. Anything the rows already say is not worth a summary — it is the same
// fact twice, and the second one costs the first its spotlight. An earlier
// version led with the last gathering's turnout, which is precisely the row
// sitting directly beneath it.
//
// So this says only what no row can:
//
//   1. REACH — how many different people we saw at all this month. No single
//      gathering knows this; it is the union across all of them, and it is the
//      one figure genuinely out of the whole church.
//   2. WHO HAS GONE QUIET — people who used to come and have not been marked
//      present in weeks. This is the only pastoral fact on the page, and it is
//      invisible in a list organised by gathering.
//   3. WHAT IS STILL OWED — the recording backlog, which is scattered down the
//      list as prompts and can only be counted by scrolling the whole thing.
//
// Deliberately NOT an average turnout across gathering types. A prayer meeting
// will never draw the whole roster, so averaging it with a Sunday service gives
// a number that mostly tracks which kinds of gathering fell in the month — the
// trap lib/attendance.js calls out for small groups.

/** How many gatherings the dashboard's strip shows. */
const MAX_BARS = 6

/** A series needs this many occurrences before the strip is one gathering. */
const MIN_FOR_SERIES = 3

/** Unseen for this long, having come before, is worth somebody's attention. */
const QUIET_DAYS = 21

/** How many names the quiet line shows before it starts counting instead. */
const QUIET_NAMES = 2

/**
 * Months are grouped on the raw 'YYYY-MM-DD' prefix rather than a parsed Date:
 * `new Date('2026-08-01')` is UTC midnight, which is still July anywhere west
 * of Greenwich and would file the first of the month under the wrong one.
 */
const monthKeyOf = (date) => String(date || '').slice(0, 7)

const labelForMonthKey = (key, options) => {
  const [year, month] = key.split('-')
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString(undefined, options)
}

const pad = (value) => String(value).padStart(2, '0')

const localKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

const currentMonthKey = () => localKey(new Date()).slice(0, 7)

const daysAgoKey = (days) => {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return localKey(date)
}

const dayLabel = (date, options) =>
  date ? new Date(`${date}T00:00:00`).toLocaleDateString(undefined, options) : ''

/** "today" and "yesterday" are how people refer to the near past out loud. */
const whenLabel = (date) => {
  if (!date) return ''
  const today = new Date()
  if (date === localKey(today)) return 'today'
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (date === localKey(yesterday)) return 'yesterday'
  return dayLabel(date, { weekday: 'short', day: 'numeric', month: 'short' })
}

/** Two gatherings are the same weekly thing if they carry the same name. */
const seriesKeyOf = (row) => String(row.eventTitle || '').trim().toLowerCase()

/**
 * @param rows     the aggregated attendance list — saved records plus the
 *                 "Not recorded" prompts synthesised from events, meetings and
 *                 schedules
 * @param members  the roster, for the denominator and for the names on the
 *                 quiet line
 */
export function useAttendanceStats(rows, members) {
  const roster = computed(() => (members.value || []).length)

  // Only counted gatherings carry a real number, and a skipped one is not a
  // count: it is somebody saying "do not ask me for this again". Counting
  // either the prompts or the skips at zero would report a slump that never
  // happened.
  //
  // Whether a gathering was counted is lib/attendance.js's question, not this
  // file's: a meeting's register lives on its minute, and asking "did this row
  // come from the attendance collection" left every meeting out of the month's
  // reach.
  const recorded = computed(() =>
    (rows.value || [])
      .filter((row) => isRecorded(row) && !row.skipped && row.date)
      .sort((a, b) => String(a.date).localeCompare(String(b.date)))
  )

  /**
   * Still owed, oldest first. A gathering that was called off is not owed —
   * that is the whole point of marking it — and neither is one somebody chose
   * to skip, which never reaches this list because its skip document
   * de-duplicates the prompt away.
   */
  const awaiting = computed(() =>
    (rows.value || [])
      .filter((row) => !isRecorded(row) && !row.skipped && row.date && !isCalledOff(row))
      .sort((a, b) => String(a.date).localeCompare(String(b.date)))
  )

  const countOf = (row) => row.totalAttendees ?? row.attendees?.length ?? 0

  // How many the gathering was for: the people carrying its tags, recounted off
  // the roster by useAttendance.js. The roster stands in only for a gathering
  // that names no audience, where everyone is the honest answer.
  const expectedOf = (row) => row.expectedAttendees || roster.value

  const rosterShare = (count) => {
    if (!roster.value) return null
    return Math.min(100, Math.round(((count || 0) / roster.value) * 100))
  }

  const months = computed(() => {
    const byKey = new Map()

    recorded.value.forEach((row) => {
      const key = monthKeyOf(row.date)
      if (!key) return
      if (!byKey.has(key)) byKey.set(key, { gatherings: 0, people: new Set(), largest: 0 })
      const month = byKey.get(key)
      month.gatherings += 1
      // Ids arrive as strings from the checker but a legacy record may hold
      // numbers; normalise or the same person counts twice.
      ;(row.attendees || []).forEach((id) => month.people.add(String(id)))
      month.largest = Math.max(month.largest, countOf(row))
    })

    return [...byKey.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, month]) => {
        // A record imported with a head count but no names contributes nobody
        // to the union, which would report a month of full services as nobody
        // seen at all. The largest single gathering is a floor no counting
        // method can fall below — that many distinct people were in one room —
        // so it stands in until the names are there.
        const count = Math.max(month.people.size, month.largest)
        return {
          key,
          shortLabel: labelForMonthKey(key, { month: 'short' }),
          longLabel: labelForMonthKey(key, { month: 'long' }),
          gatherings: month.gatherings,
          count,
          share: rosterShare(count),
        }
      })
  })

  // Usually this month. In the first days of a new month there is nothing
  // recorded yet, so it falls back to the most recent month that has something
  // — the line names the month, so a fallback is never mistaken for today.
  const primaryMonth = computed(() => {
    const key = currentMonthKey()
    return months.value.find((month) => month.key === key) || months.value[0] || null
  })

  // The nearest earlier month with something in it, not simply last month — a
  // church that took August off should be compared with July, not with a gap.
  const priorMonth = computed(() => {
    const primary = primaryMonth.value
    if (!primary) return null
    return months.value.find((month) => month.key < primary.key) || null
  })

  /** When each person on the roster was last marked present. */
  const lastSeen = computed(() => {
    const seen = new Map()
    recorded.value.forEach((row) => {
      ;(row.attendees || []).forEach((id) => {
        const key = String(id)
        const previous = seen.get(key)
        if (!previous || String(row.date) > previous) seen.set(key, String(row.date))
      })
    })
    return seen
  })

  /**
   * People who used to come and have not been seen in weeks.
   *
   * Only people who have been marked present at least once: somebody who has
   * never appeared in any record is far more likely to be a gap in the
   * recording than a person who has stopped coming, and a list that cried wolf
   * about half the roster would be ignored within a week. The same reasoning
   * keeps head-count-only records out of it — they name nobody, so they make
   * nobody quiet.
   */
  const quiet = computed(() => {
    const cutoff = daysAgoKey(QUIET_DAYS)
    const byId = new Map((members.value || []).map((m) => [String(m.firestoreId || m.id), m]))

    const people = []
    lastSeen.value.forEach((date, id) => {
      if (date >= cutoff) return
      const member = byId.get(id)
      if (!member) return // left the roster; not a person to go looking for
      people.push({ id, date, name: getDisplayName(member) })
    })

    // Longest away first: if only two names fit, they should be the two who
    // have been gone longest.
    return people.sort((a, b) => a.date.localeCompare(b.date))
  })

  const stats = computed(() => {
    const primary = primaryMonth.value
    const prior = priorMonth.value
    const next = awaiting.value[0] || null
    const quietPeople = quiet.value

    return {
      roster: roster.value,

      // Counts first, share second: "62 of 118 people" is a sentence anyone
      // can check against the roster they know; "53%" has to be trusted.
      reach: primary
        ? {
            count: primary.count,
            share: primary.share,
            monthLabel: primary.longLabel,
            gatherings: primary.gatherings,
            priorCount: prior?.count ?? null,
            priorLabel: prior?.shortLabel || '',
          }
        : null,

      quiet: quietPeople.length
        ? {
            count: quietPeople.length,
            names: quietPeople.slice(0, QUIET_NAMES).map((person) => person.name),
            others: Math.max(quietPeople.length - QUIET_NAMES, 0),
            sinceLabel: dayLabel(quietPeople[0].date, { day: 'numeric', month: 'short' }),
            weeks: Math.floor(QUIET_DAYS / 7),
          }
        : null,

      // The only work this page owns. Recording starts from this line rather
      // than from a floating button, because attendance follows the calendar:
      // you record against a gathering that has already happened, you do not
      // invent one here.
      awaiting: next
        ? {
            count: awaiting.value.length,
            title: next.eventTitle || 'Untitled',
            type: next.eventType || '',
            whenLabel: whenLabel(next.date),
            key: String(next.occurrenceKey || next.id),
          }
        : null,
    }
  })

  /**
   * The last few turnouts, newest first — the dashboard's strip, not this
   * page's (Attendance is a list of gatherings already, and a chart above it
   * only repeats the rows).
   *
   * Like against like where it can be: when the most recent gathering has a
   * history of its own the strip is that one gathering over time, and the bars
   * can honestly be read against each other. Otherwise it falls back to
   * whatever happened last, each bar carrying its type's colour so nobody reads
   * a full choir practice as a bad Sunday.
   */
  const recentBars = computed(() => {
    const latest = recorded.value[recorded.value.length - 1]
    const series = latest
      ? recorded.value.filter((row) => seriesKeyOf(row) === seriesKeyOf(latest))
      : []
    const source = series.length >= MIN_FOR_SERIES ? series : recorded.value
    const shown = source.slice(-MAX_BARS).reverse()
    if (!shown.length) return []

    // Scaled against the busiest bar on screen rather than against capacity:
    // the question the strip answers is "compared with the other weeks", and a
    // fixed 0–100 axis flattens every real difference into the same stub.
    const largest = Math.max(...shown.map(countOf), 1)

    return shown.map((row, index) => ({
      key: String(row.firestoreId || row.id),
      title: row.eventTitle || 'Untitled',
      type: row.eventType || '',
      count: countOf(row),
      expected: expectedOf(row),
      dateLabel: dayLabel(row.date, { day: 'numeric', month: 'short' }),
      // A gathering nobody came to is still a fact worth seeing, so an empty
      // bar keeps a sliver of width rather than vanishing off the axis.
      width: Math.max(Math.round((countOf(row) / largest) * 100), 4),
      isLatest: index === 0,
    }))
  })

  return { stats, recentBars }
}

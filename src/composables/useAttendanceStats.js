import { computed } from 'vue'

// The numbers worth reading before the list itself: how full the last
// gathering was, how much of the church turned up at all this month, whether
// that is better or worse than last month, and what still needs recording.
//
// Everything is a share of the roster rather than a raw head count. "84" means
// nothing without knowing whether the church has ninety people or nine
// hundred; "64%" is the same sentence in a form anyone can read at a glance.
//
// Deliberately NOT an average of monthly percentages. A prayer meeting will
// never draw the whole roster, so averaging it with a Sunday service produces
// a number that mostly tracks which kinds of gathering happened to fall in the
// month — the same trap lib/attendance.js calls out for small groups. The
// monthly figure is reach instead: the share of people who came to at least
// one thing. That cannot be moved by the mix, and it answers a question worth
// asking anyway — who are we actually seeing?

/** How many recent gatherings the trend strip shows. */
const MAX_BARS = 8

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

const currentMonthKey = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

const dayLabel = (date, options) =>
  date ? new Date(`${date}T00:00:00`).toLocaleDateString(undefined, options) : ''

/**
 * @param rows        the aggregated attendance list — saved records plus the
 *                    "Not recorded" prompts synthesised from events, meetings
 *                    and schedules
 * @param rosterSize  how many people are on the roster
 */
export function useAttendanceStats(rows, rosterSize) {
  // Only saved records carry a real count. The rest of the page is prompts,
  // and counting those at zero would report a slump that never happened.
  const recorded = computed(() =>
    (rows.value || [])
      .filter((row) => row.rowType === 'attendance' && row.date)
      .sort((a, b) => String(a.date).localeCompare(String(b.date)))
  )

  const countOf = (row) => row.totalAttendees ?? row.attendees?.length ?? 0

  // How many that gathering was for: the people carrying its tags, recounted
  // off the roster by useAttendance.js. The roster stands in only for a
  // gathering that names no audience, where everyone is the honest answer.
  // Without this a choir practice of ten scored 8% and dragged the whole strip
  // down with it.
  const expectedOf = (row) => row.expectedAttendees || rosterSize.value

  // The same denominator the recorder counts against on its own header
  // ("8 of 10"), so this page cannot disagree with the screen the number was
  // typed on.
  const shareOf = (row) => {
    const expected = expectedOf(row)
    if (!expected) return null
    return Math.min(100, Math.round((countOf(row) / expected) * 100))
  }

  // Reach is the one figure that genuinely is out of the whole church - how
  // many people we saw at all this month - so it keeps the roster as its
  // denominator rather than any one gathering's audience.
  const rosterShare = (count) => {
    const roster = rosterSize.value
    if (!roster) return null
    return Math.min(100, Math.round(((count || 0) / roster) * 100))
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
        // to the union, which would report a month of full services as zero
        // reach. The largest single gathering is a floor no counting method
        // can fall below — that many distinct people were in one room — so it
        // stands in until the names are there.
        const reachCount = Math.max(month.people.size, month.largest)
        return {
          key,
          shortLabel: labelForMonthKey(key, { month: 'short' }),
          longLabel: labelForMonthKey(key, { month: 'long' }),
          gatherings: month.gatherings,
          reachCount,
          reachShare: rosterShare(reachCount),
        }
      })
  })

  // Usually this month. On the first days of a new month there is nothing
  // recorded yet, so it falls back to the most recent month that has something
  // — the tile names the month, so a fallback is never mistaken for today.
  const primaryMonth = computed(() => {
    const key = currentMonthKey()
    return months.value.find((month) => month.key === key) || months.value[0] || null
  })

  // The nearest earlier month with something in it, not simply last month — a
  // church that took August off should be compared with July, not with a gap.
  const priorMonth = computed(() => {
    const primary = primaryMonth.value
    if (!primary) return null
    return months.value.find((month) => month.key < primary.key && month.reachShare !== null) || null
  })

  const stats = computed(() => {
    const latest = recorded.value[recorded.value.length - 1] || null
    const primary = primaryMonth.value
    const prior = priorMonth.value
    const latestCount = latest ? countOf(latest) : null

    return {
      roster: rosterSize.value,

      latestShare: latest ? shareOf(latest) : null,
      latestCount,
      // What "8 of 10" is out of, so the hint under the tile names the room
      // that was expected rather than the size of the church.
      latestExpected: latest ? expectedOf(latest) : null,
      latestTitle: latest?.eventTitle || '',
      latestDateLabel: dayLabel(latest?.date, { weekday: 'short', day: 'numeric', month: 'short' }),

      reachShare: primary?.reachShare ?? null,
      reachCount: primary?.reachCount ?? null,
      monthShortLabel: primary?.shortLabel || '',
      monthLongLabel: primary?.longLabel || '',
      monthGatherings: primary?.gatherings ?? 0,

      // Percentage points, not a percentage of a percentage — "up 6 points" is
      // a sentence people say; "up 9.4%" of a percentage is not.
      trend:
        primary?.reachShare != null && prior?.reachShare != null
          ? primary.reachShare - prior.reachShare
          : null,
      trendLabel: prior ? `vs ${prior.shortLabel}` : 'no earlier month',
    }
  })

  /** The last few gatherings, oldest first — the shape behind the averages. */
  const recentBars = computed(() =>
    recorded.value.slice(-MAX_BARS).map((row) => ({
      key: String(row.firestoreId || row.id),
      title: row.eventTitle || 'Untitled',
      count: countOf(row),
      share: shareOf(row) ?? 0,
      dateLabel: dayLabel(row.date, { day: 'numeric', month: 'short' }),
    }))
  )

  return { stats, recentBars }
}

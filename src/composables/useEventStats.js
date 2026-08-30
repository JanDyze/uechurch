import { computed } from 'vue'
import { getEventTypeBar, getEventTypeDot, eventTypeLabel } from '../utils/eventColors'

// The numbers worth reading before the calendar itself: what is next and how
// soon, how much of the coming week is already spoken for, and how full the
// month being viewed is.
//
// Counts rather than shares, unlike the attendance summary. There is no roster
// to divide by here - "six events" is already the whole sentence, and a church
// with a busy month wants the number, not a percentage of some cap nobody set.
//
// Every comparison is done on the raw 'YYYY-MM-DD' string. `new Date('2026-08-01')`
// is UTC midnight, which is still July anywhere west of Greenwich, so parsing
// would file the first of the month under the previous one - the same trap
// useAttendanceStats calls out. Only the labels ever build a real Date, and
// they build it from the parts.

/** How many days ahead the "this week" tile looks, today included. */
const WEEK_DAYS = 7

const pad = (value) => String(value).padStart(2, '0')

const keyOf = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

const todayKey = () => keyOf(new Date())

const dateFromKey = (key) => {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day)
}

const addDays = (key, days) => {
  const date = dateFromKey(key)
  date.setDate(date.getDate() + days)
  return keyOf(date)
}

// Rounded, not floored: the clocks going forward makes a day 23 hours long,
// and "in 6d" for a week away would be quietly wrong twice a year.
const daysBetween = (fromKey, toKey) =>
  Math.round((dateFromKey(toKey) - dateFromKey(fromKey)) / 86400000)

const labelFor = (key, options) => (key ? dateFromKey(key).toLocaleDateString(undefined, options) : '')

/**
 * @param events       every event on the calendar - saved, recurring and birthdays
 * @param currentDate  the month the calendar is showing, so the month tile and
 *                     the type mix report on what is on screen
 */
export function useEventStats(events, currentDate) {
  // A record with no usable date cannot be placed on a calendar or counted
  // against one, so it is left out rather than sorted to the front.
  const dated = computed(() =>
    (events.value || [])
      .filter((event) => typeof event.date === 'string' && event.date.length >= 10)
      .sort(
        (a, b) =>
          a.date.localeCompare(b.date) || String(a.time || '').localeCompare(String(b.time || ''))
      )
  )

  const monthKey = computed(
    () => `${currentDate.value.getFullYear()}-${pad(currentDate.value.getMonth() + 1)}`
  )

  const monthEvents = computed(() =>
    dated.value.filter((event) => event.date.slice(0, 7) === monthKey.value)
  )

  const stats = computed(() => {
    const today = todayKey()
    const ahead = dated.value.filter((event) => event.date >= today)
    const next = ahead[0] || null
    const weekEnd = addDays(today, WEEK_DAYS - 1)

    // Today's own events belong to the week, so the range is inclusive at both
    // ends - a Sunday service this morning still counts as this week's.
    const week = ahead.filter((event) => event.date <= weekEnd)
    const done = monthEvents.value.filter((event) => event.date < today).length

    const daysToNext = next ? daysBetween(today, next.date) : null

    return {
      next,
      nextTitle: next?.title || '',
      // Distance reads better than a date for anything imminent, and a date is
      // no use at all for "today" - the only answer anyone wants then is yes.
      nextLabel:
        daysToNext === null
          ? ''
          : daysToNext === 0
            ? 'Today'
            : daysToNext === 1
              ? 'Tomorrow'
              : daysToNext < 7
                ? `in ${daysToNext}d`
                : labelFor(next.date, { day: 'numeric', month: 'short' }),
      nextDateLabel: labelFor(next?.date, { weekday: 'short', day: 'numeric', month: 'short' }),
      nextTime: next?.time || '',

      todayCount: ahead.filter((event) => event.date === today).length,

      weekCount: week.length,
      weekEndLabel: labelFor(weekEnd, { weekday: 'short', day: 'numeric', month: 'short' }),

      monthTotal: monthEvents.value.length,
      monthDone: done,
      monthToCome: monthEvents.value.length - done,
      monthLabel: labelFor(`${monthKey.value}-01`, { month: 'long' }),
      // The month on screen is not always this one - the tile has to say so,
      // or a quiet December read in August looks like a collapse.
      isCurrentMonth: monthKey.value === today.slice(0, 7),
    }
  })

  /**
   * What kind of month it is. Only the types actually present get a segment,
   * biggest first, so a month of birthdays reads as one at a glance instead of
   * as eight near-empty slivers.
   */
  const typeMix = computed(() => {
    const counts = new Map()

    monthEvents.value.forEach((event) => {
      const type = event.type || 'other'
      counts.set(type, (counts.get(type) || 0) + 1)
    })

    return [...counts.entries()]
      .sort(([typeA, countA], [typeB, countB]) => countB - countA || typeA.localeCompare(typeB))
      .map(([type, count]) => ({
        key: type,
        label: eventTypeLabel(type),
        count,
        barClass: getEventTypeBar(type),
        dotClass: getEventTypeDot(type),
      }))
  })

  return { stats, typeMix, monthEvents }
}

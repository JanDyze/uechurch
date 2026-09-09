import { formatTime } from '../../lib/occurrences'

// How dates are said on the public page. Extracted from Landing.vue because
// the floating gatherings dock needs exactly the same phrasing — two copies
// would drift, and "This Sunday" reading differently in two places on one
// screen is the kind of thing nobody reports and everybody notices.
//
// English on purpose, while the copy around it is Tagalog: a date is a label
// read off a calendar, and "Sun 13 Oct" is read faster than its translation.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/**
 * Built from the date parts rather than parsed: `new Date("2026-08-30")` is
 * UTC midnight, which reads as the day before anywhere west of Greenwich.
 */
export const dateOf = (value) => {
  const [year, month, day] = String(value || '').split('-').map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
}

export const monthOf = (value) => {
  const date = dateOf(value)
  return date ? MONTHS[date.getMonth()] : ''
}

export const dayOf = (value) => {
  const date = dateOf(value)
  return date ? date.getDate() : ''
}

/** How many days off it is, or null when there is no usable date. */
export const daysUntil = (value) => {
  const date = dateOf(value)
  if (!date) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((date - today) / 86400000)
}

/** "Today", "This Sunday", "Sun 13 Oct" — how anyone would actually say it. */
export const dayLabel = (value) => {
  const date = dateOf(value)
  if (!date) return ''
  const days = daysUntil(value)
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days < 7) return `This ${WEEKDAYS[date.getDay()]}`
  return `${WEEKDAYS[date.getDay()].slice(0, 3)} ${date.getDate()} ${MONTHS[date.getMonth()]}`
}

/**
 * A weekly service is published once, as its next date, so what a visitor
 * needs to read is how often it comes round rather than which Sunday this
 * happens to be. Anything one-off says when it is instead.
 */
export const whenLine = (gathering) =>
  [gathering.cadence || dayLabel(gathering.date), formatTime(gathering.time)]
    .filter(Boolean)
    .join(' · ')

export { formatTime }

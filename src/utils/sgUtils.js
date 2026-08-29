import { getFullName } from './memberUtils'

// Member ids come off Firestore as either the numeric `id` or the document id,
// and the two are compared as strings everywhere else in the app (see
// AttendanceChecker). Keep that convention so rosters and attendance agree.
export const memberKey = (member) => String(member?.id ?? member?.firestoreId ?? '')

export const sameMember = (a, b) => String(a) === String(b)

export const findMemberById = (members, id) =>
  members.find((m) => sameMember(memberKey(m), id)) || null

export const memberNameById = (members, id, fallback = '') => {
  const member = findMemberById(members, id)
  return member ? getFullName(member) : fallback
}

/** The group's roster, resolved to member records and sorted by name. */
export const rosterMembers = (group, members) => {
  if (!group) return []
  const ids = new Set((group.memberIds || []).map(String))
  return members
    .filter((m) => ids.has(memberKey(m)))
    .sort((a, b) => getFullName(a).localeCompare(getFullName(b)))
}

const sgLocale = (lang) => (lang === 'tl' ? 'fil-PH' : 'en-US')

/**
 * Session dates are stored as plain "YYYY-MM-DD". `new Date()` reads those as
 * UTC midnight, which lands on the day before in western timezones, so the
 * parts are read back out by hand and the date is built in local time.
 */
export const parseSessionDate = (date) => {
  if (!date) return null
  const ymd = typeof date === 'string' && date.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const parsed = ymd
    ? new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]))
    : new Date(date)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

/** `month` takes any Intl month style; 'short' is for tight spots like chips. */
export const formatSessionDate = (date, lang = 'en', month = 'long') => {
  if (!date) return ''
  const parsed = parseSessionDate(date)
  if (!parsed) return date
  return parsed.toLocaleDateString(sgLocale(lang), {
    year: 'numeric',
    month,
    day: 'numeric',
  })
}

/**
 * "today", "yesterday", "3 days ago", "2 months ago". Compared by calendar day
 * rather than elapsed hours, so a session recorded this morning still reads as
 * today. Intl carries the wording, so the Tagalog toggle needs no strings.
 */
export const formatRelativeSessionDate = (date, lang = 'en') => {
  const parsed = parseSessionDate(date)
  if (!parsed) return ''

  const now = new Date()
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const days = Math.round((startOfDay(parsed) - startOfDay(now)) / 86400000)

  const rtf = new Intl.RelativeTimeFormat(sgLocale(lang), { numeric: 'auto' })
  const distance = Math.abs(days)
  if (distance < 7) return rtf.format(days, 'day')
  if (distance < 28) return rtf.format(Math.round(days / 7), 'week')
  if (distance < 365) return rtf.format(Math.round(days / 30), 'month')
  return rtf.format(Math.round(days / 365), 'year')
}

/** "9:00 AM – 11:00 AM", or just the start if no end was recorded. */
export const formatTimeRange = (startTime, endTime) => {
  const to12h = (value) => {
    if (!value) return ''
    const [h, m] = value.split(':')
    const hour = Number(h)
    if (Number.isNaN(hour)) return value
    const suffix = hour >= 12 ? 'PM' : 'AM'
    const hour12 = hour % 12 === 0 ? 12 : hour % 12
    return `${hour12}:${m ?? '00'} ${suffix}`
  }
  const start = to12h(startTime)
  const end = to12h(endTime)
  if (start && end) return `${start} – ${end}`
  return start || end || ''
}

/**
 * Headcounts for a session. Members not explicitly marked absent are only
 * counted when they were marked present, so a half-filled form never inflates
 * the total.
 */
export const sessionTotals = (session) => {
  const present = session?.attendance?.presentIds?.length || 0
  const absent = session?.attendance?.absentIds?.length || 0
  const guests = session?.attendance?.guests?.length || 0
  return { present, absent, guests, total: present + guests }
}

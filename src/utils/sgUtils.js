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

export const formatSessionDate = (date, lang = 'en') => {
  if (!date) return ''
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return date
  return parsed.toLocaleDateString(lang === 'tl' ? 'fil-PH' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
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

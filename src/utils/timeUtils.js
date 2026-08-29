// Shared relative/absolute time formatting. Accepts a Date, a Firestore
// Timestamp, or anything the Date constructor understands, so callers don't
// each have to normalise first.
export const toDate = (value) => {
  if (!value) return null
  if (value instanceof Date) return isNaN(value) ? null : value
  if (typeof value.toDate === 'function') return value.toDate()
  if (typeof value.seconds === 'number') return new Date(value.seconds * 1000)
  const date = new Date(value)
  return isNaN(date) ? null : date
}

/** "just now", "5m ago", "3h ago", "2d ago", then a plain date. */
export const timeAgo = (value) => {
  const date = toDate(value)
  if (!date) return ''

  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

/** "12 Mar 2025" — for dates that aren't about recency, like when an account joined. */
export const formatDate = (value) => {
  const date = toDate(value)
  if (!date) return '—'
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

/** "12 Mar 2025, 9:04 AM" */
export const formatDateTime = (value) => {
  const date = toDate(value)
  if (!date) return '—'
  return `${formatDate(date)}, ${date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
}

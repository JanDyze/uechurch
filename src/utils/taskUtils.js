// The shape of a to-do list: what is late, what is today, what is coming, and
// what has no date on it at all.
//
// Lives here rather than in the view because the dashboard asks the same
// questions of the same records, and a list that disagrees with the tile
// counting it is worse than no tile.

/**
 * Local YYYY-MM-DD, matching how events store `date`. Never `toISOString()` —
 * that is UTC, and a task due tonight would read as yesterday's anywhere west
 * of Greenwich.
 */
export const todayKey = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`

/** Local midnight for a YYYY-MM-DD key, or null if it is not one. */
const dateOf = (key) => {
  const [year, month, day] = String(key || '').split('-').map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
}

/** Whole days from one key to another; negative when `to` is in the past. */
export const daysBetween = (fromKey, toKey) => {
  const from = dateOf(fromKey)
  const to = dateOf(toKey)
  if (!from || !to) return 0
  return Math.round((to - from) / 86_400_000)
}

/* --------------------------------------------------------------- buckets */

/**
 * The list is grouped by when a thing is due, not by who owns it or what
 * ministry it belongs to. "What is late and what is today" is the only
 * question a to-do list is opened to answer; everything else is a detail on
 * the row, and the search bar reaches it.
 */
export const DUE_BUCKETS = [
  { key: 'overdue', label: 'Overdue' },
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This week' },
  { key: 'later', label: 'Later' },
  { key: 'someday', label: 'No due date' },
]

export const dueBucket = (task, today = todayKey()) => {
  const due = task?.dueDate
  if (!due) return 'someday'
  // Measured off the `today` handed in rather than the clock, so a caller
  // that pins a date gets buckets that agree with the labels on the rows.
  const days = daysBetween(today, due)
  if (days < 0) return 'overdue'
  if (days === 0) return 'today'
  return days <= 7 ? 'week' : 'later'
}

export const isOverdue = (task, today = todayKey()) =>
  Boolean(task && !task.done && task.dueDate && task.dueDate < today)

export const isDueToday = (task, today = todayKey()) =>
  Boolean(task && !task.done && task.dueDate === today)

/**
 * How a due date reads on a row. Days rather than dates near the present —
 * "2 days late" and "Tomorrow" are understood without arithmetic, which
 * "Sep 3" is not.
 */
export const dueLabel = (dueDate, today = todayKey()) => {
  if (!dueDate) return ''
  const diff = daysBetween(today, dueDate)
  if (diff < 0) {
    const late = -diff
    return late === 1 ? '1 day late' : `${late} days late`
  }
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  const date = dateOf(dueDate)
  if (!date) return String(dueDate)
  if (diff < 7) return date.toLocaleDateString(undefined, { weekday: 'long' })
  const sameYear = date.getFullYear() === new Date().getFullYear()
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
}

/* -------------------------------------------------------------- priority */

// Three, not four. A "low priority" task is a task; offering the word only
// invites people to file things under it and never look again.
export const TASK_PRIORITIES = [
  { key: 'urgent', label: 'Urgent' },
  { key: 'high', label: 'High' },
  { key: 'normal', label: 'Normal' },
]

const PRIORITY_RANK = { urgent: 0, high: 1, normal: 2 }

export const priorityRank = (priority) => PRIORITY_RANK[priority] ?? 2

/** Only the two worth a badge; "normal" is the absence of one. */
export const isFlagged = (task) => task?.priority === 'urgent' || task?.priority === 'high'

/* ------------------------------------------------------------ assignment */

export const isAssignedTo = (task, memberId) => {
  if (!memberId) return false
  return (task?.assigneeIds || []).some((id) => String(id) === String(memberId))
}

export const assigneeLabel = (task) => {
  const names = (task?.assigneeNames || []).filter(Boolean)
  if (!names.length) return 'Unassigned'
  if (names.length <= 2) return names.join(' & ')
  return `${names[0]} +${names.length - 1}`
}

/* --------------------------------------------------------------- search */

/**
 * One search bar reaches everything on the row, including the words the row
 * shows rather than stores — "overdue", "unassigned", "done" — so the states
 * a filter drawer would offer can simply be typed.
 */
const haystack = (task, today) =>
  [
    task.title,
    task.details,
    task.ministry,
    ...(task.assigneeNames || []),
    task.assigneeIds?.length ? '' : 'unassigned',
    isFlagged(task) ? task.priority : '',
    task.done ? 'done complete finished' : 'open todo',
    isOverdue(task, today) ? 'overdue late' : '',
    isDueToday(task, today) ? 'today' : '',
    task.dueDate,
    task.createdByName,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

/** Every word has to land somewhere, so "ana overdue" narrows twice. */
export const matchesTaskQuery = (task, query, today = todayKey()) => {
  const terms = String(query || '').trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (!terms.length) return true
  const text = haystack(task, today)
  return terms.every((term) => text.includes(term))
}

/* ---------------------------------------------------------------- sorting */

/** Soonest first, undated last, then the loud ones, then alphabetical. */
export const compareTasks = (a, b) => {
  const aDue = a.dueDate || '9999-12-31'
  const bDue = b.dueDate || '9999-12-31'
  return (
    aDue.localeCompare(bDue) ||
    priorityRank(a.priority) - priorityRank(b.priority) ||
    String(a.title || '').localeCompare(String(b.title || ''))
  )
}

/** Most recently finished first — the only order a done pile is read in. */
export const compareDone = (a, b) => (b.doneAt?.getTime?.() || 0) - (a.doneAt?.getTime?.() || 0)

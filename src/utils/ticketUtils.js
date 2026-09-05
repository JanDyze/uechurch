// The backlog for building the app itself — not the church's task list, which
// is `taskUtils` and is about assigning jobs to people.

/**
 * The three kinds, named after the conventional-commit types this repo already
 * uses, so a ticket and the commit that closes it are filed under the same
 * word.
 */
export const TICKET_KINDS = [
  { key: 'bug', label: 'Bug', commit: 'fix' },
  { key: 'feature', label: 'Feature', commit: 'feat' },
  { key: 'chore', label: 'Chore', commit: 'chore' },
]

export const isTicketKind = (kind) => TICKET_KINDS.some((k) => k.key === kind)

export const kindLabel = (kind) => TICKET_KINDS.find((k) => k.key === kind)?.label || 'Feature'

/** Badge colours. Bugs are the only kind that gets to be loud. */
export const kindClasses = (kind) =>
  ({
    bug: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    feature: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    chore: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  })[kind] || 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'

/* --------------------------------------------------------------- status */

/**
 * A ticket moves rather than being ticked. Starting one takes it; pausing
 * keeps it yours while you are elsewhere; dropping puts it back for anyone.
 * That distinction is the point — "not working on it right now" and "no longer
 * mine" are different facts, and a checkbox can express neither.
 */
export const TICKET_STATUSES = [
  { key: 'open', label: 'To do' },
  { key: 'doing', label: 'In progress' },
  { key: 'paused', label: 'Paused' },
  { key: 'done', label: 'Done' },
]

export const isTicketStatus = (status) => TICKET_STATUSES.some((s) => s.key === status)

export const statusLabel = (status) =>
  TICKET_STATUSES.find((s) => s.key === status)?.label || 'To do'

export const isClosed = (ticket) => ticket?.status === 'done'

/** State reads as coloured words on the meta line, not as another pill. */
export const statusTextClasses = (status) =>
  ({
    doing: 'text-green-600 dark:text-green-400',
    paused: 'text-amber-600 dark:text-amber-400',
  })[status] || 'text-gray-400 dark:text-gray-500'

/**
 * Kind is carried by a coloured spine down the left of the row, so the row
 * needs no badge for it. Three pills on every line — kind, state, priority —
 * was three things to read before reaching the sentence that mattered.
 */
export const kindBorder = (kind) =>
  ({
    bug: 'border-l-red-500',
    feature: 'border-l-blue-500',
    chore: 'border-l-gray-300 dark:border-l-gray-600',
  })[kind] || 'border-l-gray-300 dark:border-l-gray-600'

export const kindTextClasses = (kind) =>
  ({
    bug: 'text-red-600 dark:text-red-400',
    feature: 'text-blue-600 dark:text-blue-400',
    chore: 'text-gray-500 dark:text-gray-400',
  })[kind] || 'text-gray-500 dark:text-gray-400'

/* --------------------------------------------------------------- search */

/**
 * The kind pills narrow by kind; this narrows by everything else. Assignee and
 * state are both in the haystack, so "paused", "unassigned" or a person's name
 * can simply be typed rather than each needing a control of its own.
 */
const haystack = (ticket) =>
  [
    ticket.title,
    ticket.details,
    ticket.kind,
    kindLabel(ticket.kind),
    ticket.assigneeName,
    ticket.assigneeUid ? 'taken assigned' : 'unassigned free',
    ticket.status,
    statusLabel(ticket.status),
    ticket.status === 'done' ? 'closed fixed complete' : '',
    ticket.status === 'doing' ? 'started wip' : '',
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

/** Every word has to land somewhere, so "bug lineup" narrows twice. */
export const matchesTicketQuery = (ticket, query) => {
  const terms = String(query || '')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
  if (!terms.length) return true
  const text = haystack(ticket)
  return terms.every((term) => text.includes(term))
}

/* -------------------------------------------------------------- ordering */

/**
 * The order you put them in, smallest first.
 *
 * There is no urgent/high/normal any more. A three-word scale makes you file
 * a ticket under a word and then argue with yourself about which word; a list
 * you drag says the same thing without the vocabulary, and says it precisely —
 * second is second, not "also high".
 *
 * A ticket with no order yet sinks to the bottom and falls back to newest
 * first, which is where an unplaced thing belongs.
 */
export const orderOf = (ticket) =>
  typeof ticket?.order === 'number' ? ticket.order : Number.MAX_SAFE_INTEGER

export const compareTickets = (a, b) =>
  orderOf(a) - orderOf(b) ||
  (b.createdAt?.getTime?.() || 0) - (a.createdAt?.getTime?.() || 0)

/** Most recently closed first — the only order a done pile is read in. */
export const compareClosed = (a, b) => (b.doneAt?.getTime?.() || 0) - (a.doneAt?.getTime?.() || 0)

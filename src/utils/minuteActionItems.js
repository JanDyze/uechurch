/**
 * Reads the Action Items out of a set of written-up minutes so each one can
 * be pushed onto the To-do list with a button rather than retyped.
 *
 * This parses the minutes rather than asking the model for JSON on the side,
 * for one reason: the page is the record. If the buttons came from a separate
 * structured reply, the list under the button could quietly disagree with the
 * table above it, and no one would be able to tell which was the minute. Read
 * from the table, the two cannot come apart — and every minute already filed
 * works without being re-enhanced.
 *
 * Nothing here is written back into the minute. A resolved date is a guess
 * offered to whoever presses the button; the minute keeps saying "by Friday".
 */

import { buildPeopleIndex, findPeople, resolveTimeline } from './minuteAnnotations'
import { todayKey } from './taskUtils'

/**
 * The heading the commitments live under. Two spellings, because the prompts
 * were rewritten in plainer words — "Who does what" — and every minute already
 * filed says "Action Items". A parser that only knew the new one would quietly
 * stop offering buttons on last year's minutes, and nothing on the page would
 * say why.
 */
const ACTION_HEADING = /^(#{1,4})\s*(?:[ivx]+\.?\s*)?(?:action items?|actions|who does what)\b/i
const ANY_HEADING = /^(#{1,4})\s+/

const CLEAR = /^(not specified|not set|none|none mentioned|n\/a|-|—|tbd)$/i
const clean = (value) => {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  return CLEAR.test(text) ? '' : text
}

// The table is Task | Who | By when | Status, and for a whole meeting
// Task | Who | By when | About. Read by header name rather than position, so
// a reordered column still lands — and so the older spellings the prompts used
// before they were plainened (Servant, Timeline, Agenda Item) keep working on
// every minute already filed.
const COLUMN_ALIASES = {
  task: ['task', 'action', 'action item', 'item', 'what', 'gawain'],
  servant: ['who', 'servant', 'assignee', 'assigned to', 'responsible', 'person', 'lead', 'owner'],
  timeline: ['by when', 'when', 'timeline', 'due', 'due date', 'deadline', 'target', 'by'],
  status: ['status', 'state'],
  agenda: ['about', 'agenda item', 'agenda', 'item', 'source'],
}

const columnFor = (header) => {
  const name = String(header || '').toLowerCase().replace(/[^a-z ]/g, '').trim()
  for (const [key, aliases] of Object.entries(COLUMN_ALIASES)) {
    if (aliases.includes(name)) return key
  }
  return null
}

const splitRow = (line) =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.replace(/\*\*/g, '').trim())

const isSeparator = (line) => /^\|?[\s:|-]+\|[\s:|-]*$/.test(String(line || '').trim())

/**
 * The Action Items section, in the order it appears. Both the per-item minutes
 * and the whole-meeting ones have one; a meeting's covers every agenda item.
 *
 * @param {string} markdown
 * @returns {Array<{task: string, servant: string, timeline: string, status: string, agenda: string}>}
 */
export function extractActionItems(markdown) {
  const source = String(markdown || '')
  if (!source.trim()) return []

  const lines = source.split(/\r?\n/)
  const items = []

  for (let i = 0; i < lines.length; i += 1) {
    const heading = lines[i].trim().match(ACTION_HEADING)
    if (!heading) continue

    const level = heading[1].length
    let columns = null

    for (i += 1; i < lines.length; i += 1) {
      const line = lines[i]
      const trimmed = line.trim()

      // The section ends at the next heading of the same rank or higher.
      const next = trimmed.match(ANY_HEADING)
      if (next && next[1].length <= level) {
        i -= 1
        break
      }

      if (isSeparator(trimmed)) continue

      if (trimmed.startsWith('|')) {
        const cells = splitRow(trimmed)
        const asColumns = cells.map(columnFor)
        // A header row is one where most cells name a column.
        if (!columns && asColumns.filter(Boolean).length >= 2) {
          columns = asColumns
          continue
        }
        if (!columns) columns = ['task', 'servant', 'timeline', 'status']

        const row = {}
        cells.forEach((cell, index) => {
          const key = columns[index]
          if (key && !row[key]) row[key] = clean(cell)
        })
        if (row.task) {
          items.push({
            task: row.task,
            servant: row.servant || '',
            timeline: row.timeline || '',
            status: row.status || '',
            agenda: row.agenda || '',
          })
        }
        continue
      }

      // The single-task case, where the prompt asks for a bullet instead of a
      // table. Everything is in one sentence; who and when are dug out of it.
      const bullet = trimmed.match(/^[*\-+]\s+(.*)$/) || trimmed.match(/^\d+[.)]\s+(.*)$/)
      if (bullet) {
        const text = bullet[1].replace(/\*\*/g, '').trim()
        if (!text || CLEAR.test(text)) continue
        items.push({ task: text, servant: '', timeline: text, status: '', agenda: '', inline: true })
      }
    }
  }

  return items
}

/**
 * One parsed row, turned into what the To-do list stores. The servant column
 * is matched against the roster; where it names nobody on it, the task is
 * added unassigned rather than to a guess.
 *
 * @param {object} item  a row from extractActionItems
 * @param {{ members?: Array, meetingDate?: string, minute?: object, agendaTitle?: string }} context
 */
export function toTaskDraft(item, context = {}) {
  const { members = [], meetingDate = todayKey(), minute, agendaTitle = '' } = context
  const index = buildPeopleIndex(members)

  // For a bullet the whole sentence is the haystack; for a table only the
  // Servant cell, so "letter to the mayor" does not assign itself to a Mayor.
  //
  // The sentence needs the bare-first-name rule and the cell must not have it:
  // a bullet saying "as a mark for those" would otherwise land on Mark's list,
  // while a Servant cell reading "joyce" is unambiguously Joyce.
  const people = findPeople(item.inline ? item.task : item.servant, index, {
    evidence: Boolean(item.inline),
  })
  const dueDate = resolveTimeline(item.timeline || '', meetingDate)

  const source = [minute?.title, item.agenda || agendaTitle].filter(Boolean).join(' — ')

  return {
    title: item.task,
    // What the minute said, kept verbatim next to the guess: a due date read
    // out of "before the anniversary" has to be checkable against the words.
    details: [
      source ? `From the minutes of ${source}.` : '',
      item.timeline && !item.inline ? `Timeline as minuted: ${item.timeline}.` : '',
      item.servant && !people.length ? `Minuted against: ${item.servant}.` : '',
    ]
      .filter(Boolean)
      .join(' '),
    assigneeIds: people.map((person) => person.id),
    assigneeNames: people.map((person) => person.name),
    ministry: '',
    dueDate,
    priority: 'normal',
    done: false,
    // Not stored on the task — shown beside the button so the resolved date
    // can be checked against the words it came from before anyone commits.
    timelineText: item.inline ? '' : item.timeline,
  }
}

/** Same wording, same task — how a row already pushed to the list is spotted. */
export const sameTaskTitle = (a, b) =>
  String(a || '').trim().toLowerCase().replace(/[^a-z0-9 ]/g, '') ===
  String(b || '').trim().toLowerCase().replace(/[^a-z0-9 ]/g, '')

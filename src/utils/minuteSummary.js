/**
 * What a row in the minutes list should actually say.
 *
 * The list used to show the title, the date, the start and end times, the
 * location and a count of attendees — five facts, four of which are the same
 * on every row (the church meets in the same hall, at the same time, with
 * roughly the same people) and none of which answer the question the list is
 * opened with: which meeting, and is it done?
 *
 * So a row carries when, what, and where it has got to. Everything else is on
 * the minute itself, one tap away.
 */

import { extractActionItems } from './minuteActionItems'
import { todayKey, daysBetween } from './taskUtils'

/* -------------------------------------------------------------------- when */

const asKey = (value) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return todayKey(date)
}

/**
 * How a meeting's date reads in a list of meetings. Near the present, in days
 * and weeks — "Last Sunday" is placed without arithmetic and "14 Sep" is not.
 * Far from it, the date, because "37 weeks ago" is not a date anyone can use.
 */
export const meetingWhen = (value, today = todayKey()) => {
  const key = asKey(value)
  if (!key) return { label: 'No date', relative: '' }

  const date = new Date(`${key}T00:00:00`)
  const days = daysBetween(today, key)
  const absolute = date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    ...(date.getFullYear() === new Date().getFullYear() ? {} : { year: 'numeric' }),
  })

  const weekday = date.toLocaleDateString(undefined, { weekday: 'long' })

  let relative = ''
  if (days === 0) relative = 'Today'
  else if (days === 1) relative = 'Tomorrow'
  else if (days === -1) relative = 'Yesterday'
  else if (days > 1 && days <= 7) relative = `This ${weekday}`
  else if (days < -1 && days >= -7) relative = `Last ${weekday}`
  else if (days < -7 && days >= -28) {
    const weeks = Math.round(-days / 7)
    relative = weeks === 1 ? '1 week ago' : `${weeks} weeks ago`
  } else if (days > 7 && days <= 28) {
    const weeks = Math.round(days / 7)
    relative = weeks === 1 ? 'In 1 week' : `In ${weeks} weeks`
  }

  return {
    label: absolute,
    relative,
    day: String(date.getDate()),
    month: date.toLocaleDateString(undefined, { month: 'short' }),
    upcoming: days > 0,
  }
}

/* ------------------------------------------------------------ how far along */

const hasText = (value) => Boolean(String(value || '').trim())

/**
 * The one thing worth knowing about a minute from the outside: whether it has
 * been written up, is still raw notes, or is an agenda nobody has filled in.
 *
 * Notes taken but never written up is the state that needs a person, so it is
 * the one the row says loudest.
 */
export const minuteProgress = (minute) => {
  // A meeting that is coming but has no record yet — see useScheduledMinutes.
  // Answered here as well as in the row so a caller counting the list's states
  // cannot accidentally file it under "nothing written".
  if (minute?.isScheduled) {
    return { key: 'scheduled', label: 'Not started', tone: 'idle', written: 0, total: 0 }
  }

  const structure = minute?.structure || {}
  const agenda = structure.agenda || []
  const discussions = structure.discussions || {}

  const written = agenda.filter((_, index) => hasText(discussions[index])).length
  const hasSummary = hasText(structure.overallSummary)

  // The pre-structure records, which have one `content` blob and no agenda.
  if (!agenda.length && hasText(minute?.content)) {
    return { key: 'written', label: 'Written up', tone: 'done', written: 0, total: 0 }
  }

  if (hasSummary) {
    return { key: 'written', label: 'Written up', tone: 'done', written, total: agenda.length }
  }
  if (written) {
    return {
      key: 'notes',
      label: written === agenda.length ? 'Notes taken' : `Notes on ${written} of ${agenda.length}`,
      tone: 'attention',
      written,
      total: agenda.length,
    }
  }
  if (agenda.length) {
    return {
      key: 'agenda',
      label: `Agenda ready · ${agenda.length} ${agenda.length === 1 ? 'item' : 'items'}`,
      tone: 'idle',
      written: 0,
      total: agenda.length,
    }
  }
  return { key: 'empty', label: 'Nothing yet', tone: 'idle', written: 0, total: 0 }
}

/**
 * Commitments this meeting made, counted off the written-up minutes — the
 * same table the detail page turns into buttons, so the number on the row and
 * the list under it can never disagree.
 */
export const minuteActionCount = (minute) => {
  const structure = minute?.structure || {}
  if (hasText(structure.overallSummary)) {
    return extractActionItems(structure.overallSummary).length
  }
  // No whole-meeting write-up yet: fall back to whatever the items have.
  return (structure.agenda || []).reduce(
    (total, _, index) => total + extractActionItems(structure.discussions?.[index] || '').length,
    0
  )
}

/* ------------------------------------------------------------------ search */

/**
 * One box reaching everything on the row, including the words the row shows
 * rather than stores — "written up", "notes", "empty" — so the states a filter
 * drawer would offer can simply be typed.
 */
export const matchesMinuteQuery = (minute, query) => {
  const terms = String(query || '').trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (!terms.length) return true

  const structure = minute?.structure || {}
  const progress = minuteProgress(minute)
  const haystack = [
    minute.title,
    minute.location,
    minute.content,
    minute.createdBy,
    progress.label,
    progress.key === 'written' ? 'written up done complete' : 'draft unfinished',
    ...(structure.agenda || []),
    ...Object.values(structure.discussions || {}),
    structure.overallSummary,
    minute.date,
    meetingWhen(minute.date).label,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  return terms.every((term) => haystack.includes(term))
}

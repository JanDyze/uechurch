/**
 * Writes up a meeting's raw notes as minutes, via /api/enhance.
 *
 * The notes are typed during the meeting and read afterwards as the church's
 * record, so the endpoint is told — at length — to organise them and invent
 * nothing. What comes back is Markdown, which MinuteDetails renders.
 *
 * The endpoint streams newline-delimited JSON, and this reports each event
 * back through `onEvent` so the page can show the document being written. It
 * still resolves to the finished Markdown, so a caller that does not care
 * about progress can ignore all of it and await the string.
 *
 * Like /api/notify and /api/email this only exists on Vercel, so it cannot be
 * exercised from `npm run dev` unless the route is added to vite.config.js.
 * It is — enhance is one of the handlers the dev server bridges.
 */
import { auth } from '../api/firebase'

/**
 * @param {string} title  the agenda item's title, or the meeting's
 * @param {string} rawNotes  what was typed during the meeting
 * @param {'agenda'|'meeting'} mode  one item, or the whole meeting drawn together
 * @param {object} details  date, time, place and attendance for the header —
 *   the church's own records, so the write-up never has to guess at them
 * @param {(event: {type: string, text?: string, delta?: string}) => void} [onEvent]
 *   'reading' while the model is still working the notes out, then 'text' for
 *   every piece of the document as it arrives, carrying the draft so far.
 * @param {Array<{text: string, quote?: string}>} [comments]
 *   Corrections from whoever is filing the minutes. Sent on every rewrite, so
 *   a fix survives being written up again — which is the whole reason they
 *   exist, since editing the finished page by hand did not.
 * @returns {Promise<string>} the minutes, as Markdown
 */
export async function enhanceMinutesWithClaude(
  title,
  rawNotes,
  mode = 'agenda',
  details = {},
  onEvent,
  comments = []
) {
  if (!rawNotes || !rawNotes.trim()) {
    throw new Error('No notes provided to enhance')
  }

  const token = await auth.currentUser?.getIdToken()
  if (!token) throw new Error('Sign in required')

  const response = await fetch('/api/enhance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ agendaTitle: title, rawNotes, mode, details, comments }),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.error || `Could not write up the notes (HTTP ${response.status})`)
  }

  // A body with no reader — an old browser, a proxy that decided to buffer —
  // still parses: the lines are all there, they just all arrive at once.
  if (!response.body?.getReader) {
    return readEvents(await response.text(), onEvent)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let draft = ''
  let finished = ''

  const consume = (line) => {
    const event = parseLine(line)
    if (!event) return
    if (event.type === 'error') throw new Error(event.error || 'Could not write up those notes.')
    if (event.type === 'text') {
      draft += event.delta || ''
      onEvent?.({ type: 'text', delta: event.delta || '', text: draft })
      return
    }
    if (event.type === 'done') finished = event.enhanced || ''
    else onEvent?.(event)
  }

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    // A chunk boundary can land mid-line, so only whole lines are parsed and
    // the remainder waits for the next read.
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    lines.forEach(consume)
  }
  buffer += decoder.decode()
  if (buffer.trim()) consume(buffer)

  // The last line carries the whole document. Preferred over the joined
  // deltas: a dropped chunk would otherwise be a quietly truncated minute,
  // and a truncated minute reads exactly like a complete one.
  const enhanced = finished || draft
  if (!enhanced.trim()) throw new Error('The summary came back empty')

  // Deliberately no local fallback formatter. There was one — it sorted lines
  // into Decisions and Action Items by keyword when the old Hugging Face
  // models were down, which was most of the time. Minutes are a record: a
  // page that looks written but was assembled by pattern-matching is worse
  // than an error message, because nothing on it says which one it is.
  return enhanced
}

const parseLine = (line) => {
  const trimmed = line.trim()
  if (!trimmed) return null
  try {
    return JSON.parse(trimmed)
  } catch {
    return null
  }
}

/** The unbuffered path, for a body that arrived whole. */
const readEvents = (body, onEvent) => {
  let draft = ''
  let finished = ''
  for (const line of String(body).split('\n')) {
    const event = parseLine(line)
    if (!event) continue
    if (event.type === 'error') throw new Error(event.error || 'Could not write up those notes.')
    if (event.type === 'text') {
      draft += event.delta || ''
      onEvent?.({ type: 'text', delta: event.delta || '', text: draft })
    } else if (event.type === 'done') {
      finished = event.enhanced || ''
    } else {
      onEvent?.(event)
    }
  }
  const enhanced = finished || draft
  if (!enhanced.trim()) throw new Error('The summary came back empty')
  return enhanced
}

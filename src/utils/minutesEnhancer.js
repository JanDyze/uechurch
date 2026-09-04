/**
 * Writes up a meeting's raw notes as minutes, via /api/enhance.
 *
 * The notes are typed during the meeting and read afterwards as the church's
 * record, so the endpoint is told — at length — to organise them and invent
 * nothing. What comes back is Markdown, which MinuteDetails renders.
 *
 * Like /api/notify and /api/email this only exists on Vercel, so it cannot be
 * exercised from `npm run dev` unless the route is added to vite.config.js.
 */
import { auth } from '../api/firebase'

/**
 * @param {string} title  the agenda item's title, or the meeting's
 * @param {string} rawNotes  what was typed during the meeting
 * @param {'agenda'|'meeting'} mode  one item, or the whole meeting drawn together
 * @param {object} details  date, time, place and attendance for the header —
 *   the church's own records, so the write-up never has to guess at them
 * @returns {Promise<string>} the minutes, as Markdown
 */
export async function enhanceMinutesWithClaude(title, rawNotes, mode = 'agenda', details = {}) {
  if (!rawNotes || !rawNotes.trim()) {
    throw new Error('No notes provided to enhance')
  }

  const token = await auth.currentUser?.getIdToken()
  if (!token) throw new Error('Sign in required')

  const response = await fetch('/api/enhance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ agendaTitle: title, rawNotes, mode, details }),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.error || `Could not write up the notes (HTTP ${response.status})`)
  }

  const data = await response.json()
  if (!data.enhanced) throw new Error('The summary came back empty')

  // Deliberately no local fallback formatter. There was one — it sorted lines
  // into Decisions and Action Items by keyword when the old Hugging Face
  // models were down, which was most of the time. Minutes are a record: a
  // page that looks written but was assembled by pattern-matching is worse
  // than an error message, because nothing on it says which one it is.
  return data.enhanced
}

import { auth } from './firebase'

// Talks to /api/song-lookup, which asks Claude to search the web for a song's
// details. Like /api/notify and /api/email it only exists on Vercel, so this
// cannot be exercised from `npm run dev`.

/**
 * Looks a song up by title. Returns the details that go around the lyrics —
 * writers, CCLI number, usual key, an official video — plus links to where the
 * lyrics may be copied from. Never returns lyrics themselves.
 */
export const lookupSong = async ({ title, artist = '', categories = [] }) => {
  const token = await auth.currentUser?.getIdToken()
  if (!token) throw new Error('Sign in required')

  const response = await fetch('/api/song-lookup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ title, artist, categories }),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.error || `Lookup failed (HTTP ${response.status})`)
  }

  return response.json()
}

/**
 * The free-text block the lookup contributes to a song's notes. Only the parts
 * that actually came back are included, so a thin result stays a short note
 * rather than a form full of "Unknown".
 */
export const buildLookupNotes = (result) => {
  const lines = [
    result.artist && `Artist: ${result.artist}`,
    result.writers && `Writers: ${result.writers}`,
    result.publisher && `Publisher: ${result.publisher}`,
    result.year && `Year: ${result.year}`,
    result.ccliNumber && `CCLI #${result.ccliNumber}`,
    result.commonKey && `Usual key: ${result.commonKey}`,
    result.bpm && `${result.bpm} BPM`,
    result.themes?.length && `Themes: ${result.themes.join(', ')}`,
    result.scripture?.length && `Scripture: ${result.scripture.join('; ')}`,
  ].filter(Boolean)

  return lines.join('\n')
}

/**
 * Identifies a song's structure — which lines make up which section, which
 * sections repeat an earlier one, which lines are ad-libs — and recapitalises
 * the lines whose words address God, the way a worship sheet should read.
 *
 * `lines` are the sung lines alone, numbered by their position in the array.
 * The structure comes back as line numbers and labels, never text, so applying
 * it is the app's job (see applyStructure in utils/songUtils.js). `recased`
 * does carry text — a line number against that line rewritten — but only for
 * lines the server has already checked to be the same words in a different
 * case, so a line that came back reworded is not in it at all.
 *
 * @returns {{ sections: Array, adlibLines: number[], recased: Record<string, string>,
 *   recasedRefused: number, covered: number, total: number }}
 */
export const analyseStructure = async (lines) => {
  const token = await auth.currentUser?.getIdToken()
  if (!token) throw new Error('Sign in required')

  const response = await fetch('/api/lyrics-structure', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ lines }),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.error || `Analysis failed (HTTP ${response.status})`)
  }

  return response.json()
}

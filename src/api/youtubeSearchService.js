import { auth } from './firebase'

// Talks to /api/youtube-search, which searches YouTube for a song the list does
// not have yet. Like /api/notify and /api/email it only exists on Vercel, so
// this cannot be exercised from `npm run dev`.

/**
 * Searches YouTube. Returns up to eight embeddable videos as
 * `{ videoId, title, channelTitle, publishedAt, thumbnail, url }`.
 */
export const searchYoutube = async (query) => {
  const token = await auth.currentUser?.getIdToken()
  if (!token) throw new Error('Sign in required')

  const response = await fetch('/api/youtube-search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ q: query }),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.error || `Search failed (HTTP ${response.status})`)
  }

  const { results } = await response.json()
  return Array.isArray(results) ? results : []
}

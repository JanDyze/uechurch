// The public page's data, fetched from the server instead of read from
// Firestore.
//
// Everything else in this folder talks to Firestore directly, which works
// because everything else is behind a sign-in. The page at "/" is not: the
// security rules answer an anonymous browser with permission-denied, so a
// visitor reading appSettings for themselves would see the built-in defaults
// and none of what an admin actually typed. api/public.js reads it with the
// Admin SDK and hands back the narrow slice that is meant to be public.

/** The endpoint answers the same thing for everyone, so one visit fetches once. */
let inFlight = null

export const fetchPublicSite = async () => {
  if (inFlight) return inFlight

  inFlight = (async () => {
    const response = await fetch('/api/public', { headers: { Accept: 'application/json' } })
    if (!response.ok) {
      // 503 is the endpoint saying it has no service account rather than
      // anything being broken; either way the page falls back to what it can
      // read for itself.
      throw new Error(`Public page data unavailable (${response.status})`)
    }
    return response.json()
  })()

  try {
    return await inFlight
  } catch (error) {
    // Don't cache the failure: a retry on the next visit is free.
    inFlight = null
    throw error
  }
}

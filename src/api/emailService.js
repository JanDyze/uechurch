import { auth, db } from './firebase'
import { collection, doc, limit, onSnapshot, orderBy, query, setDoc } from 'firebase/firestore'
import { toDate } from '../utils/timeUtils'

// Email digests are opt-in, and the switch lives on the account's own mirror
// document in `userAccounts` — the same one the sign-in stamp writes, so a
// member turning digests on needs no permission they do not already have.
//
// Sending happens on the server (/api/email), because only the Admin SDK can
// read the whole congregation's addresses and only the server holds the Gmail
// credentials. Like /api/notify, that endpoint exists only on Vercel
// deployments; `npm run dev` cannot reach it.

const ACCOUNTS_COLLECTION = 'userAccounts'
const MAIL_LOG_COLLECTION = 'mailLog'

/** The three congregation digests, in the order they are offered. */
export const DIGEST_KINDS = [
  {
    key: 'monthly',
    label: 'Month ahead',
    schedule: 'On the 1st of the month',
    description: 'Everything on the calendar for the month, grouped by day.',
  },
  {
    key: 'today',
    label: "Today's events",
    schedule: 'Every morning',
    description: 'What is on today. Nothing is sent on a day with an empty calendar.',
  },
  {
    key: 'happening',
    label: "What's happening",
    schedule: 'Monday mornings',
    description: 'The next seven days at a glance.',
  },
]

/** Off until switched on; once on, all three kinds arrive unless turned off. */
export const DEFAULT_DIGEST_PREFS = {
  enabled: false,
  monthly: true,
  today: true,
  happening: true,
}

/** An account saved before this feature existed reads as opted out. */
export const normalizeDigestPrefs = (data) => ({
  ...DEFAULT_DIGEST_PREFS,
  ...(data?.emailDigests || {}),
})

/** Live view of the signed-in account's own preferences. */
export const subscribeToDigestPrefs = (uid, callback) => {
  if (!uid) return () => {}
  return onSnapshot(
    doc(db, ACCOUNTS_COLLECTION, uid),
    (snapshot) => callback(normalizeDigestPrefs(snapshot.data())),
    (error) => {
      console.error('Error subscribing to email preferences:', error)
      callback({ ...DEFAULT_DIGEST_PREFS })
    }
  )
}

/** merge:true — the sign-in stamp and the digest switch share this document. */
export const saveDigestPrefs = (uid, prefs) => {
  if (!uid) throw new Error('Sign in required')
  return setDoc(
    doc(db, ACCOUNTS_COLLECTION, uid),
    { emailDigests: { ...DEFAULT_DIGEST_PREFS, ...prefs } },
    { merge: true }
  )
}

const normalizeLogEntry = (docSnap) => {
  const data = docSnap.data()
  return {
    id: docSnap.id,
    kind: data.kind || '',
    subject: data.subject || '',
    events: data.events ?? null,
    range: data.range || '',
    recipients: data.recipients || 0,
    sent: data.sent || 0,
    failed: data.failed || 0,
    // 'cron' for a scheduled send, 'manual' for a button in Settings
    trigger: data.trigger || 'manual',
    actor: data.actor || '',
    error: data.error || '',
    sentAt: toDate(data.sentAt),
  }
}

/**
 * Newest sends first — what the Settings panel shows under the buttons.
 *
 * `onError` is offered because `mailLog` is written by the server and read by
 * the browser: until a Firestore rule allows administrators to read it, this
 * listener is rejected, and an empty list would look exactly like a church
 * that has simply never sent anything. The panel says which it is.
 */
export const subscribeToMailLog = (callback, { max = 12, onError } = {}) => {
  const q = query(
    collection(db, MAIL_LOG_COLLECTION),
    orderBy('sentAt', 'desc'),
    limit(max)
  )
  return onSnapshot(
    q,
    (snapshot) => {
      onError?.(null)
      callback(snapshot.docs.map(normalizeLogEntry))
    },
    (error) => {
      console.error('Error subscribing to mail log:', error)
      onError?.(
        error.code === 'permission-denied'
          ? 'This history needs a Firestore rule letting administrators read the mailLog collection.'
          : 'Could not load the send history.'
      )
      callback([])
    }
  )
}

const postToEndpoint = async (payload) => {
  const token = await auth.currentUser?.getIdToken()
  if (!token) throw new Error('Sign in required')

  const response = await fetch('/api/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  })

  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    // Vite serves the app but not the `api/` folder, so a 404 here almost
    // always means `npm run dev` rather than a genuinely missing route.
    // Saying so beats leaving an administrator to wonder what broke.
    if (response.status === 404) {
      throw new Error(
        'The mail service only runs on a Vercel deployment, not on the local dev server.'
      )
    }
    throw new Error(body.error || `Send failed (HTTP ${response.status})`)
  }
  return body
}

/**
 * Sends one digest to every opted-in account, now, rather than waiting for its
 * schedule. Administrators only — the endpoint checks, not just the UI.
 *
 * With `preview` the server builds the email and reports what it would send
 * without delivering anything, which is how the panel answers "who would get
 * this?" before an admin commits to it.
 */
export const sendDigestNow = (kind, { preview = false } = {}) =>
  postToEndpoint({ type: kind, preview })

/** The full activity report, to the requesting administrator's own address. */
export const sendActivityReport = (range = 'month', { preview = false } = {}) =>
  postToEndpoint({ type: 'activity', range, preview })

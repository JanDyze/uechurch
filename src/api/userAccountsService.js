import { auth, db } from './firebase'
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
} from 'firebase/firestore'
import { toDate } from '../utils/timeUtils'
import { notify } from './notifyService'

// One document per Firebase auth account, keyed by uid.
//
// Firebase's own user list is only reachable through the Admin SDK, which the
// browser has no business holding, so the app keeps its own mirror: every
// sign-in stamps the account here and the Accounts page reads it back. The
// facts that matter — which provider was used, when the account was created,
// when it last signed in — all come from the Firebase user object itself, so
// the mirror stays honest even though it is written client-side.
const ACCOUNTS_COLLECTION = 'userAccounts'

// Firebase provider ids, spelled for people.
const PROVIDER_LABELS = {
  'google.com': 'Google',
  password: 'Email & password',
  'facebook.com': 'Facebook',
  'apple.com': 'Apple',
  'github.com': 'GitHub',
  'twitter.com': 'X / Twitter',
  phone: 'Phone',
}

export const providerLabel = (providerId) =>
  PROVIDER_LABELS[providerId] || providerId || 'Unknown'

/** Short form for chips and stat tiles. */
export const providerShortLabel = (providerId) =>
  providerId === 'password' ? 'Email' : providerLabel(providerId)

const toTimestamp = (value) => {
  const date = toDate(value)
  return date ? Timestamp.fromDate(date) : null
}

const normalizeAccount = (docSnap) => {
  const data = docSnap.data()
  const providers = Array.isArray(data.providers) && data.providers.length
    ? data.providers
    : ['password']

  return {
    uid: docSnap.id,
    email: data.email || '',
    displayName: data.displayName || '',
    photoURL: data.photoURL || '',
    emailVerified: Boolean(data.emailVerified),
    // Only /api/accounts knows this — a browser cannot see another account's
    // disabled flag, so it stays false until a sync fills it in.
    disabled: Boolean(data.disabled),
    providers,
    // How this account was created — Google, or an email and password typed
    // into the register form. Multi-provider accounts keep the full list.
    primaryProvider: data.primaryProvider || providers[0],
    createdAt: toDate(data.createdAt),
    lastSignInAt: toDate(data.lastSignInAt),
    // An account backfilled by /api/accounts has never checked in from a
    // browser, so its last sign-in is the best "last seen" available.
    lastActiveAt: toDate(data.lastActiveAt) || toDate(data.lastSignInAt),
  }
}

/**
 * Upserts the signed-in account's mirror document. Called on every auth state
 * change, so it doubles as the "last active" stamp for the visit.
 */
/**
 * Whether Firebase considers this the account's first-ever sign-in: it stamps
 * both times at once when an account is created, and only `lastSignInTime`
 * moves afterwards.
 *
 * Checked alongside the mirror being absent, never on its own. This stays true
 * for the whole of that first session — a refresh does not re-sign-in — so on
 * its own it would announce the same person on every page load. And the mirror
 * being absent is not enough by itself either: an account made before this
 * collection existed has no document, and is not news.
 */
const FIRST_SIGN_IN_WINDOW_MS = 5 * 60 * 1000

const isFirstEverSignIn = (user) => {
  const created = Date.parse(user?.metadata?.creationTime || '')
  const lastSignIn = Date.parse(user?.metadata?.lastSignInTime || '')
  if (!Number.isFinite(created) || !Number.isFinite(lastSignIn)) return false
  return Math.abs(lastSignIn - created) < FIRST_SIGN_IN_WINDOW_MS
}

export const recordSignIn = async (user) => {
  if (!user?.uid) return

  const providers = (user.providerData || [])
    .map((entry) => entry?.providerId)
    .filter(Boolean)

  const payload = {
    email: user.email || '',
    displayName: user.displayName || '',
    photoURL: user.photoURL || '',
    emailVerified: Boolean(user.emailVerified),
    // An account with no providerData reached us through email and password.
    providers: providers.length ? providers : ['password'],
    primaryProvider: providers[0] || 'password',
    lastActiveAt: serverTimestamp(),
  }

  // Firebase already knows both of these; copying them across means the page
  // shows the true creation date even for accounts made before this mirror
  // existed, the first time their owner signs in again.
  const createdAt = toTimestamp(user.metadata?.creationTime)
  if (createdAt) payload.createdAt = createdAt

  const lastSignInAt = toTimestamp(user.metadata?.lastSignInTime)
  if (lastSignInAt) payload.lastSignInAt = lastSignInAt

  const ref = doc(db, ACCOUNTS_COLLECTION, user.uid)

  // Read before write, so "have we ever seen this account?" is still
  // answerable a line later. One extra read per app load, which is the price
  // of an administrator finding out a new person has arrived without watching
  // the Accounts page.
  const seenBefore = await getDoc(ref)
    .then((snapshot) => snapshot.exists())
    .catch(() => true) // A failed read must never turn into a false alarm.

  await setDoc(ref, payload, { merge: true })

  if (!seenBefore && isFirstEverSignIn(user)) {
    const who = user.displayName || user.email || 'Someone'
    notify('account.new', {
      title: `New account: ${who}`,
      body: `Signed in for the first time with ${
        PROVIDER_LABELS[payload.primaryProvider] || payload.primaryProvider
      }. No member record linked yet.`,
    })
  }
}

/**
 * Refreshes only the activity stamp. The presence heartbeat calls this on a
 * much slower cadence than it beats — presence itself already answers "who is
 * online right now", so this only has to be accurate enough to sort the
 * people who aren't.
 */
export const touchLastActive = async (uid) => {
  if (!uid) return
  await setDoc(
    doc(db, ACCOUNTS_COLLECTION, uid),
    { lastActiveAt: serverTimestamp() },
    { merge: true }
  )
}

export const subscribeToUserAccounts = (callback) => {
  return onSnapshot(
    collection(db, ACCOUNTS_COLLECTION),
    (snapshot) => {
      const accounts = snapshot.docs.map(normalizeAccount)
      // Newest sign-in first, client-side so no composite index is needed.
      accounts.sort((a, b) => (b.lastActiveAt?.getTime() || 0) - (a.lastActiveAt?.getTime() || 0))
      callback(accounts)
    },
    (error) => {
      console.error('Error subscribing to user accounts:', error)
      callback([])
    }
  )
}

/**
 * Backfills the collection from Firebase Auth itself, which only the Admin SDK
 * can enumerate. Administrators only, and — like /api/notify — it exists only
 * on Vercel deployments, so `npm run dev` cannot reach it.
 */
export const syncAccountsFromAuth = async () => {
  const token = await auth.currentUser?.getIdToken()
  if (!token) throw new Error('Sign in required')

  const response = await fetch('/api/accounts', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.error || `Sync failed (HTTP ${response.status})`)
  }

  return response.json()
}

/**
 * Drops the mirror record. This does not delete the Firebase auth account —
 * that needs the Admin SDK — it only removes the row from the Accounts page,
 * and the next sign-in by that account puts it straight back.
 */
export const removeUserAccount = (uid) => deleteDoc(doc(db, ACCOUNTS_COLLECTION, uid))

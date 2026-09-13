import { db } from './firebase'
import {
  AUDIT_COLLECTION,
  collection,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  startAfter,
} from './firestore'

// Reading the audit log. Writing it is firestore.js's job alone — nothing here
// adds, edits or removes an entry, and nothing anywhere else should.

export const AUDIT_PAGE_SIZE = 100

const toEntry = (d) => {
  const data = d.data()
  return {
    id: d.id,
    ...data,
    // A just-written entry reads back with a null timestamp until the server
    // stamps it; "now" is the truthful stand-in for those few hundred ms.
    at: data.at?.toDate ? data.at.toDate() : new Date(),
    _snapshot: d,
  }
}

/** The newest page, live: what somebody did a minute ago appears on its own. */
export const subscribeToRecentAudit = (callback) =>
  onSnapshot(
    query(collection(db, AUDIT_COLLECTION), orderBy('at', 'desc'), limit(AUDIT_PAGE_SIZE)),
    (snapshot) => callback(snapshot.docs.map(toEntry)),
    (error) => {
      console.error('Error subscribing to the audit log:', error)
      callback([])
    }
  )

/** The page before `last`. Fetched once rather than watched: history holds still. */
export const fetchOlderAudit = async (last) => {
  if (!last?._snapshot) return []
  const snapshot = await getDocs(
    query(
      collection(db, AUDIT_COLLECTION),
      orderBy('at', 'desc'),
      startAfter(last._snapshot),
      limit(AUDIT_PAGE_SIZE)
    )
  )
  return snapshot.docs.map(toEntry)
}

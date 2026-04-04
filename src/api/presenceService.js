import { db } from './firebase'
import {
  collection,
  doc,
  setDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  deleteDoc,
  Timestamp,
  orderBy
} from 'firebase/firestore'

const PRESENCE_COLLECTION = 'presence'

/**
 * Update the current session's presence in Firestore
 * @param {string} sessionId Unique ID for this browser session
 * @param {object} animalData { name, bg, color }
 */
export const updatePresence = async (sessionId, animalData) => {
  const presenceRef = doc(db, PRESENCE_COLLECTION, sessionId)
  return await setDoc(presenceRef, {
    ...animalData,
    lastSeen: serverTimestamp()
  }, { merge: true })
}

/**
 * Subscribe to all active presence records (seen in the last 2 minutes)
 * @param {function} callback Called with the array of active visitors
 */
export const subscribeToPresence = (callback) => {
  // We filter by lastSeen > (Now - 120 seconds)
  // Note: Client-side clock might differ slightly from server, 
  // so we filter client-side too to be sure.
  const q = query(
    collection(db, PRESENCE_COLLECTION),
    orderBy('lastSeen', 'desc')
  )

  return onSnapshot(q, (snapshot) => {
    const now = Date.now()
    const ONE_MINUTE_MS = 60 * 1000
    
    const activeVisitors = snapshot.docs.map(doc => {
      const data = doc.data()
      // Firestore Timestamp to MS
      const lastSeenMs = data.lastSeen?.seconds ? data.lastSeen.seconds * 1000 : now
      return {
        id: doc.id,
        ...data,
        lastSeenMs
      }
    }).filter(v => (now - v.lastSeenMs) < ONE_MINUTE_MS)

    callback(activeVisitors)
  })
}

/**
 * Remove presence on logout/exit
 */
export const removePresence = async (sessionId) => {
  const presenceRef = doc(db, PRESENCE_COLLECTION, sessionId)
  return await deleteDoc(presenceRef)
}

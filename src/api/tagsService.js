import { db } from './firebase'
import {
  collection,
  addDoc,
  query,
  onSnapshot,
  orderBy,
  serverTimestamp
} from 'firebase/firestore'

const TAGS_COLLECTION = 'memberTags'

/**
 * Subscribe to custom ministry tags created from the toolbar (not the
 * preset tags, which are hardcoded, and not tags that only exist because
 * they were typed onto a specific member).
 */
export const subscribeToCustomTags = (callback) => {
  const q = query(collection(db, TAGS_COLLECTION), orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snapshot) => {
    const tags = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))
    callback(tags)
  })
}

/**
 * Register a new ministry tag as a selectable option, without applying it
 * to any member.
 */
export const addCustomTag = async (name) => {
  return await addDoc(collection(db, TAGS_COLLECTION), {
    name,
    createdAt: serverTimestamp()
  })
}

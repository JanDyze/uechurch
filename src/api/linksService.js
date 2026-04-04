import { db } from './firebase'
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  onSnapshot,
  orderBy,
  serverTimestamp
} from 'firebase/firestore'

const LINKS_COLLECTION = 'links'

/**
 * Subscribe to all links, ordered by newest first
 */
export const subscribeToLinks = (callback) => {
  const q = query(collection(db, LINKS_COLLECTION), orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snapshot) => {
    const links = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))
    callback(links)
  })
}

/**
 * Add a new link to the database
 */
export const addLink = async (linkData) => {
  return await addDoc(collection(db, LINKS_COLLECTION), {
    ...linkData,
    createdAt: serverTimestamp()
  })
}

/**
 * Update an existing link
 */
export const updateLink = async (id, linkData) => {
  const linkRef = doc(db, LINKS_COLLECTION, id)
  return await updateDoc(linkRef, linkData)
}

/**
 * Delete a link permanently
 */
export const deleteLink = async (id) => {
  const linkRef = doc(db, LINKS_COLLECTION, id)
  return await deleteDoc(linkRef)
}

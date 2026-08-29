import { db } from './firebase'
import { doc, setDoc, onSnapshot, Timestamp } from 'firebase/firestore'

// A single document holds everything a different congregation would want to
// change without a code edit: what the church is called, and the category
// vocabularies used by the gallery, links, song list and calendar.
const SETTINGS_DOC = ['appSettings', 'church']

export const subscribeToAppSettings = (callback) => {
  return onSnapshot(
    doc(db, ...SETTINGS_DOC),
    (snapshot) => callback(snapshot.exists() ? snapshot.data() : null),
    (error) => {
      console.error('Error subscribing to app settings:', error)
      callback(null)
    }
  )
}

/** Merges a partial update, so saving the church name cannot drop categories. */
export const saveAppSettings = async (partial) => {
  await setDoc(
    doc(db, ...SETTINGS_DOC),
    { ...partial, updatedAt: Timestamp.now() },
    { merge: true }
  )
}

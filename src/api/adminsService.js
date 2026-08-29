import { db } from './firebase'
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore'

// One document per administrator, keyed by Firebase auth uid so membership is
// a direct document lookup rather than a query.
const ADMINS_COLLECTION = 'appAdmins'

const normalizeAdmin = (docSnap) => {
  const data = docSnap.data()
  return {
    uid: docSnap.id,
    email: data.email || '',
    displayName: data.displayName || '',
    addedBy: data.addedBy || '',
    addedByEmail: data.addedByEmail || '',
    addedAt: data.addedAt?.toDate?.() || new Date(),
  }
}

export const subscribeToAdmins = (callback) => {
  return onSnapshot(
    collection(db, ADMINS_COLLECTION),
    (snapshot) => {
      const admins = snapshot.docs.map(normalizeAdmin)
      admins.sort((a, b) => a.addedAt - b.addedAt)
      callback(admins)
    },
    (error) => {
      console.error('Error subscribing to admins:', error)
      callback([])
    }
  )
}

export const addAdmin = async (user, addedBy) => {
  await setDoc(doc(db, ADMINS_COLLECTION, user.uid), {
    email: user.email || '',
    displayName: user.displayName || '',
    addedBy: addedBy?.uid || '',
    addedByEmail: addedBy?.email || '',
    addedAt: Timestamp.now(),
  })
}

export const removeAdmin = async (uid) => {
  await deleteDoc(doc(db, ADMINS_COLLECTION, uid))
}

/**
 * Bootstrap: claims the first admin slot, but only while there are none.
 * Re-reads the collection at call time so two people tapping the button at
 * once cannot both come through — the second sees an existing admin and is
 * turned away.
 */
export const claimFirstAdmin = async (user) => {
  const snapshot = await getDocs(collection(db, ADMINS_COLLECTION))
  if (!snapshot.empty) {
    throw new Error('An administrator already exists.')
  }
  await addAdmin(user, user)
}

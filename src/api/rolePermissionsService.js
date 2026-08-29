import { db } from './firebase'
import { collection, doc, setDoc, deleteDoc, onSnapshot, Timestamp } from 'firebase/firestore'

// One document per ministry tag, keyed by the tag name exactly as it appears
// on a member record, holding the capabilities that tag grants.
const ROLES_COLLECTION = 'rolePermissions'

export const subscribeToRolePermissions = (callback) => {
  return onSnapshot(
    collection(db, ROLES_COLLECTION),
    (snapshot) => {
      const map = {}
      snapshot.docs.forEach((d) => {
        const data = d.data()
        map[d.id] = Array.isArray(data.capabilities) ? data.capabilities : []
      })
      callback(map)
    },
    (error) => {
      console.error('Error subscribing to role permissions:', error)
      callback({})
    }
  )
}

export const setRolePermissions = async (tag, capabilities, updatedBy) => {
  await setDoc(doc(db, ROLES_COLLECTION, tag), {
    capabilities,
    updatedBy: updatedBy?.email || updatedBy?.uid || '',
    updatedAt: Timestamp.now(),
  })
}

export const clearRolePermissions = async (tag) => {
  await deleteDoc(doc(db, ROLES_COLLECTION, tag))
}

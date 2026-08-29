import { db } from './firebase'
import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  onSnapshot,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore'

import { DEFAULT_MINISTRIES } from '../utils/memberUtils'

// A ministry is what someone *does* in the church — Song Leader, Usher,
// Preacher — and it is the only thing that grants access. Tags are separate
// (see tagsService): free-text labels for describing and filtering members,
// which grant nothing.
//
// They used to be one field. Because `tags` is a free-text array on the member
// document and `rolePermissions` is keyed by the same string, typing
// "Preacher" onto a member as a casual label silently handed them everything
// the Preacher role could do. A controlled vocabulary closes that: a ministry
// has to exist here before it can be assigned, and only names from this
// collection are consulted when resolving permissions.

const MINISTRIES_COLLECTION = 'ministries'
const MEMBERS_COLLECTION = 'members'
const ROLES_COLLECTION = 'rolePermissions'

export const subscribeToMinistries = (callback) => {
  const q = query(collection(db, MINISTRIES_COLLECTION), orderBy('name'))
  return onSnapshot(
    q,
    (snapshot) =>
      callback(
        snapshot.docs.map((d) => ({
          id: d.id,
          name: d.data().name || '',
          description: d.data().description || '',
        }))
      ),
    (error) => {
      console.error('Error subscribing to ministries:', error)
      callback([])
    }
  )
}

export const addMinistry = async (name, description = '') =>
  addDoc(collection(db, MINISTRIES_COLLECTION), {
    name: name.trim(),
    description: description.trim(),
    createdAt: serverTimestamp(),
  })

/**
 * Writes the starter ministries once, and only into a genuinely empty
 * collection — so a fresh church gets sensible options, but one that has
 * deliberately cleared the list never sees them come back.
 */
export const seedDefaultMinistriesIfEmpty = async () => {
  const snapshot = await getDocs(collection(db, MINISTRIES_COLLECTION))
  if (!snapshot.empty) return 0
  await Promise.all(DEFAULT_MINISTRIES.map((name) => addMinistry(name)))
  return DEFAULT_MINISTRIES.length
}

/** Every member currently serving in a ministry. */
const membersInMinistry = async (name) => {
  const snapshot = await getDocs(
    query(collection(db, MEMBERS_COLLECTION), where('ministries', 'array-contains', name))
  )
  return snapshot.docs
}

/**
 * Renames a ministry everywhere it is referenced: on every member serving in
 * it, on its rolePermissions document (the name is the document id there, so
 * the grant has to be moved rather than edited), and on the record itself.
 *
 * Missing any of the three would silently revoke someone's access.
 */
export const renameMinistry = async (oldName, newName, ministryId = null) => {
  const docs = await membersInMinistry(oldName)
  await Promise.all(
    docs.map((d) => {
      const ministries = (d.data().ministries || []).map((m) => (m === oldName ? newName : m))
      return updateDoc(d.ref, { ministries })
    })
  )

  const roleDoc = await getDoc(doc(db, ROLES_COLLECTION, oldName))
  if (roleDoc.exists()) {
    await setDoc(doc(db, ROLES_COLLECTION, newName), roleDoc.data())
    await deleteDoc(doc(db, ROLES_COLLECTION, oldName))
  }

  if (ministryId) {
    await updateDoc(doc(db, MINISTRIES_COLLECTION, ministryId), { name: newName })
  }

  return docs.length
}

/**
 * Removes a ministry from every member, drops the permissions it granted, and
 * deletes the record. Anyone serving in it loses whatever access it carried,
 * which is why the UI confirms with the affected member count first.
 */
export const deleteMinistry = async (name, ministryId = null) => {
  const docs = await membersInMinistry(name)
  await Promise.all(
    docs.map((d) => {
      const ministries = (d.data().ministries || []).filter((m) => m !== name)
      return updateDoc(d.ref, { ministries })
    })
  )

  await deleteDoc(doc(db, ROLES_COLLECTION, name)).catch(() => {
    // No grants were ever configured for this ministry; nothing to remove.
  })

  if (ministryId) {
    await deleteDoc(doc(db, MINISTRIES_COLLECTION, ministryId))
  }

  return docs.length
}

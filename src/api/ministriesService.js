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
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore'

import { DEFAULT_MINISTRIES } from '../utils/memberUtils'
import { inBatches } from './batchWrite'

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

const refFor = (member) => doc(db, MEMBERS_COLLECTION, String(member.firestoreId || member.id))

const same = (a, b) => String(a || '').toLowerCase() === String(b || '').toLowerCase()

/**
 * The one guard that makes this file's promise true rather than merely
 * intended: a name that is not in the ministries collection is not a ministry,
 * whatever the screen that called this believed. Assigning one hands out
 * whatever rolePermissions grants it, so the check is worth a read.
 */
const assertKnownMinistry = async (name) => {
  const snapshot = await getDocs(collection(db, MINISTRIES_COLLECTION))
  const known = snapshot.docs.some((d) => same(d.data().name, name))
  if (!known) {
    throw new Error(`"${name}" is not a ministry. Add it in Settings first.`)
  }
}

/**
 * Puts everyone in `members` into `ministry`, in batches, skipping whoever is
 * already in it so the count returned is what actually changed.
 *
 * This grants access — that is what a ministry is for — so the caller is
 * expected to have said so plainly before calling. arrayUnion rather than a
 * rewritten array, for the same reason as tags: the member form writes this
 * field too, and a wholesale rewrite would drop a ministry added elsewhere
 * while the batch was in flight.
 *
 * @returns how many people were added
 */
export const addMinistryToMembers = async (members, ministry) => {
  const name = String(ministry || '').trim()
  if (!name) return 0
  await assertKnownMinistry(name)

  const targets = (members || [])
    .filter((member) => member?.firestoreId || member?.id)
    .filter((member) => !(member.ministries || []).some((m) => same(m, name)))

  await inBatches(targets, (batch, member) =>
    batch.update(refFor(member), { ministries: arrayUnion(name) })
  )
  return targets.length
}

/**
 * Takes everyone in `members` out of `ministry`, which takes away whatever it
 * granted them. Every casing anyone is actually carrying goes, so a stray
 * "usher" cannot keep handing out what "Usher" was supposed to stop granting.
 *
 * @returns how many people were removed
 */
export const removeMinistryFromMembers = async (members, ministry) => {
  const name = String(ministry || '').trim()
  if (!name) return 0

  const targets = (members || [])
    .filter((member) => member?.firestoreId || member?.id)
    .filter((member) => (member.ministries || []).some((m) => same(m, name)))

  await inBatches(targets, (batch, member) => {
    const variants = [...new Set((member.ministries || []).filter((m) => same(m, name)))]
    batch.update(refFor(member), { ministries: arrayRemove(...variants) })
  })
  return targets.length
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
  // Rewritten per member rather than removed-and-added: Firestore allows only
  // one array transform per field per write.
  await inBatches(docs, (batch, d) => {
    const ministries = (d.data().ministries || []).map((m) => (m === oldName ? newName : m))
    batch.update(d.ref, { ministries })
  })

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
  await inBatches(docs, (batch, d) =>
    batch.update(d.ref, { ministries: arrayRemove(name) })
  )

  await deleteDoc(doc(db, ROLES_COLLECTION, name)).catch(() => {
    // No grants were ever configured for this ministry; nothing to remove.
  })

  if (ministryId) {
    await deleteDoc(doc(db, MINISTRIES_COLLECTION, ministryId))
  }

  return docs.length
}

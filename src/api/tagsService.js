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
  serverTimestamp
} from 'firebase/firestore'

import { DEFAULT_MINISTRY_TAGS } from '../utils/memberUtils'

const TAGS_COLLECTION = 'memberTags'
const MEMBERS_COLLECTION = 'members'
const ROLES_COLLECTION = 'rolePermissions'

/**
 * Subscribe to custom ministry tags created from Settings (not the preset
 * tags, which are hardcoded, and not tags that only exist because they were
 * typed onto a specific member).
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

/**
 * Writes the starter tags once, and only into a genuinely empty collection —
 * so a fresh church gets sensible options, but a church that has deliberately
 * deleted them never sees them come back.
 */
export const seedDefaultTagsIfEmpty = async () => {
  const snapshot = await getDocs(collection(db, TAGS_COLLECTION))
  if (!snapshot.empty) return 0
  await Promise.all(DEFAULT_MINISTRY_TAGS.map((name) => addCustomTag(name)))
  return DEFAULT_MINISTRY_TAGS.length
}

/**
 * Every member currently carrying a tag. Tags are a plain string array on the
 * member document, so this is an array-contains query.
 */
const membersWithTag = async (tag) => {
  const snapshot = await getDocs(
    query(collection(db, MEMBERS_COLLECTION), where('tags', 'array-contains', tag))
  )
  return snapshot.docs
}

/**
 * Renames a tag everywhere it is referenced: on every member holding it, on
 * its rolePermissions document (tags are the document id there, so the grant
 * has to be moved rather than edited), and on the custom-tag record itself.
 *
 * A tag is not just a label any more — it drives the permission system — so a
 * rename that missed any of the three would silently revoke someone's access.
 */
export const renameTag = async (oldName, newName, customTagId = null) => {
  const docs = await membersWithTag(oldName)
  await Promise.all(
    docs.map((d) => {
      const tags = (d.data().tags || []).map((t) => (t === oldName ? newName : t))
      return updateDoc(d.ref, { tags })
    })
  )

  const roleDoc = await getDoc(doc(db, ROLES_COLLECTION, oldName))
  if (roleDoc.exists()) {
    await setDoc(doc(db, ROLES_COLLECTION, newName), roleDoc.data())
    await deleteDoc(doc(db, ROLES_COLLECTION, oldName))
  }

  if (customTagId) {
    await updateDoc(doc(db, TAGS_COLLECTION, customTagId), { name: newName })
  }

  return docs.length
}

/**
 * Removes a tag from every member, drops the permissions it granted, and
 * deletes the custom-tag record. Anyone who held it loses whatever access it
 * carried, which is why the UI confirms with the affected member count first.
 */
export const deleteTag = async (name, customTagId = null) => {
  const docs = await membersWithTag(name)
  await Promise.all(
    docs.map((d) => {
      const tags = (d.data().tags || []).filter((t) => t !== name)
      return updateDoc(d.ref, { tags })
    })
  )

  await deleteDoc(doc(db, ROLES_COLLECTION, name)).catch(() => {
    // No grants were ever configured for this tag; nothing to remove.
  })

  if (customTagId) {
    await deleteDoc(doc(db, TAGS_COLLECTION, customTagId))
  }

  return docs.length
}

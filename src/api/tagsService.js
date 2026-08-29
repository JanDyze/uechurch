import { db } from './firebase'
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  onSnapshot,
  orderBy,
  serverTimestamp
} from 'firebase/firestore'

// Tags are free-text labels for describing and filtering members — "New
// Convert", "Needs Visit", "Choir 2024". They deliberately grant nothing.
//
// What someone *does* in the church, and what that lets them see, is a
// ministry (src/api/ministriesService.js). The two used to share this field,
// which meant typing a label that happened to match a role handed out that
// role's access. Nothing in this file may touch rolePermissions.

const TAGS_COLLECTION = 'memberTags'
const MEMBERS_COLLECTION = 'members'

/**
 * Subscribe to tags registered from Settings (not tags that only exist
 * because they were typed onto a specific member).
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
 * Renames a tag on every member holding it and on the tag record itself.
 * Nothing else references a tag, because a tag grants nothing.
 */
export const renameTag = async (oldName, newName, customTagId = null) => {
  const docs = await membersWithTag(oldName)
  await Promise.all(
    docs.map((d) => {
      const tags = (d.data().tags || []).map((t) => (t === oldName ? newName : t))
      return updateDoc(d.ref, { tags })
    })
  )

  if (customTagId) {
    await updateDoc(doc(db, TAGS_COLLECTION, customTagId), { name: newName })
  }

  return docs.length
}

/**
 * Removes a tag from every member and deletes the tag record. Nobody loses
 * access — a tag never granted any — but the UI still confirms with the
 * affected member count so a label is not wiped off 40 people by accident.
 */
export const deleteTag = async (name, customTagId = null) => {
  const docs = await membersWithTag(name)
  await Promise.all(
    docs.map((d) => {
      const tags = (d.data().tags || []).filter((t) => t !== name)
      return updateDoc(d.ref, { tags })
    })
  )

  if (customTagId) {
    await deleteDoc(doc(db, TAGS_COLLECTION, customTagId))
  }

  return docs.length
}

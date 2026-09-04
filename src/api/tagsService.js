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
  serverTimestamp,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore'
import { inBatches } from './batchWrite'

// Tags are free-text labels for describing and filtering members — "New
// Convert", "Needs Visit", "Choir 2024". They deliberately grant nothing.
//
// What someone *does* in the church, and what that lets them see, is a
// ministry (src/api/ministriesService.js). The two used to share this field,
// which meant typing a label that happened to match a role handed out that
// role's access. Nothing in this file may touch rolePermissions.

const TAGS_COLLECTION = 'memberTags'
const MEMBERS_COLLECTION = 'members'

// Tagging a group used to mean opening each person, ticking the tag and
// saving — one round trip each, and a hundred people is a hundred waits.
// Everything below commits in batches instead (see batchWrite.js).

// String() because a member document carries a numeric `id` of its own
// alongside the Firestore document id, and a path segment has to be a string.
const refFor = (member) => doc(db, MEMBERS_COLLECTION, String(member.firestoreId || member.id))

/** Anyone the app could not address — no document behind them — is left out. */
const addressable = (members) =>
  (members || []).filter((member) => member?.firestoreId || member?.id)

const same = (a, b) => String(a || '').toLowerCase() === String(b || '').toLowerCase()

/**
 * Adds `tag` to everyone in `members`, skipping whoever already carries it so
 * the count reported back is what actually changed.
 *
 * arrayUnion rather than a rewritten tags array: the array is written by the
 * member form too, and rewriting it wholesale here would throw away a tag
 * someone added on their own screen while this was running.
 *
 * @returns how many people the tag was added to
 */
export const addTagToMembers = async (members, tag) => {
  const name = String(tag || '').trim()
  if (!name) return 0

  const targets = addressable(members).filter(
    (member) => !(member.tags || []).some((t) => same(t, name))
  )
  await inBatches(targets, (batch, member) =>
    batch.update(refFor(member), { tags: arrayUnion(name) })
  )
  return targets.length
}

/**
 * Takes `tag` off everyone in `members`. arrayRemove matches exactly, so every
 * casing anyone is actually carrying is removed — "choir" typed onto one
 * member and "Choir" picked from the list are the same tag to everyone reading
 * the app, and leaving one behind would look like the removal half-failed.
 *
 * @returns how many people the tag was removed from
 */
export const removeTagFromMembers = async (members, tag) => {
  const name = String(tag || '').trim()
  if (!name) return 0

  const targets = addressable(members).filter((member) =>
    (member.tags || []).some((t) => same(t, name))
  )
  await inBatches(targets, (batch, member) => {
    const variants = [...new Set((member.tags || []).filter((t) => same(t, name)))]
    batch.update(refFor(member), { tags: arrayRemove(...variants) })
  })
  return targets.length
}

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
  // Rewritten per member rather than removed-and-added, because Firestore
  // allows only one array transform per field per write.
  await inBatches(docs, (batch, d) => {
    const tags = (d.data().tags || []).map((t) => (t === oldName ? newName : t))
    batch.update(d.ref, { tags })
  })

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
  await inBatches(docs, (batch, d) =>
    batch.update(d.ref, { tags: arrayRemove(name) })
  )

  if (customTagId) {
    await deleteDoc(doc(db, TAGS_COLLECTION, customTagId))
  }

  return docs.length
}

import { db } from './firebase'
import { collection, doc, setDoc, deleteDoc, onSnapshot, Timestamp } from 'firebase/firestore'

// One document per month, keyed by 'YYYY-MM' so a month can never be planned
// twice. A month holds a handful of Sundays and a handful of songs each, well
// inside Firestore's per-document limit, so the whole plan lives on one
// document: reordering songs or reassigning a leader is a single write, and
// the month page renders from a single listener.
const LINEUPS_COLLECTION = 'worshipLineups'

/** A song as it sits in a service order — the title is denormalised so an old
 *  lineup still reads correctly after a song is renamed or removed. */
const normalizeSong = (data = {}) => ({
  songId: data.songId || '',
  title: data.title || '',
  category: data.category || '',
  // The key this service is actually sung in. Seeded from the leader's key on
  // the song list, but kept here because a leader may transpose for one Sunday.
  key: data.key || '',
  note: data.note || '',
})

const normalizeSunday = (data = {}) => ({
  date: data.date || '',
  leaderId: data.leaderId ?? null,
  // Musicians, backup singers, anyone else rostered for the service.
  teamIds: Array.isArray(data.teamIds) ? data.teamIds.map(String) : [],
  theme: data.theme || '',
  notes: data.notes || '',
  songs: Array.isArray(data.songs) ? data.songs.map(normalizeSong) : [],
})

const normalizeLineup = (data, docId) => ({
  id: docId,
  month: data.month || docId,
  // Drafts are visible only to whoever can manage lineups, so a half-built
  // month never reaches the team before it is settled.
  status: data.status === 'published' ? 'published' : 'draft',
  notes: data.notes || '',
  sundays: (Array.isArray(data.sundays) ? data.sundays : [])
    .map(normalizeSunday)
    .sort((a, b) => a.date.localeCompare(b.date)),
  updatedBy: data.updatedBy || '',
  updatedAt: data.updatedAt?.toDate?.() || null,
})

/** One month. `callback(null)` when nothing has been planned for it yet. */
export const subscribeToLineup = (monthKey, callback) => {
  return onSnapshot(
    doc(db, LINEUPS_COLLECTION, monthKey),
    (snapshot) => {
      callback(snapshot.exists() ? normalizeLineup(snapshot.data(), snapshot.id) : null)
    },
    (error) => {
      console.error('Error subscribing to lineup:', error)
      callback(null)
    }
  )
}

/** Every planned month — one document per month, so this stays a short list. */
export const subscribeToLineups = (callback) => {
  return onSnapshot(
    collection(db, LINEUPS_COLLECTION),
    (snapshot) => {
      const lineups = snapshot.docs.map((d) => normalizeLineup(d.data(), d.id))
      lineups.sort((a, b) => b.month.localeCompare(a.month))
      callback(lineups)
    },
    (error) => {
      console.error('Error subscribing to lineups:', error)
      callback([])
    }
  )
}

/**
 * Creates the month on first write and patches it after that, so a view never
 * has to know whether the month exists yet.
 */
export const saveLineup = async (monthKey, updates, updatedBy) => {
  await setDoc(
    doc(db, LINEUPS_COLLECTION, monthKey),
    {
      month: monthKey,
      ...updates,
      updatedBy: updatedBy?.email || updatedBy?.uid || '',
      updatedAt: Timestamp.now(),
    },
    // Creates the document when it is missing and patches it when it is not,
    // so callers never branch on whether the month has been planned before.
    { merge: true }
  )
}

export const deleteLineup = async (monthKey) => {
  await deleteDoc(doc(db, LINEUPS_COLLECTION, monthKey))
}

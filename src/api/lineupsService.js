import { db } from './firebase'
import { collection, doc, setDoc, deleteDoc, onSnapshot, Timestamp } from './firestore'
import { notify } from './notifyService'
import { formatMonthLabel } from '../utils/lineupUtils'
import {
  BAND_ROLE,
  SONG_LEADER_ROLE,
  assignmentsOf,
  isWorshipRole,
} from '../data/scheduleRoles'

// One document per month, keyed by 'YYYY-MM' so a month can never be planned
// twice. A month holds a handful of Sundays and a handful of songs each, well
// inside Firestore's per-document limit, so the whole plan lives on one
// document: reordering songs or reassigning a leader is a single write, and
// the month page renders from a single listener.
//
// The page is called Schedules now, and a service carries ushers and preachers
// as well as the band, but the collection keeps its old name. Renaming it would
// mean copying every month ever planned, and the Present page, the digest
// email and the MCP connector all read it by this name — the word on screen
// changed, the data did not have to.
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
  songs: Array.isArray(data.songs) ? data.songs.map(normalizeSong) : [],
  // Everyone on the service keyed by role, the worship roles included — read
  // off leaderId and teamIds, so a lineup saved before roles existed arrives
  // here already looking like a schedule.
  assignments: assignmentsOf(data),
})

/**
 * The shape a service is written back in.
 *
 * The song leader and the band go back into leaderId and teamIds and are left
 * out of `assignments`, so each person is stored in exactly one place and the
 * two can never disagree. That also keeps every reader that predates schedules
 * — Home, Present, an older deploy of the connector — seeing the worship team
 * exactly as before.
 *
 * A role removed in Settings is not a reason to drop the people once on it:
 * any role id the editor did not recognise is written back untouched.
 */
export const toStoredSunday = (sunday = {}) => {
  const all = sunday.assignments ? { ...sunday.assignments } : assignmentsOf(sunday)
  const rest = {}
  Object.entries(all).forEach(([roleId, ids]) => {
    if (isWorshipRole(roleId)) return
    const clean = [...new Set((ids || []).map(String).filter(Boolean))]
    if (clean.length) rest[roleId] = clean
  })
  return {
    date: sunday.date || '',
    leaderId: all[SONG_LEADER_ROLE]?.[0] ?? null,
    teamIds: [...new Set((all[BAND_ROLE] || []).map(String).filter(Boolean))],
    theme: sunday.theme || '',
    songs: (sunday.songs || []).map(normalizeSong),
    assignments: rest,
  }
}

const normalizeLineup = (data, docId) => ({
  id: docId,
  month: data.month || docId,
  // Drafts are visible only to whoever can manage lineups, so a half-built
  // month never reaches the team before it is settled.
  status: data.status === 'published' ? 'published' : 'draft',
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
      // Serialised here rather than by each caller, so no screen can write a
      // service with its worship team in the wrong field.
      ...(Array.isArray(updates?.sundays) ? { sundays: updates.sundays.map(toStoredSunday) } : {}),
      updatedBy: updatedBy?.email || updatedBy?.uid || '',
      updatedAt: Timestamp.now(),
    },
    // Creates the document when it is missing and patches it when it is not,
    // so callers never branch on whether the month has been planned before.
    { merge: true }
  )

  // Publishing is the moment the month stops being a draft and becomes what
  // the team is expected to rehearse — the one write here anybody is waiting
  // on. Reordering songs inside an already-published month is not announced;
  // it would fire on every keystroke's worth of planning.
  if (updates?.status === 'published') {
    // The kind keeps its old key: notification preferences and the history
    // already on file are filed under it.
    notify('lineup.published', {
      title: `Schedule: ${formatMonthLabel(monthKey)}`,
      body: 'The month is published — check which Sundays you are on.',
      url: `/schedules/${monthKey}`,
    })
  }
}

export const deleteLineup = async (monthKey) => {
  await deleteDoc(doc(db, LINEUPS_COLLECTION, monthKey))
}

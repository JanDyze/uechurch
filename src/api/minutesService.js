import { db } from './firebase'
import { collection, addDoc, setDoc, getDoc, updateDoc, deleteDoc, doc, query, orderBy, onSnapshot, Timestamp } from 'firebase/firestore'
import { occasionsOn, occurrenceTitle, parseDateString } from '../../lib/occurrences'
import { notify } from './notifyService'

const MINUTES_COLLECTION = 'minutes'

// Normalize minute data from Firestore
const normalizeMinute = (doc) => {
  const data = doc.data()
  return {
    id: doc.id,
    firestoreId: doc.id,
    title: data.title || '',
    date: data.date || '',
    startTime: data.startTime || '',
    endTime: data.endTime || '',
    location: data.location || '',
    attendees: data.attendees || [],
    // The tag whose members this meeting is for, so the attendance list is the
    // council rather than the whole church. `null` means nobody has chosen —
    // which is not the same as choosing "Everyone", and the page guesses from
    // the title only in the first case.
    attendanceTag: data.attendanceTag ?? null,
    // Which standing gathering this minute belongs to, and which of its
    // occurrences. Together they are what tells the Minutes list that the
    // occurrence has been started, so it stops offering it. Null on a minute
    // somebody created by hand, which belongs to no schedule.
    scheduleId: data.scheduleId || null,
    occurrenceDate: data.occurrenceDate || '',
    content: data.content || '',
    structure: data.structure || {
      agenda: [],
      discussions: {},
      decisions: {},
      actionItems: [],
      overallSummary: '',
      rawDiscussions: {}
    },
    agenda: data.agenda || [],
    discussions: data.discussions || {},
    decisions: data.decisions || {},
    actionItems: data.actionItems || [],
    createdBy: data.createdBy || '',
    createdAt: data.createdAt?.toDate?.() || new Date(),
    updatedAt: data.updatedAt?.toDate?.() || new Date()
  }
}

// Subscribe to minutes with real-time updates
export const subscribeToMinutes = (callback) => {
  const q = query(collection(db, MINUTES_COLLECTION), orderBy('date', 'desc'))
  
  return onSnapshot(q, (snapshot) => {
    const minutes = snapshot.docs.map(normalizeMinute)
    callback(minutes)
  }, (error) => {
    console.error('Error subscribing to minutes:', error)
    callback([])
  })
}

// Add a new minute
/**
 * @param {object} minuteData
 * @param {{ announce?: boolean }} [options]
 *   `announce` is false when the record is being started from a scheduled
 *   occurrence rather than by somebody deciding to write minutes — see
 *   startMinuteForOccurrence.
 */
export const addMinute = async (minuteData, { announce = true } = {}) => {
  try {
    const docRef = await addDoc(collection(db, MINUTES_COLLECTION), {
      ...minuteData,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    })

    // Minutes record what was decided, and the decisions are what people are
    // waiting on. Only the council can see them, and minutes.view says who
    // that is. Later edits stay quiet — the document is written over days.
    if (announce) {
      notify('minutes.published', {
        title: 'Minutes posted',
        body: [minuteData.title, minuteData.date].filter(Boolean).join(' — '),
        url: `/minutes/${docRef.id}`,
      })
    }

    return docRef.id
  } catch (error) {
    console.error('Error adding minute:', error)
    throw error
  }
}

/* ------------------------------------------------- minutes from a schedule */

/**
 * The id of the minute belonging to one occurrence of a standing gathering.
 *
 * Deterministic on purpose: two officers opening the same meeting at the same
 * moment must land on one document, and a doc id is the only place that can be
 * guaranteed. It is the same reasoning as a service plan keyed by its Sunday
 * and a lineup keyed by its month.
 *
 * "mtg-" rather than the "recurring-" prefix the calendar uses for the same
 * occurrence: attendance stores a minute's id as its sourceId, and parses
 * `recurring-<scheduleId>-<date>` back apart elsewhere. A minute id shaped like
 * an occurrence key would be ambiguous to that parser.
 */
export const occurrenceMinuteId = (scheduleId, dateString) =>
  `mtg-${scheduleId}-${dateString}`

/**
 * Starts the minute for one occurrence of a standing gathering, filling in
 * what the schedule already knows so nobody retypes it.
 *
 * Only the meeting's details — no agenda. What a meeting is going to be about
 * is the one thing a schedule cannot know, and an agenda copied from a
 * template would have to be cleared more often than kept.
 *
 * `setDoc` with merge, so calling it twice is calling it once: the second
 * writer patches the same document instead of creating a rival. The existing
 * record is left alone if it is already there — this never overwrites a
 * meeting somebody has started writing.
 *
 * Silent. A push saying "Minutes posted" is right when somebody has written
 * minutes, and wrong when they have merely opened the meeting.
 *
 * @returns {Promise<string>} the minute's id, existing or new
 */
export const startMinuteForOccurrence = async (schedule, dateString, { createdBy = '' } = {}) => {
  const scheduleId = schedule?.id || schedule?.firestoreId
  if (!scheduleId || !dateString) throw new Error('A schedule and a date are required')

  const id = occurrenceMinuteId(scheduleId, dateString)
  const ref = doc(db, MINUTES_COLLECTION, id)

  const existing = await getDoc(ref)
  if (existing.exists()) return id

  // The occasion that week is part of what the meeting was — "Church Council ·
  // Anniversary planning" is the title people will look for later.
  const date = parseDateString(dateString)
  const title = occurrenceTitle(schedule.title || 'Meeting', date ? occasionsOn(schedule, date) : [])

  // One audience tag is an answer; several is a question the attendance drawer
  // asks better than a guess here would.
  const tags = Array.isArray(schedule.audienceTags) ? schedule.audienceTags : []
  const attendanceTag = tags.length === 1 ? tags[0] : null

  await setDoc(
    ref,
    {
      title,
      date: dateString,
      startTime: schedule.time || '',
      endTime: '',
      location: schedule.location || '',
      attendees: [],
      attendanceTag,
      scheduleId,
      occurrenceDate: dateString,
      structure: { agenda: [], discussions: {}, decisions: {}, actionItems: [] },
      createdBy,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    },
    { merge: true }
  )

  return id
}

// Update a minute
export const updateMinute = async (minute, updatedData) => {
  try {
    const docRef = doc(db, MINUTES_COLLECTION, minute.firestoreId || minute.id)
    await updateDoc(docRef, {
      ...updatedData,
      updatedAt: Timestamp.now()
    })
  } catch (error) {
    console.error('Error updating minute:', error)
    throw error
  }
}

// Delete a minute
export const deleteMinute = async (minute) => {
  try {
    const docRef = doc(db, MINUTES_COLLECTION, minute.firestoreId || minute.id)
    await deleteDoc(docRef)
  } catch (error) {
    console.error('Error deleting minute:', error)
    throw error
  }
}


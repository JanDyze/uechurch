import { db } from './firebase'
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore'

const GROUPS_COLLECTION = 'smallGroups'
const SESSIONS_COLLECTION = 'sgSessions'
const PHOTOS_COLLECTION = 'sgSessionPhotos'

/* ------------------------------------------------------------------ groups */

const normalizeGroup = (docSnap) => {
  const data = docSnap.data()
  return {
    id: docSnap.id,
    firestoreId: docSnap.id,
    name: data.name || '',
    description: data.description || '',
    // Base64 data URL kept on the group doc itself; see COVER_PHOTO_OPTIONS for
    // the size budget that keeps the list subscription cheap.
    coverPhoto: data.coverPhoto || '',
    leaderId: data.leaderId ?? null,
    coLeaderIds: Array.isArray(data.coLeaderIds) ? data.coLeaderIds : [],
    memberIds: Array.isArray(data.memberIds) ? data.memberIds : [],
    meetingDay: typeof data.meetingDay === 'number' ? data.meetingDay : null,
    meetingTime: data.meetingTime || '',
    location: data.location || '',
    defaultLanguage: data.defaultLanguage === 'tl' ? 'tl' : 'en',
    active: data.active !== false,
    createdAt: data.createdAt?.toDate?.() || new Date(),
    updatedAt: data.updatedAt?.toDate?.() || new Date(),
  }
}

export const subscribeToSmallGroups = (callback) => {
  const ref = collection(db, GROUPS_COLLECTION)
  return onSnapshot(
    ref,
    (snapshot) => {
      const groups = snapshot.docs.map(normalizeGroup)
      // Sorted client-side so no composite index is needed.
      groups.sort((a, b) => a.name.localeCompare(b.name))
      callback(groups)
    },
    (error) => {
      console.error('Error subscribing to small groups:', error)
      callback([])
    }
  )
}

export const addSmallGroup = async (groupData) => {
  const docRef = await addDoc(collection(db, GROUPS_COLLECTION), {
    ...groupData,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  })
  return docRef.id
}

export const updateSmallGroup = async (groupId, updatedData) => {
  await updateDoc(doc(db, GROUPS_COLLECTION, groupId), {
    ...updatedData,
    updatedAt: Timestamp.now(),
  })
}

/**
 * Deletes a group along with every session and photo underneath it, so no
 * orphan session rows are left pointing at a group that no longer exists.
 */
export const deleteSmallGroup = async (groupId) => {
  const sessionsSnap = await getDocs(
    query(collection(db, SESSIONS_COLLECTION), where('groupId', '==', groupId))
  )
  await Promise.all(sessionsSnap.docs.map((d) => deleteSgSession(d.id)))
  await deleteDoc(doc(db, GROUPS_COLLECTION, groupId))
}

/* ---------------------------------------------------------------- sessions */

const normalizeSession = (docSnap) => {
  const data = docSnap.data()
  const attendance = data.attendance || {}
  const lesson = data.lesson || {}
  return {
    id: docSnap.id,
    firestoreId: docSnap.id,
    groupId: data.groupId || '',
    date: data.date || '',
    startTime: data.startTime || '',
    endTime: data.endTime || '',
    venue: data.venue || '',
    leaderId: data.leaderId ?? null,
    // The linked member of whoever first saved the form, for the "Recorded by"
    // line on the printed report.
    recordedById: data.recordedById ?? null,
    language: data.language === 'tl' ? 'tl' : 'en',
    lesson: {
      title: lesson.title || '',
      scripture: lesson.scripture || '',
      notes: lesson.notes || '',
      takeaways: lesson.takeaways || '',
    },
    attendance: {
      presentIds: Array.isArray(attendance.presentIds) ? attendance.presentIds : [],
      absentIds: Array.isArray(attendance.absentIds) ? attendance.absentIds : [],
      guests: Array.isArray(attendance.guests) ? attendance.guests : [],
    },
    prayerRequests: Array.isArray(data.prayerRequests) ? data.prayerRequests : [],
    notes: data.notes || '',
    createdBy: data.createdBy || '',
    createdAt: data.createdAt?.toDate?.() || new Date(),
    updatedAt: data.updatedAt?.toDate?.() || new Date(),
  }
}

/** Sessions for one group, newest first. */
export const subscribeToGroupSessions = (groupId, callback) => {
  const q = query(collection(db, SESSIONS_COLLECTION), where('groupId', '==', groupId))
  return onSnapshot(
    q,
    (snapshot) => {
      const sessions = snapshot.docs.map(normalizeSession)
      // Client-side sort avoids the composite index a where + orderBy needs.
      sessions.sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      callback(sessions)
    },
    (error) => {
      console.error('Error subscribing to SG sessions:', error)
      callback([])
    }
  )
}

/** Every session across all groups — used for dashboards and bulk export. */
export const subscribeToAllSgSessions = (callback) => {
  const q = query(collection(db, SESSIONS_COLLECTION), orderBy('date', 'desc'))
  return onSnapshot(
    q,
    (snapshot) => callback(snapshot.docs.map(normalizeSession)),
    (error) => {
      console.error('Error subscribing to all SG sessions:', error)
      callback([])
    }
  )
}

export const addSgSession = async (sessionData) => {
  const docRef = await addDoc(collection(db, SESSIONS_COLLECTION), {
    ...sessionData,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  })
  return docRef.id
}

export const updateSgSession = async (sessionId, updatedData) => {
  await updateDoc(doc(db, SESSIONS_COLLECTION, sessionId), {
    ...updatedData,
    updatedAt: Timestamp.now(),
  })
}

export const deleteSgSession = async (sessionId) => {
  const photosSnap = await getDocs(
    query(collection(db, PHOTOS_COLLECTION), where('sessionId', '==', sessionId))
  )
  await Promise.all(photosSnap.docs.map((d) => deleteDoc(d.ref)))
  await deleteDoc(doc(db, SESSIONS_COLLECTION, sessionId))
}

/* ------------------------------------------------------------------ photos */

// Photos live in their own collection rather than on the session document:
// they are stored as base64, and a handful of them would blow past Firestore's
// 1 MiB per-document limit.
export const subscribeToSessionPhotos = (sessionId, callback) => {
  const q = query(collection(db, PHOTOS_COLLECTION), where('sessionId', '==', sessionId))
  return onSnapshot(
    q,
    (snapshot) => {
      const photos = snapshot.docs.map((d) => {
        const data = d.data()
        return {
          id: d.id,
          sessionId: data.sessionId,
          url: data.url,
          caption: data.caption || '',
          uploadedAt: data.uploadedAt?.toDate?.() || new Date(),
        }
      })
      photos.sort((a, b) => a.uploadedAt - b.uploadedAt)
      callback(photos)
    },
    (error) => {
      console.error('Error subscribing to session photos:', error)
      callback([])
    }
  )
}

export const uploadSessionPhoto = async (sessionId, base64Data, caption = '') => {
  const photoRef = await addDoc(collection(db, PHOTOS_COLLECTION), {
    sessionId,
    url: base64Data,
    caption,
    uploadedAt: Timestamp.now(),
  })
  return { id: photoRef.id, url: base64Data, caption }
}

export const deleteSessionPhoto = async (photoId) => {
  await deleteDoc(doc(db, PHOTOS_COLLECTION, photoId))
}

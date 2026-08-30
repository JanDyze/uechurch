import { db } from './firebase'
import { collection, addDoc, updateDoc, deleteDoc, doc, query, orderBy, onSnapshot, Timestamp, where } from 'firebase/firestore'
import { readProvenance } from '../../lib/attendance'

const ATTENDANCE_COLLECTION = 'attendance'

// Normalize attendance data from Firestore
const normalizeAttendance = (doc) => {
  const data = doc.data()
  // source/sourceId/occurrenceKey replace the old single `eventId`, which meant
  // four different things. readProvenance derives them from a legacy record
  // when they are missing, so documents written before this change keep
  // working and a backfill is optional rather than a prerequisite.
  const provenance = readProvenance(data)
  return {
    id: doc.id,
    firestoreId: doc.id,
    ...provenance,
    // Kept for now so nothing that still reads it breaks; new writes set the
    // three fields above and leave this as the event id only when there is one.
    eventId: data.eventId || '',
    eventType: data.eventType || '',
    eventTitle: data.eventTitle || '',
    date: data.date || '',
    time: data.time || '',
    location: data.location || '',
    attendees: data.attendees || [],
    totalAttendees: data.totalAttendees || 0,
    expectedAttendees: data.expectedAttendees || 0,
    notes: data.notes || '',
    createdBy: data.createdBy || '',
    createdAt: data.createdAt?.toDate?.() || new Date(),
    updatedAt: data.updatedAt?.toDate?.() || new Date()
  }
}

// Subscribe to attendance records with real-time updates
export const subscribeToAttendance = (callback) => {
  const q = query(collection(db, ATTENDANCE_COLLECTION), orderBy('date', 'desc'))
  
  return onSnapshot(q, (snapshot) => {
    const attendance = snapshot.docs.map(normalizeAttendance)
    callback(attendance)
  }, (error) => {
    console.error('Error subscribing to attendance:', error)
    callback([])
  })
}

// Add a new attendance record
export const addAttendance = async (attendanceData) => {
  try {
    const docRef = await addDoc(collection(db, ATTENDANCE_COLLECTION), {
      ...attendanceData,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    })
    return docRef.id
  } catch (error) {
    console.error('Error adding attendance:', error)
    throw error
  }
}

// Update an attendance record
export const updateAttendance = async (attendance, updatedData) => {
  try {
    const docRef = doc(db, ATTENDANCE_COLLECTION, attendance.firestoreId || attendance.id)
    await updateDoc(docRef, {
      ...updatedData,
      updatedAt: Timestamp.now()
    })
  } catch (error) {
    console.error('Error updating attendance:', error)
    throw error
  }
}

// Delete an attendance record
export const deleteAttendance = async (attendance) => {
  try {
    const docRef = doc(db, ATTENDANCE_COLLECTION, attendance.firestoreId || attendance.id)
    await deleteDoc(docRef)
  } catch (error) {
    console.error('Error deleting attendance:', error)
    throw error
  }
}


import { db } from './firebase'
import { collection, addDoc, updateDoc, deleteDoc, doc, query, orderBy, onSnapshot, Timestamp } from 'firebase/firestore'

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
export const addMinute = async (minuteData) => {
  try {
    const docRef = await addDoc(collection(db, MINUTES_COLLECTION), {
      ...minuteData,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    })
    return docRef.id
  } catch (error) {
    console.error('Error adding minute:', error)
    throw error
  }
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


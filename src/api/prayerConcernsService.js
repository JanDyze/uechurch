import { db } from './firebase'
import { collection, addDoc, updateDoc, deleteDoc, doc, query, orderBy, onSnapshot, Timestamp } from 'firebase/firestore'

const PRAYER_CONCERNS_COLLECTION = 'prayerConcerns'

// Normalize prayer concern data from Firestore
const normalizePrayerConcern = (doc) => {
  const data = doc.data()
  return {
    id: doc.id,
    firestoreId: doc.id,
    title: data.title || '',
    memberId: data.memberId || '',
    memberName: data.memberName || '',
    description: data.description || '',
    status: data.status || 'active', // active, answered, ongoing
    priority: data.priority || 'normal', // low, normal, high, urgent
    date: data.date || '',
    notes: data.notes || '',
    createdBy: data.createdBy || '',
    createdAt: data.createdAt?.toDate?.() || new Date(),
    updatedAt: data.updatedAt?.toDate?.() || new Date()
  }
}

// Subscribe to prayer concerns with real-time updates
export const subscribeToPrayerConcerns = (callback) => {
  const q = query(collection(db, PRAYER_CONCERNS_COLLECTION), orderBy('createdAt', 'desc'))
  
  return onSnapshot(q, (snapshot) => {
    const concerns = snapshot.docs.map(normalizePrayerConcern)
    callback(concerns)
  }, (error) => {
    console.error('Error subscribing to prayer concerns:', error)
    callback([])
  })
}

// Add a new prayer concern
export const addPrayerConcern = async (concernData) => {
  try {
    const docRef = await addDoc(collection(db, PRAYER_CONCERNS_COLLECTION), {
      ...concernData,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    })
    return docRef.id
  } catch (error) {
    console.error('Error adding prayer concern:', error)
    throw error
  }
}

// Update a prayer concern
export const updatePrayerConcern = async (concern, updatedData) => {
  try {
    const docRef = doc(db, PRAYER_CONCERNS_COLLECTION, concern.firestoreId || concern.id)
    await updateDoc(docRef, {
      ...updatedData,
      updatedAt: Timestamp.now()
    })
  } catch (error) {
    console.error('Error updating prayer concern:', error)
    throw error
  }
}

// Delete a prayer concern
export const deletePrayerConcern = async (concern) => {
  try {
    const docRef = doc(db, PRAYER_CONCERNS_COLLECTION, concern.firestoreId || concern.id)
    await deleteDoc(docRef)
  } catch (error) {
    console.error('Error deleting prayer concern:', error)
    throw error
  }
}


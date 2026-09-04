import { db } from './firebase'
import { collection, addDoc, updateDoc, deleteDoc, doc, query, orderBy, onSnapshot, Timestamp } from 'firebase/firestore'
import { notify } from './notifyService'

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

    // Urgent gets its own kind rather than a louder subject line: it vibrates
    // differently and reads as an alert in the panel, which is the whole
    // reason someone marked it urgent.
    const urgent = concernData.priority === 'urgent'
    notify(urgent ? 'prayer.urgent' : 'prayer.new', {
      title: urgent ? 'Urgent prayer request' : 'New prayer concern',
      body: describe(concernData),
    })

    return docRef.id
  } catch (error) {
    console.error('Error adding prayer concern:', error)
    throw error
  }
}

/** "Title — Whose it is", the two things worth reading on a lock screen. */
const describe = (concern) =>
  [concern?.title, concern?.memberName].filter(Boolean).join(' — ')

// Update a prayer concern
export const updatePrayerConcern = async (concern, updatedData) => {
  try {
    const docRef = doc(db, PRAYER_CONCERNS_COLLECTION, concern.firestoreId || concern.id)
    await updateDoc(docRef, {
      ...updatedData,
      updatedAt: Timestamp.now()
    })

    // An answered prayer is the one update here worth carrying: it is the
    // point of having asked, and the people who prayed are the people who
    // already hold prayer.view.
    const after = { ...concern, ...updatedData }
    if (updatedData.status === 'answered' && concern.status !== 'answered') {
      notify('prayer.answered', {
        title: 'Answered prayer',
        body: describe(after),
      })
    }
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


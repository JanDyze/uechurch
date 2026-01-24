import { db } from "./firebase";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
} from "firebase/firestore";

const EVENTS_COLLECTION = "events";

// Helper to normalize event data from Firestore
const normalizeEvent = (data, docId) => {
  return {
    id: data.id || docId,
    firestoreId: docId,
    title: data.title || '',
    type: data.type || 'worship',
    date: data.date || '',
    time: data.time || '09:00',
    location: data.location || '',
    description: data.description || '',
    attendees: data.attendees || 0,
    icon: data.icon || 'Calendar',
    // Override-related fields
    overrideOf: data.overrideOf || null,
    isOverride: data.isOverride || false,
    isCancelled: data.isCancelled || false,
    memberId: data.memberId || null,
  };
};

// Subscribe to events changes (real-time)
export const subscribeToEvents = (callback) => {
  const eventsRef = collection(db, EVENTS_COLLECTION);
  
  return onSnapshot(
    eventsRef,
    (snapshot) => {
      const events = snapshot.docs.map((doc) => {
        const data = doc.data();
        return normalizeEvent(data, doc.id);
      });
      // Sort by date
      events.sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return dateA - dateB;
      });
      callback(events);
    },
    (error) => {
      console.error("Error subscribing to events:", error);
      callback([]);
    }
  );
};

// Add a new event
export const addEvent = async (eventData) => {
  try {
    const eventsRef = collection(db, EVENTS_COLLECTION);
    const docRef = await addDoc(eventsRef, eventData);
    return docRef.id;
  } catch (error) {
    console.error("Error adding event:", error);
    throw error;
  }
};

// Update an event (uses Firestore document ID)
export const updateEvent = async (firestoreId, eventData) => {
  try {
    const eventRef = doc(db, EVENTS_COLLECTION, firestoreId);
    const { firestoreId: _, ...dataToUpdate } = eventData;
    await updateDoc(eventRef, dataToUpdate);
  } catch (error) {
    console.error("Error updating event:", error);
    throw error;
  }
};

// Delete an event (uses Firestore document ID)
export const deleteEvent = async (firestoreId) => {
  try {
    const eventRef = doc(db, EVENTS_COLLECTION, firestoreId);
    await deleteDoc(eventRef);
  } catch (error) {
    console.error("Error deleting event:", error);
    throw error;
  }
};

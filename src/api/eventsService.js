import { db } from "./firebase";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
} from "firebase/firestore";

const EVENTS_COLLECTION = "events";
const EVENT_PRESETS_COLLECTION = "eventPresets";

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
  };
};

// Helper to normalize preset data from Firestore
const normalizePreset = (data, docId) => {
  return {
    id: data.id || docId,
    firestoreId: docId,
    title: data.title || '',
    type: data.type || 'worship',
    time: data.time || '09:00',
    location: data.location || '',
    description: data.description || '',
    attendees: data.attendees || 0,
    icon: data.icon || 'Calendar',
  };
};

// ========== EVENTS ==========

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

// ========== EVENT PRESETS ==========

// Subscribe to event presets changes (real-time)
export const subscribeToEventPresets = (callback) => {
  const presetsRef = collection(db, EVENT_PRESETS_COLLECTION);
  
  return onSnapshot(
    presetsRef,
    (snapshot) => {
      const presets = snapshot.docs.map((doc) => {
        const data = doc.data();
        return normalizePreset(data, doc.id);
      });
      callback(presets);
    },
    (error) => {
      console.error("Error subscribing to event presets:", error);
      callback([]);
    }
  );
};

// Add a new event preset
export const addEventPreset = async (presetData) => {
  try {
    const presetsRef = collection(db, EVENT_PRESETS_COLLECTION);
    const docRef = await addDoc(presetsRef, presetData);
    return docRef.id;
  } catch (error) {
    console.error("Error adding event preset:", error);
    throw error;
  }
};

// Update an event preset (uses Firestore document ID)
export const updateEventPreset = async (firestoreId, presetData) => {
  try {
    const presetRef = doc(db, EVENT_PRESETS_COLLECTION, firestoreId);
    const { firestoreId: _, ...dataToUpdate } = presetData;
    await updateDoc(presetRef, dataToUpdate);
  } catch (error) {
    console.error("Error updating event preset:", error);
    throw error;
  }
};

// Delete an event preset (uses Firestore document ID)
export const deleteEventPreset = async (firestoreId) => {
  try {
    const presetRef = doc(db, EVENT_PRESETS_COLLECTION, firestoreId);
    await deleteDoc(presetRef);
  } catch (error) {
    console.error("Error deleting event preset:", error);
    throw error;
  }
};



import { db } from "./firebase";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  Timestamp,
} from "firebase/firestore";

const SCHEDULES_COLLECTION = "recurringSchedules";

// A schedule is a rule the Events page expands into calendar entries.
// `weekday` is 0-6 (Sun-Sat). `occurrences` limits which weeks of the month it
// falls on (e.g. [2,3,4,5] for "every Wednesday except the first"); an empty
// array means every occurrence.
const normalizeSchedule = (data, docId) => ({
  id: docId,
  firestoreId: docId,
  title: data.title || "",
  type: data.type || "worship",
  weekday: typeof data.weekday === "number" ? data.weekday : 0,
  occurrences: Array.isArray(data.occurrences) ? data.occurrences : [],
  time: data.time || "09:00",
  location: data.location || "",
  description: data.description || "",
  icon: data.icon || "Calendar",
  enabled: data.enabled !== false,
});

export const subscribeToRecurringSchedules = (callback) => {
  const ref = collection(db, SCHEDULES_COLLECTION);

  return onSnapshot(
    ref,
    (snapshot) => {
      const schedules = snapshot.docs.map((d) => normalizeSchedule(d.data(), d.id));
      schedules.sort((a, b) => a.weekday - b.weekday || a.time.localeCompare(b.time));
      callback(schedules);
    },
    (error) => {
      console.error("Error subscribing to recurring schedules:", error);
      callback([]);
    }
  );
};

export const addRecurringSchedule = async (schedule) => {
  try {
    const docRef = await addDoc(collection(db, SCHEDULES_COLLECTION), {
      ...schedule,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    return docRef.id;
  } catch (error) {
    console.error("Error adding recurring schedule:", error);
    throw error;
  }
};

export const updateRecurringSchedule = async (schedule, updatedData) => {
  try {
    const docRef = doc(db, SCHEDULES_COLLECTION, schedule.firestoreId || schedule.id);
    await updateDoc(docRef, { ...updatedData, updatedAt: Timestamp.now() });
  } catch (error) {
    console.error("Error updating recurring schedule:", error);
    throw error;
  }
};

export const deleteRecurringSchedule = async (schedule) => {
  try {
    const docRef = doc(db, SCHEDULES_COLLECTION, schedule.firestoreId || schedule.id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Error deleting recurring schedule:", error);
    throw error;
  }
};

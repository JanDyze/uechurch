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

// How early an occurrence becomes available to record attendance against,
// relative to its start time. Volunteers arrive before the service starts, so
// waiting until 9:00 to surface the 9:00 service means whoever opens the app at
// 8:30 sees nothing and records a one-off event instead. `sameDay` (from
// midnight) is the default and matches what the app did before this was
// configurable.
export const SAME_DAY = "sameDay";

export const SHOW_BEFORE_OPTIONS = [
  { value: 0, label: "At start time" },
  { value: 30, label: "30 minutes before" },
  { value: 60, label: "1 hour before" },
  { value: 120, label: "2 hours before" },
  { value: 180, label: "3 hours before" },
  { value: 360, label: "6 hours before" },
  { value: SAME_DAY, label: "All day (from midnight)" },
  { value: 1440, label: "1 day before" },
  { value: 4320, label: "3 days before" },
  { value: 10080, label: "1 week before" },
];

export const DEFAULT_SHOW_BEFORE = SAME_DAY;

// Anything unrecognised - including the schedules saved before this field
// existed - falls back to the default rather than hiding the occurrence.
export const normalizeShowBefore = (value) => {
  if (value === SAME_DAY) return SAME_DAY;
  const minutes = Number(value);
  return Number.isFinite(minutes) && minutes >= 0 ? minutes : DEFAULT_SHOW_BEFORE;
};

export const showBeforeLabel = (value) =>
  SHOW_BEFORE_OPTIONS.find((o) => o.value === normalizeShowBefore(value))?.label || "";

// The moment an occurrence on `dateString` starts being shown. Built from local
// date parts on purpose: `new Date("2026-08-30")` parses as UTC midnight, which
// lands on the wrong day for anyone west of Greenwich.
export const getVisibleFrom = (dateString, time, showBefore) => {
  const [year, month, day] = String(dateString || "").split("-").map(Number);
  if (!year || !month || !day) return null;

  const [hours, minutes] = String(time || "00:00").split(":").map(Number);
  const start = new Date(year, month - 1, day, hours || 0, minutes || 0, 0, 0);

  const lead = normalizeShowBefore(showBefore);
  if (lead === SAME_DAY) {
    const midnight = new Date(start);
    midnight.setHours(0, 0, 0, 0);
    return midnight;
  }
  return new Date(start.getTime() - lead * 60 * 1000);
};

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
  showBefore: normalizeShowBefore(data.showBefore),
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

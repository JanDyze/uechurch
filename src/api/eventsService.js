import { db } from "./firebase";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
} from "firebase/firestore";
import { notify } from "./notifyService";

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
    // Which member tags this gathering is for. Empty means everyone, and
    // `attendees` above is the head count that falls out of it rather than a
    // number anyone typed — see utils/audience.js.
    audienceTags: Array.isArray(data.audienceTags) ? data.audienceTags : [],
    // ...and who it leaves out. "Everyone except the kids" is a normal thing
    // for a gathering to be, and listing every other tag to say so would go
    // stale the moment a new tag exists.
    excludeTags: Array.isArray(data.excludeTags) ? data.excludeTags : [],
    icon: data.icon || 'Calendar',
    // Override-related fields
    overrideOf: data.overrideOf || null,
    isOverride: data.isOverride || false,
    isCancelled: data.isCancelled || false,
    memberId: data.memberId || null,
  };
};

/* ------------------------------------------------------------------ pushes */
// What the calendar is worth interrupting someone for: a new gathering, one
// that moved, one that is off. Everything else a save touches — a typo in the
// description, an attendee count, a past date being tidied up — is a change to
// the record, not news, and is deliberately silent.

/** Local YYYY-MM-DD, matching how event.date is stored. */
const todayString = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
};

/** Nobody needs telling about something that has already happened. */
const isUpcoming = (event) => Boolean(event?.date) && event.date >= todayString();

/** The one supporting line: when, and where. */
const whenAndWhere = (event) =>
  [event?.date, event?.time, event?.location].filter(Boolean).join(" · ");

const eventMark = (event) => ({ type: event?.type, icon: event?.icon });

/** The fields that change someone's plans, as opposed to tidying the record. */
const PLAN_FIELDS = ["date", "time", "location"];

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
    announceAddedEvent(eventData);
    return docRef.id;
  } catch (error) {
    console.error("Error adding event:", error);
    throw error;
  }
};

/**
 * Not every added document is a new event. Cancelling one occurrence of a
 * recurring service writes a cancelled override, and editing one writes a
 * plain override — both used to go out as "New event: Sunday Service", which
 * is the opposite of what happened.
 */
const announceAddedEvent = (event) => {
  if (!isUpcoming(event)) return;
  const title = event.title || "Untitled";

  if (event.isCancelled) {
    notify("event.cancelled", {
      title: `Cancelled: ${title}`,
      body: whenAndWhere(event),
      event: eventMark(event),
    });
    return;
  }

  if (event.isOverride) {
    notify("event.changed", {
      title: `Updated: ${title}`,
      body: whenAndWhere(event),
      event: eventMark(event),
    });
    return;
  }

  notify("event.new", {
    title: `New event: ${title}`,
    body: whenAndWhere(event),
    event: eventMark(event),
  });
};

/**
 * `previous` is what the event looked like before this save, so the diff can
 * tell a rescheduling from a corrected spelling. Callers that do not have it
 * simply save without announcing anything.
 */
export const updateEvent = async (firestoreId, eventData, previous = null) => {
  try {
    const eventRef = doc(db, EVENTS_COLLECTION, firestoreId);
    const { firestoreId: _, ...dataToUpdate } = eventData;
    await updateDoc(eventRef, dataToUpdate);

    const after = { ...previous, ...dataToUpdate };
    const moved = previous && PLAN_FIELDS.some((f) => previous[f] !== after[f]);
    // An event moved out of the past into the future is news; one edited while
    // it sits in the past is not, however much moved.
    if (moved && isUpcoming(after)) {
      notify("event.changed", {
        title: `Updated: ${after.title || "Untitled"}`,
        body: whenAndWhere(after),
        event: eventMark(after),
      });
    }
  } catch (error) {
    console.error("Error updating event:", error);
    throw error;
  }
};

/** `event` is optional; without it the delete is silent. */
export const deleteEvent = async (firestoreId, event = null) => {
  try {
    const eventRef = doc(db, EVENTS_COLLECTION, firestoreId);
    await deleteDoc(eventRef);

    // Deleting a cancellation override un-cancels an occurrence — restoring
    // it, not calling it off — so that one is left alone.
    if (isUpcoming(event) && !event.isCancelled) {
      notify("event.cancelled", {
        title: `Cancelled: ${event.title || "Untitled"}`,
        body: whenAndWhere(event),
        event: eventMark(event),
      });
    }
  } catch (error) {
    console.error("Error deleting event:", error);
    throw error;
  }
};

import { ref, onMounted, onUnmounted } from "vue";
import {
  subscribeToEvents,
  addEvent,
  updateEvent,
  deleteEvent as deleteEventDoc,
  hideOccurrence,
} from "../api/eventsService";

export function useEvents() {
  const events = ref([]);
  const loading = ref(true);
  let unsubscribeEvents = null;

  // Subscribe to real-time updates from Firestore for events
  const setupEventsListener = () => {
    loading.value = true;
    unsubscribeEvents = subscribeToEvents((updatedEvents) => {
      events.value = updatedEvents;
      loading.value = false;
    });
  };

  // Add a new event to Firestore
  const addEventToFirestore = async (eventData) => {
    try {
      await addEvent(eventData);
    } catch (error) {
      console.error('Error adding event to Firestore:', error);
      throw error;
    }
  };

  // Update an event in Firestore (uses Firestore document ID). The event as it
  // stands is handed on so the service can tell a reschedule — which the
  // church is told about — from a wording fix, which it is not.
  const updateEventInFirestore = async (event, eventData) => {
    try {
      const firestoreId = event.firestoreId || event.id;
      await updateEvent(firestoreId, eventData, event);
    } catch (error) {
      console.error('Error updating event in Firestore:', error);
      throw error;
    }
  };

  // Delete an event from Firestore (uses Firestore document ID)
  const removeEvent = async (event) => {
    try {
      const firestoreId = event.firestoreId || event.id;
      await deleteEventDoc(firestoreId, event);
    } catch (error) {
      console.error('Error deleting event from Firestore:', error);
      throw error;
    }
  };

  // Delete one date of a weekly schedule. There is no document to remove - the
  // occurrence is generated - so this writes the override that stands in for
  // it. The schedule itself is untouched and next week still happens.
  const removeOccurrence = async (event) => {
    try {
      await hideOccurrence(event);
    } catch (error) {
      console.error('Error removing occurrence:', error);
      throw error;
    }
  };

  // Initialize: Set up real-time listeners
  onMounted(() => {
    // See useMembers: onSnapshot failures arrive through its error callback,
    // not as a throw, so there is nothing here for a catch to handle.
    setupEventsListener();
  });

  // Cleanup: Unsubscribe when component unmounts
  onUnmounted(() => {
    if (unsubscribeEvents) {
      unsubscribeEvents();
    }
  });

  return {
    events,
    loading,
    addEventToFirestore,
    updateEventInFirestore,
    removeEvent,
    removeOccurrence,
  };
}

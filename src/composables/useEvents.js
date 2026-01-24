import { ref, onMounted, onUnmounted } from "vue";
import {
  subscribeToEvents,
  addEvent,
  updateEvent,
  deleteEvent as deleteEventDoc,
} from "../api/eventsService";
import eventsData from "../assets/events.json";

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

  // Update an event in Firestore (uses Firestore document ID)
  const updateEventInFirestore = async (event, eventData) => {
    try {
      const firestoreId = event.firestoreId || event.id;
      await updateEvent(firestoreId, eventData);
    } catch (error) {
      console.error('Error updating event in Firestore:', error);
      throw error;
    }
  };

  // Delete an event from Firestore (uses Firestore document ID)
  const removeEvent = async (event) => {
    try {
      const firestoreId = event.firestoreId || event.id;
      await deleteEventDoc(firestoreId);
    } catch (error) {
      console.error('Error deleting event from Firestore:', error);
      throw error;
    }
  };

  // Initialize: Set up real-time listeners
  onMounted(() => {
    try {
      setupEventsListener();
    } catch (error) {
      console.error("Error setting up Firestore listeners:", error);
      // Fallback to local data if Firestore fails
      events.value = eventsData;
    }
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
  };
}

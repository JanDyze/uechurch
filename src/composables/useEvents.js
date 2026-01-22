import { ref, onMounted, onUnmounted } from "vue";
import {
  subscribeToEvents,
  addEvent,
  updateEvent,
  deleteEvent as deleteEventDoc,
  subscribeToEventPresets,
  addEventPreset,
  updateEventPreset,
  deleteEventPreset as deleteEventPresetDoc,
} from "../api/eventsService";
import eventsData from "../assets/events.json";

export function useEvents() {
  const events = ref([]);
  const eventPresets = ref([]);
  const loading = ref(true);
  let unsubscribeEvents = null;
  let unsubscribePresets = null;

  // Subscribe to real-time updates from Firestore for events
  const setupEventsListener = () => {
    loading.value = true;
    unsubscribeEvents = subscribeToEvents((updatedEvents) => {
      events.value = updatedEvents;
      loading.value = false;
    });
  };

  // Subscribe to real-time updates from Firestore for presets
  const setupPresetsListener = () => {
    unsubscribePresets = subscribeToEventPresets((updatedPresets) => {
      eventPresets.value = updatedPresets;
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

  // Add a new event preset to Firestore
  const addPresetToFirestore = async (presetData) => {
    try {
      await addEventPreset(presetData);
    } catch (error) {
      console.error('Error adding preset to Firestore:', error);
      throw error;
    }
  };

  // Update an event preset in Firestore (uses Firestore document ID)
  const updatePresetInFirestore = async (preset, presetData) => {
    try {
      const firestoreId = preset.firestoreId || preset.id;
      await updateEventPreset(firestoreId, presetData);
    } catch (error) {
      console.error('Error updating preset in Firestore:', error);
      throw error;
    }
  };

  // Delete an event preset from Firestore (uses Firestore document ID)
  const removePreset = async (preset) => {
    try {
      const firestoreId = preset.firestoreId || preset.id;
      await deleteEventPresetDoc(firestoreId);
    } catch (error) {
      console.error('Error deleting preset from Firestore:', error);
      throw error;
    }
  };

  // Initialize: Set up real-time listeners
  onMounted(() => {
    try {
      setupEventsListener();
      setupPresetsListener();
    } catch (error) {
      console.error("Error setting up Firestore listeners:", error);
      // Fallback to local data if Firestore fails
      events.value = eventsData;
      eventPresets.value = [];
    }
  });

  // Cleanup: Unsubscribe when component unmounts
  onUnmounted(() => {
    if (unsubscribeEvents) {
      unsubscribeEvents();
    }
    if (unsubscribePresets) {
      unsubscribePresets();
    }
  });

  return {
    events,
    eventPresets,
    loading,
    addEventToFirestore,
    updateEventInFirestore,
    removeEvent,
    addPresetToFirestore,
    updatePresetInFirestore,
    removePreset,
  };
}



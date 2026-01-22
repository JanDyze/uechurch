import { ref } from 'vue'
import eventTypesData from '../data/eventTypes.json'

export function useEventForm() {
  const newEventDate = ref('')
  const newEventData = ref({
    title: '',
    type: 'worship',
    time: '09:00',
    location: '',
    description: '',
    attendees: 0,
    icon: 'Calendar'
  })

  const selectedPreset = ref(null)
  const eventTypes = eventTypesData

  const resetEventForm = () => {
    newEventDate.value = ''
    newEventData.value = {
      title: '',
      type: 'worship',
      time: '09:00',
      location: '',
      description: '',
      attendees: 0,
      icon: 'Calendar'
    }
    selectedPreset.value = null
  }

  const updateEventFormFromPreset = (preset) => {
    if (preset) {
      // Remove firestoreId and id from form data
      const { firestoreId, id, ...presetData } = preset
      newEventData.value = { ...presetData }
      selectedPreset.value = { ...preset }
    } else {
      resetEventForm()
    }
  }

  return {
    newEventDate,
    newEventData,
    selectedPreset,
    eventTypes,
    resetEventForm,
    updateEventFormFromPreset
  }
}




import { ref } from 'vue'
import eventTypesData from '../data/eventTypes.json'

export function usePresetForm() {
  const newPreset = ref({
    title: '',
    type: 'worship',
    time: '09:00',
    location: '',
    description: '',
    attendees: 0,
    icon: 'Calendar'
  })

  const editingPreset = ref(null)
  const eventTypes = eventTypesData

  const resetPresetForm = () => {
    newPreset.value = {
      title: '',
      type: 'worship',
      time: '09:00',
      location: '',
      description: '',
      attendees: 0,
      icon: 'Calendar'
    }
    editingPreset.value = null
  }

  const startEditPreset = (preset) => {
    editingPreset.value = { ...preset }
    // Remove firestoreId and id from form data
    const { firestoreId, id, ...presetData } = preset
    newPreset.value = { ...presetData }
  }

  return {
    newPreset,
    editingPreset,
    eventTypes,
    resetPresetForm,
    startEditPreset
  }
}




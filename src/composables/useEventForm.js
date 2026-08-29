import { ref, computed } from 'vue'
import { useAppSettings } from './useAppSettings'

export function useEventForm(members = { value: [] }) {
  const memberCount = computed(() => members.value?.length || 0)
  
  const newEventDate = ref('')
  const newEventData = ref({
    title: '',
    type: 'worship',
    time: '09:00',
    location: '',
    description: '',
    attendees: memberCount.value,
    icon: 'Calendar'
  })

  const { categories } = useAppSettings()
  const eventTypes = computed(() => categories.value.eventTypes)

  const resetEventForm = () => {
    newEventDate.value = ''
    newEventData.value = {
      title: '',
      type: 'worship',
      time: '09:00',
      location: '',
      description: '',
      attendees: memberCount.value,
      icon: 'Calendar'
    }
  }

  return {
    newEventDate,
    newEventData,
    eventTypes,
    resetEventForm,
    memberCount,
  }
}

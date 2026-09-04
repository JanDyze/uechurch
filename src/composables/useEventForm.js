import { ref, computed } from 'vue'
import { useAppSettings } from './useAppSettings'
import { expectedAttendance } from '../utils/audience'

export function useEventForm(members = { value: [] }) {
  const memberCount = computed(() => members.value?.length || 0)

  const newEventDate = ref('')
  const newEventData = ref({
    title: '',
    type: 'worship',
    time: '09:00',
    location: '',
    description: '',
    // Who the event is for, and who it leaves out. Nothing selected means
    // everyone, which is how a service starts out — see utils/audience.js.
    audienceTags: [],
    excludeTags: [],
    icon: 'Calendar'
  })

  const { categories } = useAppSettings()
  const eventTypes = computed(() => categories.value.eventTypes)

  // The head count the tags produce, counted off the roster as it stands. It is
  // stored on the event so anything reading the document straight — the digest,
  // an export — sees a number, but the picker and the details card recount it
  // live rather than trusting a snapshot.
  const expectedFromTags = computed(() =>
    expectedAttendance(newEventData.value, members.value)
  )

  const resetEventForm = () => {
    newEventDate.value = ''
    newEventData.value = {
      title: '',
      type: 'worship',
      time: '09:00',
      location: '',
      description: '',
      audienceTags: [],
      excludeTags: [],
      icon: 'Calendar'
    }
  }

  return {
    newEventDate,
    newEventData,
    eventTypes,
    resetEventForm,
    memberCount,
    expectedFromTags,
  }
}

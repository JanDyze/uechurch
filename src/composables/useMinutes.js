import { ref, onMounted, onUnmounted } from 'vue'
import { subscribeToMinutes, addMinute, updateMinute, deleteMinute } from '../api/minutesService'

export function useMinutes() {
  const minutes = ref([])
  const loading = ref(true)
  let unsubscribe = null

  onMounted(() => {
    unsubscribe = subscribeToMinutes((data) => {
      minutes.value = data
      loading.value = false
    })
  })

  onUnmounted(() => {
    if (unsubscribe) {
      unsubscribe()
    }
  })

  const addMinuteToFirestore = async (minuteData) => {
    return await addMinute(minuteData)
  }

  const updateMinuteInFirestore = async (minute, updatedData) => {
    return await updateMinute(minute, updatedData)
  }

  const removeMinute = async (minute) => {
    return await deleteMinute(minute)
  }

  return {
    minutes,
    loading,
    addMinuteToFirestore,
    updateMinuteInFirestore,
    removeMinute
  }
}




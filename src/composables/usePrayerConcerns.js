import { ref, onMounted, onUnmounted } from 'vue'
import { subscribeToPrayerConcerns, addPrayerConcern, updatePrayerConcern, deletePrayerConcern } from '../api/prayerConcernsService'

export function usePrayerConcerns() {
  const prayerConcerns = ref([])
  const loading = ref(true)
  let unsubscribe = null

  onMounted(() => {
    unsubscribe = subscribeToPrayerConcerns((data) => {
      prayerConcerns.value = data
      loading.value = false
    })
  })

  onUnmounted(() => {
    if (unsubscribe) {
      unsubscribe()
    }
  })

  const addPrayerConcernToFirestore = async (concernData) => {
    return await addPrayerConcern(concernData)
  }

  const updatePrayerConcernInFirestore = async (concern, updatedData) => {
    return await updatePrayerConcern(concern, updatedData)
  }

  const removePrayerConcern = async (concern) => {
    return await deletePrayerConcern(concern)
  }

  return {
    prayerConcerns,
    loading,
    addPrayerConcernToFirestore,
    updatePrayerConcernInFirestore,
    removePrayerConcern
  }
}


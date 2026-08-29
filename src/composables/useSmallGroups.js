import { ref, onMounted, onUnmounted } from 'vue'
import {
  subscribeToSmallGroups,
  addSmallGroup,
  updateSmallGroup,
  deleteSmallGroup,
} from '../api/smallGroupsService'

export function useSmallGroups() {
  const groups = ref([])
  const loading = ref(true)
  let unsubscribe = null

  onMounted(() => {
    unsubscribe = subscribeToSmallGroups((data) => {
      groups.value = data
      loading.value = false
    })
  })

  onUnmounted(() => {
    if (unsubscribe) unsubscribe()
  })

  const createGroup = (groupData) => addSmallGroup(groupData)
  const saveGroup = (groupId, updatedData) => updateSmallGroup(groupId, updatedData)
  const removeGroup = (groupId) => deleteSmallGroup(groupId)

  const findGroup = (groupId) =>
    groups.value.find((g) => g.firestoreId === groupId || g.id === groupId) || null

  return { groups, loading, createGroup, saveGroup, removeGroup, findGroup }
}

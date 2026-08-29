import { ref, watch, onUnmounted, unref } from 'vue'
import {
  subscribeToGroupSessions,
  addSgSession,
  updateSgSession,
  deleteSgSession,
  subscribeToSessionPhotos,
  uploadSessionPhoto,
  deleteSessionPhoto,
} from '../api/smallGroupsService'

/**
 * Sessions belonging to one small group. `groupId` may be a ref, so navigating
 * between groups re-subscribes instead of leaking the previous listener.
 */
export function useSgSessions(groupId) {
  const sessions = ref([])
  const loading = ref(true)
  let unsubscribe = null

  const stop = () => {
    if (unsubscribe) {
      unsubscribe()
      unsubscribe = null
    }
  }

  watch(
    () => unref(groupId),
    (id) => {
      stop()
      sessions.value = []
      if (!id) {
        loading.value = false
        return
      }
      loading.value = true
      unsubscribe = subscribeToGroupSessions(id, (data) => {
        sessions.value = data
        loading.value = false
      })
    },
    { immediate: true }
  )

  onUnmounted(stop)

  const createSession = (sessionData) => addSgSession(sessionData)
  const saveSession = (sessionId, updatedData) => updateSgSession(sessionId, updatedData)
  const removeSession = (sessionId) => deleteSgSession(sessionId)

  const findSession = (sessionId) =>
    sessions.value.find((s) => s.firestoreId === sessionId || s.id === sessionId) || null

  return { sessions, loading, createSession, saveSession, removeSession, findSession }
}

/**
 * Photos attached to one session. `sessionId` may be a ref (or null while a
 * session is still unsaved), matching useSgSessions above.
 */
export function useSessionPhotos(sessionId) {
  const photos = ref([])
  const loading = ref(false)
  let unsubscribe = null

  const stop = () => {
    if (unsubscribe) {
      unsubscribe()
      unsubscribe = null
    }
  }

  watch(
    () => unref(sessionId),
    (id) => {
      stop()
      photos.value = []
      if (!id) return
      loading.value = true
      unsubscribe = subscribeToSessionPhotos(id, (data) => {
        photos.value = data
        loading.value = false
      })
    },
    { immediate: true }
  )

  onUnmounted(stop)

  const addPhoto = (base64, caption) => uploadSessionPhoto(unref(sessionId), base64, caption)
  const removePhoto = (photo) => deleteSessionPhoto(photo.id)

  return { photos, loading, addPhoto, removePhoto }
}

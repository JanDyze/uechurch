import { computed, ref, onMounted, onUnmounted } from 'vue'
import { subscribeToAdmins, addAdmin, removeAdmin, claimFirstAdmin } from '../api/adminsService'
import { useAuth } from './useAuth'

// Shared across every caller: the admin list gates UI in several places and
// there is no reason for each to open its own listener.
const admins = ref([])
const loading = ref(true)
let unsubscribe = null
let subscribers = 0

export function useAdmins() {
  const { user } = useAuth()

  onMounted(() => {
    subscribers += 1
    if (unsubscribe) return
    unsubscribe = subscribeToAdmins((data) => {
      admins.value = data
      loading.value = false
    })
  })

  onUnmounted(() => {
    subscribers -= 1
    if (subscribers <= 0 && unsubscribe) {
      unsubscribe()
      unsubscribe = null
      subscribers = 0
    }
  })

  const isAdmin = computed(() =>
    Boolean(user.value && admins.value.some((admin) => admin.uid === user.value.uid))
  )

  // Nobody has claimed the first slot yet — Settings offers the bootstrap.
  const hasNoAdmins = computed(() => !loading.value && admins.value.length === 0)

  const promote = (targetUser) => addAdmin(targetUser, user.value)
  const demote = (uid) => removeAdmin(uid)
  const claimFirst = () => claimFirstAdmin(user.value)

  return { admins, loading, isAdmin, hasNoAdmins, promote, demote, claimFirst }
}

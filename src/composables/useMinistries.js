import { computed, onMounted, onUnmounted, ref } from 'vue'
import {
  subscribeToMinistries,
  addMinistry,
  renameMinistry,
  deleteMinistry,
  seedDefaultMinistriesIfEmpty,
} from '../api/ministriesService'

// Shared across every caller, like useAdmins: the ministry list gates the
// member form, the roles grid and the filters, and there is no reason for each
// to open its own listener.
const ministries = ref([])
const loading = ref(true)
let unsubscribe = null
let subscribers = 0

export function useMinistries() {
  onMounted(() => {
    subscribers += 1
    if (unsubscribe) return
    unsubscribe = subscribeToMinistries((data) => {
      ministries.value = data
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

  /** Just the names — what a member document stores and roles are keyed by. */
  const ministryNames = computed(() => ministries.value.map((m) => m.name).filter(Boolean))

  /**
   * Whether a stored value is a ministry the church still recognises. The
   * member form only offers real ones, but a ministry deleted after a member
   * was assigned to it would otherwise linger as an unrecognised chip.
   */
  const isKnownMinistry = (name) =>
    ministryNames.value.some((n) => n.toLowerCase() === String(name || '').toLowerCase())

  return {
    ministries,
    ministryNames,
    loading,
    isKnownMinistry,
    add: addMinistry,
    rename: renameMinistry,
    remove: deleteMinistry,
    seedDefaults: seedDefaultMinistriesIfEmpty,
  }
}

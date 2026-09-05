import { computed, onMounted, onUnmounted, ref } from 'vue'
import {
  subscribeToTickets,
  addTicket,
  updateTicket,
  setTicketStatus,
  reorderTickets,
  deleteTicket,
} from '../api/ticketsService'
import { compareClosed, compareTickets, isClosed } from '../utils/ticketUtils'

// One listener shared across callers, the same arrangement as useTasks.
const tickets = ref([])
const loading = ref(true)
let unsubscribe = null
let subscribers = 0

export function useTickets() {
  onMounted(() => {
    subscribers += 1
    if (unsubscribe) return
    unsubscribe = subscribeToTickets((data) => {
      tickets.value = data
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

  const openTickets = computed(() =>
    tickets.value.filter((t) => !isClosed(t)).sort(compareTickets)
  )

  const closedTickets = computed(() =>
    tickets.value.filter(isClosed).sort(compareClosed)
  )

  const openCountByKind = computed(() =>
    openTickets.value.reduce((counts, t) => {
      counts[t.kind] = (counts[t.kind] || 0) + 1
      return counts
    }, {})
  )

  return {
    tickets,
    loading,
    openTickets,
    closedTickets,
    openCountByKind,
    addTicket,
    updateTicket,
    setTicketStatus,
    reorderTickets,
    removeTicket: deleteTicket,
  }
}

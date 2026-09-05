import { computed, onMounted, onUnmounted, ref } from 'vue'
import {
  subscribeToEntries,
  subscribeToOpening,
  addEntry,
  updateEntry,
  deleteEntry,
  saveOpening,
} from '../api/ledgerService'
import {
  balancesAsOf,
  currentMonthKey,
  entriesInMonth,
  statementFor,
  todayIso,
} from '../utils/ledgerUtils'

// One listener each, shared across callers — the same arrangement as useTickets
// and useTasks. Two subscriptions rather than one because the opening balance
// is a single document that almost never changes, while entries change daily.
const entries = ref([])
const opening = ref({ asOf: '', cash: 0, bank: 0, isSet: false })
const loading = ref(true)

let unsubscribeEntries = null
let unsubscribeOpening = null
let subscribers = 0

export function useLedger() {
  onMounted(() => {
    subscribers += 1
    if (unsubscribeEntries) return
    unsubscribeEntries = subscribeToEntries((data) => {
      entries.value = data
      loading.value = false
    })
    unsubscribeOpening = subscribeToOpening((data) => {
      opening.value = data
    })
  })

  onUnmounted(() => {
    subscribers -= 1
    if (subscribers > 0) return
    unsubscribeEntries?.()
    unsubscribeOpening?.()
    unsubscribeEntries = null
    unsubscribeOpening = null
    subscribers = 0
  })

  /** Balances right now — what is in the tin and in the bank today. */
  const balancesToday = computed(() => balancesAsOf(entries.value, opening.value, todayIso()))

  const statementForMonth = (monthKey) => statementFor(entries.value, monthKey, opening.value)

  const monthEntries = (monthKey) => entriesInMonth(entries.value, monthKey)

  /** Months that actually hold entries, newest first, for the month picker. */
  const monthsWithEntries = computed(() => {
    const keys = new Set(entries.value.map((e) => String(e.date || '').slice(0, 7)).filter(Boolean))
    keys.add(currentMonthKey())
    return [...keys].sort().reverse()
  })

  return {
    entries,
    opening,
    loading,
    balancesToday,
    monthsWithEntries,
    monthEntries,
    statementForMonth,
    addEntry,
    updateEntry,
    removeEntry: deleteEntry,
    saveOpening,
  }
}

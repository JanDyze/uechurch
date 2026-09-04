import { computed, onMounted, onUnmounted, ref, unref, watch } from 'vue'
import {
  subscribeToLineup,
  subscribeToLineups,
  saveLineup,
  deleteLineup,
} from '../api/lineupsService'
import { useAuth } from './useAuth'
import { monthKeyOf, sundaysInMonth, todayIso } from '../utils/lineupUtils'

/** An unplanned service slot: the shape the editor and the cards expect. */
export const blankSunday = (date) => ({
  date,
  leaderId: null,
  teamIds: [],
  theme: '',
  notes: '',
  songs: [],
})

/** True once anything has actually been filled in for a service. */
export const isSundayPlanned = (sunday) =>
  Boolean(sunday?.leaderId || sunday?.songs?.length || sunday?.theme || sunday?.notes?.trim() || sunday?.teamIds?.length)

/**
 * The month's plan. `monthKey` may be a ref, so paging between months
 * re-subscribes instead of leaking the previous listener.
 *
 * `sundays` is the calendar's Sundays overlaid with whatever has been saved,
 * so the month page always shows its full shape even before anyone has planned
 * a single service. Any off-Sunday date already stored is still listed — the
 * page no longer offers a way to add one, but it will not hide one either.
 */
export function useLineup(monthKey) {
  const { user } = useAuth()
  const lineup = ref(null)
  const loading = ref(true)
  let unsubscribe = null

  const stop = () => {
    if (unsubscribe) {
      unsubscribe()
      unsubscribe = null
    }
  }

  watch(
    () => unref(monthKey),
    (key) => {
      stop()
      lineup.value = null
      if (!key) {
        loading.value = false
        return
      }
      loading.value = true
      unsubscribe = subscribeToLineup(key, (data) => {
        lineup.value = data
        loading.value = false
      })
    },
    { immediate: true }
  )

  onUnmounted(stop)

  const sundays = computed(() => {
    const key = unref(monthKey)
    const stored = lineup.value?.sundays || []
    const byDate = new Map(stored.map((s) => [s.date, s]))
    const dates = new Set([...sundaysInMonth(key), ...stored.map((s) => s.date)])
    return [...dates]
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b))
      .map((date) => byDate.get(date) || blankSunday(date))
  })

  const status = computed(() => lineup.value?.status || 'draft')
  const isPublished = computed(() => status.value === 'published')

  /** Writes the whole `sundays` array back — the plan is one document. */
  const writeSundays = (next) =>
    saveLineup(
      unref(monthKey),
      { sundays: next.filter((s) => s.date).sort((a, b) => a.date.localeCompare(b.date)) },
      user.value
    )

  /** Replace one service, keeping the rest of the month untouched. */
  const saveSunday = (sunday) => {
    const rest = (lineup.value?.sundays || []).filter((s) => s.date !== sunday.date)
    return writeSundays([...rest, sunday])
  }

  /** Wipe one service back to unplanned; the slot itself stays on the page. */
  const clearSunday = (date) =>
    writeSundays((lineup.value?.sundays || []).filter((s) => s.date !== date))

  const setStatus = (next) =>
    saveLineup(unref(monthKey), { status: next === 'published' ? 'published' : 'draft' }, user.value)

  const removeMonth = () => deleteLineup(unref(monthKey))

  return {
    lineup,
    loading,
    sundays,
    status,
    isPublished,
    saveSunday,
    clearSunday,
    setStatus,
    removeMonth,
  }
}

/** Every planned month, for the month index and the dashboard card. */
export function useAllLineups() {
  const lineups = ref([])
  const loading = ref(true)
  let unsubscribe = null

  onMounted(() => {
    unsubscribe = subscribeToLineups((data) => {
      lineups.value = data
      loading.value = false
    })
  })

  onUnmounted(() => {
    if (unsubscribe) unsubscribe()
  })

  const plannedMonths = computed(() => lineups.value.map((l) => l.month))

  /**
   * The next service with a plan on it, today included, ignoring months that
   * are still drafts unless the caller can see drafts.
   */
  const nextService = (includeDrafts = false) => {
    const today = todayIso()
    const rows = lineups.value
      .filter((l) => includeDrafts || l.status === 'published')
      .flatMap((l) => l.sundays.map((s) => ({ ...s, month: l.month, status: l.status })))
      .filter((s) => s.date >= today && isSundayPlanned(s))
      .sort((a, b) => a.date.localeCompare(b.date))
    return rows[0] || null
  }

  const findMonth = (key) => lineups.value.find((l) => l.month === key) || null

  const currentMonth = computed(() => findMonth(monthKeyOf()))

  return { lineups, loading, plannedMonths, nextService, findMonth, currentMonth }
}

import { computed, ref } from 'vue'

/**
 * The order the apps sit in, and therefore which four ride on the bottom bar.
 *
 * Alphabetical to begin with, because any other default is a guess about what
 * this particular church does most. After that it is whatever the person
 * dragged, kept per device in localStorage: the four they pull to the front
 * become their bar, so the dock ends up holding the apps they actually use
 * without anyone having to configure a dock.
 *
 * Stored as paths, not indexes. A path survives a page being renamed, added or
 * removed; an index would silently point at a different app the next time the
 * catalogue changed.
 */
const STORAGE_KEY = 'uec.appOrder'

const readStored = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    return Array.isArray(raw) ? raw.filter((p) => typeof p === 'string') : []
  } catch {
    return []
  }
}

const order = ref(readStored())

/** How many of them the bar shows. */
export const BAR_SLOTS = 4

export function useAppOrder(allowedItems) {
  /**
   * Saved order first, then anything it has never heard of — a newly added
   * page, or one a role was just granted — in alphabetical order after it.
   * Nothing is dropped for being unknown, and nothing is invented for being
   * saved and since removed.
   */
  const ordered = computed(() => {
    const items = allowedItems.value
    const rank = new Map(order.value.map((path, i) => [path, i]))
    const known = items.filter((i) => rank.has(i.path)).sort((a, b) => rank.get(a.path) - rank.get(b.path))
    const fresh = items
      .filter((i) => !rank.has(i.path))
      .sort((a, b) => a.name.localeCompare(b.name))
    return [...known, ...fresh]
  })

  const primary = computed(() => ordered.value.slice(0, BAR_SLOTS))

  const setOrder = (items) => {
    order.value = items.map((i) => i.path)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(order.value))
    } catch {
      // The arrangement lasts the session and resets next launch.
    }
  }

  /** Back to plain alphabetical. */
  const resetOrder = () => {
    order.value = []
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* nothing to undo */
    }
  }

  return { ordered, primary, setOrder, resetOrder }
}

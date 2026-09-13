import { computed, ref, watch } from 'vue'
import { clearUserPref, saveUserPrefs, subscribeToUserPrefs } from '../api/userPrefsService'
import { useAuth } from './useAuth'

/**
 * The order the apps sit in, and therefore which four ride on the bottom bar.
 *
 * Alphabetical to begin with, because any other default is a guess about what
 * this particular church does most. After that it is whatever the person
 * dragged: the four they pull to the front become their bar, so the dock ends
 * up holding the apps they actually use without anyone having to configure a
 * dock.
 *
 * Kept against the account, not the device. Somebody who arranges their apps
 * on their phone and then opens the app on a borrowed laptop should find their
 * own bar there, and a shared tablet in the office should not hand the last
 * person's arrangement to the next one.
 *
 * Stored as paths, not indexes. A path survives a page being renamed, added or
 * removed; an index would silently point at a different app the next time the
 * catalogue changed.
 */
const PREF_KEY = 'appOrder'

// What the device remembers is now only a paint cache of the signed-in
// account's order, keyed by uid. Firestore is the truth, but it answers a
// moment after the first render, and without something to draw in the meantime
// the bottom bar would reshuffle itself on every cold start.
const cacheKey = (uid) => `uec.appOrder.${uid}`

// The old device-wide key, from before the order followed the account. Read
// once per account to carry an existing arrangement up to Firestore, then left
// alone — see adoptLegacyOrder.
const LEGACY_KEY = 'uec.appOrder'

const readPaths = (key) => {
  try {
    const raw = JSON.parse(localStorage.getItem(key) || '[]')
    return Array.isArray(raw) ? raw.filter((p) => typeof p === 'string') : []
  } catch {
    return []
  }
}

const writePaths = (key, paths) => {
  try {
    localStorage.setItem(key, JSON.stringify(paths))
  } catch {
    // The arrangement still lives in Firestore; only the head start is lost.
  }
}

const forget = (key) => {
  try {
    localStorage.removeItem(key)
  } catch {
    /* nothing to undo */
  }
}

const order = ref([])
const uid = ref(null)

/**
 * Pages whose path changed, old to new. A path survives a rename of the label,
 * but not a rename of the path itself — so without this, whoever had Lineups
 * on their bar would find Schedules dropped to the back of the list.
 */
const RENAMED_PATHS = { '/lineups': '/schedules' }

/** How many of them the bar shows. */
export const BAR_SLOTS = 4

/**
 * An account whose preferences hold no order, on a device that was arranging
 * apps before this moved to Firestore, keeps what it had. Only the first
 * account to sign in after the change inherits it: the order was written when
 * nobody was being asked which account it belonged to, so handing the same one
 * to every account that subsequently signs in on this device would be guessing.
 */
const adoptLegacyOrder = (forUid) => {
  const legacy = readPaths(LEGACY_KEY)
  forget(LEGACY_KEY)
  if (!legacy.length) return []
  writePaths(cacheKey(forUid), legacy)
  saveUserPrefs(forUid, { [PREF_KEY]: legacy }).catch((error) =>
    console.error('Error saving app order:', error)
  )
  return legacy
}

let started = false
let unsubscribe = null

/**
 * Starts following the signed-in account's order. Module-level with an explicit
 * init like initAppSettings: the bar reads this through a composable, but the
 * subscription belongs to the session rather than to whichever component
 * happened to mount first.
 */
export const initAppOrder = () => {
  if (started) return
  started = true

  const { user } = useAuth()

  watch(
    () => user.value?.uid || null,
    (now) => {
      unsubscribe?.()
      unsubscribe = null
      uid.value = now

      if (!now) {
        // Signing out takes the arrangement with it: the next person at this
        // device gets plain alphabetical until they sign in.
        order.value = []
        return
      }

      // Something to draw while the first snapshot is in flight.
      order.value = readPaths(cacheKey(now))

      unsubscribe = subscribeToUserPrefs(now, (prefs) => {
        // A failed read leaves whatever is on screen alone rather than
        // flattening the bar to alphabetical.
        if (!prefs) return
        const saved = prefs[PREF_KEY]
        if (Array.isArray(saved)) {
          const paths = saved.filter((p) => typeof p === 'string')
          order.value = paths
          writePaths(cacheKey(now), paths)
          return
        }
        order.value = adoptLegacyOrder(now)
      })
    },
    { immediate: true }
  )
}

export function useAppOrder(allowedItems) {
  /**
   * Saved order first, then anything it has never heard of — a newly added
   * page, or one a role was just granted — in alphabetical order after it.
   * Nothing is dropped for being unknown, and nothing is invented for being
   * saved and since removed.
   */
  const ordered = computed(() => {
    const items = allowedItems.value
    const rank = new Map(order.value.map((path, i) => [RENAMED_PATHS[path] || path, i]))
    const known = items.filter((i) => rank.has(i.path)).sort((a, b) => rank.get(a.path) - rank.get(b.path))
    const fresh = items
      .filter((i) => !rank.has(i.path))
      .sort((a, b) => a.name.localeCompare(b.name))
    return [...known, ...fresh]
  })

  const primary = computed(() => ordered.value.slice(0, BAR_SLOTS))

  const setOrder = (items) => {
    const paths = items.map((i) => i.path)
    order.value = paths
    if (!uid.value) return // Nobody to save it against; it lasts the session.
    writePaths(cacheKey(uid.value), paths)
    saveUserPrefs(uid.value, { [PREF_KEY]: paths }).catch((error) =>
      console.error('Error saving app order:', error)
    )
  }

  /** Back to plain alphabetical, on every device this account signs in on. */
  const resetOrder = () => {
    order.value = []
    if (!uid.value) return
    forget(cacheKey(uid.value))
    clearUserPref(uid.value, PREF_KEY).catch((error) =>
      console.error('Error clearing app order:', error)
    )
  }

  return { ordered, primary, setOrder, resetOrder }
}

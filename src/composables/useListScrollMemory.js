import { onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRoute } from 'vue-router'

/**
 * Remember where a list was scrolled to, and put it back on return.
 *
 * The router's own `savedPosition` restores the window, and none of our lists
 * scroll the window — they scroll an inner box inside a `h-full` column, so the
 * window is always at zero and there is nothing for the router to restore.
 *
 * This matters because every list now opens a record as a full page rather than
 * a drawer. Checking three people in a row is back, scroll, tap; without this,
 * each back lands at the top of the roll and the third person is a long way
 * down.
 *
 * Positions live in a module-level Map: they should survive leaving the
 * component (that is the whole point) but not a reload, where starting at the
 * top is the honest thing to do.
 */
const positions = new Map()

export function useListScrollMemory(scroller, options = {}) {
  const route = useRoute()
  // Per path, so People and Minutes do not restore each other's position.
  const key = options.key || route.path
  const { attempts = 30 } = options

  const remember = () => {
    const el = scroller.value
    if (el) positions.set(key, el.scrollTop)
  }

  const forget = () => positions.delete(key)

  onMounted(async () => {
    const top = positions.get(key)
    if (!top) return
    await nextTick()

    // The rows arrive from Firestore after mount, so the box is short at first
    // and any scrollTop we set would clamp to the bottom of an empty list. Wait
    // for it to grow tall enough to hold the position, then stop asking — a
    // list that came back shorter (someone searched, someone was deleted) has
    // no such position and should stay where it is.
    let left = attempts
    const restore = () => {
      const el = scroller.value
      if (!el) return
      if (el.scrollHeight - el.clientHeight >= top) {
        el.scrollTop = top
        return
      }
      if (left-- > 0) requestAnimationFrame(restore)
    }
    requestAnimationFrame(restore)
  })

  onBeforeUnmount(remember)

  return { remember, forget }
}

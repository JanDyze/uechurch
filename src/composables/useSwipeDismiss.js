import { onBeforeUnmount, ref } from 'vue'

/**
 * Swipe a panel away — down for a sheet that came up from the bottom, right
 * for a drawer that came in from the edge.
 *
 * The whole panel is the target, body included. That is the point: a gesture
 * you can only start from a 40px header is one most people never find. What
 * makes it safe to listen on the body is that the swipe defers to scrolling:
 *
 *   - it will not start unless the scroller under the finger is already at its
 *     start, so a list you are halfway down scrolls as it always did;
 *   - it will not start until the finger has committed to the dismiss axis, so
 *     a mostly-vertical drag in a right-hand drawer is a scroll, not a close;
 *   - a drag the wrong way does nothing at all.
 *
 * Nothing is prevented until the swipe has actually taken over, which is why
 * the move listener has to be non-passive rather than simply blocking touch
 * with `touch-action: none`. Blocking outright is what made the earlier
 * version header-only.
 */
const AXIS_SLOP = 8

export function useSwipeDismiss(options = {}) {
  const { direction = 'down', threshold = 110, onDismiss, enabled } = options

  const offset = ref(0)
  const dragging = ref(false)
  let start = null

  /**
   * The nearest scrolling ancestor of whatever was touched, and whether it is
   * still at the top (or left) of its content. A sheet must not slide away
   * under a finger that was trying to scroll back up a long list.
   */
  const scrollerAtStart = (target) => {
    let el = target
    while (el && el !== document.body) {
      const style = el.ownerDocument?.defaultView?.getComputedStyle?.(el)
      if (!style) break
      const scrolls =
        direction === 'down'
          ? /(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight
          : /(auto|scroll)/.test(style.overflowX) && el.scrollWidth > el.clientWidth
      if (scrolls) return direction === 'down' ? el.scrollTop <= 0 : el.scrollLeft <= 0
      el = el.parentElement
    }
    return true
  }

  const detach = () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onUp)
  }

  const release = () => {
    detach()
    start = null
    dragging.value = false
    offset.value = 0
  }

  function onMove(event) {
    if (!start) return

    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    const along = direction === 'down' ? dy : dx
    const across = direction === 'down' ? Math.abs(dx) : Math.abs(dy)

    if (!dragging.value) {
      // Undecided: wait for the finger to say which way it is going.
      if (Math.abs(along) < AXIS_SLOP && across < AXIS_SLOP) return
      // Wrong way, or mostly across — leave it to the scroller.
      if (along <= 0 || across > Math.abs(along)) return release()
      if (!scrollerAtStart(start.target)) return release()
      dragging.value = true
    }

    offset.value = Math.max(0, along)
    // Only now, once the swipe owns the gesture.
    event.preventDefault()
  }

  function onUp() {
    const passed = dragging.value && offset.value > threshold
    detach()
    start = null
    dragging.value = false
    offset.value = 0
    if (passed) onDismiss?.()
  }

  const onPointerdown = (event) => {
    if (event.button !== undefined && event.button !== 0) return
    if (enabled && !enabled(event)) return
    start = { x: event.clientX, y: event.clientY, target: event.target }
    window.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  onBeforeUnmount(release)

  /** Spread onto the panel. */
  const swipeTarget = {
    onPointerdown,
  }

  /** The panel's inline style while a swipe is in flight. */
  const swipeStyle = () => ({
    transform: offset.value
      ? direction === 'down'
        ? `translateY(${offset.value}px)`
        : `translateX(${offset.value}px)`
      : '',
    transition: dragging.value ? 'none' : '',
  })

  return { offset, dragging, swipeTarget, swipeStyle }
}

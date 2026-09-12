import { onBeforeUnmount } from 'vue'

/**
 * Swipe to turn a page — the month grid being the one that wants it.
 *
 * Sideways is the obvious gesture. Up and down is here because the calendar
 * already reads a vertical wheel as "next month" on a desktop
 * (handleCalendarWheel), and a finger should not mean something different from
 * the mouse. Both axes point the same way: the page moves in the direction
 * you push it, so up or left brings the next month on, down or right the one
 * before.
 *
 * Distinct from useSwipeDismiss, which drags a panel away and needs the offset
 * to follow the finger. Nothing here moves under the finger: a month grid is a
 * table, and sliding it would mean rendering the neighbouring months to slide
 * in. What it borrows from that file is the care about when a swipe counts:
 *
 *   - one finger only, so a pinch-zoom is never a page turn;
 *   - the dominant axis wins, and it has to win clearly;
 *   - if anything under the finger scrolls along that axis, the scroll keeps
 *     the gesture. This is what makes vertical paging safe to offer at all —
 *     in the agenda list the container scrolls, so up and down stays scrolling
 *     and only sideways turns the month.
 *
 * Listeners are passive throughout. There is nothing to prevent: the decision
 * is made at touchend, by which point the browser has already done whatever
 * scrolling it was going to do.
 */

/** Far enough to mean it. Below this a swipe is a tap that wobbled. */
const DISTANCE = 60

/** The winning axis has to beat the other by this much, or it is a drift. */
const AXIS_RATIO = 1.6

/** A flick is decided sooner than a drag, but still has to travel. */
const QUICK_MS = 500
const QUICK_DISTANCE = 35

export function useSwipePage({ onNext, onPrevious, enabled, axis = 'horizontal' } = {}) {
  let element = null
  let start = null

  const isEnabled = () => (typeof enabled === 'function' ? enabled() : enabled !== false)
  const axisMode = () => (typeof axis === 'function' ? axis() : axis)

  /**
   * Whether something under the finger scrolls along `direction` and has room
   * to move. A month grid does not scroll at all; the agenda list scrolls
   * vertically, which is precisely why it must keep its vertical gestures.
   */
  const scrollableAlong = (target, direction) => {
    let el = target
    while (el && el !== element && el !== document.body) {
      const style = el.ownerDocument?.defaultView?.getComputedStyle?.(el)
      if (style) {
        const overflow = direction === 'x' ? style.overflowX : style.overflowY
        const scrolls = direction === 'x'
          ? el.scrollWidth > el.clientWidth + 1
          : el.scrollHeight > el.clientHeight + 1
        if (scrolls && /auto|scroll/.test(overflow)) return true
      }
      el = el.parentElement
    }
    return false
  }

  const onTouchStart = (event) => {
    if (!isEnabled() || event.touches.length !== 1) {
      start = null
      return
    }
    const touch = event.touches[0]
    start = { x: touch.clientX, y: touch.clientY, at: Date.now(), target: event.target, cancelled: false }
  }

  const onTouchMove = (event) => {
    // A second finger arriving mid-gesture means it was never a page turn.
    if (start && event.touches.length > 1) start.cancelled = true
  }

  const onTouchEnd = (event) => {
    const from = start
    start = null
    if (!from || from.cancelled || !isEnabled()) return

    const touch = event.changedTouches?.[0]
    if (!touch) return

    const dx = touch.clientX - from.x
    const dy = touch.clientY - from.y
    const horizontal = Math.abs(dx) >= Math.abs(dy)
    const delta = horizontal ? dx : dy
    const other = horizontal ? dy : dx

    // Vertical paging is opt-in per view, because a list that scrolls needs
    // its up and down left alone.
    if (!horizontal && axisMode() !== 'both') return

    // A drift diagonally across the screen is not a decision.
    if (Math.abs(delta) < Math.abs(other) * AXIS_RATIO) return

    if (scrollableAlong(from.target, horizontal ? 'x' : 'y')) return

    const quick = Date.now() - from.at < QUICK_MS
    if (Math.abs(delta) < (quick ? QUICK_DISTANCE : DISTANCE)) return

    // A drag across something that does not scroll still ends in a click, at
    // the point the finger lifted. Without this, every swipe would also open
    // whichever day it happened to finish on.
    swallowNextClick()

    // Push the page away to bring the next one on: up or left is forward,
    // which is also how the wheel reads on a desktop.
    if (delta < 0) onNext?.()
    else onPrevious?.()
  }

  let unswallow = null
  const swallowNextClick = () => {
    unswallow?.()
    const stop = (clickEvent) => {
      clickEvent.stopPropagation()
      clickEvent.preventDefault()
      unswallow?.()
    }
    // Capture, so it runs before the day cell's own listener.
    document.addEventListener('click', stop, { capture: true, once: true })
    const timer = setTimeout(() => unswallow?.(), 400)
    unswallow = () => {
      clearTimeout(timer)
      document.removeEventListener('click', stop, { capture: true })
      unswallow = null
    }
  }

  const detach = () => {
    if (!element) return
    element.removeEventListener('touchstart', onTouchStart)
    element.removeEventListener('touchmove', onTouchMove)
    element.removeEventListener('touchend', onTouchEnd)
    element.removeEventListener('touchcancel', onTouchCancel)
    element = null
  }

  const onTouchCancel = () => { start = null }

  /** Bind with `:ref="swipeRef"` on the element the gesture belongs to. */
  const swipeRef = (el) => {
    if (element === el) return
    detach()
    element = el || null
    if (!element) return
    element.addEventListener('touchstart', onTouchStart, { passive: true })
    element.addEventListener('touchmove', onTouchMove, { passive: true })
    element.addEventListener('touchend', onTouchEnd, { passive: true })
    element.addEventListener('touchcancel', onTouchCancel, { passive: true })
  }

  onBeforeUnmount(() => {
    detach()
    unswallow?.()
  })

  return { swipeRef }
}

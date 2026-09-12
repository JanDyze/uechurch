import { computed, onScopeDispose, readonly, ref } from 'vue'

/**
 * Pull-to-refresh, ours rather than the browser's.
 *
 * Chrome's own gesture is a thin bar drawn outside the page, and on an
 * installed PWA it is the one piece of chrome left that still looks like a
 * browser. It also fires at the worst moments: a flick down at the top of a
 * bottom sheet used to reload the whole app. `overscroll-behavior-y: none` in
 * style.css turns it off, and this takes over the gesture with the church's
 * own mark.
 *
 * The gesture is tracked globally from App.vue — one set of listeners for the
 * whole app rather than a wrapper every view has to remember to use — so the
 * work here is deciding whether a given touch is a pull at all. A drag only
 * counts when the finger starts inside a scroller that is already at the top
 * and nothing overlaying it (a modal, a sheet, the drawer) claims the gesture
 * first.
 */

// How far the finger travels for a full pull, and where the puck settles while
// refreshing. Both in CSS pixels, tuned on a phone: 72px is far enough that a
// scroll-flick never trips it, close enough that a thumb reaches it.
const THRESHOLD = 72
const MAX_PULL = 110
const RESTING = 64

// A refresh that resolves instantly still shows the spin, otherwise the puck
// blinks and the pull feels like it did nothing.
const MIN_SPIN = 650

// The reload path needs its own, longer hold. A reload is not a promise this
// code can wait on - it tears the document down - so without a deliberate
// pause the puck appears and is gone inside a frame or two, and a quick pull
// looks like the logo never spun at all. 950ms is one full turn of the spin
// animation plus the time the puck spends settling into place, which is the
// shortest hold that reads as a deliberate spin rather than a flicker.
const RELOAD_SPIN = 950

// Matches the puck's transform transition, so it unmounts once it is offscreen.
const RETRACT_MS = 260

// How long the offer to reload stands. A reload throws away everything the
// page is holding - a half-typed note, a scroll position, an open section -
// so the gesture asks once before it does that, and the first pull only arms
// the second. Long enough to read the pill and pull again without hurrying,
// short enough that a pull five minutes later is its own first pull again.
const ARM_WINDOW = 6000

const distance = ref(0)
const state = ref('idle') // idle | pulling | refreshing | returning

// Set by a pull that would have reloaded: the pill is up and the next pull is
// the one that goes through.
const armed = ref(false)
let armTimer = null

let handler = null

/**
 * Views with their own way to reload — a Firestore re-fetch, a re-query —
 * register it here and the gesture calls that instead of reloading the page.
 * Returns its own unregister, and ties itself to the calling component's
 * scope so leaving the view cannot leave a stale handler behind.
 */
export const onPullToRefresh = (fn) => {
  handler = fn
  const off = () => {
    if (handler === fn) handler = null
  }
  onScopeDispose(off)
  return off
}

const disarm = () => {
  clearTimeout(armTimer)
  armTimer = null
  armed.value = false
}

const arm = () => {
  clearTimeout(armTimer)
  armed.value = true
  armTimer = setTimeout(() => {
    armed.value = false
    armTimer = null
  }, ARM_WINDOW)
}

/** Rubber band: the first pixels track the finger, the last ones barely move,
 *  so the pull has a floor you can feel instead of sliding forever. */
const damp = (dy) => MAX_PULL * (1 - Math.exp(-dy / MAX_PULL))

/** The scroller the finger is actually in, or null when something overlaying
 *  the page owns this touch. */
const scrollParentOf = (target) => {
  let el = target instanceof Element ? target : null
  while (el && el !== document.body && el !== document.documentElement) {
    if (el.hasAttribute('data-no-pull-refresh')) return null
    const style = getComputedStyle(el)
    // Modals, sheets and drawers are all fixed. Their content scrolls in its
    // own right and pulling inside one should never reload the app under it.
    if (style.position === 'fixed') return null
    if (/(auto|scroll|overlay)/.test(style.overflowY) && el.scrollHeight > el.clientHeight) return el
    el = el.parentElement
  }
  return document.scrollingElement || document.documentElement
}

export function usePullToRefresh() {
  let startX = 0
  let startY = 0
  let tracking = false
  let decided = false // whether this touch has committed to being a pull

  const cancel = () => {
    tracking = false
    decided = false
  }

  // Sends the puck back up rather than blanking it: `returning` keeps it
  // mounted for the length of its own transition, then it unmounts.
  const retract = () => {
    state.value = 'returning'
    distance.value = 0
    setTimeout(() => {
      if (state.value === 'returning') state.value = 'idle'
    }, RETRACT_MS)
  }

  const onTouchStart = (event) => {
    if (state.value === 'refreshing' || event.touches.length !== 1) return cancel()
    const touch = event.touches[0]
    const scroller = scrollParentOf(event.target)
    if (!scroller || scroller.scrollTop > 0) return cancel()
    startX = touch.clientX
    startY = touch.clientY
    tracking = true
    decided = false
  }

  const onTouchMove = (event) => {
    if (!tracking) return
    const touch = event.touches[0]
    const dy = touch.clientY - startY
    const dx = touch.clientX - startX

    if (!decided) {
      // Nothing is committed until the finger has moved enough to say what
      // this gesture is. A swipe deck, a chip row and a carousel all live at
      // the top of their pages; sideways motion belongs to them.
      if (Math.abs(dy) < 8 && Math.abs(dx) < 8) return
      if (dy <= 0 || Math.abs(dx) > Math.abs(dy)) return cancel()
      decided = true
      state.value = 'pulling'
      // Re-zero so the puck starts from the finger rather than jumping the
      // 8px that were spent deciding.
      startY = touch.clientY
    }

    // Claimed from the first frame, not from the first pixel of pull: once
    // Chrome decides a touch is a scroll it stops honouring preventDefault for
    // the rest of that gesture, and the page would slide under the puck. Only
    // safe because App.vue registers this listener non-passive.
    if (event.cancelable) event.preventDefault()

    const pull = touch.clientY - startY
    distance.value = pull > 0 ? damp(pull) : 0
  }

  const onTouchEnd = async () => {
    if (!decided) return cancel()
    cancel()
    if (distance.value < THRESHOLD) return retract()

    // No handler means no view claimed the gesture, so the fallback is the
    // browser's: reload. That is the one outcome the gesture can reach by
    // accident and cannot take back, so the first pull only says what the next
    // one will do; the second, inside the window, does it - and lets the logo
    // turn first, because a reload is not something this code can wait on.
    if (!handler) {
      if (!armed.value) {
        arm()
        return retract()
      }
      disarm()
      state.value = 'refreshing'
      distance.value = RESTING
      setTimeout(() => window.location.reload(), RELOAD_SPIN)
      return
    }

    disarm()
    state.value = 'refreshing'
    distance.value = RESTING

    const started = Date.now()
    try {
      await handler()
    } catch {
      // A failed refresh is the view's story to tell — it has the toast.
    }
    const remaining = MIN_SPIN - (Date.now() - started)
    if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining))
    retract()
  }

  return {
    state: readonly(state),
    distance: readonly(distance),
    // True between the pull that offered the reload and the one that runs it.
    armed: readonly(armed),
    disarm,
    // 0 → 1 as the pull approaches the point where releasing refreshes.
    progress: computed(() => Math.min(1, distance.value / THRESHOLD)),
    isRefreshing: computed(() => state.value === 'refreshing'),
    onTouchStart,
    onTouchMove,
    onTouchEnd,
  }
}

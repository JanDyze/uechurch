<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import mark from '../../assets/uec-mark.webp'

/**
 * The church's mark, over the gap between one page and the next.
 *
 * Every view in the router is a dynamic import, so the first visit to any of
 * them is a chunk fetch — on the mobile data this app is mostly used on, long
 * enough to leave the screen holding the page the user has already left. This
 * fills that gap with the logo instead of nothing.
 *
 * It plays uec-mark.webp, not the full reveal: at these durations the reveal
 * would only ever get through its own opening frames, which are black. The
 * mark opens on the finished logo and loops a shine across it, so however
 * briefly it appears, what appears is the logo.
 *
 * The curtain is deliberately short, and it is not waiting for the navigation
 * — the new page renders underneath it and is ready before it lifts. Its whole
 * job is to make the swap read as one movement rather than a flicker.
 */

const router = useRouter()

// How long the mark holds once a navigation starts. Short enough that a member
// clicking through the sidebar is not waiting on it, long enough that the logo
// registers as a logo rather than a flash. If it ever wears out its welcome,
// the gentler setting is to show it only when a navigation is genuinely slow:
// start a ~100ms timer in the guard below and show from that instead, so a
// warm, already-fetched chunk swaps with no curtain at all.
const HOLD = 420

const active = ref(false)
let holdTimer = null

// The mark is only in the DOM while the curtain is down, so without this the
// browser would not begin fetching it until the first navigation — and the
// first curtain, the one covering the slowest chunk fetch of the session,
// would be the one with nothing on it. Warmed when the browser is idle, so it
// never competes with the work of getting the first page up.
onMounted(() => {
  const warm = () => {
    new Image().src = mark
  }
  if (window.requestIdleCallback) window.requestIdleCallback(warm, { timeout: 3000 })
  else setTimeout(warm, 1500)
})

const stopBefore = router.beforeEach((to, from) => {
  // The projector window takes nothing of ours over it — it is on a second
  // screen in front of a congregation, and a logo swelling over a hymn is
  // exactly the interruption that route's meta exists to prevent.
  if (to.meta?.projector || from.meta?.projector) return true

  // Only a real change of page. A view that writes its search or its open tab
  // into the query string navigates constantly, and curtaining every keystroke
  // would make the app feel like it were fighting the user.
  if (to.path === from.path) return true

  // Anyone who has asked their system to stop animating things gets the swap
  // plain, the same bargain PullToRefresh strikes with its spin.
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return true

  clearTimeout(holdTimer)
  active.value = true
  return true
})

// afterEach, not a watcher on the route: it fires for a redirected, cancelled
// or failed navigation too, so a guard that bounces the user — or a chunk that
// fails to load — cannot leave the curtain down over the app.
const stopAfter = router.afterEach(() => {
  if (!active.value) return
  clearTimeout(holdTimer)
  holdTimer = setTimeout(() => {
    active.value = false
  }, HOLD)
})

onUnmounted(() => {
  clearTimeout(holdTimer)
  stopBefore()
  stopAfter()
})
</script>

<template>
  <!-- aria-hidden: the navigation announces itself through the page that
       arrives. pointer-events stay off throughout — a curtain that could
       swallow a tap is one that can strand someone if it ever fails to lift. -->
  <Transition name="rt">
    <div v-if="active" class="rt" aria-hidden="true">
      <img :src="mark" alt="" class="rt-mark" />
    </div>
  </Transition>
</template>

<style scoped>
.rt {
  position: fixed;
  inset: 0;
  /* Over the app and its sheets, under the toasts (9999) and the theme
     reveal — a toast that lands mid-navigation still has something to say. */
  z-index: 9000;
  display: grid;
  place-items: center;
  pointer-events: none;
  /* The landing's ink rather than a flat black, so the curtain belongs to this
     app rather than to the browser. Not quite opaque: the page underneath
     stays faintly legible, which keeps it reading as a transition rather than
     as a screen of its own. */
  background: rgba(6, 40, 50, 0.94);
}

:global(.dark) .rt {
  background: rgba(17, 24, 39, 0.94);
}

.rt-mark {
  width: 7rem;
  height: 7rem;
  object-fit: contain;
}

@media (min-width: 640px) {
  .rt-mark {
    width: 8.5rem;
    height: 8.5rem;
  }
}

/* In fast, out slower: the curtain should arrive before the eye notices the
   old page has gone, and leave slowly enough to hand over to the new one. */
.rt-enter-active {
  transition: opacity 0.12s ease-out;
}

.rt-leave-active {
  transition: opacity 0.22s ease-in;
}

.rt-enter-from,
.rt-leave-to {
  opacity: 0;
}

.rt-enter-active .rt-mark {
  animation: rt-settle 0.3s cubic-bezier(0.22, 1, 0.36, 1);
}

@keyframes rt-settle {
  from {
    transform: scale(0.92);
    opacity: 0;
  }
}
</style>

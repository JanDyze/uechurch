<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import reveal from '../../assets/uec-reveal.webp'
import still from '../../assets/uec-still.webp'

/**
 * The logo drawing itself in, played once.
 *
 * This is the long cut — the disc, the cross, the letters and a shine, just
 * under five seconds of it — so it belongs somewhere the eye arrives and
 * stays, not somewhere it is passing through. It stops on the finished logo
 * rather than looping, so a reader who lingers is not lapped by a second run.
 *
 * It costs 211 KB, which is more than anything else on the public page and
 * five times less than the GIF it came from. The landing page fought hard to
 * paint its hero on the first connection, so nothing here is allowed to load
 * until it is actually about to be seen: the src is empty until an observer
 * says the band has come into view, and a visitor who never scrolls that far
 * pays nothing at all.
 */

// Size comes from the caller's own classes rather than a prop, so a placement
// can be as responsive as the band around it. The clip is 384px square, so
// anything drawn up to ~192px stays sharp on a 2x screen.

const root = ref(null)
const src = ref('')

// Someone who has asked their system to stop animating things gets the last
// frame of the clip, not the clip — the same mark, just already arrived.
const reduced =
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

let observer = null

onMounted(() => {
  if (reduced) {
    src.value = still
    return
  }

  // rootMargin gives the fetch a head start, so by the time the band is on
  // screen the animation is ready to begin rather than beginning to download.
  observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return
      src.value = reveal
      observer.disconnect()
      observer = null
    },
    { rootMargin: '200px' }
  )
  observer.observe(root.value)
})

onUnmounted(() => observer?.disconnect())
</script>

<template>
  <!-- The element holds its square whether or not the clip has loaded, so the
       band around it never reflows when the animation arrives. -->
  <div ref="root" class="br">
    <Transition name="br">
      <img v-if="src" :src="src" alt="" class="br-clip" />
    </Transition>
  </div>
</template>

<style scoped>
.br {
  flex: none;
  display: grid;
  place-items: center;
}

.br-clip {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.br-enter-active {
  transition: opacity 0.4s ease-out;
}

.br-enter-from {
  opacity: 0;
}
</style>

<script setup>
import { onMounted, onUnmounted, ref } from 'vue'

// The one moment the page is about somebody in particular.
//
// Hand-rolled rather than a dependency: this is forty div elements falling
// under one CSS animation, and a confetti library would be a bigger download
// than the page it lands on. Nothing here is interactive — it sits over
// everything, catches no clicks, and takes itself off the page once it has
// finished, so the rest of the app never has to know it happened.
const PIECES = 44
const SETTLE_MS = 6200

// Church blue-greens plus the red off the dock's ringed day and one warm
// yellow, so the fall reads as this page's palette rather than party stock.
const COLORS = ['#45dcef', '#0288ac', '#e2483d', '#f5c542', '#ffffff', '#7ee8f5']

const random = (min, max) => min + Math.random() * (max - min)

const pieces = Array.from({ length: PIECES }, (_, index) => ({
  id: index,
  style: {
    left: `${random(0, 100)}%`,
    // A few sway wide of where they started, the way real paper does.
    '--drift': `${random(-14, 14)}vw`,
    '--spin': `${random(-720, 720)}deg`,
    '--fall': `${random(3.4, 5.2)}s`,
    '--delay': `${random(0, 1.4)}s`,
    '--tilt': `${random(-40, 40)}deg`,
    width: `${random(5, 9)}px`,
    height: `${random(9, 15)}px`,
    background: COLORS[index % COLORS.length],
    // Every third one is a disc instead of a strip.
    borderRadius: index % 3 === 0 ? '50%' : '1px',
  },
}))

// Falling paper is decoration with no meaning behind it, so somebody who has
// asked for less motion simply never sees it.
const showing = ref(
  typeof window === 'undefined' ||
    !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
)

let timer = null

onMounted(() => {
  if (!showing.value) return
  // Off the page once the last piece has landed: an element this size left
  // sitting over the document is a compositing layer nobody is looking at.
  timer = setTimeout(() => {
    showing.value = false
  }, SETTLE_MS)
})

onUnmounted(() => {
  if (timer) clearTimeout(timer)
})
</script>

<template>
  <div
    v-if="showing"
    class="pointer-events-none fixed inset-0 z-[60] overflow-hidden"
    aria-hidden="true"
  >
    <span v-for="piece in pieces" :key="piece.id" class="piece" :style="piece.style"></span>
  </div>
</template>

<style scoped>
.piece {
  position: absolute;
  top: -8vh;
  display: block;
  animation: fall var(--fall) linear var(--delay) forwards;
  will-change: transform, opacity;
}

@keyframes fall {
  from {
    opacity: 0;
    transform: translate3d(0, 0, 0) rotate(var(--tilt));
  }
  8% {
    opacity: 1;
  }
  85% {
    opacity: 1;
  }
  to {
    opacity: 0;
    transform: translate3d(var(--drift), 118vh, 0) rotate(var(--spin));
  }
}
</style>

<script setup>
import { computed } from 'vue'
import { useAppSettings } from '../../composables/useAppSettings'
import { usePullToRefresh } from '../../composables/usePullToRefresh'

// The mark on the puck is the church's uploaded logo, the same one the sidebar
// and the bottom bar draw, so a rebranded install spins its own logo here too.
const { logoUrl } = useAppSettings()

const { state, distance, progress, isRefreshing, onTouchStart, onTouchMove, onTouchEnd } =
  usePullToRefresh()

// App.vue owns the listeners; this component owns the gesture's state.
defineExpose({ onTouchStart, onTouchMove, onTouchEnd })

const RING = 2 * Math.PI * 19 // circumference of the r=19 progress ring

// The logo turns with the finger, and exactly one full turn is spent getting
// to the point where releasing refreshes. Landing on 360 is what makes the
// handoff invisible: the CSS spin starts from 0, so at any smaller angle the
// logo would snap backwards the instant the finger lifts.
const rotation = computed(() => Math.round(progress.value * 360))
const dashOffset = computed(() => RING * (1 - progress.value))
</script>

<template>
  <!-- aria-hidden: the gesture is a touch affordance, and the refresh it runs
       announces itself through whatever the view already shows. -->
  <div v-if="state !== 'idle'" class="ptr" aria-hidden="true">
    <div
      class="ptr-puck"
      :class="{ 'ptr-settling': state !== 'pulling' }"
      :style="{
        transform: `translate3d(-50%, ${distance}px, 0)`,
        opacity: isRefreshing ? 1 : Math.min(1, progress * 1.6),
      }"
    >
      <!-- The scale lives on its own element: the drag writes an inline
           transform on the puck, and a keyframed transform there would win the
           cascade and drop the puck back to the top of the screen mid-pull. -->
      <div class="ptr-face" :class="{ 'ptr-armed': progress >= 1, 'ptr-spinning': isRefreshing }">
        <svg class="ptr-ring" viewBox="0 0 44 44">
          <circle class="ptr-track" cx="22" cy="22" r="19" />
          <circle
            class="ptr-progress"
            cx="22"
            cy="22"
            r="19"
            :stroke-dasharray="isRefreshing ? `${RING * 0.28} ${RING}` : RING"
            :stroke-dashoffset="isRefreshing ? 0 : dashOffset"
          />
        </svg>
        <img
          :src="logoUrl"
          alt=""
          class="ptr-logo"
          :style="isRefreshing ? null : { transform: `rotate(${rotation}deg)` }"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.ptr {
  position: fixed;
  /* Above the app's own chrome - the Topbar is z-70 and the puck pulls down
     over it - but under everything that takes the screen: the Topbar's own
     dropdown backdrop and the people drawer (z-90), the notification panel and
     the more sheet (z-110), and toasts (z-9999). Those all sit on top of the
     page the gesture would refresh, and the gesture is refused inside them. */
  z-index: 80;
  top: calc(env(safe-area-inset-top) + 0.25rem);
  left: 50%;
  pointer-events: none;
}

.ptr-puck {
  position: absolute;
  /* Parked offscreen at rest, so the pull draws it down into view. */
  top: -3.5rem;
  left: 0;
  width: 2.75rem;
  height: 2.75rem;
  border-radius: 9999px;
  background: #ffffff;
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.18), 0 0 0 1px rgba(15, 23, 42, 0.05);
  transition: opacity 0.2s ease;
}

/* Only the release animates. During the drag the puck is pinned to the finger,
   and a transition there would leave it trailing behind. */
.ptr-settling {
  transition: transform 0.26s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.2s ease;
}

:global(.dark) .ptr-puck {
  background: #1f2937;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.06);
}

.ptr-face {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
}

.ptr-ring {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  /* SVG circles start at 3 o'clock; this puts the fill at the top. */
  transform: rotate(-90deg);
}

.ptr-track {
  fill: none;
  stroke: currentColor;
  stroke-width: 2.5;
  color: rgba(15, 23, 42, 0.08);
}

:global(.dark) .ptr-track {
  color: rgba(255, 255, 255, 0.1);
}

.ptr-progress {
  fill: none;
  stroke: var(--color-primary);
  stroke-width: 2.5;
  stroke-linecap: round;
  transition: stroke-dashoffset 0.12s linear;
}

.ptr-logo {
  width: 1.5rem;
  height: 1.5rem;
  object-fit: contain;
  will-change: transform;
}

/* Armed: the ring has closed, so the puck gives the one bit of feedback a
   phone can otherwise only manage with a vibration - let go now and it
   refreshes. */
.ptr-armed {
  animation: ptr-pop 0.3s ease-out;
}

@keyframes ptr-pop {
  50% {
    transform: scale(1.14);
  }
}

/* The ring carries a -90deg of its own, so its spin has to start from there or
   it snaps a quarter turn the moment the finger lifts. */
.ptr-spinning .ptr-ring {
  animation: ptr-turn-ring 0.9s linear infinite;
}

.ptr-spinning .ptr-logo {
  animation: ptr-turn 0.9s cubic-bezier(0.65, 0.05, 0.35, 1) infinite;
}

@keyframes ptr-turn {
  to {
    transform: rotate(360deg);
  }
}

@keyframes ptr-turn-ring {
  from {
    transform: rotate(-90deg);
  }
  to {
    transform: rotate(270deg);
  }
}

/* Honour a reduced-motion setting: the puck still arrives and still says the
   app is working, it just stops turning. */
@media (prefers-reduced-motion: reduce) {
  .ptr-spinning .ptr-logo,
  .ptr-spinning .ptr-ring,
  .ptr-armed {
    animation: none;
  }
}
</style>

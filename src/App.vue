<script setup>
import { useTheme } from './composables/useTheme'

const { isTransitioning, isDark, transitionOrigin } = useTheme()
</script>

<template>
  <div id="app">
    <router-view />
    
    <!-- Theme transition overlay - circular reveal -->
    <div 
      v-if="isTransitioning" 
      class="theme-circle-reveal"
      :class="isDark ? 'to-dark' : 'to-light'"
      :style="{ '--origin-x': transitionOrigin.x + 'px', '--origin-y': transitionOrigin.y + 'px' }"
    >
      <span class="theme-text" :class="isDark ? 'text-light' : 'text-dark'">
        {{ isDark ? 'Then darkness came...' : 'Let there be light!' }}
      </span>
    </div>
  </div>
</template>

<style>
#app {
  width: 100%;
  height: 100vh;
  position: relative;
}

.theme-circle-reveal {
  position: fixed;
  inset: 0;
  z-index: 9999;
  pointer-events: none;
  animation: circle-expand 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

.theme-circle-reveal.to-dark {
  background: rgba(17, 24, 39, 0.92);
}

.theme-circle-reveal.to-light {
  background: rgba(255, 255, 255, 0.92);
}

.theme-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 2.5rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  white-space: nowrap;
  opacity: 0;
  animation: text-fade 0.6s ease-out 0.1s forwards;
}

.theme-text.text-light {
  color: #fbbf24;
  text-shadow: 
    0 0 20px rgba(251, 191, 36, 0.8),
    0 4px 15px rgba(0, 0, 0, 0.5);
}

.theme-text.text-dark {
  color: #1e3a5f;
  text-shadow: 
    0 0 30px rgba(255, 255, 255, 0.9),
    0 0 60px rgba(255, 255, 255, 0.5);
}

@keyframes circle-expand {
  0% {
    clip-path: circle(0% at var(--origin-x) var(--origin-y));
  }
  100% {
    clip-path: circle(150% at var(--origin-x) var(--origin-y));
  }
}

@keyframes text-fade {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.8);
  }
  30% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
  70% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(1.05);
  }
}
</style>

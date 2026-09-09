<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Moon, Sun } from '../icons'
import GoogleSignInButton from '../components/auth/GoogleSignInButton.vue'
import { useAppSettings } from '../composables/useAppSettings'
import { useTheme } from '../composables/useTheme'
import { useToast } from '../composables/useToast'
import bundledHero from '../assets/hero-cover.webp'
import brandReveal from '../assets/uec-reveal.webp'

// The door to the app, and there is exactly one way through it.
//
// This was a split-panel layout wrapping a stack of fields — AuthLayout, which
// existed to be shared with the sign-up page. Both are gone. With no form
// there is nothing to stack, nothing for a keyboard to shove out of the way
// and no second screen to share a layout with, so the whole thing is one
// component and one composition: the room the church meets in, full bleed, the
// mark drawing itself in over it, and a single button in the thumb's reach.
//
// Wide screens get the same picture rather than a split, for the same reason —
// half a screen of white holding one button is a panel with nothing in it.

const route = useRoute()
const router = useRouter()
const toast = useToast()

const { church: churchInfo, logoUrl, hasCustomLogo, landing } = useAppSettings()
const { isDark, toggleTheme } = useTheme()

// The mark is the way back out to the church's public page — but only while
// that page is published. With the landing page turned off "/" resolves to
// this screen, so the link would go nowhere.
const showPublicLink = computed(() => landing.value.enabled !== false)

// The same picture the public page opens on, so signing in reads as walking
// further into the building rather than arriving somewhere else. Falls back to
// the bundled 54 KB webp, which is also what a signed-out reader gets: the
// rules will not answer for the settings document until they are in.
const heroImage = computed(() => landing.value.heroImage || bundledHero)

// Somebody who has asked for less motion gets the finished logo rather than
// the clip that draws it — and so does a congregation that has uploaded a mark
// of its own, since the animation is UEC's logo drawing itself and would be
// the wrong church's. Read once, the way the confetti reads it: a reader who
// changes the setting mid-sign-in is not a case worth a listener.
const reduceMotion =
  typeof window !== 'undefined' &&
  Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)

const isAnimatedMark = computed(() => !hasCustomLogo.value && !reduceMotion)
const markSrc = computed(() => (isAnimatedMark.value ? brandReveal : logoUrl.value))

const error = ref('')

// Bumped every time an error is set, and used as the banner's key: without it
// Vue reuses the same element for the next message and the shake never
// replays, so a second failed attempt looks exactly like the first.
const errorSeq = ref(0)
const fail = (message) => {
  error.value = message
  errorSeq.value += 1
}

const handleSignedIn = (user) => {
  error.value = ''
  toast.success(`Welcome, ${user.displayName || user.email}!`)
  const redirect = route.query.redirect
  router.replace(typeof redirect === 'string' ? redirect : '/dashboard')
}
</script>

<template>
  <div class="relative flex min-h-dvh flex-col overflow-hidden bg-gray-900">
    <img :src="heroImage" alt="" class="hero absolute inset-0 h-full w-full object-cover" />

    <!-- Church blue over the photograph by day, near-ink by night. The screen
         is dark either way — it has to be, for white type and a white button
         to sit on it — but the theme toggle in the corner is not a no-op. -->
    <div
      class="absolute inset-0 bg-gradient-to-b from-primary/70 via-primary/55 to-gray-900/95 dark:from-gray-900/70 dark:via-gray-900/85 dark:to-black/95"
    ></div>
    <div class="vignette absolute inset-0"></div>

    <!-- Back out to the public page. -->
    <RouterLink
      v-if="showPublicLink"
      to="/"
      :aria-label="`Go to the ${churchInfo.shortName} public page`"
      class="chip absolute left-4 z-20"
      style="top: max(1rem, env(safe-area-inset-top))"
    >
      <ArrowLeft class="h-4 w-4" />
    </RouterLink>

    <button
      class="chip absolute right-4 z-20"
      style="top: max(1rem, env(safe-area-inset-top))"
      :title="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
      :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
      @click="toggleTheme($event)"
    >
      <Sun v-if="isDark" class="h-4 w-4" />
      <Moon v-else class="h-4 w-4" />
    </button>

    <!-- On a phone the brand takes whatever room is left and the action sits
         at the bottom, where a thumb is. Given a wide screen there is no thumb
         and no fold, so the two centre together as one column. -->
    <main class="relative z-10 flex flex-1 flex-col px-6 lg:justify-center">
      <div
        class="flex flex-1 flex-col items-center justify-center pt-16 text-center lg:flex-none lg:pt-0 lg:pb-10"
      >
        <div class="halo">
          <img
            :src="markSrc"
            :alt="churchInfo.shortName"
            class="mark"
            :class="{ 'mark-flat': !isAnimatedMark }"
          />
        </div>

        <h1 class="rise mt-5 text-3xl font-black tracking-tighter text-white" style="--d: 260ms">
          {{ churchInfo.shortName }}
        </h1>
        <p
          class="rise mt-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-white/55"
          style="--d: 330ms"
        >
          {{ churchInfo.fullName }}
        </p>

        <span class="rule mt-7" style="--d: 400ms"></span>

        <p
          class="rise mt-7 max-w-xs text-sm leading-relaxed text-white/70"
          style="--d: 470ms"
        >
          Members, events, attendance and minutes — all in one place.
        </p>
      </div>

      <div
        class="mx-auto w-full max-w-sm shrink-0"
        style="padding-bottom: max(2rem, calc(env(safe-area-inset-bottom) + 1.25rem))"
      >
        <!-- Above the button, not below it: on the shortest phones anything
             under the action is the first thing to fall off the screen. -->
        <p
          v-if="error"
          :key="errorSeq"
          role="alert"
          class="alert mb-4 rounded-xl border border-red-400/30 bg-red-950/60 px-4 py-3 text-[11px] font-bold text-red-200 backdrop-blur-sm"
        >
          {{ error }}
        </p>

        <div class="rise" style="--d: 560ms">
          <GoogleSignInButton @signed-in="handleSignedIn" @error="fail($event)" />
        </div>

        <!-- What the removed "create one" link used to answer. -->
        <p
          class="rise mt-5 text-center text-[11px] font-semibold leading-relaxed text-white/45"
          style="--d: 640ms"
        >
          First time here? Signing in makes your account — ask an administrator
          to link it to your member record.
        </p>

        <p
          class="rise mt-8 text-center text-[9px] font-bold uppercase tracking-[0.2em] text-white/25"
          style="--d: 700ms"
        >
          &copy; {{ new Date().getFullYear() }} {{ churchInfo.shortName }}
        </p>
      </div>
    </main>
  </div>
</template>

<style scoped>
/* ---------------------------------------------------------------- ground */

/* A very slow push across the photograph — under a tenth of the frame, which
   at this speed reads as depth rather than as movement. The scale is also
   what keeps the drift from ever exposing an edge. */
@keyframes hero-drift {
  from {
    transform: scale(1.08) translate3d(0, 0, 0);
  }
  to {
    transform: scale(1.16) translate3d(-2%, -1.5%, 0);
  }
}

.hero {
  animation: hero-drift 30s ease-in-out infinite alternate;
}

/* Darkest at the corners, so the type in the middle keeps its contrast
   wherever the photograph happens to be bright. */
.vignette {
  background: radial-gradient(115% 75% at 50% 38%, transparent, rgba(0, 0, 0, 0.55));
}

/* ------------------------------------------------------------------ mark */

/* Sized against the viewport rather than fixed: this is the largest thing on
   the screen, and on a short phone a fixed height would push the button off
   the bottom. svh so the browser's own chrome sliding away does not resize it. */
.mark {
  width: auto;
  height: clamp(122px, 27svh, 212px);
  filter: drop-shadow(0 8px 24px rgba(0, 0, 0, 0.5));
  animation: mark-in 0.7s cubic-bezier(0.22, 1, 0.36, 1);
}

/* The clip is a square frame the logo is drawn inside and only fills about two
   thirds of it, so a church using its own flat logo needs roughly two thirds
   of the height to read the same size. The reader never sees both. */
.mark-flat {
  height: clamp(78px, 17svh, 136px);
}

@keyframes mark-in {
  from {
    opacity: 0;
    transform: scale(0.86);
  }
}

/* The light the mark sits in, breathing once every few seconds. Sized off the
   mark's own height, so it stays a circle around either version of it. */
.halo {
  position: relative;
  display: grid;
  place-items: center;
}

.halo::before {
  content: '';
  position: absolute;
  height: 165%;
  aspect-ratio: 1;
  border-radius: 9999px;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.2), transparent 66%);
  animation: halo 4.5s ease-in-out infinite;
}

@keyframes halo {
  0%,
  100% {
    opacity: 0.5;
    transform: scale(0.94);
  }
  50% {
    opacity: 1;
    transform: scale(1.06);
  }
}

/* ------------------------------------------------------------ entrances */

@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(14px);
  }
}

/* `backwards` holds the first frame through the delay, so a staggered element
   stays invisible until its turn instead of flashing in and then animating. */
.rise {
  animation: rise 0.62s cubic-bezier(0.22, 1, 0.36, 1) backwards;
  animation-delay: var(--d, 0ms);
}

/* Drawn out from the middle. The one piece of the sequence that is a line
   rather than a word, which is what stops the stagger reading as a list. */
@keyframes rule-draw {
  from {
    transform: scaleX(0);
  }
}

.rule {
  width: 3.5rem;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.45), transparent);
  animation: rule-draw 0.9s cubic-bezier(0.22, 1, 0.36, 1) backwards;
  animation-delay: var(--d, 0ms);
}

/* --------------------------------------------------------------- chips */

/* Glass, because on this screen everything sits on a photograph. */
.chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 9999px;
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.22);
  background: rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(8px);
  transition: background-color 0.2s, transform 0.2s;
}

.chip:hover {
  background: rgba(255, 255, 255, 0.2);
}

.chip:active {
  transform: scale(0.92);
}

/* --------------------------------------------------------------- alert */

/* An error arrives where the eye already is, and moves once — so a second
   failed attempt does not look identical to the first. */
@keyframes shake {
  0%,
  100% {
    transform: translateX(0);
  }
  20% {
    transform: translateX(-6px);
  }
  40% {
    transform: translateX(5px);
  }
  60% {
    transform: translateX(-3px);
  }
  80% {
    transform: translateX(2px);
  }
}

.alert {
  animation: shake 0.42s ease-in-out;
}

/* ------------------------------------------------------ reduced motion */

/* All of the above is decoration over a screen with one button on it, so a
   reader who has asked for stillness gets the finished state directly. */
@media (prefers-reduced-motion: reduce) {
  .hero,
  .mark,
  .halo::before,
  .rise,
  .rule,
  .alert {
    animation: none !important;
  }

  .hero {
    transform: scale(1.08);
  }
}
</style>

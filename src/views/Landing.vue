<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowDown,
  ArrowRight,
  Facebook,
  LogIn,
  Mail,
  MapPin,
  Moon,
  Phone,
  Loader2,
  Settings as SettingsIcon,
  Sun,
} from '../icons'
import { getMemberByUid } from '../api/membersService'
import { getDisplayName } from '../utils/memberUtils'
import { usePublicSite, initPublicSite } from '../composables/usePublicSite'
import { useAuth } from '../composables/useAuth'
import { usePermissions } from '../composables/usePermissions'
import { useTheme } from '../composables/useTheme'
import StageIcon from '../components/landing/StageIcon.vue'
import artPunla from '../assets/stage-punla.webp'
import artPuno from '../assets/stage-puno.webp'
import artPrutas from '../assets/stage-prutas.webp'
import UpcomingDock from '../components/landing/UpcomingDock.vue'
import bundledHero from '../assets/hero-cover.webp'

// The public face of the app, in Filipino — the congregation this is for reads
// Tagalog, and a visitor's first screen is the wrong place to make them read a
// second language. The service times, the address and the calendar are still
// whatever an admin typed, so those come through in their own words.
//
// Everything a congregation must supply itself is typed under
// Settings > Public page or comes from the church's own calendar and gallery,
// and a section with nothing behind it is hidden rather than shown empty.
//
// None of it can be read from Firestore by a visitor: the rules refuse
// anonymous reads, so the data arrives from /api/public. See usePublicSite.
initPublicSite()
const { church, landing, logoUrl, enabled, gatherings, photos } = usePublicSite()
const { isDark, toggleTheme } = useTheme()
const { isAuthenticated, displayName, user } = useAuth()
const { isAdmin } = usePermissions()

/* --------------------------------------------------------- the greeting */

// The names the greeting rolls through, and the two lines that follow one.
// All of it comes from Settings > Public page now: a congregation that says
// Manoy and Inday rather than Kuya and Ate should not need a deploy to say so.
const TERM_MS = 1900

// Shuffled per load rather than merely started at a random index: two people
// opening the page get a different run of names, and somebody who watches it
// for a minute is not watching the order they saw last Sunday.
const shuffled = (list) => {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

// Re-shuffled whenever the setting lands, which is after first paint: the
// settings arrive from the network, so this cannot be a one-off const.
const terms = ref([])
const termIndex = ref(0)
watch(
  () => landing.value.welcomeTerms,
  (list) => {
    terms.value = shuffled((list || []).map((name) => String(name).trim()).filter(Boolean))
    termIndex.value = 0
  },
  { immediate: true }
)
const term = computed(() => terms.value[termIndex.value] || '')

// A signed-in member gets their own name in the slot instead of a term off the
// list. Not only because it is warmer: ate/kuya, nanay/tatay and lola/lolo are
// gendered, and picking one at random for somebody the app can actually name
// would get it wrong half the time. The roll is for strangers precisely
// because nobody is being addressed yet.
// What the church actually calls them: the nickname on their member record
// when it carries one, otherwise their first name. Same rule as the lineups
// and the attendance cards, via getDisplayName — a person who is "Tope" on a
// roster should not be "Cristopher" here.
//
// Fetched by uid on its own rather than through useMyMember(), which reads the
// whole members collection. This page wants one name, not the directory.
const memberName = ref('')

watch(
  () => user.value?.uid,
  async (uid) => {
    memberName.value = ''
    if (!uid) return
    try {
      const member = await getMemberByUid(uid)
      memberName.value = member ? getDisplayName(member) : ''
    } catch (error) {
      // No approved claim, or rules that will not answer for this account.
      // The sign-in profile below is a fair enough thing to greet on.
      console.error('Error loading the member record for the greeting:', error)
    }
  },
  { immediate: true }
)

const greeting = computed(() => {
  if (!isAuthenticated.value) return ''
  if (memberName.value) return memberName.value
  // No linked record yet — fall back to the name on the sign-in itself.
  const first = displayName.value.trim().split(/\s+/)[0] || ''
  // useAuth falls back to the literal "User" for an account with neither a
  // display name nor an email to cut one from. Being greeted as "User" is
  // worse than not being greeted, so that case drops back to the roll.
  if (!first || first === 'User') return ''
  // An email-derived name arrives in the address's own case, which is
  // usually all lower.
  return first.charAt(0).toUpperCase() + first.slice(1)
})

let termTimer = null

onMounted(() => {
  // After first paint, and only in the gaps: the chunk is wanted before the
  // tap, not instead of the page.
  if (window.requestIdleCallback) window.requestIdleCallback(warmAppRoute, { timeout: 3000 })
  else setTimeout(warmAppRoute, 1200)

  startStageWalk()

  // Someone who has asked for less motion keeps the word they landed on. The
  // sentence under it carries the whole meaning either way, so nothing is
  // lost by holding still.
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  termTimer = setInterval(() => {
    if (terms.value.length < 2) return
    termIndex.value = (termIndex.value + 1) % terms.value.length
  }, TERM_MS)
})

// Auth resolves after the page has already painted, so the roll may be running
// by the time a name arrives. Once one has, there is nothing left to roll.
watch(greeting, (value) => {
  if (!value || !termTimer) return
  clearInterval(termTimer)
  termTimer = null
})

onUnmounted(() => {
  if (termTimer) clearInterval(termTimer)
  if (stripTimer) clearTimeout(stripTimer)
  stopStageWalk()
})

/* ------------------------------------------------------------- the way in */

// Members reach this page too — it is the church's public link, not a
// visitors-only door — so the calls to action point them back into the app
// instead of asking them to sign in again.
const appLink = computed(() => (isAuthenticated.value ? '/dashboard' : '/login'))

// Both targets are lazy route chunks, so the first thing a tap used to do was
// open a network request with nothing on screen to say so — which reads as a
// dead button. Two halves to the fix: the chunk is fetched while the visitor is
// still reading the page, and the button holds a spinner until the navigation
// actually leaves.
//
// Deliberately not warmed: initPermissions(), which the router guard awaits for
// a signed-in member and which subscribes to the entire members collection.
// Starting that here would download the church directory for somebody who only
// wanted to know what time the service is.
const navigating = ref(false)

const openApp = async () => {
  if (navigating.value) return
  navigating.value = true
  try {
    await router.push(appLink.value)
  } finally {
    // A push that lands unmounts this page, so this only matters when the
    // guard sent them elsewhere or the navigation was cancelled.
    navigating.value = false
  }
}

const warmAppRoute = () => {
  try {
    for (const record of router.resolve(appLink.value).matched) {
      for (const component of Object.values(record.components || {})) {
        // A lazy route is still a function here; one already resolved, or
        // statically imported like the app shell, is a component object.
        if (typeof component === 'function') component()
      }
    }
  } catch (error) {
    // Warming is an optimisation. A failure here must not cost the page.
    console.error('Error warming the app route:', error)
  }
}

// The router lets "/" through while the settings are still in flight, so the
// decision is finished here: an install that has switched the public page off
// sends its visitors to sign-in as soon as that setting lands.
const route = useRoute()
const router = useRouter()
watch(
  enabled,
  (value) => {
    if (value === false && route.query.preview === undefined) router.replace(appLink.value)
  },
  { immediate: true }
)

/* ------------------------------------------------------------------ hero */

// One photograph, bundled with the app, drawn as an arch — a window rather
// than a backdrop.
//
// This used to be a full-bleed crossfade through five gallery photos. Each one
// is a few hundred kilobytes fetched from Firebase Storage, all of them
// blocking the only thing on the screen, and on mobile data the hero stayed
// empty for seconds. Nothing above the fold waits on the network now: the arch
// is a 54 KB webp shipped in the bundle, and the hero paints on the first
// frame with or without it.
//
// The file is cover.jpg centre-cropped to the arch's 2:3 and re-encoded. The
// crop is deliberately central: the drawing is symmetrical about the aisle, so
// the middle keeps the platform and the cross and loses only tent wall.
const heroImage = computed(() => landing.value.heroImage || bundledHero)

/* -------------------------------------------------------------- sections */

const services = computed(() => (landing.value.services || []).filter((s) => s.name?.trim()))

// A stage with no name renders nothing, so it is dropped rather than drawn as
// an empty step. Same rule the service rows follow.
const path = computed(() =>
  (landing.value.path || []).filter((step) => step.stage?.trim())
)
const hasPurpose = computed(() => Boolean(landing.value.vision || landing.value.mission))

/* --------------------------------------------------- the discipleship stages

   Three stages read as three stages whether or not anybody touches them, so
   this walks itself: one is highlighted, its line is shown, and every few
   seconds it moves on. A tap takes it over and the walking stops for good —
   somebody steering does not want the page steering too. */

const STAGE_MS = 3800

const activeStage = ref(0)
let stageTimer = null

const stopStageWalk = () => {
  if (stageTimer) clearInterval(stageTimer)
  stageTimer = null
}

const pickStage = (index) => {
  activeStage.value = index
  stopStageWalk()
}

const startStageWalk = () => {
  stopStageWalk()
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  if (path.value.length < 2) return
  stageTimer = setInterval(() => {
    activeStage.value = (activeStage.value + 1) % path.value.length
  }, STAGE_MS)
}

// The stages arrive with the settings, after first paint.
watch(
  () => path.value.length,
  (count) => {
    activeStage.value = 0
    if (count > 1) startStageWalk()
    else stopStageWalk()
  }
)

const stage = computed(() => path.value[activeStage.value] || null)

// The backdrop is whichever stage is being read about, so the section grows a
// seed into a tree into fruit as the rail walks. Three separate cut-outs
// rather than one band: only one is ever shown, and each is a few kilobytes.
const STAGE_ART = [artPunla, artPuno, artPrutas]
const stageArt = computed(() => STAGE_ART[activeStage.value] || '')

// How far along the rail the fill reaches. One stage means no rail to fill.
const stageProgress = computed(() => {
  const last = path.value.length - 1
  if (last < 1) return 0
  return (activeStage.value / last) * 100
})
const hasContact = computed(() =>
  Boolean(landing.value.phone || landing.value.email || landing.value.facebook)
)
const hasVisit = computed(() => Boolean(landing.value.address) || hasContact.value)
const visitAnchor = computed(() => (services.value.length ? 'gather' : 'visit'))

// The address doubles as a map search when no explicit link is set, so filling
// in one field is enough to get a working "Kunin ang direksyon".
const mapHref = computed(() => {
  if (landing.value.mapUrl) return landing.value.mapUrl
  if (!landing.value.address) return ''
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(landing.value.address)}`
})

// The hero button, and the closing band, both aim at whatever the page can
// actually tell a visitor about turning up. With neither section filled in
// there is nothing to scroll to, so the button is not drawn at all.
const canPlanVisit = computed(() => services.value.length > 0 || hasVisit.value)
const scrollToVisit = () => {
  document.getElementById(visitAnchor.value)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// The gallery strip, in the order the server shuffled it. Every photo below is
// lazy, and none of them are in the way of first paint.
const gallery = computed(() => photos.value.slice(0, 6))

// The same photographs twice. The track is animated exactly half its width,
// so the copy is what the eye lands on when the first run has gone by — which
// is the whole trick behind a loop with no seam. The duplicates are hidden
// from assistive tech, since they are the same pictures said again.
const loopedGallery = computed(() => [...gallery.value, ...gallery.value])

// The strip drifts on its own, but it is still a strip: somebody who wants to
// go back to a photograph should be able to drag it there. Touching it or
// scrolling it hands control over, and it picks up again a couple of seconds
// after they stop — long enough not to fight a slow look, short enough that
// the band does not simply stop forever on the first touch.
//
// A pointer resting on it is handled in CSS instead, which holds for as long
// as it stays there rather than on a timer.
const HOLD_MS = 2500

const stripHeld = ref(false)
let stripTimer = null

const holdStrip = () => {
  stripHeld.value = true
  if (stripTimer) clearTimeout(stripTimer)
  stripTimer = setTimeout(() => {
    stripHeld.value = false
  }, HOLD_MS)
}

// Sections are numbered down the margin, and which numbers exist depends on
// what the church has filled in — so they are counted rather than written out.
const sectionNumbers = computed(() => {
  let n = 0
  const next = () => String(++n).padStart(2, '0')
  return {
    // In the order they are read down the page, which is what the numbers
    // are for — vision and mission moved below the photographs.
    path: path.value.length ? next() : '',
    gather: services.value.length ? next() : '',
    about: landing.value.about ? next() : '',
    life: gallery.value.length ? next() : '',
    purpose: hasPurpose.value ? next() : '',
    visit: hasVisit.value ? next() : '',
  }
})

// The gatherings list, the icons for it and the date helpers all moved into
// UpcomingDock and src/utils/publicDates.js — the page no longer lays events
// out anywhere, so nothing here needs to know how to format one.

/* ---------------------------------------------------------- admin's nudge */

// Only an administrator ever sees this, and only while the page really is a
// shell: the settings exist, they just have not been filled in, and there is
// nowhere else this would be noticed until a visitor arrives. It stays in
// English — it is a note about the Settings screen, not part of the page.
const needsSetup = computed(
  () =>
    isAdmin.value &&
    !landing.value.about &&
    !landing.value.address &&
    !services.value.length
)

const year = new Date().getFullYear()
</script>

<template>
  <!-- Warm paper rather than white, and a serif for anything that speaks. The
       app behind the sign-in is a tool and looks like one; this is a church's
       front door, and it should read like something printed. The serif is the
       system stack, so none of it costs a font download. -->
  <div class="min-h-dvh bg-[#faf8f4] text-stone-800 dark:bg-gray-900 dark:text-gray-100">
    <!-- Masthead. Always the same ink as the hero, so there is no scroll
         listener and no colour shifting underneath the reader — over the paper
         below it simply reads as a masthead. -->
    <header class="fixed inset-x-0 top-0 z-40 border-b border-white/10 bg-[#062832]">
      <div class="mx-auto flex h-16 max-w-5xl items-center gap-3 px-4 sm:px-6">
        <img :src="logoUrl" :alt="church.shortName" class="h-9 w-auto shrink-0" />
        <div class="min-w-0 flex-1">
          <p class="truncate font-serif text-lg font-semibold leading-tight text-white">
            {{ church.shortName }}
          </p>
          <p
            v-if="church.branch"
            class="truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-primary-light"
          >
            {{ church.branch }}
          </p>
        </div>

        <button
          @click="toggleTheme($event)"
          class="flex h-10 w-10 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
        >
          <Sun v-if="isDark" class="h-5 w-5" />
          <Moon v-else class="h-5 w-5" />
        </button>
        <button
          @click="openApp"
          :disabled="navigating"
          class="inline-flex h-10 shrink-0 items-center gap-1.5 border border-white/25 px-3 text-sm font-semibold text-white transition-colors hover:bg-white/10 disabled:cursor-wait sm:px-4"
        >
          <Loader2 v-if="navigating" class="h-4 w-4 animate-spin" />
          <ArrowRight v-else-if="isAuthenticated" class="h-4 w-4" />
          <LogIn v-else class="h-4 w-4" />
          <span>{{ navigating ? 'Sandali…' : isAuthenticated ? 'Open app' : 'Log in' }}</span>
        </button>
      </div>
    </header>

    <!-- Hero. No photograph behind the words — an ink ground with one arched
         window beside them, which paints on the first frame and looks like a
         church rather than a landing-page template. -->
    <section class="relative isolate overflow-hidden bg-[#062832] pt-16">
      <!-- Light through the window, and the faint arch it throws on the wall.
           Both are gradients: nothing in this layer is an image. -->
      <div
        class="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_55%_at_78%_-5%,rgba(34,184,207,0.28),transparent_72%)]"
      ></div>
      <div
        class="pointer-events-none absolute -left-24 top-24 h-[26rem] w-[26rem] rounded-t-full border border-white/[0.07]"
      ></div>

      <div
        class="relative mx-auto grid max-w-5xl gap-12 px-4 pb-16 pt-12 sm:px-6 sm:pb-20 sm:pt-16 lg:grid-cols-5 lg:items-center lg:gap-14 lg:pb-24 lg:pt-20"
      >
        <div class="lg:col-span-3">
          <!-- The greeting is the headline. The name rolls over in a slot of
               its own height, so the swap never nudges the line beneath it. -->
          <h1
            class="max-w-xl font-serif text-[2.5rem] font-semibold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-[3.5rem]"
          >
            <span class="block h-[1.25em]">
              <Transition name="roll" mode="out-in">
                <span :key="greeting || term" class="inline-block text-primary-light">
                  {{ greeting || term }},
                </span>
              </Transition>
            </span>
            <span class="block">
              {{ greeting ? landing.welcomeLineMember : landing.welcomeLine }}
            </span>
          </h1>
          <p
            v-if="landing.intro"
            class="mt-6 max-w-lg text-base leading-relaxed text-white/70 sm:text-lg"
          >
            {{ landing.intro }}
          </p>

          <!-- What is coming up used to sit here, in the middle of the one
               paragraph a stranger is trying to read. It lives in the corner
               now — see UpcomingDock — where it can wait, count itself, and
               lean out with a reminder without ever being in the way. -->

          <!-- One button. The masthead already carries the way into the app
               in both states, and a visitor's hero does not need to offer a
               staff door twice. -->
          <button
            v-if="canPlanVisit"
            @click="scrollToVisit"
            class="mt-8 inline-flex h-12 items-center gap-2 bg-primary-light px-5 text-sm font-bold text-[#062832] transition-transform active:scale-95"
          >
            Dumalaw sa amin
            <ArrowDown class="h-4 w-4" />
          </button>
        </div>

        <!-- The window. One static photograph, arched, with a hairline arch
             set off behind it. -->
        <div class="lg:col-span-2">
          <div class="relative mx-auto w-48 sm:w-60 lg:w-full lg:max-w-[19rem]">
            <div
              class="pointer-events-none absolute -inset-3 rounded-t-full border border-primary-light/25"
            ></div>
            <img
              :src="heroImage"
              :alt="church.shortName"
              fetchpriority="high"
              decoding="async"
              class="relative aspect-2/3 w-full rounded-t-full object-cover"
            />
          </div>
        </div>
      </div>
    </section>

    <!-- The verse the church gathers on. One band of brand colour, one
         sentence, nothing to click. -->
    <section
      v-if="landing.verse"
      class="bg-primary px-4 py-10 sm:px-6 sm:py-12 dark:bg-primary/15"
    >
      <blockquote class="mx-auto max-w-3xl text-center">
        <p class="font-serif text-lg italic leading-relaxed text-white sm:text-2xl">
          &ldquo;{{ landing.verse }}&rdquo;
        </p>
        <footer
          v-if="landing.verseReference"
          class="mt-4 text-[10px] font-bold uppercase tracking-[0.28em] text-white/70"
        >
          {{ landing.verseReference }}
        </footer>
      </blockquote>
    </section>

    <!-- Nobody but an administrator sees this, and only while the page is still
         a shell. -->
    <div
      v-if="needsSetup"
      class="border-b border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-900/20"
    >
      <div class="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 sm:px-6">
        <SettingsIcon class="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <p class="min-w-0 flex-1 text-xs text-amber-800 dark:text-amber-200">
          This is what visitors see. Add your service times, a few words about the church
          and where to find you.
        </p>
        <router-link
          to="/settings"
          class="shrink-0 text-xs font-bold text-amber-700 underline underline-offset-2 dark:text-amber-300"
        >
          Settings
        </router-link>
      </div>
    </div>

    <!-- Punla, Puno, Prutas — the church's own discipleship process, drawn as
         the sequence it is. Ink, like the hero: this is the one framework the
         church names itself by, and it also breaks up the paper either side. -->
    <section v-if="path.length" class="relative isolate overflow-hidden bg-[#062832]">
      <div
        class="pointer-events-none absolute inset-0 bg-[radial-gradient(55%_70%_at_85%_0%,rgba(34,184,207,0.16),transparent_70%)]"
      ></div>

      <!-- Whichever stage is active, drawn big behind the words.
           Cut out of Discipleship-Process.png one figure at a time, with the
           poster's ground keyed out by saturation — the figures are all
           strongly coloured and everything around them is pale grey, which is
           what separates them. Crossfaded, so walking the rail grows a seed
           into a tree into fruit. -->
      <Transition name="art">
        <div
          v-if="stageArt"
          :key="activeStage"
          class="pointer-events-none absolute inset-0 opacity-[0.18] sm:opacity-[0.16]"
          :style="{
            backgroundImage: `url(${stageArt})`,
            backgroundSize: 'auto min(70%, 30rem)',
            backgroundPosition: 'center 45%',
            backgroundRepeat: 'no-repeat',
            maskImage:
              'radial-gradient(60% 55% at 50% 45%, #000 40%, transparent 78%)',
            WebkitMaskImage:
              'radial-gradient(60% 55% at 50% 45%, #000 40%, transparent 78%)',
          }"
        ></div>
      </Transition>

      <div class="relative mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-24">
        <div class="flex items-baseline gap-4">
          <span class="shrink-0 font-serif text-sm tabular-nums text-primary-light">
            {{ sectionNumbers.path }}
          </span>
          <h2 class="min-w-0 font-serif text-xl font-semibold tracking-tight text-white sm:text-2xl">
            Discipleship Process
          </h2>
          <span class="hidden h-px min-w-8 flex-1 bg-white/15 sm:block"></span>
        </div>

        <!-- A rail you can walk. It advances on its own so the three stages
             read as a sequence without being touched, and hands over the
             moment somebody taps one. -->
        <div class="mt-12">
          <!-- The rail, with the fill behind the nodes. Its line sits at the
               vertical centre of a node, so both move together if either is
               resized. -->
          <div class="relative">
            <span class="absolute left-0 right-0 top-7 h-px bg-white/12"></span>
            <span
              class="absolute left-0 top-7 h-px bg-primary-light transition-all duration-500 ease-out"
              :style="{ width: stageProgress + '%' }"
            ></span>

            <ol class="relative flex items-start justify-between gap-2">
              <li v-for="(step, index) in path" :key="step.stage" class="min-w-0 flex-1">
                <button
                  @click="pickStage(index)"
                  class="group flex w-full flex-col items-center gap-2 text-center"
                  :aria-current="index === activeStage ? 'step' : undefined"
                >
                  <!-- The poster draws these stages as a seed, a tree and a
                       bunch of grapes, so the rail does too — a number told
                       you the order, which the rail already shows.
                       Sits on the section's own ink so the rail line passes
                       behind it rather than through it. -->
                  <span
                    class="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#062832] transition-all duration-300"
                    :class="
                      index === activeStage
                        ? 'scale-110 ring-1 ring-primary-light'
                        : index < activeStage
                          ? 'opacity-70'
                          : 'opacity-30'
                    "
                  >
                    <StageIcon :index="index" class="h-9 w-9" />
                  </span>
                  <span
                    class="truncate font-pixel text-[11px] uppercase transition-colors sm:text-xs"
                    :class="index === activeStage ? 'text-white' : 'text-white/40'"
                  >
                    {{ step.stage }}
                  </span>
                </button>
              </li>
            </ol>
          </div>

          <!-- What the highlighted stage means. One panel, so the stages stay
               a row and the reading stays in one place. -->
          <!-- No box around this. The stage name is the loudest thing in the
               section and the artwork behind it is its own illustration, so a
               card would only draw a line between the two. -->
          <div v-if="stage" class="mt-12 min-h-32 text-center">
            <Transition name="stage" mode="out-in">
              <div :key="stage.stage">
                <h3
                  class="font-pixel text-4xl uppercase leading-none text-white sm:text-6xl lg:text-7xl"
                >
                  {{ stage.stage }}
                </h3>
                <p
                  v-if="stage.note"
                  class="mx-auto mt-5 max-w-md text-sm leading-relaxed text-white/60 sm:text-base"
                >
                  {{ stage.note }}
                </p>
              </div>
            </Transition>
          </div>

          <!-- The verse the church prints under these three stages. Left in
               the markup rather than the settings: it is part of what the
               framework *is*, the way the stage names are. -->
          <blockquote class="mt-10 border-t border-white/10 pt-6">
            <p class="max-w-2xl font-serif text-sm italic leading-relaxed text-white/55 sm:text-base">
              &ldquo;Ang mabuting lupang hinasikan ng punla ay ang taong nakikinig sa Salita ng
              Dios, at iniingatan ito sa kanilang puso at pinagsisikapang sundin hanggang sila
              ay mamunga.&rdquo;
            </p>
            <footer class="mt-2 text-[10px] font-bold uppercase tracking-[0.28em] text-primary-light">
              Lucas 8:15
            </footer>
          </blockquote>
        </div>
      </div>
    </section>

    <!-- Kailan kami nagtitipon. Set like an order of service rather than as
         cards: name, leader dots, time. -->
    <section
      v-if="services.length"
      id="gather"
      class="scroll-mt-20 border-y border-stone-200 bg-white dark:border-gray-800 dark:bg-gray-800/30"
    >
      <div class="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-20">
        <div class="flex items-baseline gap-4">
          <span class="shrink-0 font-serif text-sm tabular-nums text-primary dark:text-primary-light">
            {{ sectionNumbers.gather }}
          </span>
          <h2 class="min-w-0 font-serif text-xl font-semibold tracking-tight sm:text-2xl">
            Kailan kami nagtitipon
          </h2>
          <span class="hidden h-px min-w-8 flex-1 bg-stone-300 sm:block dark:bg-gray-800"></span>
        </div>

        <ul class="mt-8">
          <li
            v-for="(service, index) in services"
            :key="`service-${index}`"
            class="border-b border-dashed border-stone-300 py-5 dark:border-gray-700"
          >
            <!-- On a phone the time goes under the name, on its own line.
                 It used to sit beside it, and with the leader dots hidden at
                 that width every time started wherever its name happened to
                 end — three rows, three different left edges. Stacked, they
                 all start in the same place. From sm up there is room for the
                 dots, so the printed-programme reading comes back. -->
            <div class="sm:flex sm:items-baseline sm:gap-3">
              <p class="font-serif text-lg font-semibold leading-tight sm:text-xl">
                {{ service.name }}
              </p>
              <span
                class="hidden h-px flex-1 self-end bg-[radial-gradient(circle,currentColor_1px,transparent_1px)] bg-[length:6px_1px] bg-repeat-x text-stone-300 dark:text-gray-700 sm:block"
              ></span>
              <p
                v-if="service.when"
                class="mt-1 text-sm font-bold text-primary dark:text-primary-light sm:mt-0 sm:shrink-0"
              >
                {{ service.when }}
              </p>
            </div>
            <p v-if="service.note" class="mt-1.5 text-sm text-stone-500 dark:text-gray-400">
              {{ service.note }}
            </p>
          </li>
        </ul>
      </div>
    </section>

    <!-- Sino kami -->
    <section
      v-if="landing.about"
      class="border-y border-stone-200 bg-white dark:border-gray-800 dark:bg-gray-800/30"
    >
      <div class="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-20">
        <div class="flex items-baseline gap-4">
          <span class="shrink-0 font-serif text-sm tabular-nums text-primary dark:text-primary-light">
            {{ sectionNumbers.about }}
          </span>
          <h2 class="min-w-0 font-serif text-xl font-semibold tracking-tight sm:text-2xl">
            {{ landing.aboutTitle || 'Sino kami' }}
          </h2>
          <span class="hidden h-px min-w-8 flex-1 bg-stone-300 sm:block dark:bg-gray-800"></span>
        </div>
        <p
          class="mt-8 max-w-2xl whitespace-pre-line font-serif text-lg leading-relaxed text-stone-600 dark:text-gray-300"
        >
          {{ landing.about }}
        </p>
      </div>
    </section>

    <!-- Buhay sa simbahan, sa mga larawang ibinahagi ng admin album by album.
         Every one of these is lazy and below the fold: nothing here is in the
         way of the hero. -->
    <section v-if="gallery.length" class="py-14 sm:py-20">
      <div class="mx-auto max-w-5xl px-4 sm:px-6">
        <div class="flex items-baseline gap-4">
          <span class="shrink-0 font-serif text-sm tabular-nums text-primary dark:text-primary-light">
            {{ sectionNumbers.life }}
          </span>
          <h2 class="min-w-0 font-serif text-xl font-semibold tracking-tight sm:text-2xl">
            Buhay sa simbahan
          </h2>
          <span class="hidden h-px min-w-8 flex-1 bg-stone-300 sm:block dark:bg-gray-800"></span>
        </div>
      </div>

      <!-- One long strip that never ends.
           The list is laid out twice and the track slides exactly half its
           own width before repeating, so the second copy is already in the
           first one's place when it snaps back — the loop has no seam and no
           jump. Full-bleed rather than boxed: a band running off both edges
           is what says it carries on.

           It pauses under the pointer, so anything worth looking at can be
           looked at, and holds still for anyone who has asked for less
           motion. -->
      <div
        class="marquee no-scrollbar mt-8 overflow-x-auto"
        :class="{ 'is-held': stripHeld }"
        @pointerdown="holdStrip"
        @scroll.passive="holdStrip"
      >
        <div class="marquee-track flex w-max gap-3 pl-3 sm:gap-4 sm:pl-4">
          <figure
            v-for="(photo, index) in loopedGallery"
            :key="`${photo.id}-${index}`"
            class="relative w-60 shrink-0 overflow-hidden sm:w-72"
            :aria-hidden="index >= gallery.length"
          >
            <img
              :src="photo.url"
              :alt="photo.album || ''"
              loading="lazy"
              decoding="async"
              class="aspect-4/3 w-full object-cover"
            />
            <figcaption
              v-if="photo.album"
              class="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-[#062832]/85 to-transparent px-3 pb-2.5 pt-8 text-xs font-semibold text-white"
            >
              {{ photo.album }}
            </figcaption>
          </figure>
        </div>
      </div>
    </section>

    <!-- Vision and mission.
         Two statements, side by side, in the hairline grid the rest of the
         page already uses for a pair of related things. It was a pair of
         cards you turned over: a flip is a nice trick the first time and an
         obstacle every time after, and these are two sentences somebody
         should be able to read without being asked to play with them.

         Placed after the photographs on purpose. It is what the church says
         about itself, which lands better once a visitor has seen the room and
         the people in it. -->
    <section v-if="hasPurpose" class="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-20">
      <div class="flex items-baseline gap-4">
        <span class="shrink-0 font-serif text-sm tabular-nums text-primary dark:text-primary-light">
          {{ sectionNumbers.purpose }}
        </span>
        <h2 class="min-w-0 font-serif text-xl font-semibold tracking-tight sm:text-2xl">
          Vision &amp; Mission
        </h2>
        <span
          class="hidden h-px min-w-8 flex-1 bg-stone-300 sm:block dark:bg-gray-800"
        ></span>
      </div>

      <div
        class="mt-8 grid gap-px overflow-hidden border border-stone-200 bg-stone-200 dark:border-gray-800 dark:bg-gray-800 sm:grid-cols-2"
      >
        <div v-if="landing.vision" class="bg-[#faf8f4] p-6 dark:bg-gray-900 sm:p-8">
          <p
            class="text-[10px] font-bold uppercase tracking-[0.28em] text-primary dark:text-primary-light"
          >
            Vision
          </p>
          <p class="mt-3 font-serif text-xl leading-snug sm:text-2xl">{{ landing.vision }}</p>
        </div>
        <div v-if="landing.mission" class="bg-[#faf8f4] p-6 dark:bg-gray-900 sm:p-8">
          <p
            class="text-[10px] font-bold uppercase tracking-[0.28em] text-primary dark:text-primary-light"
          >
            Mission
          </p>
          <p class="mt-3 font-serif text-xl leading-snug sm:text-2xl">{{ landing.mission }}</p>
        </div>
      </div>
    </section>

    <!-- Saan kami matatagpuan -->
    <section
      v-if="hasVisit"
      id="visit"
      class="mx-auto max-w-5xl scroll-mt-20 px-4 py-14 sm:px-6 sm:py-20"
    >
      <div class="flex items-baseline gap-4">
        <span class="shrink-0 font-serif text-sm tabular-nums text-primary dark:text-primary-light">
          {{ sectionNumbers.visit }}
        </span>
        <h2 class="min-w-0 font-serif text-xl font-semibold tracking-tight sm:text-2xl">
          Saan kami matatagpuan
        </h2>
        <span class="hidden h-px min-w-8 flex-1 bg-stone-300 sm:block dark:bg-gray-800"></span>
      </div>

      <div
        class="mt-8 grid gap-px overflow-hidden border border-stone-200 bg-stone-200 dark:border-gray-800 dark:bg-gray-800 sm:grid-cols-2"
      >
        <div v-if="landing.address" class="bg-[#faf8f4] p-5 dark:bg-gray-900 sm:col-span-2 sm:p-6">
          <div class="flex items-start gap-3">
            <MapPin class="mt-0.5 h-5 w-5 shrink-0 text-primary dark:text-primary-light" />
            <div class="min-w-0">
              <p class="whitespace-pre-line font-serif text-lg font-semibold leading-snug">
                {{ landing.address }}
              </p>
              <a
                v-if="mapHref"
                :href="mapHref"
                target="_blank"
                rel="noopener noreferrer"
                class="mt-2 inline-flex items-center gap-1 text-sm font-bold text-primary dark:text-primary-light"
              >
                Kunin ang direksyon
                <ArrowRight class="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>

        <a
          v-if="landing.phone"
          :href="`tel:${landing.phone}`"
          class="flex items-center gap-3 bg-[#faf8f4] p-5 transition-colors hover:bg-white dark:bg-gray-900 dark:hover:bg-gray-800/60 sm:p-6"
        >
          <Phone class="h-5 w-5 shrink-0 text-primary dark:text-primary-light" />
          <span class="min-w-0 truncate text-sm font-semibold">{{ landing.phone }}</span>
        </a>

        <a
          v-if="landing.email"
          :href="`mailto:${landing.email}`"
          class="flex items-center gap-3 bg-[#faf8f4] p-5 transition-colors hover:bg-white dark:bg-gray-900 dark:hover:bg-gray-800/60 sm:p-6"
        >
          <Mail class="h-5 w-5 shrink-0 text-primary dark:text-primary-light" />
          <span class="min-w-0 truncate text-sm font-semibold">{{ landing.email }}</span>
        </a>

        <a
          v-if="landing.facebook"
          :href="landing.facebook"
          target="_blank"
          rel="noopener noreferrer"
          class="flex items-center gap-3 bg-[#faf8f4] p-5 transition-colors hover:bg-white dark:bg-gray-900 dark:hover:bg-gray-800/60 sm:p-6"
        >
          <Facebook class="h-5 w-5 shrink-0 text-primary dark:text-primary-light" />
          <span class="min-w-0 truncate text-sm font-semibold">Sundan kami sa Facebook</span>
        </a>
      </div>
    </section>

    <!-- The last word. The hero's ink and its arch again, closing the page
         where it opened. -->
    <section v-if="canPlanVisit" class="relative isolate overflow-hidden bg-[#062832]">
      <div
        class="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_70%_at_15%_110%,rgba(34,184,207,0.22),transparent_70%)]"
      ></div>
      <div
        class="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-t-full border border-white/[0.07]"
      ></div>

      <div class="relative mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-24">
        <h2
          class="max-w-xl font-serif text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl"
        >
          {{ landing.closingTitle }}
        </h2>
        <p v-if="landing.closingBody" class="mt-4 text-base text-white/70">
          {{ landing.closingBody }}
        </p>
        <div class="mt-8 flex flex-wrap gap-3">
          <a
            v-if="mapHref"
            :href="mapHref"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex h-12 items-center gap-2 bg-primary-light px-5 text-sm font-bold text-[#062832] transition-transform active:scale-95"
          >
            <MapPin class="h-4 w-4" />
            Kunin ang direksyon
          </a>
          <a
            v-if="landing.email"
            :href="`mailto:${landing.email}`"
            class="inline-flex h-12 items-center gap-2 border border-white/30 px-5 text-sm font-bold text-white transition-colors hover:bg-white/10"
          >
            <Mail class="h-4 w-4" />
            Magpadala ng mensahe
          </a>
        </div>
      </div>
    </section>

    <!-- What's coming up, parked in the corner. Last in the markup and fixed
         in place, so it floats over the page without displacing any of it. -->
    <UpcomingDock :gatherings="gatherings" />

    <!-- Footer -->
    <footer class="border-t border-stone-200 dark:border-gray-800">
      <div
        class="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6"
      >
        <div class="min-w-0">
          <p class="font-serif text-base font-semibold">{{ church.fullName }}</p>
          <p v-if="church.branch" class="text-xs text-stone-500 dark:text-gray-400">
            {{ church.branch }}
          </p>
        </div>
        <p class="text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-400">
          &copy; {{ year }} {{ church.shortName }}
        </p>
      </div>
    </footer>
  </div>
</template>

<style scoped>
/* The photograph strip runs forever.
   width: max-content on the track is what lets it be wider than the screen;
   translating it -50% lands the second copy exactly where the first began.
   The duration scales with nothing — it is a fixed, slow drift, because the
   point is atmosphere rather than getting to the end. */
.marquee-track {
  animation: marquee 52s linear infinite;
}

/* A pointer resting on it holds it for as long as it rests; a touch or a
   drag holds it through the class above, which lets go on its own. */
.marquee:hover .marquee-track,
.marquee.is-held .marquee-track {
  animation-play-state: paused;
}

@keyframes marquee {
  to {
    transform: translateX(-50%);
  }
}

/* The backdrop crossfades between stages. Both figures are present for the
   length of it, which is what makes one dissolve into the next rather than
   the section flashing empty between them. */
.art-enter-active,
.art-leave-active {
  transition: opacity 600ms ease;
}

.art-enter-from,
.art-leave-to {
  opacity: 0 !important;
}

/* The stage panel changes text rather than position, so it crossfades in
   place instead of sliding — the rail above it is what shows movement. */
.stage-enter-active,
.stage-leave-active {
  transition: opacity 200ms ease, transform 240ms cubic-bezier(0.22, 1, 0.36, 1);
}

.stage-enter-from {
  opacity: 0;
  transform: translateY(0.4rem);
}

.stage-leave-to {
  opacity: 0;
  transform: translateY(-0.4rem);
}

@media (prefers-reduced-motion: reduce) {
  /* Held still. It already scrolls, so nothing is lost by stopping it. */
  .marquee-track {
    animation: none;
  }

  .stage-enter-active,
  .stage-leave-active {
    transition-duration: 1ms;
  }
}

/* The kinship word rolls over: the old one lifts out, the new one rises in.
   The transition runs "out-in", so the two halves are kept short — this is a
   wink, not a performance. The fixed-height box around it is what stops the
   swap from nudging the line under it. */
.roll-enter-active,
.roll-leave-active {
  transition: opacity 220ms ease, transform 260ms cubic-bezier(0.22, 1, 0.36, 1);
}

.roll-enter-from {
  opacity: 0;
  transform: translateY(0.45em);
}

.roll-leave-to {
  opacity: 0;
  transform: translateY(-0.45em);
}
</style>

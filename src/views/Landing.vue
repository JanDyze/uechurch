<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowDown,
  ArrowRight,
  BookOpen,
  Calendar,
  Church,
  Clock,
  Facebook,
  HandHeart,
  HeartHandshake,
  LogIn,
  Mail,
  MapPin,
  Moon,
  PartyPopper,
  Phone,
  Settings as SettingsIcon,
  Sparkles,
  Sun,
  Users,
} from '../icons'
import { usePublicSite, initPublicSite } from '../composables/usePublicSite'
import { useAuth } from '../composables/useAuth'
import { usePermissions } from '../composables/usePermissions'
import { useTheme } from '../composables/useTheme'
import { formatTime } from '../../lib/occurrences'
import bundledHero from '../assets/church.jpg'

// The public face of the app. Everything on this page is typed by an admin
// under Settings > Public page or comes from the church's own calendar and
// gallery, so a section with nothing behind it is hidden rather than shown
// empty. A brand-new install still reads as a finished page because the copy —
// not the details only a congregation can supply — has defaults.
//
// None of it can be read from Firestore by a visitor: the rules refuse
// anonymous reads, so the data arrives from /api/public. See usePublicSite.
initPublicSite()
const { church, landing, logoUrl, enabled, gatherings, photos } = usePublicSite()
const { isDark, toggleTheme } = useTheme()
const { isAuthenticated } = useAuth()
const { isAdmin } = usePermissions()

// Members reach this page too — it is the church's public link, not a
// visitors-only door — so the two calls to action point them back into the app
// instead of asking them to sign in again.
const appLink = computed(() => (isAuthenticated.value ? '/dashboard' : '/login'))

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

// The hero rotates through the photos an admin has shared from the gallery, so
// the page shows the congregation rather than a stock building. With none
// shared it falls back to the uploaded hero photo, and then to the bundled one.
const HERO_SLOTS = 5
const ROTATE_MS = 7000

const shuffle = (list) => {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

// Shuffled again here, on top of the server's own shuffle: the payload is
// cached at the edge for minutes at a time, and this is what makes two visits
// inside that window look different.
const deck = ref([])
watch(photos, (list) => (deck.value = shuffle(list)), { immediate: true })

const heroImages = computed(() => {
  const shared = deck.value.slice(0, HERO_SLOTS).map((photo) => photo.url)
  if (shared.length) return shared
  return [landing.value.heroImage || bundledHero]
})

const slide = ref(0)
let rotation = null

// Which slides have been asked for. A gallery photo is a few hundred kilobytes,
// and drawing all five at once — even at opacity 0 — downloads all five before
// the page has said hello, on a phone, on mobile data. So the next one is
// fetched a turn ahead of when it is needed, and somebody who reads the hero
// and leaves has paid for two photos rather than five.
const primed = ref([0, 1])
const prime = (index) => {
  const count = heroImages.value.length
  if (!count) return
  const wrapped = ((index % count) + count) % count
  if (!primed.value.includes(wrapped)) primed.value = [...primed.value, wrapped]
}

const startRotation = () => {
  stopRotation()
  // Someone who has asked for less motion gets the first photo and no
  // crossfade, which is the whole of what this does.
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  rotation = setInterval(() => {
    const count = heroImages.value.length
    if (count < 2) return
    slide.value = (slide.value + 1) % count
    prime(slide.value + 1)
  }, ROTATE_MS)
}
const stopRotation = () => {
  if (rotation) clearInterval(rotation)
  rotation = null
}

const showSlide = (index) => {
  slide.value = index
  prime(index + 1)
}

// The photos arrive after first paint, so the hero starts on the fallback and
// restarts here once there is a deck to show.
watch(heroImages, () => {
  slide.value = 0
  primed.value = [0, 1]
})

/* ----------------------------------------------------------- page chrome */

// The header sits over the hero and only draws its own background once the
// page has moved, so the photo starts at the very top of the screen.
const scrolled = ref(false)
const onScroll = () => {
  scrolled.value = window.scrollY > 24
}

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()
  startRotation()
})

onUnmounted(() => {
  window.removeEventListener('scroll', onScroll)
  stopRotation()
})

/* -------------------------------------------------------------- sections */

const services = computed(() => (landing.value.services || []).filter((s) => s.name?.trim()))
const hasContact = computed(() =>
  Boolean(landing.value.phone || landing.value.email || landing.value.facebook)
)
const hasVisit = computed(() => Boolean(landing.value.address) || hasContact.value)
const visitAnchor = computed(() => (services.value.length ? 'gather' : 'visit'))

// The address doubles as a map search when no explicit link is set, so filling
// in one field is enough to get a working "Get directions".
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

/* ----------------------------------------------------- upcoming gatherings */

const TYPE_ICONS = {
  worship: Church,
  prayer: HandHeart,
  fellowship: Users,
  outreach: HeartHandshake,
  celebration: PartyPopper,
  special: Sparkles,
  training: BookOpen,
}
const iconFor = (type) => TYPE_ICONS[type] || Calendar

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// Built from the date parts rather than parsed: `new Date("2026-08-30")` is
// UTC midnight, which reads as the day before anywhere west of Greenwich.
const dateOf = (value) => {
  const [year, month, day] = String(value || '').split('-').map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
}

const monthOf = (value) => {
  const date = dateOf(value)
  return date ? MONTHS[date.getMonth()] : ''
}
const dayOf = (value) => {
  const date = dateOf(value)
  return date ? date.getDate() : ''
}

/** "Today", "This Sunday", "Sun 13 Oct" — how anyone would actually say it. */
const dayLabel = (value) => {
  const date = dateOf(value)
  if (!date) return ''
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const days = Math.round((date - today) / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days < 7) return `This ${WEEKDAYS[date.getDay()]}`
  return `${WEEKDAYS[date.getDay()].slice(0, 3)} ${date.getDate()} ${MONTHS[date.getMonth()]}`
}

// A weekly service is published once, as its next date, so what a visitor
// needs to read is how often it comes round rather than which Sunday this
// happens to be. Anything one-off says when it is instead.
const whenLine = (gathering) =>
  [gathering.cadence || dayLabel(gathering.date), formatTime(gathering.time)]
    .filter(Boolean)
    .join(' · ')

const nextGathering = computed(() => gatherings.value[0] || null)

/* ---------------------------------------------------------- admin's nudge */

// Only an administrator ever sees this, and only while the page really is a
// shell: the settings exist, they just have not been filled in, and there is
// nowhere else this would be noticed until a visitor arrives.
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
  <div class="min-h-dvh bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
    <!-- Header: the logo and the way in. Fixed, so "Sign in" is never more than
         a thumb away, and transparent until the page has moved. -->
    <header
      :class="[
        'fixed inset-x-0 top-0 z-40 transition-colors duration-300',
        scrolled
          ? 'border-b border-gray-200/80 dark:border-gray-800 bg-white/90 dark:bg-gray-900/90 backdrop-blur'
          : 'border-b border-transparent',
      ]"
    >
      <div class="mx-auto flex h-16 max-w-5xl items-center gap-3 px-4 sm:px-6">
        <img
          :src="logoUrl"
          :alt="church.shortName"
          class="h-9 w-auto shrink-0"
          :class="scrolled ? '' : 'drop-shadow-lg'"
        />
        <div class="min-w-0 flex-1">
          <p
            class="truncate text-sm font-bold leading-tight transition-colors"
            :class="scrolled ? '' : 'text-white drop-shadow'"
          >
            {{ church.shortName }}
          </p>
          <p
            v-if="church.branch"
            class="truncate text-[10px] font-semibold uppercase tracking-widest transition-colors"
            :class="scrolled ? 'text-gray-400' : 'text-white/70 drop-shadow'"
          >
            {{ church.branch }}
          </p>
        </div>

        <button
          @click="toggleTheme($event)"
          class="flex h-10 w-10 items-center justify-center rounded-full transition-colors"
          :class="
            scrolled
              ? 'text-primary dark:text-primary-light hover:bg-gray-100 dark:hover:bg-gray-800'
              : 'text-white hover:bg-white/15'
          "
          :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
        >
          <Sun v-if="isDark" class="h-5 w-5" />
          <Moon v-else class="h-5 w-5" />
        </button>
        <router-link
          :to="appLink"
          class="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg px-3 sm:px-4 text-sm font-semibold shadow-sm transition-transform active:scale-95"
          :class="scrolled ? 'bg-primary text-white' : 'bg-white/95 text-gray-900'"
        >
          <ArrowRight v-if="isAuthenticated" class="h-4 w-4" />
          <LogIn v-else class="h-4 w-4" />
          <span>{{ isAuthenticated ? 'Open app' : 'Sign in' }}</span>
        </router-link>
      </div>
    </header>

    <!-- Hero -->
    <section class="relative isolate flex min-h-[92svh] flex-col justify-end overflow-hidden">
      <div class="absolute inset-0 -z-10">
        <template v-for="(src, index) in heroImages" :key="src">
          <img
            v-if="primed.includes(index)"
            :src="src"
            alt=""
            :fetchpriority="index === 0 ? 'high' : 'low'"
            class="absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ease-in-out"
            :class="index === slide ? 'opacity-100' : 'opacity-0'"
          />
        </template>
        <div
          class="absolute inset-0 bg-gradient-to-b from-gray-950/75 via-gray-950/45 to-gray-950/90"
        ></div>
      </div>

      <div class="relative mx-auto w-full max-w-5xl px-4 pb-16 pt-28 sm:px-6 sm:pb-24">
        <!-- The one thing a stranger most wants to know: when could I come? -->
        <div
          v-if="nextGathering"
          class="mb-6 inline-flex max-w-full items-center gap-2 rounded-full border border-white/25 bg-white/10 py-1.5 pl-3 pr-4 text-xs font-semibold text-white backdrop-blur"
        >
          <Clock class="h-3.5 w-3.5 shrink-0" />
          <span class="truncate">
            {{ dayLabel(nextGathering.date) }}
            <span class="text-white/60">·</span>
            {{ nextGathering.title }}
            <template v-if="formatTime(nextGathering.time)">
              <span class="text-white/60">·</span>
              {{ formatTime(nextGathering.time) }}
            </template>
          </span>
        </div>

        <p class="text-[10px] font-black uppercase tracking-[0.2em] text-white/70">
          {{ church.fullName }}
        </p>
        <h1
          class="mt-3 max-w-2xl text-[2.6rem] sm:text-6xl font-black leading-[1.02] tracking-tighter text-white"
        >
          {{ landing.tagline }}
        </h1>
        <p
          v-if="landing.intro"
          class="mt-5 max-w-xl text-base sm:text-lg leading-relaxed text-white/80"
        >
          {{ landing.intro }}
        </p>

        <div class="mt-8 flex flex-wrap items-center gap-3">
          <button
            v-if="canPlanVisit"
            @click="scrollToVisit"
            class="inline-flex h-12 items-center gap-2 rounded-xl bg-white px-5 text-sm font-bold text-gray-900 shadow-lg transition-transform active:scale-95"
          >
            Plan your visit
            <ArrowDown class="h-4 w-4" />
          </button>
          <router-link
            :to="appLink"
            class="inline-flex h-12 items-center gap-2 rounded-xl border border-white/40 px-5 text-sm font-bold text-white transition-colors hover:bg-white/10"
          >
            {{ isAuthenticated ? 'Go to dashboard' : 'Member sign in' }}
          </router-link>
        </div>

        <!-- Which photo of the rotation is showing, and a way to skip ahead. -->
        <div v-if="heroImages.length > 1" class="mt-10 flex items-center gap-2">
          <button
            v-for="(src, index) in heroImages"
            :key="`dot-${src}`"
            @click="showSlide(index)"
            class="h-1.5 rounded-full transition-all"
            :class="index === slide ? 'w-6 bg-white' : 'w-1.5 bg-white/40 hover:bg-white/70'"
            :aria-label="`Show photo ${index + 1}`"
          ></button>
        </div>
      </div>
    </section>

    <!-- Nobody but an administrator sees this, and only while the page is still
         a shell. -->
    <div v-if="needsSetup" class="border-b border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-900/20">
      <div class="mx-auto flex max-w-5xl items-center gap-3 px-4 sm:px-6 py-3">
        <SettingsIcon class="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <p class="min-w-0 flex-1 text-xs text-amber-800 dark:text-amber-200">
          This is what visitors see. Add your service times, a few words about the church
          and where to find you.
        </p>
        <router-link
          to="/settings"
          class="shrink-0 text-xs font-bold text-amber-700 dark:text-amber-300 underline underline-offset-2"
        >
          Settings
        </router-link>
      </div>
    </div>

    <!-- Service times -->
    <section
      v-if="services.length"
      id="gather"
      class="mx-auto max-w-5xl scroll-mt-20 px-4 sm:px-6 py-14 sm:py-20"
    >
      <h2 class="text-[10px] font-black uppercase tracking-[0.2em] text-primary dark:text-primary-light">
        When we gather
      </h2>
      <p class="mt-2 text-2xl sm:text-3xl font-black tracking-tight">You are welcome to join us</p>

      <ul class="mt-8 grid gap-3 sm:grid-cols-2">
        <li
          v-for="(service, index) in services"
          :key="`service-${index}`"
          class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800/60 p-5"
        >
          <div class="flex items-start gap-3">
            <div class="mt-0.5 shrink-0 rounded-lg bg-primary/10 p-2">
              <Clock class="h-5 w-5 text-primary dark:text-primary-light" />
            </div>
            <div class="min-w-0">
              <p class="text-base font-bold leading-tight">{{ service.name }}</p>
              <p v-if="service.when" class="mt-1 text-sm font-semibold text-primary dark:text-primary-light">
                {{ service.when }}
              </p>
              <p v-if="service.note" class="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
                {{ service.note }}
              </p>
            </div>
          </div>
        </li>
      </ul>
    </section>

    <!-- What's coming up. Titles and times only: the server never publishes
         where a gathering meets, because some of them meet at a member's
         house. The one address on this page is the church's own, below. -->
    <section
      v-if="gatherings.length"
      class="border-y border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40"
    >
      <div class="mx-auto max-w-5xl px-4 sm:px-6 py-14 sm:py-20">
        <h2 class="text-[10px] font-black uppercase tracking-[0.2em] text-primary dark:text-primary-light">
          What's coming up
        </h2>
        <p class="mt-2 text-2xl sm:text-3xl font-black tracking-tight">The weeks ahead</p>

        <ul class="mt-8 space-y-2.5">
          <li
            v-for="gathering in gatherings"
            :key="gathering.id"
            class="flex items-center gap-4 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/60 p-4"
          >
            <div
              class="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-primary/10 text-primary dark:text-primary-light"
            >
              <span class="text-[10px] font-black uppercase tracking-wider">
                {{ monthOf(gathering.date) }}
              </span>
              <span class="text-xl font-black leading-none">{{ dayOf(gathering.date) }}</span>
            </div>
            <div class="min-w-0 flex-1">
              <p class="truncate text-base font-bold leading-tight">{{ gathering.title }}</p>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {{ whenLine(gathering) }}
              </p>
            </div>
            <component
              :is="iconFor(gathering.type)"
              class="h-5 w-5 shrink-0 text-gray-300 dark:text-gray-600"
            />
          </li>
        </ul>
      </div>
    </section>

    <!-- About -->
    <section v-if="landing.about" class="mx-auto max-w-5xl px-4 sm:px-6 py-14 sm:py-20">
      <div class="grid gap-8 sm:gap-10 lg:grid-cols-5 lg:items-center">
        <div class="lg:col-span-3">
          <h2
            class="text-[10px] font-black uppercase tracking-[0.2em] text-primary dark:text-primary-light"
          >
            {{ landing.aboutTitle || 'Who we are' }}
          </h2>
          <p
            class="mt-4 whitespace-pre-line text-base leading-relaxed text-gray-600 dark:text-gray-300"
          >
            {{ landing.about }}
          </p>
        </div>
        <!-- A face to go with the words, when there is one to use. -->
        <div v-if="deck.length" class="lg:col-span-2">
          <img
            :src="deck[0].url"
            :alt="deck[0].album || ''"
            loading="lazy"
            class="aspect-4/3 w-full rounded-2xl object-cover shadow-sm"
          />
        </div>
      </div>
    </section>

    <!-- Life here, in photographs the admin has shared album by album. -->
    <section v-if="deck.length > 1" class="py-14 sm:py-20">
      <div class="mx-auto max-w-5xl px-4 sm:px-6">
        <h2 class="text-[10px] font-black uppercase tracking-[0.2em] text-primary dark:text-primary-light">
          Life at church
        </h2>
        <p class="mt-2 text-2xl sm:text-3xl font-black tracking-tight">Come and see</p>
      </div>

      <!-- A swipeable strip on a phone, a grid once there is room for one. -->
      <div
        class="no-scrollbar mt-8 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 sm:mx-auto sm:grid sm:max-w-5xl sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:px-6"
      >
        <figure
          v-for="photo in deck.slice(0, 6)"
          :key="photo.id"
          class="relative w-[78%] shrink-0 snap-center overflow-hidden rounded-2xl sm:w-auto sm:shrink"
        >
          <img
            :src="photo.url"
            :alt="photo.album || ''"
            loading="lazy"
            class="aspect-4/3 w-full object-cover"
          />
          <figcaption
            v-if="photo.album"
            class="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-gray-950/80 to-transparent px-3 pb-2.5 pt-8 text-xs font-semibold text-white"
          >
            {{ photo.album }}
          </figcaption>
        </figure>
      </div>
    </section>

    <!-- Where to find us -->
    <section
      v-if="hasVisit"
      id="visit"
      class="mx-auto max-w-5xl scroll-mt-20 px-4 sm:px-6 py-14 sm:py-20"
    >
      <h2 class="text-[10px] font-black uppercase tracking-[0.2em] text-primary dark:text-primary-light">
        Where to find us
      </h2>
      <p class="mt-2 text-2xl sm:text-3xl font-black tracking-tight">Come as you are</p>

      <div class="mt-8 grid gap-3 sm:grid-cols-2">
        <div
          v-if="landing.address"
          class="rounded-2xl border border-gray-200 dark:border-gray-800 p-5 sm:col-span-2"
        >
          <div class="flex items-start gap-3">
            <div class="mt-0.5 shrink-0 rounded-lg bg-primary/10 p-2">
              <MapPin class="h-5 w-5 text-primary dark:text-primary-light" />
            </div>
            <div class="min-w-0">
              <p class="whitespace-pre-line text-base font-semibold leading-snug">
                {{ landing.address }}
              </p>
              <a
                v-if="mapHref"
                :href="mapHref"
                target="_blank"
                rel="noopener noreferrer"
                class="mt-2 inline-flex items-center gap-1 text-sm font-bold text-primary dark:text-primary-light"
              >
                Get directions
                <ArrowRight class="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>

        <a
          v-if="landing.phone"
          :href="`tel:${landing.phone}`"
          class="flex items-center gap-3 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/60"
        >
          <div class="shrink-0 rounded-lg bg-primary/10 p-2">
            <Phone class="h-5 w-5 text-primary dark:text-primary-light" />
          </div>
          <span class="min-w-0 truncate text-sm font-semibold">{{ landing.phone }}</span>
        </a>

        <a
          v-if="landing.email"
          :href="`mailto:${landing.email}`"
          class="flex items-center gap-3 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/60"
        >
          <div class="shrink-0 rounded-lg bg-primary/10 p-2">
            <Mail class="h-5 w-5 text-primary dark:text-primary-light" />
          </div>
          <span class="min-w-0 truncate text-sm font-semibold">{{ landing.email }}</span>
        </a>

        <a
          v-if="landing.facebook"
          :href="landing.facebook"
          target="_blank"
          rel="noopener noreferrer"
          class="flex items-center gap-3 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/60"
        >
          <div class="shrink-0 rounded-lg bg-primary/10 p-2">
            <Facebook class="h-5 w-5 text-primary dark:text-primary-light" />
          </div>
          <span class="min-w-0 truncate text-sm font-semibold">Follow us on Facebook</span>
        </a>
      </div>
    </section>

    <!-- The last word: one invitation, and the two things it takes to accept. -->
    <section v-if="canPlanVisit" class="px-4 sm:px-6 pb-14 sm:pb-20">
      <!-- Filled, so it cannot use `bg-primary` in both themes: dark mode swaps
           the brand colour to a light cyan meant for text on a dark surface,
           and white on that is unreadable. -->
      <div
        class="mx-auto max-w-5xl overflow-hidden rounded-3xl bg-primary px-6 py-12 sm:px-12 sm:py-16 dark:bg-gray-800 dark:ring-1 dark:ring-primary/30"
      >
        <h2 class="max-w-lg text-3xl sm:text-4xl font-black leading-tight tracking-tighter text-white">
          There is a place for you here.
        </h2>
        <p class="mt-3 max-w-md text-base text-white/80">
          Whether you have been coming for years or have never set foot in a church, we
          would love to meet you this week.
        </p>
        <div class="mt-8 flex flex-wrap gap-3">
          <a
            v-if="mapHref"
            :href="mapHref"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex h-12 items-center gap-2 rounded-xl bg-white px-5 text-sm font-bold text-gray-900 shadow-sm transition-transform active:scale-95"
          >
            <MapPin class="h-4 w-4" />
            Get directions
          </a>
          <a
            v-if="landing.email"
            :href="`mailto:${landing.email}`"
            class="inline-flex h-12 items-center gap-2 rounded-xl border border-white/40 px-5 text-sm font-bold text-white transition-colors hover:bg-white/10"
          >
            <Mail class="h-4 w-4" />
            Send a message
          </a>
        </div>
      </div>
    </section>

    <!-- Footer -->
    <footer class="border-t border-gray-200 dark:border-gray-800">
      <div
        class="mx-auto flex max-w-5xl flex-col gap-3 px-4 sm:px-6 py-8 sm:flex-row sm:items-center sm:justify-between"
      >
        <div class="min-w-0">
          <p class="text-sm font-bold">{{ church.fullName }}</p>
          <p v-if="church.branch" class="text-xs text-gray-500 dark:text-gray-400">
            {{ church.branch }}
          </p>
        </div>
        <p class="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
          &copy; {{ year }} {{ church.shortName }}
        </p>
      </div>
    </footer>
  </div>
</template>

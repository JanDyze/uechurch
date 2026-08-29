<script setup>
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Clock, MapPin, Phone, Mail, Facebook, ArrowRight, LogIn, Moon, Sun } from '../icons'
import { useAppSettings } from '../composables/useAppSettings'
import { useTheme } from '../composables/useTheme'
import bundledHero from '../assets/church.jpg'

// The public face of the app: everything on this page is typed by an admin
// under Settings > Public page, so a section with nothing behind it is hidden
// rather than shown empty. A brand-new install still reads as a finished page
// because the copy — not the details only a congregation can supply — has
// defaults.
const { church, landing, logoUrl } = useAppSettings()
const { isDark, toggleTheme } = useTheme()

// The router lets "/" through while the settings document is still in flight,
// so the decision is finished here: an install that has switched the public
// page off sends its visitors to sign-in as soon as that setting lands.
const route = useRoute()
const router = useRouter()
watch(
  () => landing.value.enabled,
  (enabled) => {
    if (enabled === false && route.query.preview === undefined) router.replace('/login')
  },
  { immediate: true }
)

const heroImage = computed(() => landing.value.heroImage || bundledHero)
const services = computed(() => (landing.value.services || []).filter((s) => s.name?.trim()))
const hasContact = computed(() =>
  Boolean(landing.value.phone || landing.value.email || landing.value.facebook)
)
const hasVisit = computed(() => Boolean(landing.value.address) || hasContact.value)

// The address doubles as a map search when no explicit link is set, so filling
// in one field is enough to get a working "Get directions".
const mapHref = computed(() => {
  if (landing.value.mapUrl) return landing.value.mapUrl
  if (!landing.value.address) return ''
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(landing.value.address)}`
})

const year = new Date().getFullYear()
</script>

<template>
  <div class="min-h-dvh bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
    <!-- Header: the logo and the way in. Stays put on scroll so "Sign in" is
         never more than a thumb away on a phone. -->
    <header
      class="sticky top-0 z-30 border-b border-gray-200/80 dark:border-gray-800 bg-white/90 dark:bg-gray-900/90 backdrop-blur"
    >
      <div class="mx-auto flex h-16 max-w-5xl items-center gap-3 px-4 sm:px-6">
        <img :src="logoUrl" :alt="church.shortName" class="h-9 w-auto shrink-0" />
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-bold leading-tight">{{ church.shortName }}</p>
          <p
            v-if="church.branch"
            class="truncate text-[10px] font-semibold uppercase tracking-widest text-gray-400"
          >
            {{ church.branch }}
          </p>
        </div>

        <button
          @click="toggleTheme($event)"
          class="flex h-10 w-10 items-center justify-center rounded-full text-primary dark:text-primary-light hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
        >
          <Sun v-if="isDark" class="h-5 w-5" />
          <Moon v-else class="h-5 w-5" />
        </button>
        <router-link
          to="/login"
          class="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 sm:px-4 text-sm font-semibold text-white shadow-sm transition-transform active:scale-95"
        >
          <LogIn class="h-4 w-4" />
          <span>Sign in</span>
        </router-link>
      </div>
    </header>

    <!-- Hero -->
    <section class="relative isolate overflow-hidden">
      <img :src="heroImage" alt="" class="absolute inset-0 h-full w-full object-cover" />
      <div
        class="absolute inset-0 bg-gradient-to-b from-gray-900/80 via-gray-900/70 to-gray-900/90"
      ></div>

      <div class="relative mx-auto max-w-5xl px-4 sm:px-6 py-20 sm:py-28 text-white">
        <p class="text-[10px] font-black uppercase tracking-[0.2em] text-white/70">
          {{ church.fullName }}
        </p>
        <h1
          class="mt-3 max-w-2xl text-4xl sm:text-5xl font-black leading-[1.05] tracking-tighter"
        >
          {{ landing.tagline }}
        </h1>
        <p v-if="landing.intro" class="mt-5 max-w-xl text-base sm:text-lg text-white/80">
          {{ landing.intro }}
        </p>

        <div class="mt-8 flex flex-wrap gap-3">
          <a
            v-if="services.length || hasVisit"
            href="#visit"
            class="inline-flex h-12 items-center gap-2 rounded-xl bg-white px-5 text-sm font-bold text-gray-900 shadow-lg transition-transform active:scale-95"
          >
            Plan your visit
            <ArrowRight class="h-4 w-4" />
          </a>
          <router-link
            to="/login"
            class="inline-flex h-12 items-center gap-2 rounded-xl border border-white/40 px-5 text-sm font-bold text-white transition-colors hover:bg-white/10"
          >
            Member sign in
          </router-link>
        </div>
      </div>
    </section>

    <!-- Service times -->
    <section v-if="services.length" id="visit" class="mx-auto max-w-5xl px-4 sm:px-6 py-14 sm:py-20">
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

    <!-- About -->
    <section
      v-if="landing.about"
      class="border-y border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40"
    >
      <div class="mx-auto max-w-3xl px-4 sm:px-6 py-14 sm:py-20">
        <h2
          class="text-[10px] font-black uppercase tracking-[0.2em] text-primary dark:text-primary-light"
        >
          {{ landing.aboutTitle || 'Who we are' }}
        </h2>
        <p class="mt-4 whitespace-pre-line text-base leading-relaxed text-gray-600 dark:text-gray-300">
          {{ landing.about }}
        </p>
      </div>
    </section>

    <!-- Where to find us -->
    <section
      v-if="hasVisit"
      :id="services.length ? undefined : 'visit'"
      class="mx-auto max-w-5xl px-4 sm:px-6 py-14 sm:py-20"
    >
      <h2 class="text-[10px] font-black uppercase tracking-[0.2em] text-primary dark:text-primary-light">
        Where to find us
      </h2>

      <div class="mt-6 grid gap-3 sm:grid-cols-2">
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

<script setup>
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { Download, Export, PlusSquare, X } from '../../icons'
import { usePwaInstall } from '../../composables/usePwaInstall'
import { useAppSettings } from '../../composables/useAppSettings'

const route = useRoute()
const { church, logoUrl } = useAppSettings()
const {
  shouldOfferInstall,
  canPromptDirectly,
  needsManualSteps,
  isIosInAppBrowser,
  promptInstall,
  close,
} = usePwaInstall()

const busy = ref(false)
// The toggle is off on every open by design: it silences a whole day, so it
// should be a thing someone reaches for, never a thing left ticked from last
// time and forgotten.
const muteForToday = ref(false)

// The projector window is the one screen this must never reach.
const offer = computed(() => shouldOfferInstall.value && !route.meta?.projector)

// The visitors' page speaks Tagalog and the signed-in app speaks English, so
// the one prompt that floats over both has to follow the page underneath it.
const tagalog = computed(() => Boolean(route.meta?.public))

const copy = computed(() => {
  // Defaulted separately per language: "I-install ang the app" is what one
  // shared fallback string would produce on the Tagalog side.
  const named = church.value?.shortName
  return tagalog.value
    ? {
        title: `I-install ang ${named || 'app'}`,
        blurb: 'Idagdag sa home screen — mas mabilis buksan, at gumagana kahit mahina ang signal.',
        install: 'I-install',
        later: 'Mamaya na',
        dismiss: 'Isara',
        mute: 'Huwag nang ipakita sa loob ng 24 oras',
        steps: ['Pindutin ang Share sa ibaba ng Safari.', 'Piliin ang "Add to Home Screen".'],
        inApp: 'Buksan muna ang page na ito sa Safari para ma-install.',
      }
    : {
        title: `Install ${named || 'the app'}`,
        blurb: 'Add it to your home screen for faster access and offline use.',
        install: 'Install',
        later: 'Not now',
        dismiss: 'Dismiss',
        mute: "Don't show again for 24 hours",
        steps: ['Tap the Share button in Safari.', 'Choose "Add to Home Screen".'],
        inApp: 'Open this page in Safari first to install it.',
      }
})

const handleClose = () => close({ forToday: muteForToday.value })

const handleInstall = async () => {
  busy.value = true
  try {
    await promptInstall()
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <!-- Floats over the page rather than sitting in the flow: every layout here
       is a full-height, self-scrolling shell, and a bar that reserved space
       would have to be subtracted from each of them. -->
  <Transition name="install-prompt">
    <div
      v-if="offer"
      class="fixed inset-x-0 top-0 z-110 px-2 pt-[calc(env(safe-area-inset-top)+0.5rem)] pointer-events-none"
    >
      <div
        role="dialog"
        aria-modal="false"
        :aria-label="copy.title"
        class="pointer-events-auto mx-auto max-w-md rounded-2xl border-2 border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xl shadow-gray-900/10 dark:shadow-black/40 overflow-hidden"
      >
        <div class="flex items-start gap-3 p-3.5 pb-2.5">
          <!-- The church's own mark, not a generic install glyph: this is the
               thing being added to the home screen, so it should be what the
               home screen will show. -->
          <img
            :src="logoUrl"
            alt=""
            class="shrink-0 w-11 h-11 rounded-xl object-contain bg-gray-50 dark:bg-gray-800 p-1"
          />

          <div class="min-w-0 flex-1 pt-0.5">
            <p class="text-[11px] font-black tracking-tight text-gray-900 dark:text-white truncate">
              {{ copy.title }}
            </p>
            <p class="text-[10px] font-bold text-gray-400 dark:text-gray-500 leading-snug">
              {{ isIosInAppBrowser ? copy.inApp : copy.blurb }}
            </p>
          </div>

          <button
            type="button"
            :aria-label="copy.dismiss"
            class="shrink-0 -mt-0.5 -mr-0.5 p-1.5 rounded-lg text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            @click="handleClose"
          >
            <X class="w-4 h-4" />
          </button>
        </div>

        <!-- iOS has no install API, so the two taps are spelled out rather than
             hidden behind a "how?" — an extra tap to reach instructions is an
             extra tap on the one platform that already needs the most. -->
        <div v-if="needsManualSteps && !isIosInAppBrowser" class="px-3.5 pb-1 space-y-1.5">
          <p class="flex items-center gap-2 text-[10px] font-bold text-gray-500 dark:text-gray-400">
            <Export class="w-4 h-4 shrink-0 text-primary dark:text-primary-light" />
            {{ copy.steps[0] }}
          </p>
          <p class="flex items-center gap-2 text-[10px] font-bold text-gray-500 dark:text-gray-400">
            <PlusSquare class="w-4 h-4 shrink-0 text-primary dark:text-primary-light" />
            {{ copy.steps[1] }}
          </p>
        </div>

        <div class="p-3.5 pt-2.5 space-y-2.5">
          <div class="flex items-center gap-2">
            <!-- Only Chrome and friends hand us a dialog to open; on iOS the
                 steps above are the whole action, so there is no button. -->
            <button
              v-if="canPromptDirectly"
              type="button"
              :disabled="busy"
              class="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-primary text-white text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100"
              @click="handleInstall"
            >
              <Download class="w-3.5 h-3.5" />
              {{ copy.install }}
            </button>
            <button
              type="button"
              :class="[
                'py-2.5 rounded-xl border-2 border-gray-100 dark:border-gray-800 text-gray-500 dark:text-gray-400 text-[9px] font-black uppercase tracking-widest transition-all active:scale-95',
                canPromptDirectly ? 'px-4' : 'flex-1',
              ]"
              @click="handleClose"
            >
              {{ copy.later }}
            </button>
          </div>

          <label
            class="flex items-center gap-2 text-[10px] font-bold text-gray-400 dark:text-gray-500 cursor-pointer select-none"
          >
            <input
              v-model="muteForToday"
              type="checkbox"
              class="w-3.5 h-3.5 rounded accent-primary cursor-pointer"
            />
            {{ copy.mute }}
          </label>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.install-prompt-enter-active,
.install-prompt-leave-active {
  transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.28s ease;
}

.install-prompt-enter-from,
.install-prompt-leave-to {
  transform: translateY(-120%);
  opacity: 0;
}
</style>

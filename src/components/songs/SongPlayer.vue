<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { AlertTriangle, Loader2, Music2, Pause, Play, Video } from '../../icons'
import { thumbnailForId } from '../../utils/songUtils'

const props = defineProps({
  videoId: { type: String, required: true },
  title: { type: String, default: '' },
})

/* -------------------------------------------------------------------------
 * Video / music preference
 * Module-level so the choice is shared by every player and survives a reload:
 * someone rehearsing wants to watch, someone praying along wants only the
 * music. (Same shared-state pattern as useSgLanguage.)
 * ---------------------------------------------------------------------- */
const MODE_STORAGE_KEY = 'uec.songs.playerMode'

// Music first: most people open a song to hear it, not to watch it.
const readStoredMode = () => {
  try {
    return localStorage.getItem(MODE_STORAGE_KEY) === 'video' ? 'video' : 'audio'
  } catch {
    return 'audio'
  }
}

const mode = ref(readStoredMode())

const setMode = (value) => {
  mode.value = value
  try {
    localStorage.setItem(MODE_STORAGE_KEY, value)
  } catch {
    // Private mode / blocked storage: the toggle still works for this session.
  }
}

const isAudio = computed(() => mode.value === 'audio')

/* -------------------------------------------------------------------------
 * YouTube IFrame API
 * Loaded once per page, and only when someone actually presses play. The API
 * (rather than a plain <iframe src>) is what lets music mode keep playing while
 * the picture is hidden, and gives us our own play/pause and scrubber.
 * ---------------------------------------------------------------------- */
let apiPromise = null

const loadYouTubeApi = () => {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (!apiPromise) {
    apiPromise = new Promise((resolve, reject) => {
      const previous = window.onYouTubeIframeAPIReady
      window.onYouTubeIframeAPIReady = () => {
        previous?.()
        resolve(window.YT)
      }
      const script = document.createElement('script')
      script.src = 'https://www.youtube.com/iframe_api'
      script.async = true
      script.onerror = () => {
        apiPromise = null
        reject(new Error('The YouTube player could not be loaded'))
      }
      document.head.appendChild(script)
    })
  }
  return apiPromise
}

// Plain `let`, never a ref: the YT player must not be wrapped in a Vue proxy.
let player = null
let ticker = null
let autoplayWatchdog = null

const hostRef = ref(null)
const hasStarted = ref(false)
const isBusy = ref(false)
const isPlaying = ref(false)
const failed = ref(false)
// iOS in particular can refuse to start a cross-origin video from a tap on our
// own button. In music mode the picture is hidden, so there would be nothing
// left to tap: this flag surfaces a way out instead of a silent dead player.
const autoplayBlocked = ref(false)
const duration = ref(0)
const currentTime = ref(0)
const scrubbing = ref(false)
const artFailed = ref(false)

const art = computed(() => thumbnailForId(props.videoId))

const stopTicker = () => {
  if (ticker) clearInterval(ticker)
  ticker = null
}

const startTicker = () => {
  stopTicker()
  ticker = setInterval(() => {
    if (!player || scrubbing.value) return
    currentTime.value = player.getCurrentTime?.() || 0
    if (!duration.value) duration.value = player.getDuration?.() || 0
  }, 250)
}

const clearWatchdog = () => {
  if (autoplayWatchdog) clearTimeout(autoplayWatchdog)
  autoplayWatchdog = null
}

const start = async () => {
  if (!props.videoId || hasStarted.value) return
  hasStarted.value = true
  isBusy.value = true
  failed.value = false
  autoplayBlocked.value = false
  // If the player never leaves "unstarted" the browser refused the tap.
  clearWatchdog()
  autoplayWatchdog = setTimeout(() => {
    const state = player?.getPlayerState?.()
    if (state === undefined || state === -1 || state === 5) {
      autoplayBlocked.value = true
      isBusy.value = false
    }
  }, 3000)
  try {
    const YT = await loadYouTubeApi()
    if (!hostRef.value) return
    player = new YT.Player(hostRef.value, {
      width: '100%',
      height: '100%',
      videoId: props.videoId,
      // playsinline keeps iOS from taking the video fullscreen in its own
      // player, which would defeat music mode entirely.
      playerVars: { autoplay: 1, playsinline: 1, rel: 0, modestbranding: 1 },
      events: {
        onReady: (event) => {
          duration.value = event.target.getDuration?.() || 0
          event.target.playVideo?.()
        },
        onStateChange: (event) => {
          const state = event.data
          isBusy.value = state === YT.PlayerState.BUFFERING
          isPlaying.value = state === YT.PlayerState.PLAYING
          if (state !== -1 && state !== YT.PlayerState.CUED) {
            clearWatchdog()
            autoplayBlocked.value = false
          }
          if (state === YT.PlayerState.PLAYING) {
            duration.value = duration.value || player?.getDuration?.() || 0
            startTicker()
          } else if (state === YT.PlayerState.ENDED) {
            stopTicker()
            currentTime.value = duration.value
          } else {
            stopTicker()
          }
        },
        onError: () => {
          clearWatchdog()
          failed.value = true
          isBusy.value = false
        },
      },
    })
  } catch {
    clearWatchdog()
    failed.value = true
    isBusy.value = false
    hasStarted.value = false
  }
}

const togglePlay = () => {
  if (!hasStarted.value) {
    start()
    return
  }
  if (!player) return
  if (isPlaying.value) player.pauseVideo?.()
  else player.playVideo?.()
}

const onSeekInput = (event) => {
  scrubbing.value = true
  currentTime.value = Number(event.target.value)
}

const onSeekCommit = (event) => {
  const seconds = Number(event.target.value)
  scrubbing.value = false
  currentTime.value = seconds
  player?.seekTo?.(seconds, true)
}

const formatTime = (seconds) => {
  const total = Math.max(0, Math.floor(seconds || 0))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

// Picking another song while the drawer stays open reuses the same player, so
// nothing has to be torn down and rebuilt between two songs.
watch(
  () => props.videoId,
  (id) => {
    artFailed.value = false
    currentTime.value = 0
    duration.value = 0
    if (player && id) player.loadVideoById?.(id)
  }
)

onBeforeUnmount(() => {
  stopTicker()
  clearWatchdog()
  player?.destroy?.()
  player = null
})

const MODES = [
  { value: 'video', label: 'Video', icon: Video },
  { value: 'audio', label: 'Music', icon: Music2 },
]
</script>

<template>
  <div class="overflow-hidden rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
    <!-- Mode switch -->
    <div class="flex items-center justify-between gap-2 px-3 py-2 border-b border-gray-100 dark:border-gray-800">
      <span class="text-[11px] font-black uppercase tracking-widest text-gray-400">
        {{ isAudio ? 'Music only' : 'Video' }}
      </span>
      <div role="group" aria-label="Playback mode" class="flex items-center gap-0.5 rounded-full bg-gray-100 dark:bg-gray-800 p-0.5">
        <button
          v-for="option in MODES"
          :key="option.value"
          type="button"
          @click="setMode(option.value)"
          :aria-pressed="mode === option.value"
          :class="[
            'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors',
            mode === option.value
              ? 'bg-white dark:bg-gray-700 text-primary dark:text-primary-light shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
          ]"
        >
          <component :is="option.icon" class="h-3.5 w-3.5" />
          {{ option.label }}
        </button>
      </div>
    </div>

    <!-- Stage: the iframe lives here in both modes. In music mode it stays
         mounted at full size but invisible behind the now-playing bar, so
         switching never interrupts what is already playing. -->
    <div class="relative bg-black">
      <div
        class="absolute inset-0"
        :class="isAudio ? 'opacity-0 pointer-events-none' : ''"
        :aria-hidden="isAudio"
      >
        <div ref="hostRef" class="h-full w-full"></div>
      </div>

      <!-- Video mode keeps 16:9 -->
      <div v-if="!isAudio" class="aspect-video w-full"></div>

      <!-- Music mode collapses to a now-playing bar -->
      <div
        v-else
        class="relative z-10 flex items-center gap-3 bg-linear-to-r from-gray-900 to-gray-800 p-3"
      >
        <div class="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-gray-800">
          <img
            v-if="art && !artFailed"
            :src="art"
            alt=""
            class="h-full w-full object-cover"
            @error="artFailed = true"
          />
          <Music2 v-else class="absolute inset-0 m-auto h-5 w-5 text-gray-500" />
        </div>

        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-bold text-white">{{ title || 'Now playing' }}</p>
          <p class="mt-0.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-gray-400">
            <span v-if="isPlaying" class="flex items-end gap-0.5" aria-hidden="true">
              <span
                v-for="bar in 3"
                :key="bar"
                class="equalizer-bar"
                :style="{ animationDelay: `${bar * 120}ms` }"
              ></span>
            </span>
            {{ isPlaying ? 'Playing' : hasStarted ? 'Paused' : 'Music only' }}
          </p>
        </div>

        <button
          type="button"
          @click="togglePlay"
          :aria-label="isPlaying ? 'Pause' : 'Play'"
          class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-gray-900 transition-transform hover:scale-105 active:scale-95"
        >
          <Loader2 v-if="isBusy && !isPlaying" class="h-5 w-5 animate-spin" />
          <Pause v-else-if="isPlaying" class="h-5 w-5 fill-current" />
          <Play v-else class="h-5 w-5 translate-x-0.5 fill-current" />
        </button>
      </div>

      <!-- Poster: video mode, nothing playing yet -->
      <button
        v-if="!isAudio && !hasStarted"
        type="button"
        @click="start"
        class="group absolute inset-0 z-10 flex items-center justify-center"
        :aria-label="`Play ${title}`"
      >
        <img
          v-if="art && !artFailed"
          :src="art"
          alt=""
          class="absolute inset-0 h-full w-full object-cover"
          @error="artFailed = true"
        />
        <span class="absolute inset-0 bg-black/25 transition-colors group-hover:bg-black/40"></span>
        <span class="relative flex h-14 w-14 items-center justify-center rounded-full bg-red-600 text-white shadow-lg transition-transform group-hover:scale-110">
          <Play class="h-6 w-6 translate-x-0.5 fill-current" />
        </span>
      </button>
    </div>

    <!-- Transport: music mode hides YouTube's own controls, so it needs ours -->
    <div v-if="isAudio" class="flex items-center gap-2 px-3 py-2">
      <span class="w-9 shrink-0 text-[11px] font-bold tabular-nums text-gray-400">
        {{ formatTime(currentTime) }}
      </span>
      <input
        type="range"
        min="0"
        :max="duration || 0"
        step="1"
        :value="currentTime"
        :disabled="!duration"
        aria-label="Seek"
        class="song-seek min-w-0 flex-1"
        @input="onSeekInput"
        @change="onSeekCommit"
      />
      <span class="w-9 shrink-0 text-right text-[11px] font-bold tabular-nums text-gray-400">
        {{ formatTime(duration) }}
      </span>
    </div>

    <p
      v-if="autoplayBlocked && isAudio && !failed"
      class="flex flex-wrap items-center gap-1.5 border-t border-gray-100 px-3 py-2 text-xs font-bold text-gray-500 dark:border-gray-800 dark:text-gray-400"
    >
      This browser won't start it with the picture hidden.
      <button
        type="button"
        @click="setMode('video')"
        class="rounded-lg px-2 py-0.5 text-primary dark:text-primary-light hover:underline"
      >
        Switch to Video
      </button>
      — press play there, then flip back to Music.
    </p>

    <p
      v-if="failed"
      class="flex items-center gap-2 border-t border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/10 dark:text-amber-400"
    >
      <AlertTriangle class="h-3.5 w-3.5 shrink-0" />
      This video can't play here — open it on YouTube instead.
    </p>
  </div>
</template>

<style scoped>
.equalizer-bar {
  width: 2px;
  height: 8px;
  border-radius: 1px;
  background: currentColor;
  animation: equalize 0.9s ease-in-out infinite alternate;
}

@keyframes equalize {
  from { height: 3px; }
  to { height: 9px; }
}

@media (prefers-reduced-motion: reduce) {
  .equalizer-bar { animation: none; }
}

/* A range input cannot be styled with utility classes, and the track colour has
   to read on both the light and the dark card. */
.song-seek {
  -webkit-appearance: none;
  appearance: none;
  height: 4px;
  border-radius: 999px;
  background-color: rgb(148 163 184 / 0.4);
  cursor: pointer;
}

.song-seek::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 12px;
  height: 12px;
  border: none;
  border-radius: 999px;
  background: var(--color-primary);
}

.song-seek::-moz-range-thumb {
  width: 12px;
  height: 12px;
  border: none;
  border-radius: 999px;
  background: var(--color-primary);
}

.song-seek:disabled {
  opacity: 0.5;
  cursor: default;
}
</style>

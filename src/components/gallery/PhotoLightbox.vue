<script setup>
/**
 * One photo, the whole screen, and a swipe to the next.
 *
 * Built for the phone first. The old viewer put the photo beside a side panel
 * of badges and a date in capitals, which on a phone stacked underneath and
 * pushed the picture into the top half of the screen. Here the photo gets
 * everything but a thin bar at each end: the controls on top, where a thumb
 * does not rest on them while swiping, and the album's name below.
 */

import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Image as ImageIcon,
  MoreVertical,
  Share2,
  Trash2,
  X,
} from '../../icons'
import { formatLongDate } from '../../../lib/occurrences'
import { useScrollLock } from '../../composables/useScrollLock'

const props = defineProps({
  photos: { type: Array, default: () => [] },
  index: { type: Number, default: 0 },
  album: { type: Object, default: null },
  canManage: { type: Boolean, default: false },
  // A confirmation is open over the viewer and owns the keyboard: Escape there
  // means "don't delete", not "close the photo as well".
  paused: { type: Boolean, default: false },
})

const emit = defineEmits(['close', 'go', 'share', 'download', 'cover', 'delete'])

// The grid behind has no business moving while this is up.
useScrollLock(() => true)

const photo = computed(() => props.photos[props.index] || null)
const count = computed(() => props.photos.length)
const isCover = computed(() => Boolean(photo.value && props.album?.coverUrl === photo.value.url))

const showMenu = ref(false)

// Wraps at both ends: the last photo of a service is followed by the first,
// rather than by a button that does nothing.
const step = (by) => {
  if (count.value < 2) return
  showMenu.value = false
  emit('go', (props.index + by + count.value) % count.value)
}

const onKeydown = (event) => {
  if (props.paused) return
  if (event.key === 'ArrowRight') step(1)
  else if (event.key === 'ArrowLeft') step(-1)
  else if (event.key === 'Escape') {
    if (showMenu.value) showMenu.value = false
    else emit('close')
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))

/* ------------------------------------------------------------------ swipe */
// Horizontal only, and only once the finger has clearly gone sideways — a
// mostly-vertical drag is somebody adjusting their grip, not asking for the
// next photo.
const SWIPE_DISTANCE = 50
let start = null
const dragX = ref(0)

const onPointerDown = (event) => {
  if (event.pointerType === 'mouse') return
  start = { x: event.clientX, y: event.clientY }
}

const onPointerMove = (event) => {
  if (!start) return
  const dx = event.clientX - start.x
  const dy = event.clientY - start.y
  dragX.value = Math.abs(dx) > Math.abs(dy) ? dx : 0
}

const onPointerUp = () => {
  if (!start) return
  const dx = dragX.value
  start = null
  dragX.value = 0
  if (Math.abs(dx) >= SWIPE_DISTANCE) step(dx < 0 ? 1 : -1)
}

const run = (event) => {
  showMenu.value = false
  emit(event, photo.value)
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="photo"
      role="dialog"
      aria-modal="true"
      aria-label="Photo viewer"
      class="fixed inset-0 z-100 flex flex-col bg-black text-white"
    >
      <!-- Top bar -->
      <div
        class="relative z-10 flex shrink-0 items-center gap-1 px-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2"
      >
        <button
          @click="emit('close')"
          aria-label="Close"
          class="flex h-10 w-10 items-center justify-center rounded-full text-white/80 hover:bg-white/10 hover:text-white"
        >
          <X class="h-5 w-5" />
        </button>
        <span class="ml-1 text-sm font-medium tabular-nums text-white/70">
          {{ index + 1 }} / {{ count }}
        </span>

        <div class="ml-auto flex items-center gap-1">
          <button
            @click="run('share')"
            aria-label="Share photo link"
            title="Share"
            class="flex h-10 w-10 items-center justify-center rounded-full text-white/80 hover:bg-white/10 hover:text-white"
          >
            <Share2 class="h-5 w-5" />
          </button>
          <button
            @click="run('download')"
            aria-label="Download photo"
            title="Download"
            class="flex h-10 w-10 items-center justify-center rounded-full text-white/80 hover:bg-white/10 hover:text-white"
          >
            <Download class="h-5 w-5" />
          </button>

          <div v-if="canManage" class="relative">
            <button
              @click="showMenu = !showMenu"
              aria-label="More actions"
              aria-haspopup="menu"
              :aria-expanded="showMenu"
              class="flex h-10 w-10 items-center justify-center rounded-full text-white/80 hover:bg-white/10 hover:text-white"
            >
              <MoreVertical class="h-5 w-5" />
            </button>
            <div v-if="showMenu" class="fixed inset-0" @click="showMenu = false"></div>
            <div
              v-if="showMenu"
              role="menu"
              class="absolute right-0 top-full mt-1 w-48 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 text-gray-700 shadow-xl dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
            >
              <button
                role="menuitem"
                @click="run('cover')"
                :disabled="isCover"
                class="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm hover:bg-gray-100 disabled:opacity-50 disabled:hover:bg-transparent dark:hover:bg-gray-700"
              >
                <ImageIcon class="h-4 w-4 shrink-0 text-gray-400" />
                {{ isCover ? 'This is the cover' : 'Use as cover' }}
              </button>
              <button
                role="menuitem"
                @click="run('delete')"
                class="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
              >
                <Trash2 class="h-4 w-4 shrink-0" />
                Delete photo
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- The photo -->
      <div
        class="relative flex min-h-0 flex-1 touch-pan-y items-center justify-center select-none"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
      >
        <img
          :key="photo.id"
          :src="photo.url"
          alt=""
          draggable="false"
          class="max-h-full max-w-full object-contain"
          :style="dragX ? { transform: `translateX(${dragX}px)` } : null"
        />

        <!-- Arrows for a mouse; a phone swipes. -->
        <template v-if="count > 1">
          <button
            @click="step(-1)"
            aria-label="Previous photo"
            class="absolute left-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white/80 backdrop-blur hover:bg-white/20 hover:text-white sm:flex"
          >
            <ChevronLeft class="h-6 w-6" />
          </button>
          <button
            @click="step(1)"
            aria-label="Next photo"
            class="absolute right-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white/80 backdrop-blur hover:bg-white/20 hover:text-white sm:flex"
          >
            <ChevronRight class="h-6 w-6" />
          </button>
        </template>
      </div>

      <!-- Where it was taken -->
      <div class="shrink-0 px-4 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <p class="truncate text-sm font-semibold">{{ album?.title || 'Photo' }}</p>
        <p class="truncate text-xs text-white/60">
          {{ [album?.date ? formatLongDate(album.date) : '', album?.location].filter(Boolean).join(' · ') }}
        </p>
        <p v-if="photo.description" class="mt-1 line-clamp-2 text-xs text-white/80">
          {{ photo.description }}
        </p>
      </div>
    </div>
  </Teleport>
</template>

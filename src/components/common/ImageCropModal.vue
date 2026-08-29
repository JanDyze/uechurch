<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { X, ZoomIn, ZoomOut, Move } from '../../icons'

const props = defineProps({
  show: { type: Boolean, default: false },
  // A decoded <img> of the file the user picked.
  image: { type: Object, default: null },
  aspect: { type: Number, default: 16 / 9 },
  title: { type: String, default: 'Adjust photo' },
  hint: { type: String, default: 'Drag to reposition, pinch or use the slider to zoom' },
  applyLabel: { type: String, default: 'Apply' },
  cancelLabel: { type: String, default: 'Cancel' },
  busy: { type: Boolean, default: false },
})

const emit = defineEmits(['update:show', 'apply'])

const MAX_ZOOM = 4

const dialogRef = ref(null)
const frameRef = ref(null)
const frameSize = ref({ width: 0, height: 0 })
const zoom = ref(1)
const offset = ref({ x: 0, y: 0 })

/** Scale at which the image exactly covers the frame — the zoom = 1 baseline. */
const baseScale = computed(() => {
  const { width, height } = frameSize.value
  if (!props.image || !width || !height) return 1
  return Math.max(width / props.image.naturalWidth, height / props.image.naturalHeight)
})

const displaySize = computed(() => {
  if (!props.image) return { width: 0, height: 0 }
  const scale = baseScale.value * zoom.value
  return {
    width: props.image.naturalWidth * scale,
    height: props.image.naturalHeight * scale,
  }
})

/** How far the image may slide before a gap would open at an edge. */
const maxOffset = computed(() => ({
  x: Math.max(0, (displaySize.value.width - frameSize.value.width) / 2),
  y: Math.max(0, (displaySize.value.height - frameSize.value.height) / 2),
}))

const clampOffset = () => {
  offset.value = {
    x: Math.min(maxOffset.value.x, Math.max(-maxOffset.value.x, offset.value.x)),
    y: Math.min(maxOffset.value.y, Math.max(-maxOffset.value.y, offset.value.y)),
  }
}

const imageStyle = computed(() => ({
  width: `${displaySize.value.width}px`,
  height: `${displaySize.value.height}px`,
  transform: `translate(-50%, -50%) translate(${offset.value.x}px, ${offset.value.y}px)`,
}))

const measure = () => {
  const el = frameRef.value
  if (!el) return
  frameSize.value = { width: el.clientWidth, height: el.clientHeight }
  clampOffset()
}

// Re-measure and re-centre every time the modal opens with a new image, so a
// second pick never inherits the previous framing.
watch(
  () => [props.show, props.image],
  async ([show]) => {
    if (!show) return
    zoom.value = 1
    offset.value = { x: 0, y: 0 }
    await nextTick()
    measure()
  },
  { immediate: true }
)

watch(zoom, clampOffset)

/* ----------------------------------------------------------- pan and pinch */
let dragStart = null
let pinchStart = null
const pointers = new Map()

const pointerDistance = () => {
  const [a, b] = [...pointers.values()]
  return Math.hypot(a.x - b.x, a.y - b.y)
}

const onPointerDown = (event) => {
  frameRef.value?.setPointerCapture?.(event.pointerId)
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
  if (pointers.size === 2) {
    pinchStart = { distance: pointerDistance(), zoom: zoom.value }
    dragStart = null
  } else {
    dragStart = { x: event.clientX, y: event.clientY, offset: { ...offset.value } }
  }
}

const onPointerMove = (event) => {
  if (!pointers.has(event.pointerId)) return
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })

  if (pointers.size === 2 && pinchStart) {
    const ratio = pointerDistance() / (pinchStart.distance || 1)
    zoom.value = Math.min(MAX_ZOOM, Math.max(1, pinchStart.zoom * ratio))
    return
  }
  if (!dragStart) return
  offset.value = {
    x: dragStart.offset.x + (event.clientX - dragStart.x),
    y: dragStart.offset.y + (event.clientY - dragStart.y),
  }
  clampOffset()
}

const endPointer = (event) => {
  pointers.delete(event.pointerId)
  if (pointers.size < 2) pinchStart = null
  if (pointers.size === 0) dragStart = null
}

const onWheel = (event) => {
  event.preventDefault()
  zoom.value = Math.min(MAX_ZOOM, Math.max(1, zoom.value - event.deltaY * 0.002))
}

/* -------------------------------------------------------------------- apply */
const close = () => emit('update:show', false)

const apply = () => {
  if (!props.image || props.busy) return
  const scale = baseScale.value * zoom.value
  // Convert the visible window back into source-image pixels.
  emit('apply', {
    x: (displaySize.value.width / 2 - frameSize.value.width / 2 - offset.value.x) / scale,
    y: (displaySize.value.height / 2 - frameSize.value.height / 2 - offset.value.y) / scale,
    width: frameSize.value.width / scale,
    height: frameSize.value.height / scale,
  })
}

/* ------------------------------------------------------------ keyboard */
// This opens on top of a drawer that runs its own focus trap on `document`.
// Listening on `window` in the capture phase puts this handler ahead of that
// one, so Escape closes the crop dialog without also closing the form behind
// it, and Tab stays in here.
const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
let previouslyFocused = null

const onKeydown = (event) => {
  if (event.key === 'Escape') {
    event.stopPropagation()
    close()
    return
  }
  if (event.key !== 'Tab' || !dialogRef.value) return
  const nodes = [...dialogRef.value.querySelectorAll(FOCUSABLE)]
  if (!nodes.length) return
  event.stopPropagation()
  const first = nodes[0]
  const last = nodes[nodes.length - 1]
  const active = document.activeElement
  if (event.shiftKey) {
    if (active === first || !dialogRef.value.contains(active)) {
      event.preventDefault()
      last.focus()
    }
  } else if (active === last || !dialogRef.value.contains(active)) {
    event.preventDefault()
    first.focus()
  }
}

const releaseKeyboard = () => window.removeEventListener('keydown', onKeydown, true)

watch(
  () => props.show,
  async (show) => {
    if (show) {
      previouslyFocused = document.activeElement
      window.addEventListener('keydown', onKeydown, true)
      await nextTick()
      dialogRef.value?.querySelector(FOCUSABLE)?.focus()
      return
    }
    releaseKeyboard()
    if (previouslyFocused && document.body.contains(previouslyFocused)) previouslyFocused.focus()
    previouslyFocused = null
  }
)

onBeforeUnmount(releaseKeyboard)
</script>

<template>
  <Teleport to="body">
    <Transition name="crop-fade">
      <div v-if="show" class="fixed inset-0 z-90 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/70" @click="close" />

        <div
          ref="dialogRef"
          role="dialog"
          aria-modal="true"
          aria-label="Adjust photo"
          tabindex="-1"
          class="relative z-10 w-full max-w-lg rounded-2xl bg-white dark:bg-gray-800 shadow-2xl overflow-hidden"
        >
          <div
            class="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700"
          >
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white truncate">
              {{ title }}
            </h3>
            <button
              type="button"
              @click="close"
              class="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="Close"
            >
              <X class="h-5 w-5" />
            </button>
          </div>

          <div class="p-4 space-y-3">
            <!-- The frame is exactly the crop: what shows here is what gets saved. -->
            <div
              ref="frameRef"
              class="relative w-full overflow-hidden rounded-xl bg-gray-900 touch-none select-none cursor-grab active:cursor-grabbing"
              :style="{ aspectRatio: String(aspect) }"
              @pointerdown="onPointerDown"
              @pointermove="onPointerMove"
              @pointerup="endPointer"
              @pointercancel="endPointer"
              @wheel="onWheel"
            >
              <img
                v-if="image"
                :src="image.src"
                alt=""
                draggable="false"
                class="absolute left-1/2 top-1/2 max-w-none"
                :style="imageStyle"
              />
              <!-- Rule-of-thirds guides, so the framing is easy to judge. -->
              <div class="pointer-events-none absolute inset-0">
                <div class="absolute inset-y-0 left-1/3 w-px bg-white/25" />
                <div class="absolute inset-y-0 left-2/3 w-px bg-white/25" />
                <div class="absolute inset-x-0 top-1/3 h-px bg-white/25" />
                <div class="absolute inset-x-0 top-2/3 h-px bg-white/25" />
              </div>
            </div>

            <p class="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
              <Move class="h-3.5 w-3.5 shrink-0" />{{ hint }}
            </p>

            <div class="flex items-center gap-3">
              <ZoomOut class="h-4 w-4 shrink-0 text-gray-400" />
              <input
                v-model.number="zoom"
                type="range"
                min="1"
                :max="MAX_ZOOM"
                step="0.01"
                class="flex-1 accent-primary"
                aria-label="Zoom"
              />
              <ZoomIn class="h-4 w-4 shrink-0 text-gray-400" />
            </div>
          </div>

          <div
            class="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-200 dark:border-gray-700"
          >
            <button
              type="button"
              @click="close"
              class="px-4 py-2 rounded-lg text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              {{ cancelLabel }}
            </button>
            <button
              type="button"
              @click="apply"
              :disabled="busy"
              class="px-5 py-2 rounded-lg text-sm font-semibold bg-primary text-white hover:bg-primary-hover transition-colors disabled:opacity-50"
            >
              {{ applyLabel }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.crop-fade-enter-active,
.crop-fade-leave-active {
  transition: opacity 0.2s ease;
}
.crop-fade-enter-from,
.crop-fade-leave-to {
  opacity: 0;
}
</style>

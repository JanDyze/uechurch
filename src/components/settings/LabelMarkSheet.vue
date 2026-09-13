<script setup>
import { computed, ref, watch } from 'vue'
import { ImagePlus, Loader2, Search, Trash2, X } from '../../icons'
import { useFocusTrap } from '../../composables/useFocusTrap'
import { useToast } from '../../composables/useToast'
import { uploadImage } from '../../api/blobService'
import {
  EVENT_ICON_NAMES,
  getEventIcon,
  loadAllIconPaths,
} from '../../utils/eventIcons'
import LabelMark from '../common/LabelMark.vue'

// Choosing the picture a ministry or a tag is shown with. An icon from the
// set the calendar already uses, or a photograph — the choir's own logo, the
// youth group's badge — which is the thing an icon library will never have.

const props = defineProps({
  show: { type: Boolean, default: false },
  // What is being given a picture, for the heading: "Usher".
  name: { type: String, default: '' },
  // 'Ministry' or 'Tag'.
  kind: { type: String, default: 'Ministry' },
  mark: { type: Object, default: null },
  busy: { type: Boolean, default: false },
})

const emit = defineEmits(['close', 'save'])

const toast = useToast()
const query = ref('')
const iconsReady = ref(0)
const uploading = ref(false)
const fileInput = ref(null)

watch(
  () => props.show,
  async (open) => {
    if (!open) return
    query.value = ''
    if (iconsReady.value) return
    try {
      await loadAllIconPaths()
      iconsReady.value += 1
    } catch (e) {
      console.error('Could not load the icon set:', e)
    }
  }
)

// Capped for the same reason as the calendar's picker: fifteen hundred buttons
// is too many to mount at once, and typing is how you reach the rest.
const LIMIT = 120

// Seeded with the name itself, so "Usher" opens on whatever the set has for it
// before a single letter is typed.
const matching = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return EVENT_ICON_NAMES
  return EVENT_ICON_NAMES.filter((icon) => icon.toLowerCase().includes(q))
})
const shown = computed(() => matching.value.slice(0, LIMIT))

const pickIcon = (icon) => emit('save', { icon, imageUrl: '' })

/**
 * Squared and shrunk before it leaves the phone. A mark is drawn at the size
 * of a letter, and a twelve-megapixel photograph behind every chip on a
 * profile would be most of that page's download.
 */
const shrink = (file, size = 256) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = () => {
      const img = new Image()
      img.onerror = reject
      img.onload = () => {
        const side = Math.min(img.width, img.height)
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        canvas
          .getContext('2d')
          .drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size)
        resolve(canvas.toDataURL('image/png'))
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })

const handleFile = async (event) => {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  if (!file.type.startsWith('image/')) {
    toast.error('Choose an image file')
    return
  }
  uploading.value = true
  try {
    const url = await uploadImage(await shrink(file), 'labels')
    emit('save', { icon: '', imageUrl: url })
  } catch (e) {
    console.error('Error uploading mark:', e)
    toast.error('Could not upload that image. Please try again.')
  } finally {
    uploading.value = false
  }
}

const close = () => emit('close')
const dialogRef = ref(null)
useFocusTrap(dialogRef, () => props.show, close)
</script>

<template>
  <Teleport to="body">
    <Transition name="mark-sheet">
      <div
        v-if="show"
        class="fixed inset-0 z-110 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-4"
        @click.self="close"
      >
        <div
          ref="dialogRef"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mark-sheet-title"
          tabindex="-1"
          class="flex h-[80dvh] w-full flex-col rounded-t-2xl bg-white shadow-xl dark:bg-gray-800 sm:h-[36rem] sm:max-w-lg sm:rounded-2xl"
        >
          <div
            class="flex shrink-0 items-center gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700"
          >
            <span
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300"
            >
              <LabelMark v-if="mark" :mark="mark" :size="mark.imageUrl ? 'h-10 w-10' : 'h-5 w-5'" />
              <span v-else class="text-sm font-semibold">{{ name.slice(0, 1) }}</span>
            </span>
            <div class="min-w-0 flex-1">
              <h3 id="mark-sheet-title" class="truncate text-base font-semibold text-gray-900 dark:text-white">
                {{ name }}
              </h3>
              <p class="text-xs text-gray-500 dark:text-gray-400">{{ kind }} picture</p>
            </div>
            <button
              @click="close"
              aria-label="Close"
              class="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
            >
              <X class="h-5 w-5" />
            </button>
          </div>

          <!-- Upload and remove: the two things that are not an icon. -->
          <div class="flex shrink-0 gap-2 px-4 pt-3">
            <button
              type="button"
              @click="fileInput?.click()"
              :disabled="uploading || busy"
              class="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              <Loader2 v-if="uploading" class="h-4 w-4 animate-spin" />
              <ImagePlus v-else class="h-4 w-4" />
              {{ uploading ? 'Uploading…' : 'Upload image' }}
            </button>
            <button
              v-if="mark"
              type="button"
              @click="emit('save', { icon: '', imageUrl: '' })"
              :disabled="busy"
              class="flex h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-red-500/10 dark:hover:text-red-400"
            >
              <Trash2 class="h-4 w-4" />
              Remove
            </button>
            <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="handleFile" />
          </div>

          <div class="shrink-0 px-4 py-3">
            <div class="relative">
              <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                v-model="query"
                type="search"
                placeholder="Search icons — music, book, hands"
                class="h-10 w-full rounded-lg border border-gray-200 bg-white pl-9 pr-3 text-sm text-gray-900 focus:border-primary focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              />
            </div>
          </div>

          <div class="min-h-0 flex-1 overflow-y-auto px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <div class="grid grid-cols-6 gap-1 sm:grid-cols-8">
              <button
                v-for="icon in shown"
                :key="`${icon}-${iconsReady}`"
                type="button"
                @click="pickIcon(icon)"
                :disabled="busy"
                :title="icon"
                :aria-label="icon"
                :aria-pressed="mark?.icon === icon"
                :class="[
                  'flex aspect-square items-center justify-center rounded-lg transition-colors disabled:opacity-50',
                  mark?.icon === icon
                    ? 'bg-primary/10 text-primary ring-1 ring-primary dark:bg-primary-light/20 dark:text-primary-light'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700',
                ]"
              >
                <component :is="getEventIcon(icon)" class="h-5 w-5" />
              </button>
            </div>
            <p v-if="!shown.length" class="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
              No icons match “{{ query }}”
            </p>
            <p
              v-else-if="matching.length > shown.length"
              class="py-3 text-center text-xs text-gray-400 dark:text-gray-500"
            >
              {{ matching.length - shown.length }} more — keep typing to narrow it
            </p>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.mark-sheet-enter-active,
.mark-sheet-leave-active {
  transition: opacity 0.25s ease;
}
.mark-sheet-enter-from,
.mark-sheet-leave-to {
  opacity: 0;
}
@media (max-width: 639px) {
  .mark-sheet-enter-active > div,
  .mark-sheet-leave-active > div {
    transition: transform 0.25s ease;
  }
  .mark-sheet-enter-from > div,
  .mark-sheet-leave-to > div {
    transform: translateY(100%);
  }
}
</style>

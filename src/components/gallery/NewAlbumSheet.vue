<script setup>
/**
 * An album for photos that were not taken at a gathering on the calendar — a
 * workday on the building, a visit, a baptism at the beach.
 *
 * Gatherings get their albums on their own now, so this is the exception, and
 * it asks for the photos in the same step as the name. The album is not
 * written until they are chosen: backing out of the picker leaves nothing
 * behind, where an album saved first would sit on the list empty until
 * somebody noticed and deleted it. That button used to exist in the toolbar
 * and open nothing at all.
 *
 * A bottom sheet on a phone and a centred card on a desktop, the shape the
 * People sort sheet uses.
 */

import { computed, nextTick, ref, watch } from 'vue'
import { ImagePlus, X } from '../../icons'
import { useFocusTrap } from '../../composables/useFocusTrap'
import { DEFAULT_TIMEZONE, zonedDateString } from '../../../lib/occurrences'

const props = defineProps({
  show: { type: Boolean, default: false },
})

const emit = defineEmits(['close', 'create'])

const title = ref('')
const date = ref('')
const location = ref('')

const titleRef = ref(null)
const fileRef = ref(null)

watch(
  () => props.show,
  async (open) => {
    if (!open) return
    title.value = ''
    date.value = zonedDateString(new Date(), DEFAULT_TIMEZONE)
    location.value = ''
    await nextTick()
    titleRef.value?.focus()
  }
)

const canCreate = computed(() => Boolean(title.value.trim() && date.value))

const dialogRef = ref(null)
useFocusTrap(dialogRef, () => props.show, () => emit('close'))

// Called straight from the click, not after an await: a browser only opens a
// file picker inside the gesture that asked for it.
const choosePhotos = () => {
  if (!canCreate.value) return
  fileRef.value?.click()
}

const onFiles = (event) => {
  const files = Array.from(event.target.files || [])
  event.target.value = ''
  if (!files.length) return
  emit('create', {
    title: title.value.trim(),
    date: date.value,
    location: location.value.trim(),
    files,
  })
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="show"
        class="fixed inset-0 z-100 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4"
        @click.self="emit('close')"
      >
        <div
          ref="dialogRef"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-album-title"
          tabindex="-1"
          class="flex max-h-[85dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-gray-200 bg-white shadow-2xl sm:max-w-sm sm:rounded-2xl dark:border-gray-700 dark:bg-gray-800"
        >
          <div
            class="flex shrink-0 items-center justify-between gap-3 border-b border-gray-200 bg-linear-to-r from-primary/10 to-transparent px-4 py-3.5 dark:border-gray-700 dark:from-primary-light/10"
          >
            <div class="flex min-w-0 items-center gap-3">
              <div class="shrink-0 rounded-xl bg-primary p-2.5 shadow-lg shadow-primary/30">
                <ImagePlus class="h-5 w-5 text-white" />
              </div>
              <div class="min-w-0">
                <h2
                  id="new-album-title"
                  class="truncate text-base font-bold text-gray-900 dark:text-white"
                >
                  New album
                </h2>
                <p class="text-xs text-gray-500 dark:text-gray-400">
                  Gatherings get one on their own
                </p>
              </div>
            </div>
            <button
              @click="emit('close')"
              aria-label="Close"
              class="shrink-0 rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
            >
              <X class="h-5 w-5" />
            </button>
          </div>

          <form
            class="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
            @submit.prevent="choosePhotos"
          >
            <label class="block">
              <span class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">Name</span>
              <input
                ref="titleRef"
                v-model="title"
                type="text"
                enterkeyhint="next"
                placeholder="e.g. Church workday"
                class="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-transparent focus:ring-2 focus:ring-primary dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              />
            </label>

            <div class="grid grid-cols-2 gap-3">
              <label class="block">
                <span class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">Date</span>
                <input
                  v-model="date"
                  type="date"
                  class="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:border-transparent focus:ring-2 focus:ring-primary dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                />
              </label>
              <label class="block">
                <span class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">Place</span>
                <input
                  v-model="location"
                  type="text"
                  placeholder="Optional"
                  class="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-transparent focus:ring-2 focus:ring-primary dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                />
              </label>
            </div>

            <button
              type="submit"
              :disabled="!canCreate"
              class="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-white shadow-lg shadow-primary/25 transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none dark:disabled:bg-gray-700"
            >
              <ImagePlus class="h-4 w-4" />
              Choose photos
            </button>
            <p class="text-center text-xs text-gray-400 dark:text-gray-500">
              The album is saved with its first photos.
            </p>

            <input
              ref="fileRef"
              type="file"
              accept="image/*"
              multiple
              class="hidden"
              @change="onFiles"
            />
          </form>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.25s ease;
}

.modal-enter-active > div,
.modal-leave-active > div {
  transition: transform 0.25s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

@media (max-width: 639px) {
  .modal-enter-from > div,
  .modal-leave-to > div {
    transform: translateY(100%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .modal-enter-active,
  .modal-leave-active,
  .modal-enter-active > div,
  .modal-leave-active > div {
    transition: none;
  }
}
</style>

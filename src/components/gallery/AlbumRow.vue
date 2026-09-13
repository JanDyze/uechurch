<script setup>
/**
 * An album with nothing in it yet — almost always a gathering that has
 * happened and has not been photographed, or not uploaded.
 *
 * One line, not a card. There is no picture to show, and a picture-shaped gap
 * says "something is missing" louder than anything on the page that is
 * actually there. The date is a shape rather than a sentence, the way the
 * Minutes list draws a meeting nobody has opened, and dashed for the same
 * reason: the row is a standing offer, not a record.
 *
 * A tap goes straight to the photo picker. Adding photos is the only thing an
 * empty album is for, so opening it first would be a screen with one button.
 */

import { computed } from 'vue'
import { ChevronRight, ImagePlus, Loader2 } from '../../icons'

const props = defineProps({
  album: { type: Object, required: true },
  uploading: { type: Boolean, default: false },
})

const emit = defineEmits(['add'])

const when = computed(() => {
  const [year, month, day] = String(props.album.date || '').split('-').map(Number)
  if (!year || !month || !day) return { day: '—', month: '' }
  const date = new Date(year, month - 1, day)
  return {
    day: String(day),
    month: date.toLocaleDateString('en-US', { month: 'short' }),
    weekday: date.toLocaleDateString('en-US', { weekday: 'long' }),
  }
})

// The weekday and the place, when there is one. The category is left off: on
// a list of services it is "Worship" on every row.
const detail = computed(() =>
  [when.value.weekday, props.album.location].filter(Boolean).join(' · ')
)
</script>

<template>
  <button
    type="button"
    @click="emit('add', album)"
    :disabled="uploading"
    class="group flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-gray-50 sm:px-4 dark:hover:bg-gray-700/50"
  >
    <div
      class="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 text-gray-500 dark:border-gray-600 dark:text-gray-400"
    >
      <span class="text-sm font-bold leading-none tabular-nums">{{ when.day }}</span>
      <span class="text-[9px] font-semibold uppercase tracking-wide opacity-70">
        {{ when.month }}
      </span>
    </div>

    <div class="min-w-0 flex-1">
      <p class="truncate text-sm font-medium text-gray-700 dark:text-gray-200">
        {{ album.title || 'Untitled album' }}
      </p>
      <p v-if="detail" class="truncate text-xs text-gray-400 dark:text-gray-500">
        {{ detail }}
      </p>
    </div>

    <!-- A row standing in for a cover that failed to load still has photos
         behind it, so it opens rather than offering to add more. -->
    <ChevronRight
      v-if="album.coverBroken"
      class="h-4 w-4 shrink-0 text-gray-300 transition-transform group-hover:translate-x-0.5 dark:text-gray-600"
    />
    <span
      v-else
      class="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-primary transition-colors group-hover:bg-primary/10 dark:text-primary-light"
    >
      <Loader2 v-if="uploading" class="h-3.5 w-3.5 animate-spin" />
      <ImagePlus v-else class="h-3.5 w-3.5" />
      <span class="hidden min-[360px]:inline">{{ uploading ? 'Adding…' : 'Add photos' }}</span>
    </span>
  </button>
</template>

<script setup>
/**
 * An album with photos in it, shown as its cover.
 *
 * Only albums that have something to show get a card. A gathering nobody has
 * photographed yet used to get one too, drawn over a stock picture of the
 * church with a "No photos yet" badge — so the page read as a wall of the same
 * building, and the albums with real pictures in them were the hard ones to
 * find. Those are AlbumRow now.
 */

import { formatShortDate } from '../../../lib/occurrences'

defineProps({
  album: { type: Object, required: true },
})

// A cover whose file has gone — deleted from the store before covers were kept
// in step with photos — must not render as a broken image. The page drops the
// album back to a plain row instead.
const emit = defineEmits(['open', 'broken'])
</script>

<template>
  <button
    type="button"
    @click="emit('open', album)"
    class="group relative block aspect-4/3 w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-100 text-left transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none dark:border-gray-700 dark:bg-gray-900"
  >
    <img
      :src="album.coverUrl"
      alt=""
      loading="lazy"
      decoding="async"
      @error="emit('broken', album)"
      class="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
    />
    <div
      class="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/80 via-black/40 to-transparent px-2.5 pt-8 pb-2 sm:px-3 sm:pb-2.5"
    >
      <p class="line-clamp-2 text-sm font-semibold leading-snug text-white">
        {{ album.title || 'Untitled album' }}
      </p>
      <p class="mt-0.5 truncate text-[11px] font-medium text-white/75">
        {{ album.date ? formatShortDate(album.date) : 'No date' }}
      </p>
    </div>
  </button>
</template>

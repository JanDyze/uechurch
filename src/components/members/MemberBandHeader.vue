<script setup>
// The heading over one age band on the People list. Same bands, same colours
// as the summary bar above it and the attendance recorder — utils/ageBands.js
// is the one place they are defined.

defineProps({
  band: {
    type: Object,
    required: true,
  },
  count: {
    type: Number,
    default: 0,
  },
  /** Selection mode: the heading doubles as "take this whole band". */
  picking: {
    type: Boolean,
    default: false,
  },
  checked: {
    type: Boolean,
    default: false,
  },
})

defineEmits(['toggle'])
</script>

<template>
  <div
    class="sticky top-0 z-20 flex items-center gap-2 border-b border-gray-100 bg-white/95 px-3 py-2 backdrop-blur dark:border-gray-700 dark:bg-gray-800/95"
  >
    <span :class="['h-2 w-2 shrink-0 rounded-full', band.dotClass]"></span>
    <span class="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
      {{ band.label }}
    </span>
    <span class="text-xs tabular-nums text-gray-400 dark:text-gray-500">{{ count }}</span>

    <!-- Tagging a whole age band is the common bulk edit — the kids become
         WLA Kids, the youth get a tag of their own — so picking one is one tap
         from its heading rather than a scroll and forty. -->
    <button
      v-if="picking"
      type="button"
      @click="$emit('toggle')"
      class="ml-auto rounded px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 dark:text-primary-light"
    >
      {{ checked ? 'Clear' : `Select all ${count}` }}
    </button>
  </div>
</template>

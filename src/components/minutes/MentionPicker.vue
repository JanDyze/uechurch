<script setup>
// The list that appears under the caret when someone types "@" in the notes.
// Teleported and fixed rather than positioned inside the editor: the editor
// scrolls and clips, and a list that scrolls away from the word it belongs to
// is worse than no list.

import { UserRound } from '../../icons'

defineProps({
  open: { type: Boolean, default: false },
  matches: { type: Array, default: () => [] },
  activeIndex: { type: Number, default: 0 },
  anchor: { type: Object, default: () => ({ top: 0, left: 0, flip: false }) },
})

const emit = defineEmits(['choose', 'hover'])
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open && matches.length"
      class="fixed z-90 w-60 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-600 dark:bg-gray-800"
      :style="{
        top: `${anchor.top}px`,
        left: `${anchor.left}px`,
        transform: anchor.flip ? 'translateY(-100%)' : 'none',
      }"
      role="listbox"
      aria-label="Mention someone"
    >
      <button
        v-for="(match, index) in matches"
        :key="match.id"
        type="button"
        role="option"
        :aria-selected="index === activeIndex"
        @mousedown.prevent="emit('choose', match)"
        @mouseenter="emit('hover', index)"
        :class="[
          'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors',
          index === activeIndex
            ? 'bg-primary text-white'
            : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700',
        ]"
      >
        <UserRound
          :class="['h-4 w-4 shrink-0', index === activeIndex ? 'text-white/80' : 'text-gray-400']"
        />
        <span class="min-w-0 flex-1">
          <span class="block truncate">{{ match.name }}</span>
          <span
            v-if="match.formal"
            :class="[
              'block truncate text-xs',
              index === activeIndex ? 'text-white/70' : 'text-gray-400 dark:text-gray-500',
            ]"
          >
            {{ match.formal }}
          </span>
        </span>
      </button>
    </div>
  </Teleport>
</template>

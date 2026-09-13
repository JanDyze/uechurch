<script setup>
// The same search bar People and Minutes open from their floating button. It
// replaces a permanent action bar that carried a category filter as well:
// categories were a second thing to keep up in Settings, and everything they
// could narrow to — a service, a month, a place — is already written on the
// album and so can simply be typed.

import { computed, nextTick, ref, watch } from 'vue'
import { Search, X } from '../../icons'

const props = defineProps({
  searchQuery: { type: String, default: '' },
  resultCount: { type: Number, default: 0 },
  totalCount: { type: Number, default: 0 },
  open: { type: Boolean, default: false },
})

const emit = defineEmits(['update:searchQuery', 'close'])

// The placeholder has to teach what the box reaches: nobody tries typing
// "empty" into a search bar unless something says they can.
const placeholder = 'Gathering, month, place — or "empty"'

const showCount = computed(() => Boolean(props.searchQuery))

const inputRef = ref(null)
const desktopInputRef = ref(null)
watch(
  () => props.open,
  async (isOpen) => {
    if (!isOpen) return
    await nextTick()
    ;(inputRef.value || desktopInputRef.value)?.focus()
  }
)

const closeSearch = () => emit('close')
</script>

<template>
  <div
    v-if="open"
    class="sticky top-0 z-40 mb-3 shrink-0 rounded-xl border border-gray-200/80 bg-white/95 px-2 py-2 shadow-sm backdrop-blur dark:border-gray-700 dark:bg-gray-900/95 sm:px-3 lg:mb-4"
  >
    <!-- Mobile -->
    <div class="relative lg:hidden">
      <Search
        class="pointer-events-none absolute left-3 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-gray-400"
      />
      <input
        ref="inputRef"
        :value="searchQuery"
        @input="emit('update:searchQuery', $event.target.value)"
        @keyup.escape="closeSearch"
        type="text"
        inputmode="search"
        enterkeyhint="search"
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        aria-label="Search albums"
        :placeholder="placeholder"
        class="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 pl-9.5 pr-9 text-sm text-gray-900 placeholder:text-gray-400 focus:border-transparent focus:bg-white focus:ring-2 focus:ring-primary focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:focus:bg-gray-800"
      />
      <button
        @click="searchQuery ? emit('update:searchQuery', '') : closeSearch()"
        class="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-gray-400 active:bg-gray-100 dark:active:bg-gray-700"
        :aria-label="searchQuery ? 'Clear search' : 'Close search'"
      >
        <X class="h-4 w-4" />
      </button>
    </div>

    <p
      v-if="showCount"
      class="mt-2 text-[11px] font-semibold tabular-nums text-gray-500 lg:hidden dark:text-gray-400"
    >
      {{ resultCount }} of {{ totalCount }}
    </p>

    <!-- Desktop -->
    <div class="hidden w-full items-center gap-3 lg:flex">
      <div class="relative flex-1">
        <Search
          class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
        />
        <input
          ref="desktopInputRef"
          :value="searchQuery"
          @input="emit('update:searchQuery', $event.target.value)"
          @keyup.escape="closeSearch"
          type="text"
          autocomplete="off"
          aria-label="Search albums"
          :placeholder="placeholder"
          class="h-9 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-9 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:ring-2 focus:ring-primary dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        />
        <button
          @click="searchQuery ? emit('update:searchQuery', '') : closeSearch()"
          class="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
          :aria-label="searchQuery ? 'Clear search' : 'Close search'"
        >
          <X class="h-4 w-4" />
        </button>
      </div>
      <span
        v-if="showCount"
        class="shrink-0 text-xs font-semibold tabular-nums text-gray-500 dark:text-gray-400"
      >
        {{ resultCount }} of {{ totalCount }}
      </span>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick } from 'vue'
import { Search, X } from '../../icons'

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  placeholder: {
    type: String,
    default: 'Search...'
  },
  open: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue', 'update:open'])

const inputRef = ref(null)
const desktopInputRef = ref(null)

const openSearch = async () => {
  emit('update:open', true)
  await nextTick()
  inputRef.value?.focus()
}

const closeSearch = () => {
  emit('update:open', false)
  emit('update:modelValue', '')
}

// Emptying the box is a different intention from putting it away, and the
// search is the only control these pages have: someone who has just read the
// results for "youth" and wants to look up a name next should not have to
// select the text or collapse the bar to do it. Focus stays in the box, so the
// next query is simply typed.
const clearAndFocus = async (target) => {
  emit('update:modelValue', '')
  await nextTick()
  target.value?.focus()
}

const clearDesktop = () => clearAndFocus(desktopInputRef)

// One button, because the expanded mobile bar has no room for two. With
// something typed it empties the box and keeps the bar open; empty, it puts
// the bar away — which is what the same tap has always done.
const clearOrClose = () => {
  if (props.modelValue) {
    clearAndFocus(inputRef)
    return
  }
  closeSearch()
}
</script>

<template>
  <!-- Desktop: always-visible inline search -->
  <div class="relative hidden lg:block lg:flex-1">
    <Search class="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
    <input
      ref="desktopInputRef"
      :value="modelValue"
      @input="emit('update:modelValue', $event.target.value)"
      @keyup.escape="clearDesktop"
      type="text"
      :placeholder="placeholder"
      class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 py-2 pl-10 pr-9 text-sm text-gray-900 dark:text-white focus:border-transparent focus:ring-2 focus:ring-primary"
    />
    <button
      v-if="modelValue"
      @click="clearDesktop"
      title="Clear search"
      aria-label="Clear search"
      class="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
    >
      <X class="h-4 w-4" />
    </button>
  </div>

  <!-- Mobile: icon-only trigger -->
  <button
    v-if="!open"
    @click="openSearch"
    class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors hover:bg-gray-200 dark:hover:bg-gray-600 lg:hidden"
    title="Search"
  >
    <Search class="h-5 w-5" />
  </button>

  <!-- Mobile: expanded search -->
  <div v-else class="relative flex-1 lg:hidden">
    <Search class="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
    <input
      ref="inputRef"
      :value="modelValue"
      @input="emit('update:modelValue', $event.target.value)"
      @keyup.escape="clearOrClose"
      type="text"
      :placeholder="placeholder"
      class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 py-2 pl-10 pr-9 text-sm text-gray-900 dark:text-white focus:border-transparent focus:ring-2 focus:ring-primary"
    />
    <button
      @click="clearOrClose"
      class="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
      :title="modelValue ? 'Clear search' : 'Close search'"
      :aria-label="modelValue ? 'Clear search' : 'Close search'"
    >
      <X class="h-4 w-4" />
    </button>
  </div>
</template>

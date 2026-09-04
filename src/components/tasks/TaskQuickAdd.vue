<script setup>
import { ref } from 'vue'
import { Plus, Loader2 } from '../../icons'

// The whole reason a to-do list gets used or abandoned. "Buy candles" does not
// deserve a drawer, a member picker and a priority select — it deserves a line
// you type and press Enter on, and the details can be filled in later by
// tapping the row. The full editor is still one button away in the toolbar.

const emit = defineEmits(['add'])

const title = ref('')
const saving = ref(false)
const inputRef = ref(null)

// The page owns the write, so it reports back through a callback rather than
// the box guessing: a failed save has to leave the words in the input, not
// clear them and expect the person to remember what they typed.
const submit = () => {
  const text = title.value.trim()
  if (!text || saving.value) return

  saving.value = true
  emit('add', text, (saved) => {
    saving.value = false
    if (saved) title.value = ''
    // Focus stays put: a list is written in bursts, and reaching back for the
    // box between each line is what stops people writing the second one.
    inputRef.value?.focus()
  })
}
</script>

<template>
  <form
    @submit.prevent="submit"
    class="mb-3 flex shrink-0 items-center gap-2 rounded-xl border border-dashed border-gray-300 bg-white px-3 py-2 focus-within:border-primary focus-within:border-solid dark:border-gray-600 dark:bg-gray-800 dark:focus-within:border-primary-light"
  >
    <Plus class="h-5 w-5 shrink-0 text-gray-400" />
    <input
      ref="inputRef"
      v-model="title"
      type="text"
      enterkeyhint="done"
      placeholder="Add a task..."
      aria-label="Add a task"
      class="min-w-0 flex-1 bg-transparent text-sm text-gray-900 placeholder-gray-400 focus:outline-none dark:text-white"
    />
    <button
      type="submit"
      :disabled="!title.trim() || saving"
      :class="[
        'shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
        title.trim() && !saving
          ? 'bg-primary text-white hover:bg-primary-hover'
          : 'cursor-not-allowed bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500'
      ]"
    >
      <Loader2 v-if="saving" class="h-4 w-4 animate-spin" />
      <span v-else>Add</span>
    </button>
  </form>
</template>

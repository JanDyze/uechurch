<script setup>
// Picking how the People list is arranged. A bottom sheet on a phone and a
// centred card on a desktop, the same shape the bulk-assign sheet uses.
import { ref } from 'vue'
import { ArrowUpDown, Check, X } from '../../icons'
import { useFocusTrap } from '../../composables/useFocusTrap'

const props = defineProps({
  show: { type: Boolean, default: false },
  options: { type: Array, default: () => [] },
  modelValue: { type: String, default: 'name' },
})

const emit = defineEmits(['update:modelValue', 'close'])

const dialogRef = ref(null)
useFocusTrap(dialogRef, () => props.show, () => emit('close'))

const pick = (key) => {
  emit('update:modelValue', key)
  emit('close')
}
</script>

<template>
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
        aria-labelledby="members-sort-title"
        tabindex="-1"
        class="flex max-h-[85dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-gray-200 bg-white shadow-2xl sm:max-w-sm sm:rounded-2xl dark:border-gray-700 dark:bg-gray-800"
      >
        <div
          class="flex shrink-0 items-center justify-between gap-3 border-b border-gray-200 bg-linear-to-r from-primary/10 to-transparent px-4 py-3.5 dark:border-gray-700 dark:from-primary-light/10"
        >
          <div class="flex min-w-0 items-center gap-3">
            <div class="shrink-0 rounded-xl bg-primary p-2.5 shadow-lg shadow-primary/30">
              <ArrowUpDown class="h-5 w-5 text-white" />
            </div>
            <div class="min-w-0">
              <h2
                id="members-sort-title"
                class="truncate text-base font-bold text-gray-900 dark:text-white"
              >
                Sort people by
              </h2>
              <p class="text-xs text-gray-500 dark:text-gray-400">
                The headings follow the sort
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

        <div class="min-h-0 flex-1 overflow-y-auto p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <button
            v-for="option in options"
            :key="option.key"
            @click="pick(option.key)"
            :aria-current="option.key === modelValue ? 'true' : undefined"
            :class="[
              'flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors',
              option.key === modelValue
                ? 'bg-primary/10 dark:bg-primary-light/15'
                : 'hover:bg-gray-100 dark:hover:bg-gray-700/60',
            ]"
          >
            <span class="min-w-0 flex-1">
              <span
                :class="[
                  'block truncate text-sm font-semibold',
                  option.key === modelValue
                    ? 'text-primary dark:text-primary-light'
                    : 'text-gray-900 dark:text-white',
                ]"
              >
                {{ option.label }}
              </span>
              <span class="block truncate text-xs text-gray-500 dark:text-gray-400">
                {{ option.hint }}
              </span>
            </span>
            <Check
              v-if="option.key === modelValue"
              class="h-4.5 w-4.5 shrink-0 text-primary dark:text-primary-light"
            />
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

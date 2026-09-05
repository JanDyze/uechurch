<script setup>
import { ref, watch } from 'vue'
import { X } from '../../icons'
import { useFocusTrap } from '../../composables/useFocusTrap'
import { useToast } from '../../composables/useToast'
import { centavosToInput, parseAmount } from '../../utils/moneyUtils'
import { todayIso } from '../../utils/ledgerUtils'

const props = defineProps({
  show: { type: Boolean, default: false },
  opening: { type: Object, default: () => ({}) },
  saving: { type: Boolean, default: false },
})

const emit = defineEmits(['update:show', 'save'])

const toast = useToast()

const asOf = ref('')
const cashText = ref('')
const bankText = ref('')

watch(
  () => props.show,
  (open) => {
    if (!open) return
    asOf.value = props.opening?.asOf || todayIso()
    cashText.value = centavosToInput(props.opening?.cash || 0)
    bankText.value = centavosToInput(props.opening?.bank || 0)
  }
)

const close = () => emit('update:show', false)

const save = () => {
  if (!asOf.value) {
    toast.error('Give the opening balance a date')
    return
  }
  emit('save', {
    asOf: asOf.value,
    cash: Math.abs(parseAmount(cashText.value)),
    bank: Math.abs(parseAmount(bankText.value)),
  })
}

const dialogRef = ref(null)
useFocusTrap(dialogRef, () => props.show, close)

const fieldClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-primary placeholder:text-gray-400 dark:border-gray-600 dark:bg-gray-900 dark:text-white'
const labelClass = 'mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300'
</script>

<template>
  <Teleport to="body">
    <Transition name="opening-sheet">
      <div
        v-if="show"
        class="fixed inset-0 z-120 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-4"
        @click.self="close"
      >
        <div
          ref="dialogRef"
          role="dialog"
          aria-modal="true"
          aria-labelledby="opening-title"
          tabindex="-1"
          class="flex w-full flex-col rounded-t-2xl bg-white shadow-xl dark:bg-gray-800 sm:max-w-md sm:rounded-2xl"
          @click.stop
        >
          <div
            class="flex shrink-0 items-center justify-between border-b border-gray-200 px-4 py-4 dark:border-gray-700 sm:px-6"
          >
            <h3 id="opening-title" class="text-lg font-semibold text-gray-900 dark:text-white">
              Opening balance
            </h3>
            <button
              @click="close"
              aria-label="Close"
              class="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
            >
              <X class="h-5 w-5" />
            </button>
          </div>

          <div class="space-y-4 p-4 sm:p-6">
            <p class="text-sm text-gray-500 dark:text-gray-400">
              What the church held when it started keeping the books here. Every later month counts
              forward from this, so it is entered once — and anything dated before it is treated as
              already inside these figures.
            </p>

            <div>
              <label for="opening-date" :class="labelClass">Balances as of</label>
              <input id="opening-date" v-model="asOf" type="date" :class="fieldClass" />
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label for="opening-cash" :class="labelClass">Cash on hand</label>
                <input
                  id="opening-cash"
                  v-model="cashText"
                  type="text"
                  inputmode="decimal"
                  placeholder="0.00"
                  :class="fieldClass"
                />
              </div>
              <div>
                <label for="opening-bank" :class="labelClass">In bank</label>
                <input
                  id="opening-bank"
                  v-model="bankText"
                  type="text"
                  inputmode="decimal"
                  placeholder="0.00"
                  :class="fieldClass"
                />
              </div>
            </div>
          </div>

          <div
            class="flex shrink-0 items-center justify-end gap-3 border-t border-gray-200 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] dark:border-gray-700 sm:px-6 sm:pb-4"
          >
            <button
              @click="close"
              class="rounded-lg bg-gray-100 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              @click="save"
              :disabled="saving"
              class="rounded-lg px-4 py-2 font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              :style="{ background: 'var(--color-primary)' }"
            >
              {{ saving ? 'Saving…' : 'Save' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.opening-sheet-enter-active,
.opening-sheet-leave-active {
  transition: opacity 0.25s ease;
}

.opening-sheet-enter-from,
.opening-sheet-leave-to {
  opacity: 0;
}

@media (max-width: 639px) {
  .opening-sheet-enter-active > div,
  .opening-sheet-leave-active > div {
    transition: transform 0.25s ease;
  }

  .opening-sheet-enter-from > div,
  .opening-sheet-leave-to > div {
    transform: translateY(100%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .opening-sheet-enter-active,
  .opening-sheet-leave-active,
  .opening-sheet-enter-active > div,
  .opening-sheet-leave-active > div {
    transition: none;
  }
}
</style>

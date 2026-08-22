<script setup>
import { ref, computed, watch } from 'vue'
import { X, Wallet, Landmark } from 'lucide-vue-next'
import { formatPeso } from '../../composables/useFinances'

const props = defineProps({
  show: { type: Boolean, default: false },
  opening: { type: Object, required: true },
  saving: { type: Boolean, default: false },
})

const emit = defineEmits(['update:show', 'save'])

const form = ref({ asOf: '', cashOnHand: '', bankEastwest: '' })

watch(
  () => props.show,
  (open) => {
    if (!open) return
    form.value = {
      asOf: props.opening.asOf || `${new Date().getFullYear()}-01-01`,
      cashOnHand: String(props.opening.cashOnHand ?? ''),
      bankEastwest: String(props.opening.bankEastwest ?? ''),
    }
  }
)

const toNumber = (value) => Number(String(value).replace(/,/g, '')) || 0

const total = computed(() => toNumber(form.value.cashOnHand) + toNumber(form.value.bankEastwest))
const isValid = computed(() => Boolean(form.value.asOf))

const close = () => emit('update:show', false)

const handleSave = () => {
  if (!isValid.value || props.saving) return
  emit('save', {
    asOf: form.value.asOf,
    cashOnHand: toNumber(form.value.cashOnHand),
    bankEastwest: toNumber(form.value.bankEastwest),
  })
}

const inputClass =
  'w-full h-11 pl-8 pr-3 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-1 focus:ring-primary focus:border-primary'
</script>

<template>
  <Teleport to="body">
    <Transition name="sheet">
      <div
        v-if="show"
        class="fixed inset-0 z-80 flex flex-col justify-end sm:items-center sm:justify-center"
      >
        <div class="absolute inset-0 bg-black/50" @click="close" />

        <div
          class="sheet-panel relative z-10 w-full sm:max-w-md max-h-[92dvh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-white dark:bg-gray-800 shadow-2xl border-t sm:border border-gray-200 dark:border-gray-700"
        >
          <div
            class="shrink-0 flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700"
          >
            <h3 class="text-base font-semibold text-gray-900 dark:text-white">Starting balance</h3>
            <button
              @click="close"
              class="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              aria-label="Close"
            >
              <X class="h-5 w-5" />
            </button>
          </div>

          <div class="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            <p class="text-xs text-gray-500 dark:text-gray-400">
              Enter what each account held before the first transaction you record here. Every
              month after it rolls forward on its own.
            </p>

            <div>
              <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Balance at the start of
              </label>
              <input
                v-model="form.asOf"
                type="date"
                class="w-full h-11 px-3 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-1 focus:ring-primary focus:border-primary"
              />
            </div>

            <div>
              <label
                class="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
              >
                <Wallet class="h-3.5 w-3.5" /> Cash on Hand
              </label>
              <div class="relative">
                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">₱</span>
                <input
                  v-model="form.cashOnHand"
                  type="text"
                  inputmode="decimal"
                  placeholder="0.00"
                  :class="inputClass"
                />
              </div>
            </div>

            <div>
              <label
                class="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
              >
                <Landmark class="h-3.5 w-3.5" /> Cash in Bank - Eastwest
              </label>
              <div class="relative">
                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">₱</span>
                <input
                  v-model="form.bankEastwest"
                  type="text"
                  inputmode="decimal"
                  placeholder="0.00"
                  :class="inputClass"
                />
              </div>
            </div>

            <div
              class="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-gray-700/40 px-3 py-2.5"
            >
              <span class="text-xs font-medium text-gray-500 dark:text-gray-400">
                Beginning balance
              </span>
              <span class="text-sm font-semibold text-gray-900 dark:text-white">
                {{ formatPeso(total) }}
              </span>
            </div>
          </div>

          <div
            class="shrink-0 flex gap-3 px-5 py-4 border-t border-gray-200 dark:border-gray-700 pb-[max(1rem,env(safe-area-inset-bottom))]"
          >
            <button
              @click="close"
              class="flex-1 h-11 rounded-lg border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              @click="handleSave"
              :disabled="!isValid || saving"
              :class="[
                'flex-1 h-11 rounded-lg text-sm font-semibold transition-colors',
                isValid && !saving
                  ? 'bg-primary text-white shadow-sm hover:bg-primary-hover'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed',
              ]"
            >
              {{ saving ? 'Saving...' : 'Save' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.sheet-enter-active,
.sheet-leave-active {
  transition: opacity 0.25s ease;
}

.sheet-enter-active .sheet-panel,
.sheet-leave-active .sheet-panel {
  transition: transform 0.25s ease;
}

.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
}

.sheet-enter-from .sheet-panel,
.sheet-leave-to .sheet-panel {
  transform: translateY(100%);
}

@media (min-width: 640px) {
  .sheet-enter-from .sheet-panel,
  .sheet-leave-to .sheet-panel {
    transform: scale(0.96);
  }
}
</style>

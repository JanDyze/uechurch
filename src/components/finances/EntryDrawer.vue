<script setup>
import { computed, ref, watch } from 'vue'
import { Trash2, X } from '../../icons'
import { useFocusTrap } from '../../composables/useFocusTrap'
import { useToast } from '../../composables/useToast'
import { ACCOUNTS, CASH, BANK, DIRECTIONS, categoryOptions } from '../../data/financeChart'
import { centavosToInput, formatMoney, parseAmount } from '../../utils/moneyUtils'
import { todayIso } from '../../utils/ledgerUtils'

const props = defineProps({
  show: { type: Boolean, default: false },
  entry: { type: Object, default: null },
  saving: { type: Boolean, default: false },
})

const emit = defineEmits(['update:show', 'save', 'delete'])

const toast = useToast()

const date = ref(todayIso())
const direction = ref('in')
const amountText = ref('')
const description = ref('')
const categoryKey = ref('')
const account = ref(CASH)
const toAccount = ref(BANK)
const payee = ref('')
const notes = ref('')
const amountRef = ref(null)

const isEdit = computed(() => Boolean(props.entry))

// A category is one <option>, so the two keys travel as one string.
const packed = (c, s) => `${c || ''}|${s || ''}`
const options = computed(() => categoryOptions(direction.value))
const grouped = computed(() => {
  const byGroup = new Map()
  for (const option of options.value) {
    if (!byGroup.has(option.group)) byGroup.set(option.group, [])
    byGroup.get(option.group).push(option)
  }
  return [...byGroup.entries()].map(([label, items]) => ({ label, items }))
})

watch(
  () => props.show,
  (open) => {
    if (!open) return
    const e = props.entry
    date.value = e?.date || todayIso()
    direction.value = e?.direction || 'in'
    amountText.value = e ? centavosToInput(e.amount) : ''
    description.value = e?.description || ''
    categoryKey.value = e ? packed(e.category, e.subcategory) : ''
    account.value = e?.account || CASH
    toAccount.value = e?.toAccount || (e?.account === BANK ? CASH : BANK)
    payee.value = e?.payee || ''
    notes.value = e?.notes || ''
    requestAnimationFrame(() => amountRef.value?.focus())
  }
)

// Switching direction invalidates the category — an expense line is not an
// income line, and silently keeping the old key would file it under nothing.
watch(direction, () => {
  categoryKey.value = ''
  if (direction.value === 'transfer' && account.value === toAccount.value) {
    toAccount.value = account.value === CASH ? BANK : CASH
  }
})

// The two ends of a transfer can never be the same account.
watch(account, () => {
  if (direction.value === 'transfer' && toAccount.value === account.value) {
    toAccount.value = account.value === CASH ? BANK : CASH
  }
})

const amountCentavos = computed(() => Math.abs(parseAmount(amountText.value)))
const isTransfer = computed(() => direction.value === 'transfer')

const close = () => emit('update:show', false)

const save = () => {
  if (!date.value) return fail('Give the entry a date')
  if (amountCentavos.value <= 0) return fail('Enter an amount', amountRef)
  if (!description.value.trim()) return fail('Say what this was for')
  if (!isTransfer.value && !categoryKey.value) return fail('Choose a statement line')

  const [category, subcategory] = categoryKey.value.split('|')

  emit('save', {
    date: date.value,
    direction: direction.value,
    amount: amountCentavos.value,
    description: description.value.trim(),
    category: isTransfer.value ? '' : category || '',
    subcategory: isTransfer.value ? '' : subcategory || '',
    account: account.value,
    toAccount: isTransfer.value ? toAccount.value : '',
    payee: payee.value.trim(),
    notes: notes.value.trim(),
  })
}

// Validated on press rather than by disabling Save: a button that will not
// press and will not say why is the harder thing to work out.
const fail = (message, focusRef) => {
  toast.error(message)
  focusRef?.value?.focus()
}

const dialogRef = ref(null)
useFocusTrap(dialogRef, () => props.show, close)

const fieldClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-primary placeholder:text-gray-400 dark:border-gray-600 dark:bg-gray-900 dark:text-white'
const labelClass = 'mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300'
</script>

<template>
  <Teleport to="body">
    <Transition name="entry-drawer">
      <div
        v-if="show"
        class="fixed inset-0 z-120 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-4"
        @click.self="close"
      >
        <div
          ref="dialogRef"
          role="dialog"
          aria-modal="true"
          aria-labelledby="entry-drawer-title"
          tabindex="-1"
          class="flex max-h-[92dvh] w-full flex-col rounded-t-2xl bg-white shadow-xl dark:bg-gray-800 sm:max-w-lg sm:rounded-2xl"
          @click.stop
        >
          <div
            class="flex shrink-0 items-center justify-between border-b border-gray-200 px-4 py-4 dark:border-gray-700 sm:px-6"
          >
            <h3 id="entry-drawer-title" class="text-lg font-semibold text-gray-900 dark:text-white">
              {{ isEdit ? 'Edit entry' : 'New entry' }}
            </h3>
            <button
              @click="close"
              aria-label="Close"
              class="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
            >
              <X class="h-5 w-5" />
            </button>
          </div>

          <div class="flex-1 overflow-y-auto p-4 sm:p-6">
            <form @submit.prevent="save" class="space-y-4">
              <!-- Direction decides what the rest of the form even asks. -->
              <div class="grid grid-cols-3 gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-700">
                <button
                  v-for="option in DIRECTIONS"
                  :key="option.key"
                  type="button"
                  @click="direction = option.key"
                  :aria-pressed="direction === option.key"
                  :class="[
                    'rounded-md px-2 py-1.5 text-sm font-medium transition-colors',
                    direction === option.key
                      ? option.key === 'in'
                        ? 'bg-white text-green-700 shadow-sm dark:bg-gray-800 dark:text-green-400'
                        : option.key === 'out'
                          ? 'bg-white text-red-700 shadow-sm dark:bg-gray-800 dark:text-red-400'
                          : 'bg-white text-gray-800 shadow-sm dark:bg-gray-800 dark:text-gray-100'
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
                  ]"
                >
                  {{ option.label }}
                </button>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label for="entry-amount" :class="labelClass">
                    Amount <span class="text-red-500">*</span>
                  </label>
                  <input
                    id="entry-amount"
                    ref="amountRef"
                    v-model="amountText"
                    type="text"
                    inputmode="decimal"
                    placeholder="0.00"
                    :class="fieldClass"
                  />
                  <p class="mt-1 text-xs text-gray-400 dark:text-gray-500">
                    {{ formatMoney(amountCentavos) }}
                  </p>
                </div>
                <div>
                  <label for="entry-date" :class="labelClass">
                    Date <span class="text-red-500">*</span>
                  </label>
                  <input id="entry-date" v-model="date" type="date" :class="fieldClass" />
                </div>
              </div>

              <div>
                <label for="entry-description" :class="labelClass">
                  What was this <span class="text-red-500">*</span>
                </label>
                <input
                  id="entry-description"
                  v-model="description"
                  type="text"
                  :placeholder="isTransfer ? 'Deposit to bank' : 'Sunday offering'"
                  :class="fieldClass"
                />
              </div>

              <!-- A transfer has no statement line: it is not income or expense. -->
              <div v-if="!isTransfer">
                <label for="entry-category" :class="labelClass">
                  Statement line <span class="text-red-500">*</span>
                </label>
                <select id="entry-category" v-model="categoryKey" :class="fieldClass">
                  <option value="">Choose a line…</option>
                  <optgroup v-for="group in grouped" :key="group.label" :label="group.label">
                    <option
                      v-for="option in group.items"
                      :key="packed(option.category, option.subcategory)"
                      :value="packed(option.category, option.subcategory)"
                    >
                      {{ option.label }}
                    </option>
                  </optgroup>
                </select>
              </div>

              <div class="grid gap-3" :class="isTransfer ? 'grid-cols-2' : 'grid-cols-1'">
                <div>
                  <label for="entry-account" :class="labelClass">
                    {{ isTransfer ? 'From' : 'Account' }}
                  </label>
                  <select id="entry-account" v-model="account" :class="fieldClass">
                    <option v-for="a in ACCOUNTS" :key="a.key" :value="a.key">{{ a.label }}</option>
                  </select>
                </div>
                <div v-if="isTransfer">
                  <label for="entry-to-account" :class="labelClass">To</label>
                  <select id="entry-to-account" v-model="toAccount" :class="fieldClass">
                    <option
                      v-for="a in ACCOUNTS"
                      :key="a.key"
                      :value="a.key"
                      :disabled="a.key === account"
                    >
                      {{ a.label }}
                    </option>
                  </select>
                </div>
              </div>

              <div v-if="!isTransfer">
                <label for="entry-payee" :class="labelClass">
                  {{ direction === 'in' ? 'Received from' : 'Paid to' }}
                </label>
                <input
                  id="entry-payee"
                  v-model="payee"
                  type="text"
                  placeholder="Optional"
                  :class="fieldClass"
                />
              </div>

              <div>
                <label for="entry-notes" :class="labelClass">Notes</label>
                <textarea
                  id="entry-notes"
                  v-model="notes"
                  rows="2"
                  placeholder="Optional"
                  :class="[fieldClass, 'resize-none']"
                ></textarea>
              </div>
            </form>
          </div>

          <div
            class="flex shrink-0 items-center justify-end gap-3 border-t border-gray-200 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] dark:border-gray-700 sm:px-6 sm:pb-4"
          >
            <button
              v-if="isEdit"
              @click="emit('delete', entry)"
              class="mr-auto flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30"
            >
              <Trash2 class="h-4 w-4" />
              Delete
            </button>
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
              {{ saving ? 'Saving…' : isEdit ? 'Save' : 'Record' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.entry-drawer-enter-active,
.entry-drawer-leave-active {
  transition: opacity 0.25s ease;
}

.entry-drawer-enter-from,
.entry-drawer-leave-to {
  opacity: 0;
}

@media (max-width: 639px) {
  .entry-drawer-enter-active > div,
  .entry-drawer-leave-active > div {
    transition: transform 0.25s ease;
  }

  .entry-drawer-enter-from > div,
  .entry-drawer-leave-to > div {
    transform: translateY(100%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .entry-drawer-enter-active,
  .entry-drawer-leave-active,
  .entry-drawer-enter-active > div,
  .entry-drawer-leave-active > div {
    transition: none;
  }
}
</style>

<script setup>
import { ref, computed, watch } from 'vue'
import { X, Trash2, ArrowDownLeft, ArrowUpRight, ArrowLeftRight } from '../../icons'
import {
  INFLOW_GROUPS,
  OUTFLOW_GROUPS,
  ACCOUNTS,
  BANK_ACCOUNT,
  CASH_ACCOUNT,
} from '../../data/financeChart'

const props = defineProps({
  show: { type: Boolean, default: false },
  /** null when recording a new transaction */
  transaction: { type: Object, default: null },
  /** date the sheet opens on, so entries land in the month being viewed */
  defaultDate: { type: String, default: '' },
  saving: { type: Boolean, default: false },
})

const emit = defineEmits(['update:show', 'save', 'delete'])

const today = () => new Date().toISOString().split('T')[0]

const blankForm = () => ({
  date: props.defaultDate || today(),
  direction: 'inflow',
  category: INFLOW_GROUPS[0].key,
  subcategory: INFLOW_GROUPS[0].lines[0].key,
  account: CASH_ACCOUNT,
  toAccount: BANK_ACCOUNT,
  amount: '',
  description: '',
  payerPayee: '',
  notes: '',
})

const form = ref(blankForm())
const showMore = ref(false)

watch(
  () => props.show,
  (open) => {
    if (!open) return
    showMore.value = false
    form.value = props.transaction
      ? {
          date: props.transaction.date,
          direction: props.transaction.direction,
          category: props.transaction.category,
          subcategory: props.transaction.subcategory,
          account: props.transaction.account,
          toAccount: props.transaction.toAccount || BANK_ACCOUNT,
          amount: String(props.transaction.amount ?? ''),
          description: props.transaction.description,
          payerPayee: props.transaction.payerPayee,
          notes: props.transaction.notes,
        }
      : blankForm()
  }
)

const isEditing = computed(() => Boolean(props.transaction))

const groups = computed(() =>
  form.value.direction === 'inflow' ? INFLOW_GROUPS : OUTFLOW_GROUPS
)

const activeGroup = computed(() => groups.value.find((g) => g.key === form.value.category) || null)

const setDirection = (direction) => {
  if (form.value.direction === direction) return
  form.value.direction = direction
  if (direction === 'transfer') {
    form.value.account = CASH_ACCOUNT
    form.value.toAccount = BANK_ACCOUNT
    return
  }
  const first = (direction === 'inflow' ? INFLOW_GROUPS : OUTFLOW_GROUPS)[0]
  form.value.category = first.key
  form.value.subcategory = first.lines?.[0]?.key || ''
}

const selectGroup = (group) => {
  form.value.category = group.key
  form.value.subcategory = group.lines?.[0]?.key || ''
}

/** Deposit takes cash to the bank; withdrawal brings it back. */
const transferMode = computed({
  get: () => (form.value.account === BANK_ACCOUNT ? 'withdrawal' : 'deposit'),
  set: (mode) => {
    form.value.account = mode === 'withdrawal' ? BANK_ACCOUNT : CASH_ACCOUNT
    form.value.toAccount = mode === 'withdrawal' ? CASH_ACCOUNT : BANK_ACCOUNT
  },
})

const amountValue = computed(() => Number(String(form.value.amount).replace(/,/g, '')) || 0)
const isValid = computed(() => amountValue.value > 0 && Boolean(form.value.date))

const accountFieldLabel = computed(() =>
  form.value.direction === 'inflow' ? 'Received in' : 'Paid from'
)

const fallbackDescription = computed(() => {
  if (form.value.direction === 'transfer') {
    return transferMode.value === 'withdrawal' ? 'Eastwest Withdrawal' : 'Eastwest Deposit'
  }
  const line = activeGroup.value?.lines?.find((l) => l.key === form.value.subcategory)
  return line ? `${activeGroup.value.label} - ${line.label}` : activeGroup.value?.label || ''
})

const close = () => emit('update:show', false)

const handleSave = () => {
  if (!isValid.value || props.saving) return
  const isTransfer = form.value.direction === 'transfer'
  emit('save', {
    date: form.value.date,
    direction: form.value.direction,
    amount: amountValue.value,
    category: isTransfer ? '' : form.value.category,
    subcategory: isTransfer ? '' : form.value.subcategory,
    account: form.value.account,
    toAccount: isTransfer ? form.value.toAccount : '',
    description: form.value.description.trim() || fallbackDescription.value,
    payerPayee: form.value.payerPayee.trim(),
    notes: form.value.notes.trim(),
  })
}

const inputClass =
  'w-full h-11 px-3 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-1 focus:ring-primary focus:border-primary'
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
          class="sheet-panel relative z-10 w-full sm:max-w-lg max-h-[92dvh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-white dark:bg-gray-800 shadow-2xl border-t sm:border border-gray-200 dark:border-gray-700"
        >
          <!-- Header -->
          <div
            class="shrink-0 flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700"
          >
            <h3 class="text-base font-semibold text-gray-900 dark:text-white">
              {{ isEditing ? 'Edit transaction' : 'Record transaction' }}
            </h3>
            <div class="flex items-center gap-1">
              <button
                v-if="isEditing"
                @click="emit('delete', transaction)"
                class="flex h-9 w-9 items-center justify-center rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                aria-label="Delete transaction"
              >
                <Trash2 class="h-4 w-4" />
              </button>
              <button
                @click="close"
                class="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                aria-label="Close"
              >
                <X class="h-5 w-5" />
              </button>
            </div>
          </div>

          <div class="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            <!-- Direction -->
            <div class="grid grid-cols-3 gap-1 p-1 rounded-xl bg-gray-100 dark:bg-gray-700/50">
              <button
                @click="setDirection('inflow')"
                :class="[
                  'flex h-10 items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition-colors',
                  form.direction === 'inflow'
                    ? 'bg-white dark:bg-gray-800 text-emerald-600 dark:text-emerald-400 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400',
                ]"
              >
                <ArrowDownLeft class="h-4 w-4" /> Money In
              </button>
              <button
                @click="setDirection('outflow')"
                :class="[
                  'flex h-10 items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition-colors',
                  form.direction === 'outflow'
                    ? 'bg-white dark:bg-gray-800 text-red-600 dark:text-red-400 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400',
                ]"
              >
                <ArrowUpRight class="h-4 w-4" /> Money Out
              </button>
              <button
                @click="setDirection('transfer')"
                :class="[
                  'flex h-10 items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition-colors',
                  form.direction === 'transfer'
                    ? 'bg-white dark:bg-gray-800 text-primary shadow-sm'
                    : 'text-gray-500 dark:text-gray-400',
                ]"
              >
                <ArrowLeftRight class="h-4 w-4" /> Transfer
              </button>
            </div>

            <!-- Amount -->
            <div>
              <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Amount
              </label>
              <div class="relative">
                <span
                  class="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-semibold text-gray-400"
                >
                  ₱
                </span>
                <input
                  v-model="form.amount"
                  type="text"
                  inputmode="decimal"
                  placeholder="0.00"
                  :class="[
                    'w-full h-14 pl-10 pr-4 text-2xl font-semibold tracking-tight rounded-xl border bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-1 focus:ring-primary focus:border-primary',
                    'border-gray-200 dark:border-gray-600',
                  ]"
                />
              </div>
            </div>

            <!-- Date -->
            <div>
              <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Date
              </label>
              <input v-model="form.date" type="date" :class="inputClass" />
            </div>

            <!-- Transfer direction -->
            <template v-if="form.direction === 'transfer'">
              <div>
                <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                  Eastwest transaction
                </label>
                <div class="grid grid-cols-2 gap-2">
                  <button
                    @click="transferMode = 'deposit'"
                    :class="[
                      'h-11 rounded-lg text-xs font-semibold transition-colors',
                      transferMode === 'deposit'
                        ? 'bg-primary text-white shadow-sm'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
                    ]"
                  >
                    Deposit
                  </button>
                  <button
                    @click="transferMode = 'withdrawal'"
                    :class="[
                      'h-11 rounded-lg text-xs font-semibold transition-colors',
                      transferMode === 'withdrawal'
                        ? 'bg-primary text-white shadow-sm'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
                    ]"
                  >
                    Withdrawal
                  </button>
                </div>
                <p class="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
                  {{
                    transferMode === 'deposit'
                      ? 'Cash on hand moves into the Eastwest account.'
                      : 'Money leaves Eastwest and becomes cash on hand.'
                  }}
                </p>
              </div>
            </template>

            <!-- Category -->
            <template v-else>
              <div>
                <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                  Statement line
                </label>
                <div class="grid grid-cols-2 gap-2">
                  <button
                    v-for="group in groups"
                    :key="group.key"
                    @click="selectGroup(group)"
                    :class="[
                      'flex items-center gap-2 px-3 py-2.5 rounded-lg text-left transition-colors',
                      form.category === group.key
                        ? 'bg-primary/10 text-primary ring-1 ring-primary/30 dark:bg-primary/20'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
                    ]"
                  >
                    <component :is="group.icon" class="h-4 w-4 shrink-0" />
                    <span class="text-xs font-medium leading-tight">{{ group.label }}</span>
                  </button>
                </div>
              </div>

              <div v-if="activeGroup?.lines?.length">
                <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                  {{ activeGroup.label }} detail
                </label>
                <div class="flex flex-wrap gap-1.5">
                  <button
                    v-for="line in activeGroup.lines"
                    :key="line.key"
                    @click="form.subcategory = line.key"
                    :class="[
                      'h-9 px-3 rounded-full text-xs font-medium transition-colors',
                      form.subcategory === line.key
                        ? 'bg-primary text-white shadow-sm'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
                    ]"
                  >
                    {{ line.label }}
                  </button>
                </div>
              </div>

              <!-- Account -->
              <div>
                <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                  {{ accountFieldLabel }}
                </label>
                <div class="grid grid-cols-2 gap-2">
                  <button
                    v-for="account in ACCOUNTS"
                    :key="account.key"
                    @click="form.account = account.key"
                    :class="[
                      'flex items-center gap-2 h-11 px-3 rounded-lg text-xs font-medium transition-colors',
                      form.account === account.key
                        ? 'bg-primary text-white shadow-sm'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
                    ]"
                  >
                    <component :is="account.icon" class="h-4 w-4 shrink-0" />
                    {{ account.short }}
                  </button>
                </div>
              </div>
            </template>

            <!-- Description -->
            <div>
              <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Description
              </label>
              <input
                v-model="form.description"
                type="text"
                :placeholder="fallbackDescription"
                :class="inputClass"
              />
            </div>

            <!-- Optional detail -->
            <button
              v-if="!showMore"
              @click="showMore = true"
              class="text-xs font-medium text-primary hover:underline"
            >
              + Add payee and notes
            </button>

            <template v-else>
              <div>
                <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  {{ form.direction === 'inflow' ? 'Received from' : 'Paid to' }}
                </label>
                <input
                  v-model="form.payerPayee"
                  type="text"
                  placeholder="Person or company"
                  :class="inputClass"
                />
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Notes
                </label>
                <textarea
                  v-model="form.notes"
                  rows="2"
                  placeholder="Receipt number, purpose, anything to remember"
                  class="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-1 focus:ring-primary focus:border-primary"
                ></textarea>
              </div>
            </template>
          </div>

          <!-- Footer -->
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
              {{ saving ? 'Saving...' : isEditing ? 'Save changes' : 'Record' }}
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

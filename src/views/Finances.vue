<script setup>
import { ref, computed } from 'vue'
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  MoreVertical,
  Download,
  Printer,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
} from 'lucide-vue-next'
import {
  useFinances,
  buildStatement,
  currentMonthKey,
  shiftMonth,
  monthLabel,
  formatAmount,
} from '../composables/useFinances'
import { exportStatement } from '../utils/financeExport'
import { useToast } from '../composables/useToast'
import ConfirmationModal from '../components/common/ConfirmationModal.vue'
import SearchBar from '../components/common/SearchBar.vue'
import StatementReport from '../components/finances/StatementReport.vue'
import LedgerList from '../components/finances/LedgerList.vue'
import TransactionSheet from '../components/finances/TransactionSheet.vue'
import OpeningBalanceSheet from '../components/finances/OpeningBalanceSheet.vue'
import { categoryLabel } from '../data/financeChart'

const toast = useToast()
const {
  transactions,
  opening,
  loading,
  addTransaction,
  updateTransaction,
  removeTransaction,
  saveOpening,
} = useFinances()

const monthKey = ref(currentMonthKey())
const tab = ref('statement')

const statement = computed(() => buildStatement(transactions.value, opening.value, monthKey.value))

const stepMonth = (delta) => {
  monthKey.value = shiftMonth(monthKey.value, delta)
}

const isCurrentMonth = computed(() => monthKey.value === currentMonthKey())

/* ------------------------------------------------------------------ ledger */
const searchQuery = ref('')
const mobileSearchOpen = ref(false)
const ledgerFilter = ref('all')

const filters = [
  { key: 'all', label: 'All' },
  { key: 'inflow', label: 'In' },
  { key: 'outflow', label: 'Out' },
  { key: 'transfer', label: 'Transfer' },
]

const ledgerRows = computed(() => {
  let rows = statement.value.transactions

  if (ledgerFilter.value !== 'all') {
    rows = rows.filter((t) => t.direction === ledgerFilter.value)
  }

  const query = searchQuery.value.trim().toLowerCase()
  if (query) {
    rows = rows.filter(
      (t) =>
        t.description?.toLowerCase().includes(query) ||
        t.payerPayee?.toLowerCase().includes(query) ||
        t.notes?.toLowerCase().includes(query) ||
        categoryLabel(t).toLowerCase().includes(query)
    )
  }

  return rows
})

/* ------------------------------------------------------ transaction editor */
const showSheet = ref(false)
const editingTransaction = ref(null)
const saving = ref(false)

/** New entries land inside the month being viewed, not always today. */
const defaultDate = computed(() => {
  const today = new Date().toISOString().split('T')[0]
  return isCurrentMonth.value ? today : `${monthKey.value}-01`
})

const openAdd = () => {
  editingTransaction.value = null
  showSheet.value = true
}

const openEdit = (transaction) => {
  editingTransaction.value = transaction
  showSheet.value = true
}

const handleSave = async (payload) => {
  saving.value = true
  try {
    if (editingTransaction.value) {
      await updateTransaction(editingTransaction.value.firestoreId, payload)
      toast.success('Transaction updated')
    } else {
      await addTransaction(payload)
      toast.success('Transaction recorded')
      // Follow the entry to the month it was filed under.
      monthKey.value = payload.date.slice(0, 7)
    }
    showSheet.value = false
  } catch (error) {
    console.error('Error saving transaction:', error)
    toast.error('Failed to save. Please try again.')
  } finally {
    saving.value = false
  }
}

/* --------------------------------------------------------- opening balance */
const showOpening = ref(false)
const savingOpening = ref(false)

const handleSaveOpening = async (payload) => {
  savingOpening.value = true
  try {
    await saveOpening(payload)
    toast.success('Starting balance saved')
    showOpening.value = false
  } catch (error) {
    console.error('Error saving opening balance:', error)
    toast.error('Failed to save. Please try again.')
  } finally {
    savingOpening.value = false
  }
}

/* ------------------------------------------------------------------ delete */
const showConfirmation = ref(false)
const confirmationConfig = ref({
  title: '',
  message: '',
  confirmText: 'Delete',
  cancelText: 'Cancel',
  confirmButtonClass: 'bg-red-600 text-white hover:bg-red-700',
  onConfirm: null,
})

const confirmDelete = (transaction) => {
  confirmationConfig.value = {
    ...confirmationConfig.value,
    title: 'Delete Transaction',
    message: `Delete "${transaction.description}"? The statement balances will be recalculated without it.`,
    onConfirm: async () => {
      try {
        await removeTransaction(transaction.firestoreId)
        showSheet.value = false
        toast.success('Transaction deleted')
      } catch (error) {
        console.error('Error deleting transaction:', error)
        toast.error('Failed to delete. Please try again.')
      }
    },
  }
  showConfirmation.value = true
}

/* ------------------------------------------------------------------- menu */
const showMenu = ref(false)

const handleExport = () => {
  showMenu.value = false
  exportStatement(statement.value)
}

const handlePrint = () => {
  showMenu.value = false
  window.print()
}

const openOpeningSheet = () => {
  showMenu.value = false
  showOpening.value = true
}
</script>

<template>
  <div class="flex flex-col h-full overflow-y-auto">
    <!-- Month bar -->
    <div
      class="sticky top-0 z-40 -mx-3 sm:-mx-4 lg:-mx-8 px-3 sm:px-4 lg:px-8 py-2 bg-white/95 dark:bg-gray-900/95 backdrop-blur border-b border-gray-100 dark:border-gray-800 no-print"
    >
      <div class="flex items-center gap-2 w-full max-w-3xl mx-auto">
        <button
          @click="stepMonth(-1)"
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          aria-label="Previous month"
        >
          <ChevronLeft class="h-5 w-5" />
        </button>

        <label
          class="relative flex h-10 flex-1 min-w-0 items-center justify-center gap-1 rounded-lg bg-gray-100 dark:bg-gray-800 px-3 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
          <span class="text-sm font-semibold text-gray-900 dark:text-white truncate">
            {{ statement.label }}
          </span>
          <ChevronDown class="h-4 w-4 shrink-0 text-gray-400" />
          <input
            v-model="monthKey"
            type="month"
            class="absolute inset-0 h-full w-full opacity-0 cursor-pointer"
            aria-label="Choose month"
          />
        </label>

        <button
          @click="stepMonth(1)"
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          aria-label="Next month"
        >
          <ChevronRight class="h-5 w-5" />
        </button>

        <!-- Overflow menu -->
        <div class="relative shrink-0">
          <button
            @click="showMenu = !showMenu"
            class="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            aria-label="More actions"
          >
            <MoreVertical class="h-5 w-5" />
          </button>

          <div v-if="showMenu" class="fixed inset-0 z-40" @click="showMenu = false"></div>

          <Transition name="fade">
            <div
              v-if="showMenu"
              class="absolute right-0 top-full mt-2 z-50 w-56 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl overflow-hidden"
            >
              <button
                @click="handleExport"
                class="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <Download class="h-4 w-4 text-gray-400" /> Export this month
              </button>
              <button
                @click="handlePrint"
                class="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <Printer class="h-4 w-4 text-gray-400" /> Print statement
              </button>
              <button
                @click="openOpeningSheet"
                class="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <Wallet class="h-4 w-4 text-gray-400" /> Starting balance
              </button>
              <router-link
                to="/finances/audit"
                @click="showMenu = false"
                class="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors border-t border-gray-100 dark:border-gray-700"
              >
                <BarChart3 class="h-4 w-4 text-gray-400" /> Yearly report
              </router-link>
            </div>
          </Transition>
        </div>

        <button
          @click="openAdd"
          class="flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 text-white shadow-sm transition-transform active:scale-95"
        >
          <Plus class="h-5 w-5" />
          <span class="text-sm font-medium hidden sm:inline">Record</span>
        </button>
      </div>
    </div>

    <div class="pt-3 pb-6 space-y-3 w-full max-w-3xl mx-auto print-area">
      <!-- Balance summary -->
      <div class="rounded-2xl bg-primary text-white p-4 shadow-sm">
        <p class="text-[11px] font-bold uppercase tracking-widest text-white/70">
          Ending balance &middot; {{ statement.label }}
        </p>
        <p class="mt-1 text-3xl font-bold tabular-nums tracking-tight">
          &#8369;{{ formatAmount(statement.ending.total) }}
        </p>

        <div class="mt-3 grid grid-cols-2 gap-2">
          <div class="rounded-lg bg-white/10 px-3 py-2">
            <p class="text-[10px] font-medium uppercase tracking-wide text-white/60">Cash on Hand</p>
            <p class="text-sm font-semibold tabular-nums">
              {{ formatAmount(statement.ending.cashOnHand) }}
            </p>
          </div>
          <div class="rounded-lg bg-white/10 px-3 py-2">
            <p class="text-[10px] font-medium uppercase tracking-wide text-white/60">Eastwest</p>
            <p class="text-sm font-semibold tabular-nums">
              {{ formatAmount(statement.ending.bankEastwest) }}
            </p>
          </div>
        </div>

        <div class="mt-3 flex items-center gap-3 text-xs border-t border-white/15 pt-3">
          <span class="flex items-center gap-1 tabular-nums">
            <ArrowDownLeft class="h-3.5 w-3.5 text-emerald-200" />
            {{ formatAmount(statement.inflow.total) }}
          </span>
          <span class="flex items-center gap-1 tabular-nums">
            <ArrowUpRight class="h-3.5 w-3.5 text-red-200" />
            {{ formatAmount(statement.outflow.total) }}
          </span>
          <span class="ml-auto font-semibold tabular-nums">
            Net {{ statement.net >= 0 ? '+' : '' }}{{ formatAmount(statement.net) }}
          </span>
        </div>
      </div>

      <!-- Starting balance prompt -->
      <button
        v-if="!opening.isSet && !loading"
        @click="showOpening = true"
        class="w-full flex items-center gap-3 rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-left no-print"
      >
        <Wallet class="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
        <div class="min-w-0">
          <p class="text-sm font-medium text-amber-900 dark:text-amber-200">
            Set the starting balance
          </p>
          <p class="text-xs text-amber-700 dark:text-amber-300/80">
            Cash on hand and Eastwest before your first entry, so every balance is right.
          </p>
        </div>
      </button>

      <!-- Tabs -->
      <div class="grid grid-cols-2 gap-1 p-1 rounded-xl bg-gray-100 dark:bg-gray-800 no-print">
        <button
          @click="tab = 'statement'"
          :class="[
            'h-10 rounded-lg text-sm font-semibold transition-colors',
            tab === 'statement'
              ? 'bg-white dark:bg-gray-700 text-primary shadow-sm'
              : 'text-gray-500 dark:text-gray-400',
          ]"
        >
          Statement
        </button>
        <button
          @click="tab = 'ledger'"
          :class="[
            'h-10 rounded-lg text-sm font-semibold transition-colors',
            tab === 'ledger'
              ? 'bg-white dark:bg-gray-700 text-primary shadow-sm'
              : 'text-gray-500 dark:text-gray-400',
          ]"
        >
          Transactions
          <span class="text-xs font-normal text-gray-400">
            ({{ statement.transactions.length }})
          </span>
        </button>
      </div>

      <!-- Statement -->
      <div v-if="tab === 'statement'">
        <div v-if="loading" class="space-y-3">
          <div
            v-for="i in 4"
            :key="`statement-skeleton-${i}`"
            class="h-28 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse"
          ></div>
        </div>
        <StatementReport
          v-else
          :statement="statement"
          :opening-is-set="opening.isSet"
          @edit-opening="showOpening = true"
        />
      </div>

      <!-- Ledger -->
      <div v-else class="space-y-3">
        <div class="flex items-center gap-2 no-print">
          <SearchBar
            v-model="searchQuery"
            v-model:open="mobileSearchOpen"
            placeholder="Search description, payee, or category"
          />
          <div
            :class="[
              'flex gap-1 overflow-x-auto no-scrollbar',
              mobileSearchOpen ? 'hidden lg:flex' : 'flex',
            ]"
          >
            <button
              v-for="filter in filters"
              :key="filter.key"
              @click="ledgerFilter = filter.key"
              :class="[
                'h-10 shrink-0 rounded-lg px-3 text-xs font-medium transition-colors',
                ledgerFilter === filter.key
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
              ]"
            >
              {{ filter.label }}
            </button>
          </div>
        </div>

        <LedgerList
          :transactions="ledgerRows"
          :loading="loading"
          :empty-message="
            searchQuery.trim() || ledgerFilter !== 'all'
              ? 'No transactions match this filter'
              : `No transactions in ${monthLabel(monthKey)}`
          "
          @select="openEdit"
        />
      </div>
    </div>

    <!-- Sheets -->
    <TransactionSheet
      v-model:show="showSheet"
      :transaction="editingTransaction"
      :default-date="defaultDate"
      :saving="saving"
      @save="handleSave"
      @delete="confirmDelete"
    />

    <OpeningBalanceSheet
      v-model:show="showOpening"
      :opening="opening"
      :saving="savingOpening"
      @save="handleSaveOpening"
    />

    <ConfirmationModal
      :show="showConfirmation"
      :title="confirmationConfig.title"
      :message="confirmationConfig.message"
      :confirm-text="confirmationConfig.confirmText"
      :cancel-text="confirmationConfig.cancelText"
      :confirm-button-class="confirmationConfig.confirmButtonClass"
      @update:show="showConfirmation = $event"
      @confirm="confirmationConfig.onConfirm?.()"
      @cancel="showConfirmation = false"
    />
  </div>
</template>

<style scoped>
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@media print {
  .no-print {
    display: none !important;
  }
  .print-area {
    overflow: visible !important;
  }
}
</style>

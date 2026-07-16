<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  Plus,
  Download,
  FileText,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  X,
  Trash2,
  Loader2,
  PieChart as PieIcon,
  DollarSign,
  Heart,
  Zap,
  User,
  Wrench,
  Building2,
  BookOpen,
  ArrowRight
} from 'lucide-vue-next'
import { subscribeToTransactions, addTransaction, deleteTransaction } from '../api/financeService'
import ConfirmationModal from '../components/common/ConfirmationModal.vue'
import SearchBar from '../components/common/SearchBar.vue'
import * as XLSX from 'xlsx'

const transactions = ref([])
const isLoading = ref(true)
const selectedType = ref('all')
const searchQuery = ref('')
const mobileSearchOpen = ref(false)
const showAddModal = ref(false)
const isSubmitting = ref(false)

// Form state
const form = ref({
  date: new Date().toISOString().split('T')[0],
  description: '',
  category: 'Tithes',
  amount: 0,
  type: 'income',
  payerPayee: '',
  notes: '',
  status: 'completed'
})

const categories = [
  'Tithes', 'Offerings', 'Missions', 'Building Fund',
  'Utilities', 'Maintenance', 'Salaries', 'Outreach',
  'Events', 'General'
]

const getCategoryIcon = (cat) => {
  switch (cat) {
    case 'Tithes': return Heart
    case 'Offerings': return DollarSign
    case 'Missions': return BookOpen
    case 'Building Fund': return Building2
    case 'Utilities': return Zap
    case 'Maintenance': return Wrench
    case 'Salaries': return User
    default: return FileText
  }
}

// Confirmation modal state
const showConfirmation = ref(false)
const confirmationConfig = ref({
  title: 'Confirm Action',
  message: '',
  confirmText: 'Confirm',
  cancelText: 'Cancel',
  confirmButtonClass: 'bg-red-600 text-white hover:bg-red-700',
  onConfirm: null
})

const showConfirmModal = (config) => {
  confirmationConfig.value = { ...confirmationConfig.value, ...config }
  showConfirmation.value = true
}

const handleConfirmation = () => {
  if (confirmationConfig.value.onConfirm) {
    confirmationConfig.value.onConfirm()
  }
}

let unsubscribeFinances = null

onMounted(() => {
  isLoading.value = true
  unsubscribeFinances = subscribeToTransactions((data) => {
    transactions.value = data
    isLoading.value = false
  })
})

onUnmounted(() => {
  if (unsubscribeFinances) unsubscribeFinances()
})

// Metrics
const stats = computed(() => {
  const totalBalance = transactions.value.reduce((acc, t) => {
    return acc + (t.type === 'income' ? Number(t.amount) : -Number(t.amount))
  }, 0)

  const thisMonth = new Date().getMonth()
  const thisYear = new Date().getFullYear()

  const monthlyIncome = transactions.value
    .filter(t => {
      const d = new Date(t.date)
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear && t.type === 'income'
    })
    .reduce((acc, t) => acc + Number(t.amount), 0)

  const monthlyExpense = transactions.value
    .filter(t => {
      const d = new Date(t.date)
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear && t.type === 'expense'
    })
    .reduce((acc, t) => acc + Number(t.amount), 0)

  return {
    balance: totalBalance,
    income: monthlyIncome,
    expense: monthlyExpense,
    pending: transactions.value.filter(t => t.status === 'pending').length
  }
})

const filteredTransactions = computed(() => {
  let result = transactions.value

  if (selectedType.value !== 'all') {
    result = result.filter(t => t.type === selectedType.value)
  }

  const query = searchQuery.value.trim().toLowerCase()
  if (query) {
    result = result.filter(t =>
      t.description?.toLowerCase().includes(query) ||
      t.payerPayee?.toLowerCase().includes(query) ||
      t.category?.toLowerCase().includes(query)
    )
  }

  return result
})

const groupedByCategory = computed(() => {
  const groups = {}
  transactions.value.forEach(t => {
    if (!groups[t.category]) groups[t.category] = 0
    groups[t.category] += Number(t.amount)
  })
  return Object.entries(groups)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
})

const resetForm = () => {
  form.value = {
    date: new Date().toISOString().split('T')[0],
    description: '',
    category: 'Tithes',
    amount: 0,
    type: 'income',
    payerPayee: '',
    notes: '',
    status: 'completed'
  }
}

const handleAddTransaction = async () => {
  isSubmitting.value = true
  try {
    await addTransaction(form.value)
    showAddModal.value = false
    resetForm()
  } catch (err) {
    console.error(err)
    showConfirmModal({
      title: 'Error',
      message: 'Failed to add transaction. Please try again.',
      confirmText: 'OK',
      cancelText: '',
      confirmButtonClass: 'bg-primary text-white hover:bg-primary-hover',
      onConfirm: () => {},
    })
  } finally {
    isSubmitting.value = false
  }
}

const confirmDelete = (transaction) => {
  showConfirmModal({
    title: 'Delete Transaction',
    message: `Are you sure you want to delete "${transaction.description}"? This will affect the net balance and cannot be undone.`,
    confirmText: 'Delete',
    cancelText: 'Cancel',
    confirmButtonClass: 'bg-red-600 text-white hover:bg-red-700',
    onConfirm: async () => {
      try {
        await deleteTransaction(transaction.firestoreId)
      } catch (err) {
        console.error(err)
        showConfirmModal({
          title: 'Error',
          message: 'Failed to delete transaction. Please try again.',
          confirmText: 'OK',
          cancelText: '',
          confirmButtonClass: 'bg-primary text-white hover:bg-primary-hover',
          onConfirm: () => {},
        })
      }
    }
  })
}

const exportToExcel = () => {
  const data = transactions.value.map(t => ({
    Date: t.date,
    Description: t.description,
    Category: t.category,
    Type: t.type.toUpperCase(),
    Amount: t.amount,
    'Payer/Payee': t.payerPayee,
    Status: t.status,
    Notes: t.notes
  }))

  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "Transactions")
  XLSX.writeFile(wb, `UEC_Finances_${new Date().getFullYear()}.xlsx`)
}

const formatCurrency = (val) => {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(val)
}

const formatDate = (dateStr) => {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const statusBadgeClass = (status) => {
  if (status === 'completed') return 'bg-green-50 text-green-700 border-green-100 dark:bg-green-900/20 dark:text-green-400 dark:border-green-900/40'
  if (status === 'pending') return 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/40'
  return 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:border-gray-600'
}
</script>

<template>
  <div class="flex flex-col h-full overflow-y-auto lg:overflow-hidden">
    <!-- Toolbar -->
    <div class="sticky top-0 z-40 mb-4 shrink-0 rounded-xl border border-gray-200/80 bg-white/95 px-2 py-2 shadow-sm backdrop-blur dark:border-gray-700 dark:bg-gray-900/95 sm:px-3">
      <div class="flex items-center justify-end gap-1.5 sm:gap-2 flex-nowrap w-full">
        <button
          @click="exportToExcel"
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
          title="Export to Excel"
        >
          <Download class="h-5 w-5" />
        </button>

        <button
          @click="showAddModal = true"
          class="flex h-10 items-center justify-center rounded-lg bg-primary text-white shadow-sm transition-colors hover:bg-primary-hover px-2.5 sm:px-4 gap-1.5 w-10 sm:w-auto shrink-0"
          title="Record a new transaction"
        >
          <Plus class="h-5 w-5 shrink-0" />
          <span class="hidden sm:inline whitespace-nowrap">Add</span>
        </button>
      </div>
    </div>

    <!-- Metrics -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mb-4 shrink-0">
      <div class="rounded-lg border border-primary/20 bg-primary/5 dark:bg-primary/10 p-3 sm:p-4">
        <div class="flex items-center gap-2 mb-2">
          <div class="p-1.5 rounded-lg bg-primary/10 dark:bg-primary/20 text-primary shrink-0">
            <Wallet class="h-4 w-4" />
          </div>
          <p class="text-xs font-medium text-gray-500 dark:text-gray-400 truncate">Net Balance</p>
        </div>
        <p class="text-base sm:text-lg lg:text-xl font-semibold text-gray-900 dark:text-white truncate">{{ formatCurrency(stats.balance) }}</p>
      </div>

      <div class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 sm:p-4">
        <div class="flex items-center gap-2 mb-2">
          <div class="p-1.5 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 shrink-0">
            <ArrowUpRight class="h-4 w-4" />
          </div>
          <p class="text-xs font-medium text-gray-500 dark:text-gray-400 truncate">Monthly Income</p>
        </div>
        <p class="text-base sm:text-lg lg:text-xl font-semibold text-green-600 dark:text-green-400 truncate">{{ formatCurrency(stats.income) }}</p>
      </div>

      <div class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 sm:p-4">
        <div class="flex items-center gap-2 mb-2">
          <div class="p-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 shrink-0">
            <ArrowDownRight class="h-4 w-4" />
          </div>
          <p class="text-xs font-medium text-gray-500 dark:text-gray-400 truncate">Monthly Expense</p>
        </div>
        <p class="text-base sm:text-lg lg:text-xl font-semibold text-red-600 dark:text-red-400 truncate">{{ formatCurrency(stats.expense) }}</p>
      </div>

      <div class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 sm:p-4">
        <div class="flex items-center gap-2 mb-2">
          <div class="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 shrink-0">
            <Loader2 class="h-4 w-4" />
          </div>
          <p class="text-xs font-medium text-gray-500 dark:text-gray-400 truncate">Total Logs</p>
        </div>
        <p class="text-base sm:text-lg lg:text-xl font-semibold text-gray-900 dark:text-white truncate">
          {{ transactions.length }}
          <span v-if="stats.pending" class="text-xs font-normal text-amber-600 dark:text-amber-400">({{ stats.pending }} pending)</span>
        </p>
      </div>
    </div>

    <!-- Main Content -->
    <div class="flex-1 flex flex-col gap-4 lg:flex-row lg:min-h-0 lg:overflow-hidden">

      <!-- Transactions -->
      <div class="flex-1 overflow-hidden bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 flex flex-col lg:min-h-0">
        <!-- Search & Filter -->
        <div class="flex items-center gap-2 p-3 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <SearchBar
            v-model="searchQuery"
            v-model:open="mobileSearchOpen"
            placeholder="Search by description, payee, or category"
          />
          <select
            v-model="selectedType"
            :class="['h-10 shrink-0 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 text-sm text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-primary lg:w-40', mobileSearchOpen ? 'hidden lg:block' : 'block']"
          >
            <option value="all">All Types</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>
        </div>

        <!-- Table (desktop only) -->
        <div class="hidden lg:block flex-1 overflow-y-auto custom-scrollbar">
          <table class="w-full text-left border-collapse">
            <thead class="sticky top-0 bg-white dark:bg-gray-800 z-10 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th class="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400">Date</th>
                <th class="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400">Description</th>
                <th class="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 text-right">Amount</th>
                <th class="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 text-center">Status</th>
                <th class="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 text-right">Action</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
              <tr v-if="isLoading" v-for="i in 5" :key="i" class="animate-pulse">
                <td v-for="j in 5" :key="j" class="px-4 py-3"><div class="h-4 bg-gray-100 dark:bg-gray-700 rounded-lg w-full"></div></td>
              </tr>
              <tr v-else-if="filteredTransactions.length === 0">
                <td colspan="5" class="px-4 py-16 text-center">
                  <div class="flex flex-col items-center">
                    <FileText class="h-10 w-10 text-gray-300 dark:text-gray-600 mb-3" />
                    <p class="text-sm text-gray-500 dark:text-gray-400">
                      {{ searchQuery.trim() ? 'No transactions match your search' : 'No transactions found' }}
                    </p>
                  </div>
                </td>
              </tr>
              <tr v-for="t in filteredTransactions" :key="t.id" class="group hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                <td class="px-4 py-3">
                  <div class="flex flex-col">
                    <span class="text-sm font-medium text-gray-900 dark:text-white">{{ formatDate(t.date) }}</span>
                    <span class="text-xs text-gray-400 dark:text-gray-500">{{ t.category }}</span>
                  </div>
                </td>
                <td class="px-4 py-3">
                  <div class="flex items-center gap-3">
                    <div :class="[
                      'p-2 rounded-lg shrink-0',
                      t.type === 'income' ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                    ]">
                      <component :is="getCategoryIcon(t.category)" class="h-4 w-4" />
                    </div>
                    <div class="flex flex-col min-w-0">
                      <p class="text-sm font-medium text-gray-900 dark:text-white truncate max-w-50">{{ t.description }}</p>
                      <p class="text-xs text-gray-500 dark:text-gray-400 truncate">From/To: {{ t.payerPayee || 'Internal' }}</p>
                    </div>
                  </div>
                </td>
                <td class="px-4 py-3 text-right">
                  <span :class="['text-sm font-semibold', t.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400']">
                    {{ t.type === 'income' ? '+' : '-' }}{{ formatCurrency(t.amount) }}
                  </span>
                </td>
                <td class="px-4 py-3">
                  <div class="flex justify-center">
                    <span :class="['px-2 py-0.5 rounded-full text-xs border capitalize', statusBadgeClass(t.status)]">
                      {{ t.status }}
                    </span>
                  </div>
                </td>
                <td class="px-4 py-3 text-right">
                  <div class="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button @click="confirmDelete(t)" class="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                      <Trash2 class="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- List (mobile & tablet) -->
        <div class="lg:hidden overflow-y-auto">
          <template v-if="isLoading">
            <div class="p-3 space-y-2">
              <div v-for="i in 5" :key="i" class="h-16 rounded-lg bg-gray-100 dark:bg-gray-700 animate-pulse"></div>
            </div>
          </template>
          <div v-else-if="filteredTransactions.length === 0" class="flex flex-col items-center py-16">
            <FileText class="h-10 w-10 text-gray-300 dark:text-gray-600 mb-3" />
            <p class="text-sm text-gray-500 dark:text-gray-400">
              {{ searchQuery.trim() ? 'No transactions match your search' : 'No transactions found' }}
            </p>
          </div>
          <div v-else class="divide-y divide-gray-100 dark:divide-gray-700">
            <div
              v-for="t in filteredTransactions"
              :key="t.id"
              class="px-4 py-3 flex items-center gap-3"
            >
              <div :class="[
                'p-2 rounded-lg shrink-0',
                t.type === 'income' ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
              ]">
                <component :is="getCategoryIcon(t.category)" class="h-4 w-4" />
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-start justify-between gap-2">
                  <p class="text-sm font-medium text-gray-900 dark:text-white truncate">{{ t.description }}</p>
                  <span :class="['shrink-0 text-sm font-semibold', t.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400']">
                    {{ t.type === 'income' ? '+' : '-' }}{{ formatCurrency(t.amount) }}
                  </span>
                </div>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ formatDate(t.date) }} &middot; {{ t.category }}</p>
                <div class="flex items-center justify-between mt-1.5">
                  <span :class="['px-2 py-0.5 rounded-full text-xs border capitalize', statusBadgeClass(t.status)]">
                    {{ t.status }}
                  </span>
                  <button @click="confirmDelete(t)" class="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                    <Trash2 class="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Panel -->
      <div class="w-full lg:w-80 flex flex-col gap-4 shrink-0">
        <!-- Top Categories -->
        <div class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white">Top Categories</h3>
            <PieIcon class="h-4 w-4 text-primary" />
          </div>

          <div v-if="groupedByCategory.length" class="space-y-3">
            <div v-for="[cat, val] in groupedByCategory" :key="cat" class="space-y-1.5">
              <div class="flex items-center justify-between text-xs">
                <span class="text-gray-600 dark:text-gray-400">{{ cat }}</span>
                <span class="font-medium text-gray-900 dark:text-white">{{ formatCurrency(val) }}</span>
              </div>
              <div class="h-1.5 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  class="h-full bg-primary rounded-full transition-all duration-500"
                  :style="{ width: `${(val / Math.max(...groupedByCategory.map(x => x[1]))) * 100}%` }"
                ></div>
              </div>
            </div>
          </div>
          <div v-else class="py-8 text-center text-gray-400 dark:text-gray-500 text-xs">
            No categorical data available
          </div>
        </div>

        <!-- Audit Report link -->
        <router-link
          to="/finances/audit"
          class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group"
        >
          <div class="min-w-0">
            <p class="text-sm font-semibold text-gray-900 dark:text-white">Full Audit Report</p>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">Yearly income &amp; expense breakdown</p>
          </div>
          <ArrowRight class="h-4 w-4 text-gray-400 shrink-0 transition-transform group-hover:translate-x-1 group-hover:text-primary" />
        </router-link>
      </div>
    </div>

    <!-- Add Transaction Modal -->
    <Transition name="modal">
      <div v-if="showAddModal" class="fixed inset-0 z-100 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="showAddModal = false"></div>
        <div class="relative bg-white dark:bg-gray-800 w-full max-w-lg rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 max-h-[90vh] overflow-y-auto custom-scrollbar">
          <!-- Header -->
          <div class="shrink-0 px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">New Transaction</h3>
            <button @click="showAddModal = false" class="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <X class="h-5 w-5" />
            </button>
          </div>

          <form @submit.prevent="handleAddTransaction" class="p-6 space-y-4">
            <!-- Type Toggle -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Transaction Type</label>
              <div class="flex p-1 bg-gray-100 dark:bg-gray-700 rounded-lg w-full">
                <button
                  type="button"
                  @click="form.type = 'income'"
                  :class="['flex-1 py-2 rounded-md text-sm font-medium transition-all', form.type === 'income' ? 'bg-white dark:bg-gray-600 text-green-600 dark:text-green-400 shadow-sm' : 'text-gray-500 dark:text-gray-400']"
                >Income</button>
                <button
                  type="button"
                  @click="form.type = 'expense'"
                  :class="['flex-1 py-2 rounded-md text-sm font-medium transition-all', form.type === 'expense' ? 'bg-white dark:bg-gray-600 text-red-600 dark:text-red-400 shadow-sm' : 'text-gray-500 dark:text-gray-400']"
                >Expense</button>
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
                <input v-model="form.date" type="date" required class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent" />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
                <select v-model="form.category" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent">
                  <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
                </select>
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
              <input v-model="form.description" type="text" required placeholder="e.g. Weekly Tithes" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent" />
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount (PHP)</label>
                <input v-model="form.amount" type="number" step="0.01" required class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent" />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Payer / Payee</label>
                <input v-model="form.payerPayee" type="text" placeholder="Individual or company" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent" />
              </div>
            </div>

            <div class="pt-2 flex gap-3">
              <button
                type="button"
                @click="showAddModal = false"
                class="flex-1 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
              >Cancel</button>
              <button
                type="submit"
                :disabled="isSubmitting"
                class="flex-1 py-2.5 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors text-sm font-medium flex items-center justify-center gap-2"
              >
                <Loader2 v-if="isSubmitting" class="h-4 w-4 animate-spin" />
                Save Transaction
              </button>
            </div>
          </form>
        </div>
      </div>
    </Transition>

    <!-- Confirmation Modal -->
    <ConfirmationModal
      :show="showConfirmation"
      :title="confirmationConfig.title"
      :message="confirmationConfig.message"
      :confirm-text="confirmationConfig.confirmText"
      :cancel-text="confirmationConfig.cancelText"
      :confirm-button-class="confirmationConfig.confirmButtonClass"
      @update:show="showConfirmation = $event"
      @confirm="handleConfirmation"
      @cancel="showConfirmation = false"
    />
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 5px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(0,0,0,0.1);
  border-radius: 10px;
}
.dark .custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255,255,255,0.1);
}

.modal-enter-active, .modal-leave-active {
  transition: all 0.2s ease;
}
.modal-enter-from, .modal-leave-to {
  opacity: 0;
  transform: scale(0.97);
}
</style>

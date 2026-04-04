<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { 
  Search, 
  Plus, 
  Download, 
  FileText, 
  CreditCard, 
  ArrowUpRight, 
  ArrowDownRight, 
  TrendingUp, 
  Calendar, 
  Filter, 
  MoreHorizontal, 
  Trash2, 
  Edit3, 
  Loader2, 
  PieChart as PieIcon, 
  DollarSign,
  Heart,
  Zap,
  User,
  Wrench,
  AlertCircle,
  Building2,
  BookOpen,
  ArrowRight
} from 'lucide-vue-next'
import { subscribeToTransactions, addTransaction, deleteTransaction, updateTransaction } from '../api/financeService'
import * as XLSX from 'xlsx'

const transactions = ref([])
const isLoading = ref(true)
const searchQuery = ref('')
const selectedType = ref('all')
const showAddModal = ref(false)
const showDeleteConfirm = ref(false)
const transactionToDelete = ref(null)
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
  return transactions.value.filter(t => {
    const matchesSearch = t.description.toLowerCase().includes(searchQuery.value.toLowerCase()) || 
                          t.payerPayee.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
                          t.category.toLowerCase().includes(searchQuery.value.toLowerCase())
    const matchesType = selectedType.value === 'all' || t.type === selectedType.value
    return matchesSearch && matchesType
  })
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
    alert("Failed to add transaction")
  } finally {
    isSubmitting.value = false
  }
}

const confirmDelete = (transaction) => {
  transactionToDelete.value = transaction
  showDeleteConfirm.value = true
}

const handleDeleteTransaction = async () => {
  if (!transactionToDelete.value) return
  isSubmitting.value = true
  try {
    await deleteTransaction(transactionToDelete.value.firestoreId)
    showDeleteConfirm.value = false
    transactionToDelete.value = null
  } catch (err) {
    console.error(err)
    alert("Failed to delete")
  } finally {
    isSubmitting.value = false
  }
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
</script>

<template>
  <div class="h-full flex flex-col space-y-6 overflow-hidden">
    <!-- Header Section -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 flex-shrink-0">
      <div>
        <h1 class="text-2xl font-black text-gray-900 dark:text-white tracking-tight uppercase">Financial Stewardship</h1>
        <p class="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-[0.2em] mt-0.5">Tracking Resources for God's Kingdom</p>
      </div>
      <div class="flex items-center gap-2">
        <button @click="exportToExcel" class="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-all shadow-sm flex items-center gap-2">
          <Download class="h-4 w-4" />
          <span class="text-xs font-bold uppercase tracking-wider hidden sm:inline">Export</span>
        </button>
        <button @click="showAddModal = true" class="px-5 py-2.5 rounded-xl bg-[#01779b] text-white hover:bg-[#015a77] transition-all shadow-lg shadow-[#01779b]/20 flex items-center gap-2">
          <Plus class="h-5 w-5" />
          <span class="text-xs font-black uppercase tracking-wider">New Transaction</span>
        </button>
      </div>
    </div>

    <!-- Metrics Grid -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 flex-shrink-0">
      <!-- Balance Card -->
      <div class="relative overflow-hidden bg-gradient-to-br from-[#01779b] to-[#22b8cf] rounded-[2rem] p-6 text-white shadow-xl">
        <div class="relative z-10">
          <div class="flex items-center justify-between mb-4">
            <div class="p-2 bg-white/20 backdrop-blur-md rounded-xl">
              <CreditCard class="h-5 w-5" />
            </div>
            <span class="text-[10px] font-black uppercase tracking-widest bg-white/20 px-2 py-1 rounded-full">Net Balance</span>
          </div>
          <p class="text-[11px] font-medium opacity-80 uppercase tracking-widest mb-1">Total Assets</p>
          <p class="text-2xl font-black tracking-tight">{{ formatCurrency(stats.balance) }}</p>
        </div>
        <!-- Decorative Circle -->
        <div class="absolute -right-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
      </div>

      <!-- Monthly Income -->
      <div class="bg-white dark:bg-slate-800 rounded-[2rem] p-6 border border-gray-100 dark:border-slate-700 shadow-sm">
        <div class="flex items-center justify-between mb-4">
          <div class="p-2 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl text-emerald-500">
            <ArrowUpRight class="h-5 w-5" />
          </div>
          <TrendingUp class="h-4 w-4 text-emerald-500 opacity-50" />
        </div>
        <p class="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1">Monthly Income</p>
        <p class="text-2xl font-black text-emerald-500 tracking-tight">{{ formatCurrency(stats.income) }}</p>
      </div>

      <!-- Monthly Expense -->
      <div class="bg-white dark:bg-slate-800 rounded-[2rem] p-6 border border-gray-100 dark:border-slate-700 shadow-sm">
        <div class="flex items-center justify-between mb-4">
          <div class="p-2 bg-rose-50 dark:bg-rose-500/10 rounded-xl text-rose-500">
            <ArrowDownRight class="h-5 w-5" />
          </div>
          <AlertCircle v-if="stats.expense > stats.income" class="h-4 w-4 text-rose-500 opacity-50 animate-pulse" />
        </div>
        <p class="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1">Monthly Expense</p>
        <p class="text-2xl font-black text-rose-500 tracking-tight">{{ formatCurrency(stats.expense) }}</p>
      </div>

      <!-- Active Entries -->
      <div class="bg-white dark:bg-slate-800 rounded-[2rem] p-6 border border-gray-100 dark:border-slate-700 shadow-sm">
        <div class="flex items-center justify-between mb-4">
          <div class="p-2 bg-amber-50 dark:bg-amber-500/10 rounded-xl text-amber-500">
            <Loader2 class="h-5 w-5" />
          </div>
          <span class="text-[10px] font-black uppercase tracking-widest text-amber-500">{{ stats.pending }} PENDING</span>
        </div>
        <p class="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Logs</p>
        <p class="text-2xl font-black text-gray-900 dark:text-white tracking-tight">{{ transactions.length }}</p>
      </div>
    </div>

    <!-- Main Content Area -->
    <div class="flex-1 flex flex-col min-h-0 bg-transparent gap-6 overflow-hidden lg:flex-row">
      
      <!-- Transaction Table -->
      <div class="flex-1 bg-white dark:bg-slate-900/50 rounded-[2.5rem] border border-gray-100 dark:border-slate-800 flex flex-col overflow-hidden shadow-sm">
        <!-- Table Actions -->
        <div class="p-6 border-b border-gray-50 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div class="relative flex-1 max-w-md">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input 
              v-model="searchQuery"
              type="text" 
              placeholder="Search by description, payee, or category..." 
              class="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-slate-800/50 border-none rounded-xl text-sm focus:ring-2 focus:ring-[#01779b] transition-all"
            />
          </div>
          <div class="flex items-center gap-2">
            <select 
              v-model="selectedType"
              class="bg-gray-50 dark:bg-slate-800/50 border-none rounded-xl text-xs font-black uppercase tracking-wider px-4 py-2 focus:ring-2 focus:ring-[#01779b]"
            >
              <option value="all">All Types</option>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
            </select>
          </div>
        </div>

        <!-- Table -->
        <div class="flex-1 overflow-y-auto custom-scrollbar">
          <table class="w-full text-left border-collapse">
            <thead class="sticky top-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md z-10 border-b border-gray-50 dark:border-slate-800">
              <tr>
                <th class="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Date</th>
                <th class="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Description</th>
                <th class="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 text-right">Amount</th>
                <th class="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 text-center">Status</th>
                <th class="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 text-right">Action</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-50 dark:divide-slate-800/50">
              <tr v-if="isLoading" v-for="i in 5" :key="i" class="animate-pulse">
                <td v-for="j in 5" :key="j" class="px-6 py-4"><div class="h-4 bg-gray-100 dark:bg-slate-800 rounded-lg w-full"></div></td>
              </tr>
              <tr v-else-if="filteredTransactions.length === 0" class="hover:bg-gray-50/50 dark:hover:bg-slate-800/30 transition-colors">
                <td colspan="5" class="px-6 py-20 text-center">
                  <div class="flex flex-col items-center">
                    <FileText class="h-12 w-12 text-gray-200 dark:text-slate-700 mb-4" />
                    <p class="text-sm font-bold text-gray-400 uppercase tracking-widest">No entries found</p>
                  </div>
                </td>
              </tr>
              <tr v-for="t in filteredTransactions" :key="t.id" class="group hover:bg-gray-50/50 dark:hover:bg-slate-800/30 transition-colors">
                <td class="px-6 py-4">
                  <div class="flex flex-col">
                    <span class="text-sm font-bold text-gray-900 dark:text-white">{{ formatDate(t.date) }}</span>
                    <span class="text-[9px] font-black text-gray-400 uppercase tracking-tighter">{{ t.category }}</span>
                  </div>
                </td>
                <td class="px-6 py-4">
                  <div class="flex items-center gap-3">
                    <div :class="[
                      'p-2 rounded-xl flex-shrink-0',
                      t.type === 'income' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500' : 'bg-rose-50 dark:bg-rose-500/10 text-rose-500'
                    ]">
                      <component :is="getCategoryIcon(t.category)" class="h-4 w-4" />
                    </div>
                    <div class="flex flex-col">
                      <p class="text-sm font-bold text-gray-900 dark:text-white truncate max-w-[200px]">{{ t.description }}</p>
                      <p class="text-[10px] text-gray-500 dark:text-slate-400 font-medium">From/To: {{ t.payerPayee || 'Internal' }}</p>
                    </div>
                  </div>
                </td>
                <td class="px-6 py-4 text-right">
                  <span :class="['text-sm font-black tracking-tight', t.type === 'income' ? 'text-emerald-500' : 'text-rose-500']">
                    {{ t.type === 'income' ? '+' : '-' }}{{ formatCurrency(t.amount) }}
                  </span>
                </td>
                <td class="px-6 py-4">
                  <div class="flex justify-center">
                    <span :class="[
                      'px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border',
                      t.status === 'completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20' : 
                      t.status === 'pending' ? 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20' : 
                      'bg-gray-50 text-gray-600 border-gray-100 dark:bg-slate-700 dark:text-slate-400 dark:border-slate-600'
                    ]">
                      {{ t.status }}
                    </span>
                  </div>
                </td>
                <td class="px-6 py-4 text-right">
                  <div class="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button @click="confirmDelete(t)" class="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors">
                      <Trash2 class="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Right Panel: Visual Summaries -->
      <div class="w-full lg:w-96 flex flex-col gap-6">
        <!-- Distribution Chart (Simplified) -->
        <div class="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-[2.5rem] p-6 shadow-sm">
          <div class="flex items-center justify-between mb-6">
            <h3 class="text-xs font-black uppercase tracking-[0.2em] text-gray-500">Top Categories</h3>
            <PieIcon class="h-4 w-4 text-[#01779b]" />
          </div>
          
          <div class="space-y-4">
            <div v-for="[cat, val] in groupedByCategory" :key="cat" class="space-y-2">
              <div class="flex items-center justify-between text-[11px] font-black uppercase tracking-wider">
                <span class="text-gray-600 dark:text-slate-400">{{ cat }}</span>
                <span class="text-gray-900 dark:text-white">{{ formatCurrency(val) }}</span>
              </div>
              <div class="h-2 w-full bg-gray-50 dark:bg-slate-800 rounded-full overflow-hidden">
                <div 
                  class="h-full bg-gradient-to-r from-[#01779b] to-[#22b8cf] rounded-full transition-all duration-1000"
                  :style="{ width: `${(val / Math.max(...groupedByCategory.map(x => x[1]))) * 100}%` }"
                ></div>
              </div>
            </div>
          </div>

          <div v-if="groupedByCategory.length === 0" class="py-12 text-center text-gray-400 italic text-[11px]">
            No categorical data available
          </div>
        </div>

        <!-- Call to Action / Info -->
        <div class="bg-slate-950 rounded-[2.5rem] p-6 text-white relative overflow-hidden group">
          <div class="relative z-10">
            <h3 class="text-lg font-black tracking-tight mb-2 uppercase">Financial Report</h3>
            <p class="text-[11px] text-slate-400 font-medium leading-relaxed mb-6">
              "Honour the LORD with thy substance, and with the firstfruits of all thine increase." — Proverbs 3:9
            </p>
            <router-link to="/finances/audit" class="w-full py-4 bg-white/10 hover:bg-white/20 rounded-2xl flex items-center justify-center gap-3 transition-all group">
              <span class="text-[10px] font-black uppercase tracking-widest">Full Audit View</span>
              <ArrowRight class="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </router-link>
          </div>
          <div class="absolute -right-10 -top-10 w-40 h-40 bg-[#01779b]/10 rounded-full blur-3xl opacity-50"></div>
        </div>
      </div>
    </div>

    <!-- Modals -->
    <!-- Add Transaction Modal -->
    <Transition name="modal">
      <div v-if="showAddModal" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" @click="showAddModal = false"></div>
        <div class="relative bg-white dark:bg-slate-900 w-full max-w-xl rounded-[2.5rem] shadow-2xl border border-gray-100 dark:border-slate-800 overflow-hidden transform transition-all p-8">
          <div class="flex items-center justify-between mb-8">
            <div>
              <h3 class="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Record stewardship</h3>
              <p class="text-[10px] font-black text-[#01779b] dark:text-[#22b8cf] uppercase tracking-widest mt-1">Transaction Ledger Entry</p>
            </div>
            <button @click="showAddModal = false" class="p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
              <MoreHorizontal class="h-6 w-6" />
            </button>
          </div>

          <form @submit.prevent="handleAddTransaction" class="space-y-6">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <!-- Type Toggle -->
               <div class="col-span-full">
                <label class="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 block">Transaction Type</label>
                <div class="flex p-1 bg-gray-100 dark:bg-slate-800 rounded-2xl w-full">
                  <button 
                    type="button"
                    @click="form.type = 'income'"
                    :class="['flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all', form.type === 'income' ? 'bg-white dark:bg-slate-700 text-emerald-500 shadow-sm' : 'text-gray-500']"
                  >Income</button>
                  <button 
                    type="button"
                    @click="form.type = 'expense'"
                    :class="['flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all', form.type === 'expense' ? 'bg-white dark:bg-slate-700 text-rose-500 shadow-sm' : 'text-gray-500']"
                  >Expense</button>
                </div>
              </div>

              <div class="space-y-2">
                <label class="text-[10px] font-black uppercase tracking-widest text-gray-400">Date</label>
                <input v-model="form.date" type="date" required class="w-full px-4 py-3 bg-gray-50 dark:bg-slate-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-[#01779b]" />
              </div>

              <div class="space-y-2">
                <label class="text-[10px] font-black uppercase tracking-widest text-gray-400">Category</label>
                <select v-model="form.category" class="w-full px-4 py-3 bg-gray-50 dark:bg-slate-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-[#01779b]">
                  <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
                </select>
              </div>

              <div class="space-y-2">
                <label class="text-[10px] font-black uppercase tracking-widest text-gray-400">Description</label>
                <input v-model="form.description" type="text" required placeholder="e.g. Weekly Tithes" class="w-full px-4 py-3 bg-gray-50 dark:bg-slate-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-[#01779b]" />
              </div>

              <div class="space-y-2">
                <label class="text-[10px] font-black uppercase tracking-widest text-gray-400">Amount (PHP)</label>
                <input v-model="form.amount" type="number" step="0.01" required class="w-full px-4 py-3 bg-gray-50 dark:bg-slate-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-[#01779b]" />
              </div>

              <div class="space-y-2 col-span-full">
                <label class="text-[10px] font-black uppercase tracking-widest text-gray-400">Payer / Payee</label>
                <input v-model="form.payerPayee" type="text" placeholder="Individual name or Company" class="w-full px-4 py-3 bg-gray-50 dark:bg-slate-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-[#01779b]" />
              </div>
            </div>

            <div class="pt-4 flex gap-3">
              <button 
                type="button" 
                @click="showAddModal = false"
                class="flex-1 py-4 bg-gray-50 dark:bg-slate-800 text-gray-500 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-gray-100 transition-all"
              >Cancel</button>
              <button 
                type="submit"
                :disabled="isSubmitting"
                class="flex-[2] py-4 bg-[#01779b] text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-[#01779b]/20 hover:bg-[#015a77] transition-all flex items-center justify-center gap-2"
              >
                <Loader2 v-if="isSubmitting" class="h-4 w-4 animate-spin" />
                Confirm Record
              </button>
            </div>
          </form>
        </div>
      </div>
    </Transition>

    <!-- Delete Confirm Modal -->
    <Transition name="modal">
      <div v-if="showDeleteConfirm" class="fixed inset-0 z-[110] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" @click="showDeleteConfirm = false"></div>
        <div class="relative bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2.5rem] shadow-2xl p-8 text-center">
          <div class="w-16 h-16 bg-rose-50 dark:bg-rose-500/10 text-rose-500 rounded-[1.5rem] flex items-center justify-center mx-auto mb-6">
            <Trash2 class="h-8 w-8" />
          </div>
          <h3 class="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight mb-2">Void Transaction?</h3>
          <p class="text-xs text-gray-500 dark:text-slate-400 font-medium leading-relaxed px-4 mb-8">
            Are you sure you want to remove this record? This action will affect the net balance and cannot be undone.
          </p>
          <div class="flex flex-col gap-3">
            <button 
              @click="handleDeleteTransaction"
              :disabled="isSubmitting"
              class="w-full py-4 bg-rose-500 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-rose-500/20 hover:bg-rose-600 transition-all flex items-center justify-center gap-2"
            >
              <Loader2 v-if="isSubmitting" class="h-4 w-4 animate-spin" />
              Delete Record
            </button>
            <button 
              @click="showDeleteConfirm = false"
              class="w-full py-4 bg-gray-50 dark:bg-slate-800 text-gray-500 rounded-2xl font-black uppercase tracking-widest text-[10px]"
            >Cancel</button>
          </div>
        </div>
      </div>
    </Transition>
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
  background: rgba(0,0,0,0.05);
  border-radius: 10px;
}
.dark .custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255,255,255,0.05);
}

.modal-enter-active, .modal-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.modal-enter-from, .modal-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>

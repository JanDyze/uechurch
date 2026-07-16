<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  ArrowLeft,
  Download,
  Printer,
  TrendingUp,
  TrendingDown,
  PieChart as PieIcon,
  Building2,
  Users,
  Wallet
} from 'lucide-vue-next'
import { subscribeToTransactions } from '../api/financeService'
import * as XLSX from 'xlsx'

const transactions = ref([])
const isLoading = ref(true)
const selectedYear = ref(new Date().getFullYear())
const years = [2023, 2024, 2025, 2026]

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

const yearTransactions = computed(() => {
  return transactions.value.filter(t => new Date(t.date).getFullYear() === selectedYear.value)
})

const monthlySummary = computed(() => {
  const months = Array.from({ length: 12 }, (_, i) => ({
    index: i,
    name: new Date(0, i).toLocaleString('default', { month: 'long' }),
    income: 0,
    expense: 0,
    net: 0
  }))

  yearTransactions.value.forEach(t => {
    const month = new Date(t.date).getMonth()
    if (t.type === 'income') months[month].income += Number(t.amount)
    else months[month].expense += Number(t.amount)
  })

  months.forEach(m => (m.net = m.income - m.expense))
  return months
})

const totals = computed(() => {
  const totalIncome = monthlySummary.value.reduce((acc, m) => acc + m.income, 0)
  const totalExpense = monthlySummary.value.reduce((acc, m) => acc + m.expense, 0)
  return {
    income: totalIncome,
    expense: totalExpense,
    net: totalIncome - totalExpense
  }
})

const categoryDistribution = computed(() => {
  const groups = {}
  yearTransactions.value.forEach(t => {
    if (!groups[t.category]) groups[t.category] = 0
    groups[t.category] += Number(t.amount)
  })
  return Object.entries(groups)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
})

const formatCurrency = (val) => {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(val)
}

const exportFullReport = () => {
  const summarySheet = monthlySummary.value.map(m => ({
    Month: m.name,
    Income: m.income,
    Expense: m.expense,
    Net: m.net
  }))

  const rawTransactionsSheet = yearTransactions.value.map(t => ({
    Date: t.date,
    Description: t.description,
    Category: t.category,
    Type: t.type.toUpperCase(),
    Amount: t.amount,
    'Payer/Payee': t.payerPayee
  }))

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summarySheet), "Monthly Summary")
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rawTransactionsSheet), "Audit Logs")
  XLSX.writeFile(wb, `Audit_Report_${selectedYear.value}.xlsx`)
}

const printReport = () => {
  window.print()
}
</script>

<template>
  <div class="flex flex-col h-full space-y-4 sm:space-y-6 overflow-y-auto lg:overflow-hidden">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
      <div class="flex items-center gap-3">
        <router-link to="/finances" class="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 transition-colors shrink-0">
          <ArrowLeft class="h-5 w-5" />
        </router-link>
        <div class="min-w-0">
          <h1 class="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white truncate">Audit Center</h1>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Full accountability &amp; transparency</p>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <select v-model="selectedYear" class="h-10 flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 text-sm text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-primary sm:flex-none">
          <option v-for="y in years" :key="y" :value="y">{{ y }} Fiscal Year</option>
        </select>
        <div class="ml-auto flex shrink-0 items-center gap-2 sm:ml-0">
          <button @click="exportFullReport" class="flex h-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 transition-colors px-2.5 sm:px-4 gap-1 sm:gap-1.5" title="Export report">
            <Download class="h-5 w-5 shrink-0" />
            <span class="whitespace-nowrap text-xs sm:text-sm">Export</span>
          </button>
          <button @click="printReport" class="flex h-10 shrink-0 items-center justify-center rounded-lg bg-primary text-white hover:bg-primary-hover transition-colors px-2.5 sm:px-4 gap-1 sm:gap-1.5" title="Print report">
            <Printer class="h-5 w-5 shrink-0" />
            <span class="whitespace-nowrap text-xs sm:text-sm">Print</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Annual Summary -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 shrink-0">
      <div class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
        <div class="flex items-center gap-2 mb-3">
          <div class="p-1.5 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 shrink-0"><TrendingUp class="h-4 w-4" /></div>
          <p class="text-xs font-medium text-gray-500 dark:text-gray-400">Total Annual Income</p>
        </div>
        <p class="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white truncate">{{ formatCurrency(totals.income) }}</p>
      </div>

      <div class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
        <div class="flex items-center gap-2 mb-3">
          <div class="p-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 shrink-0"><TrendingDown class="h-4 w-4" /></div>
          <p class="text-xs font-medium text-gray-500 dark:text-gray-400">Total Annual Expense</p>
        </div>
        <p class="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white truncate">{{ formatCurrency(totals.expense) }}</p>
      </div>

      <div class="rounded-lg border border-primary/20 bg-primary/5 dark:bg-primary/10 p-4">
        <div class="flex items-center gap-2 mb-3">
          <div class="p-1.5 rounded-lg bg-primary/10 dark:bg-primary/20 text-primary shrink-0"><Wallet class="h-4 w-4" /></div>
          <p class="text-xs font-medium text-gray-500 dark:text-gray-400">Net Surplus / Deficit</p>
        </div>
        <p class="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white truncate">{{ formatCurrency(totals.net) }}</p>
      </div>
    </div>

    <!-- Main Report -->
    <div class="shrink-0 lg:flex-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden flex flex-col lg:min-h-0">
      <div class="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3">
        <div class="min-w-0">
          <h2 class="text-sm font-semibold text-gray-900 dark:text-white truncate">Monthly Performance Ledger</h2>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Detailed breakdown by month &mdash; {{ selectedYear }}</p>
        </div>
        <PieIcon class="h-5 w-5 text-primary shrink-0" />
      </div>

      <!-- Report Table -->
      <div class="lg:flex-1 lg:overflow-y-auto no-scrollbar print-area">
        <!-- Table (desktop only) -->
        <table class="hidden w-full text-left border-collapse lg:table">
          <thead>
            <tr class="bg-gray-50 dark:bg-gray-700/30">
              <th class="px-4 sm:px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400">Month</th>
              <th class="px-4 sm:px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400">Income</th>
              <th class="px-4 sm:px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400">Expense</th>
              <th class="px-4 sm:px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400">Net</th>
              <th class="px-4 sm:px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 text-right">Trend</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
            <tr v-if="isLoading" v-for="i in 12" :key="i" class="animate-pulse">
              <td colspan="5" class="px-4 sm:px-6 py-4"><div class="h-4 bg-gray-100 dark:bg-gray-700 rounded-lg"></div></td>
            </tr>
            <tr v-for="m in monthlySummary" :key="m.name" class="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
              <td class="px-4 sm:px-6 py-3">
                <span class="text-sm font-medium text-gray-900 dark:text-white">{{ m.name }}</span>
              </td>
              <td class="px-4 sm:px-6 py-3">
                <span class="text-sm text-green-600 dark:text-green-400">{{ formatCurrency(m.income) }}</span>
              </td>
              <td class="px-4 sm:px-6 py-3">
                <span class="text-sm text-red-600 dark:text-red-400">{{ formatCurrency(m.expense) }}</span>
              </td>
              <td class="px-4 sm:px-6 py-3">
                <div class="flex items-center gap-2">
                  <span :class="['text-sm font-semibold', m.net >= 0 ? 'text-gray-900 dark:text-white' : 'text-red-600 dark:text-red-400']">
                    {{ formatCurrency(m.net) }}
                  </span>
                  <TrendingUp v-if="m.net > 0" class="h-3.5 w-3.5 text-green-500" />
                  <TrendingDown v-else-if="m.net < 0" class="h-3.5 w-3.5 text-red-500" />
                </div>
              </td>
              <td class="px-4 sm:px-6 py-3">
                <div class="flex items-center justify-end gap-1">
                  <div class="w-10 bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden relative">
                    <div
                      class="absolute h-full left-0 bg-green-500 transition-all duration-500"
                      :style="{ width: `${m.income > 0 ? (m.income / totals.income) * 100 * 5 : 0}%` }"
                    ></div>
                  </div>
                  <div class="w-10 bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden relative">
                    <div
                      class="absolute h-full left-0 bg-red-500 transition-all duration-500"
                      :style="{ width: `${m.expense > 0 ? (m.expense / totals.expense) * 100 * 5 : 0}%` }"
                    ></div>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- List (mobile & tablet) -->
        <div class="divide-y divide-gray-100 dark:divide-gray-700 lg:hidden">
          <template v-if="isLoading">
            <div v-for="i in 12" :key="i" class="px-4 sm:px-6 py-3">
              <div class="h-10 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse"></div>
            </div>
          </template>
          <div v-else v-for="m in monthlySummary" :key="m.name" class="px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
            <div class="min-w-0">
              <p class="text-sm font-medium text-gray-900 dark:text-white">{{ m.name }}</p>
              <div class="flex items-center gap-3 mt-1">
                <span class="text-xs text-green-600 dark:text-green-400">+{{ formatCurrency(m.income) }}</span>
                <span class="text-xs text-red-600 dark:text-red-400">-{{ formatCurrency(m.expense) }}</span>
              </div>
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
              <span :class="['text-sm font-semibold', m.net >= 0 ? 'text-gray-900 dark:text-white' : 'text-red-600 dark:text-red-400']">
                {{ formatCurrency(m.net) }}
              </span>
              <TrendingUp v-if="m.net > 0" class="h-3.5 w-3.5 text-green-500 shrink-0" />
              <TrendingDown v-else-if="m.net < 0" class="h-3.5 w-3.5 text-red-500 shrink-0" />
            </div>
          </div>
        </div>
      </div>

      <!-- Footer Summary -->
      <div class="p-4 sm:p-6 bg-gray-50 dark:bg-gray-700/20 mt-auto grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 border-t border-gray-200 dark:border-gray-700">
        <div class="min-w-0">
          <p class="text-xs text-gray-400 dark:text-gray-500 mb-2">Top Sector</p>
          <div class="flex items-center gap-2">
             <div class="p-1.5 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 text-primary shrink-0"><Building2 class="h-4 w-4" /></div>
             <span class="text-sm font-medium text-gray-900 dark:text-white truncate">{{ categoryDistribution[0]?.name || 'N/A' }}</span>
          </div>
        </div>
        <div class="min-w-0">
           <p class="text-xs text-gray-400 dark:text-gray-500 mb-2">Donor Base Activity</p>
           <div class="flex items-center gap-2 text-green-600 dark:text-green-400">
              <Users class="h-4 w-4 shrink-0" />
              <span class="text-sm font-medium">Scaling Up</span>
           </div>
        </div>
        <div class="col-span-2 flex flex-col sm:items-end text-left sm:text-right justify-end">
           <p class="text-xs text-gray-400 dark:text-gray-500">Audit timestamp: {{ new Date().toLocaleString() }}</p>
           <p class="text-xs text-primary mt-0.5">UEC Financial Verification Service</p>
        </div>
      </div>
    </div>
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

@media print {
  .lg\:flex-1, .px-2 {
    padding: 0 !important;
    margin: 0 !important;
    max-width: none !important;
  }
  button, select, .router-link {
    display: none !important;
  }
  .print-area {
    overflow: visible !important;
  }
  .print-area table {
    display: table !important;
  }
  .print-area .lg\:hidden {
    display: none !important;
  }
  .bg-white {
    background-color: white !important;
  }
  .dark {
    color-scheme: light !important;
  }
}
</style>

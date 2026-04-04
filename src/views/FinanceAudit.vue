<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { 
  ArrowLeft, 
  Download, 
  Printer, 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  PieChart as PieIcon, 
  Filter, 
  ChevronRight, 
  Search,
  Building2,
  Users,
  DollarSign,
  Heart,
  Briefcase,
  Zap
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
  <div class="h-full flex flex-col space-y-6 overflow-hidden max-w-7xl mx-auto py-4">
    <!-- Audit Header -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-6 px-2">
      <div class="flex items-center gap-4">
        <router-link to="/finances" class="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-800 text-gray-500 hover:text-[#01779b] transition-all shadow-sm">
          <ArrowLeft class="h-5 w-5" />
        </router-link>
        <div>
          <h1 class="text-3xl font-black text-gray-900 dark:text-white tracking-tight leading-tight uppercase">Audit Center</h1>
          <p class="text-xs font-black text-[#01779b] dark:text-[#22b8cf] uppercase tracking-widest mt-1">Full Accountability & Transparency</p>
        </div>
      </div>
      
      <div class="flex items-center gap-3">
        <select v-model="selectedYear" class="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-800 shadow-sm rounded-xl px-4 py-2.5 text-sm font-black uppercase tracking-widest focus:ring-2 focus:ring-[#01779b]">
          <option v-for="y in years" :key="y" :value="y">{{ y }} FISCAL YEAR</option>
        </select>
        <button @click="exportFullReport" class="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-800 text-gray-600 hover:text-[#01779b] transition-all shadow-sm group">
          <Download class="h-5 w-5 transition-transform group-hover:translate-y-0.5" />
        </button>
        <button @click="printReport" class="p-2.5 rounded-xl bg-[#01779b] text-white shadow-lg shadow-[#01779b]/20 hover:bg-[#015a77] transition-all group">
          <Printer class="h-5 w-5 transition-transform group-hover:scale-110" />
        </button>
      </div>
    </div>

    <!-- Annual Summary Section -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 px-2">
      <div class="bg-white dark:bg-slate-900 rounded-[2rem] p-8 border border-gray-100 dark:border-slate-800 shadow-sm">
        <div class="flex items-center gap-3 mb-6">
          <div class="p-3 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl text-emerald-500"><TrendingUp class="h-6 w-6" /></div>
          <p class="text-xs font-black text-gray-400 uppercase tracking-widest">Total Annual Income</p>
        </div>
        <p class="text-3xl font-black tracking-tighter text-gray-900 dark:text-white">{{ formatCurrency(totals.income) }}</p>
        <div class="mt-4 pt-4 border-t border-gray-50 dark:border-slate-800">
           <p class="text-[10px] font-black uppercase tracking-widest text-[#01779b]">All Sources Consolidated</p>
        </div>
      </div>

      <div class="bg-white dark:bg-slate-900 rounded-[2rem] p-8 border border-gray-100 dark:border-slate-800 shadow-sm">
        <div class="flex items-center gap-3 mb-6">
          <div class="p-3 bg-rose-50 dark:bg-rose-500/10 rounded-2xl text-rose-500"><TrendingDown class="h-6 w-6" /></div>
          <p class="text-xs font-black text-gray-400 uppercase tracking-widest">Total Annual Expense</p>
        </div>
        <p class="text-3xl font-black tracking-tighter text-gray-900 dark:text-white">{{ formatCurrency(totals.expense) }}</p>
        <div class="mt-4 pt-4 border-t border-gray-50 dark:border-slate-800">
           <p class="text-[10px] font-black uppercase tracking-widest text-rose-500">Ministry Related Costs</p>
        </div>
      </div>

      <div class="bg-slate-950 rounded-[2rem] p-8 text-white relative overflow-hidden shadow-2xl">
        <div class="relative z-10">
          <div class="flex items-center gap-3 mb-6">
            <div class="p-3 bg-white/10 rounded-2xl"><DollarSign class="h-6 w-6" /></div>
            <p class="text-xs font-black text-slate-400 uppercase tracking-widest">Net Surplus / Deficit</p>
          </div>
          <p class="text-3xl font-black tracking-tighter">{{ formatCurrency(totals.net) }}</p>
          <div class="mt-4 pt-4 border-t border-white/10">
             <p class="text-[10px] font-black uppercase tracking-widest text-[#22b8cf]">Fiscal Integrity Report</p>
          </div>
        </div>
        <div class="absolute -right-10 -bottom-10 w-40 h-40 bg-[#01779b]/20 rounded-full blur-3xl opacity-50"></div>
      </div>
    </div>

    <!-- Main Audit Report Container -->
    <div class="flex-1 bg-white dark:bg-slate-900 border border-gray-50 dark:border-slate-800/80 rounded-[3rem] overflow-hidden flex flex-col shadow-sm mx-2">
      <!-- Report Sidebar/Header toggle -->
      <div class="p-8 border-b border-gray-50 dark:border-slate-800 flex items-center justify-between">
        <div>
          <h2 class="text-xl font-black text-gray-900 dark:text-white leading-tight uppercase">Monthly Performance Ledger</h2>
          <p class="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mt-1">Detailed Breakdown by Month - {{ selectedYear }}</p>
        </div>
        <PieIcon class="h-6 w-6 text-[#01779b]" />
      </div>

      <!-- Report Table/Body -->
      <div class="flex-1 overflow-y-auto no-scrollbar print-area">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-gray-50/50 dark:bg-slate-800/20">
              <th class="px-8 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Ledger Month</th>
              <th class="px-8 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Net Revenue</th>
              <th class="px-8 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Expenditure</th>
              <th class="px-8 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Balance Shift</th>
              <th class="px-8 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 text-right">Trend Visual</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="isLoading" v-for="i in 12" :key="i" class="animate-pulse">
               <td colspan="5" class="px-8 py-5"><div class="h-4 bg-gray-50 dark:bg-slate-800 rounded-lg"></div></td>
            </tr>
            <tr v-for="m in monthlySummary" :key="m.name" class="group hover:bg-[#01779b]/5 dark:hover:bg-[#22b8cf]/5 transition-all">
              <td class="px-8 py-5">
                <span class="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">{{ m.name }}</span>
              </td>
              <td class="px-8 py-5">
                <span class="text-sm font-bold text-emerald-500">{{ formatCurrency(m.income) }}</span>
              </td>
              <td class="px-8 py-5">
                <span class="text-sm font-bold text-rose-500">{{ formatCurrency(m.expense) }}</span>
              </td>
              <td class="px-8 py-5">
                <div class="flex items-center gap-2">
                  <span :class="['text-sm font-black tracking-tighter', m.net >= 0 ? 'text-gray-900 dark:text-white' : 'text-rose-600 font-black']">
                    {{ formatCurrency(m.net) }}
                  </span>
                  <div v-if="m.net > 0" class="p-1 bg-emerald-50 text-emerald-500 rounded-lg"><TrendingUp class="h-3 w-3" /></div>
                  <div v-else-if="m.net < 0" class="p-1 bg-rose-50 text-rose-500 rounded-lg"><TrendingDown class="h-3 w-3" /></div>
                </div>
              </td>
              <td class="px-8 py-5">
                <div class="flex items-center justify-end gap-1 h-6">
                  <!-- Minimalistic sparkline bar -->
                  <div class="w-10 bg-gray-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden relative">
                    <div 
                      class="absolute h-full left-0 bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-1000"
                      :style="{ width: `${m.income > 0 ? (m.income / totals.income) * 100 * 5 : 0}%` }"
                    ></div>
                  </div>
                  <div class="w-10 bg-gray-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden relative">
                    <div 
                      class="absolute h-full left-0 bg-gradient-to-r from-rose-400 to-rose-600 transition-all duration-1000"
                      :style="{ width: `${m.expense > 0 ? (m.expense / totals.expense) * 100 * 5 : 0}%` }"
                    ></div>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <!-- Footer Distribution Summary -->
      <div class="p-8 bg-gray-50/50 dark:bg-slate-800/20 mt-auto grid grid-cols-2 lg:grid-cols-4 gap-8">
        <div>
          <p class="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 mb-3">Top Sector</p>
          <div class="flex items-center gap-3">
             <div class="p-2 bg-white dark:bg-slate-800 rounded-xl shadow-sm text-[#01779b]"><Building2 class="h-4 w-4" /></div>
             <span class="text-sm font-black text-gray-900 dark:text-white uppercase truncate">{{ categoryDistribution[0]?.name || 'N/A' }}</span>
          </div>
        </div>
        <div>
           <p class="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 mb-3">Donor Base Activity</p>
           <div class="flex items-center gap-3 text-emerald-500">
              <Users class="h-4 w-4" />
              <span class="text-sm font-black uppercase">Scaling Up</span>
           </div>
        </div>
        <div class="col-span-2 flex flex-col justify-end items-end">
           <p class="text-[10px] font-medium text-gray-400 italic">Audit timestamp: {{ new Date().toLocaleString() }}</p>
           <p class="text-[9px] font-black text-[#01779b] uppercase tracking-widest mt-1">UEC Financial Verification Service</p>
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
  .lg\:flex-1, .px-2, .max-w-7xl {
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
  .bg-white {
    background-color: white !important;
  }
  .dark {
    color-scheme: light !important;
  }
}
</style>

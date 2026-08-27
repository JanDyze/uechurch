<script setup>
import { ref, computed } from 'vue'
import {
  ArrowLeft,
  Download,
  Printer,
  TrendingUp,
  TrendingDown,
  Wallet,
} from 'lucide-vue-next'
import {
  useFinances,
  buildYearStatement,
  buildYearStatements,
  formatAmount,
} from '../composables/useFinances'
import { exportYear } from '../utils/financeExport'
import StatementReport from '../components/finances/StatementReport.vue'

const { transactions, opening, loading } = useFinances()

const selectedYear = ref(new Date().getFullYear())

/** Years the church has activity in, plus the current one. */
const years = computed(() => {
  const set = new Set(transactions.value.map((t) => Number(t.date.slice(0, 4))))
  set.add(new Date().getFullYear())
  if (opening.value.asOf) set.add(Number(opening.value.asOf.slice(0, 4)))
  return [...set].filter(Boolean).sort((a, b) => b - a)
})

const yearStatement = computed(() =>
  buildYearStatement(transactions.value, opening.value, selectedYear.value)
)

const months = computed(() =>
  buildYearStatements(transactions.value, opening.value, selectedYear.value)
)

/** Months are only worth listing once something has been recorded in them. */
const activeMonths = computed(() =>
  months.value.filter((m) => m.transactions.length > 0)
)

const handleExport = () => {
  exportYear(yearStatement.value, months.value, selectedYear.value)
}

const handlePrint = () => window.print()
</script>

<template>
  <div class="flex flex-col h-full overflow-y-auto">
    <!-- Header -->
    <div class="flex items-center gap-2 mb-4 shrink-0 w-full max-w-3xl mx-auto no-print">
      <router-link
        to="/finances"
        class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
        aria-label="Back to finances"
      >
        <ArrowLeft class="h-5 w-5" />
      </router-link>

      <select
        v-model="selectedYear"
        class="h-10 flex-1 min-w-0 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 text-sm font-semibold text-gray-900 dark:text-white focus:ring-1 focus:ring-primary"
      >
        <option v-for="year in years" :key="year" :value="year">{{ year }}</option>
      </select>

      <button
        @click="handleExport"
        class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
        aria-label="Export year"
      >
        <Download class="h-5 w-5" />
      </button>
      <button
        @click="handlePrint"
        class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-white shadow-sm transition-transform active:scale-95"
        aria-label="Print report"
      >
        <Printer class="h-5 w-5" />
      </button>
    </div>

    <div class="pb-6 space-y-3 w-full max-w-3xl mx-auto print-area">
      <!-- Annual totals -->
      <div class="grid grid-cols-2 gap-2 sm:gap-3">
        <div class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
          <div class="flex items-center gap-2 mb-1.5">
            <div
              class="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 shrink-0"
            >
              <TrendingUp class="h-4 w-4" />
            </div>
            <p class="text-[11px] font-medium text-gray-500 dark:text-gray-400 truncate">
              Total Inflow
            </p>
          </div>
          <p class="text-lg font-semibold tabular-nums text-gray-900 dark:text-white truncate">
            {{ formatAmount(yearStatement.inflow.total) }}
          </p>
        </div>

        <div class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
          <div class="flex items-center gap-2 mb-1.5">
            <div
              class="p-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 shrink-0"
            >
              <TrendingDown class="h-4 w-4" />
            </div>
            <p class="text-[11px] font-medium text-gray-500 dark:text-gray-400 truncate">
              Total Outflow
            </p>
          </div>
          <p class="text-lg font-semibold tabular-nums text-gray-900 dark:text-white truncate">
            {{ formatAmount(yearStatement.outflow.total) }}
          </p>
        </div>

        <div class="col-span-2 rounded-xl border border-primary/20 bg-primary/5 dark:bg-primary/10 p-3">
          <div class="flex items-center gap-2 mb-1.5">
            <div class="p-1.5 rounded-lg bg-primary/10 dark:bg-primary/20 text-primary shrink-0">
              <Wallet class="h-4 w-4" />
            </div>
            <p class="text-[11px] font-medium text-gray-500 dark:text-gray-400">
              Inflow less outflow &middot; {{ selectedYear }}
            </p>
          </div>
          <p
            :class="[
              'text-2xl font-bold tabular-nums truncate',
              yearStatement.net < 0
                ? 'text-red-600 dark:text-red-400'
                : 'text-gray-900 dark:text-white',
            ]"
          >
            &#8369;{{ formatAmount(yearStatement.net) }}
          </p>
        </div>
      </div>

      <!-- Month by month -->
      <section
        class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden"
      >
        <div class="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
          <h2 class="text-xs font-bold uppercase tracking-widest text-gray-700 dark:text-gray-200">
            Month by Month
          </h2>
        </div>

        <div v-if="loading" class="p-4 space-y-2">
          <div
            v-for="i in 4"
            :key="`month-skeleton-${i}`"
            class="h-12 rounded-lg bg-gray-100 dark:bg-gray-700 animate-pulse"
          ></div>
        </div>

        <p
          v-else-if="!activeMonths.length"
          class="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400"
        >
          Nothing recorded in {{ selectedYear }} yet.
        </p>

        <ul v-else class="divide-y divide-gray-100 dark:divide-gray-700">
          <li
            v-for="month in activeMonths"
            :key="month.key"
            class="flex items-center gap-3 px-4 py-3"
          >
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
                {{ month.label }}
              </p>
              <div class="flex items-center gap-3 mt-0.5">
                <span class="text-xs tabular-nums text-emerald-600 dark:text-emerald-400">
                  +{{ formatAmount(month.inflow.total) }}
                </span>
                <span class="text-xs tabular-nums text-red-600 dark:text-red-400">
                  -{{ formatAmount(month.outflow.total) }}
                </span>
              </div>
            </div>
            <div class="shrink-0 text-right">
              <p
                :class="[
                  'text-sm font-semibold tabular-nums',
                  month.net < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white',
                ]"
              >
                {{ month.net >= 0 ? '+' : '' }}{{ formatAmount(month.net) }}
              </p>
              <p class="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">
                ends {{ formatAmount(month.ending.total) }}
              </p>
            </div>
          </li>
        </ul>
      </section>

      <!-- Full year statement -->
      <div>
        <h2
          class="px-1 pb-2 pt-2 text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500"
        >
          {{ selectedYear }} Statement of Income and Expenses
        </h2>
        <div v-if="loading" class="space-y-3">
          <div
            v-for="i in 3"
            :key="`statement-skeleton-${i}`"
            class="h-28 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse"
          ></div>
        </div>
        <StatementReport
          v-else
          :statement="yearStatement"
          :opening-is-set="opening.isSet"
          @edit-opening="$router.push('/finances')"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
@media print {
  .no-print {
    display: none !important;
  }
  .print-area {
    overflow: visible !important;
  }
}
</style>

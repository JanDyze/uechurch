<script setup>
import { computed } from 'vue'
import { Receipt } from '../../icons'
import { categoryIcon, categoryLabel, accountShort } from '../../data/financeChart'
import { formatAmount } from '../../composables/useFinances'

const props = defineProps({
  transactions: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  emptyMessage: { type: String, default: 'No transactions this month' },
})

const emit = defineEmits(['select'])

/** One block per day, mirroring the DATE / TRANSACTION / AMOUNT columns. */
const days = computed(() => {
  const groups = new Map()
  props.transactions.forEach((transaction) => {
    if (!groups.has(transaction.date)) groups.set(transaction.date, [])
    groups.get(transaction.date).push(transaction)
  })
  return [...groups.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, rows]) => ({
      date,
      label: new Date(`${date}T00:00:00`).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }),
      rows,
      net: rows.reduce(
        (sum, t) =>
          t.direction === 'inflow' ? sum + t.amount : t.direction === 'outflow' ? sum - t.amount : sum,
        0
      ),
    }))
})

const amountClass = (transaction) =>
  transaction.direction === 'inflow'
    ? 'text-emerald-600 dark:text-emerald-400'
    : transaction.direction === 'outflow'
      ? 'text-red-600 dark:text-red-400'
      : 'text-gray-500 dark:text-gray-400'

const amountPrefix = (transaction) =>
  transaction.direction === 'inflow' ? '+' : transaction.direction === 'outflow' ? '-' : ''
</script>

<template>
  <div class="space-y-3">
    <template v-if="loading">
      <div
        v-for="i in 4"
        :key="`skeleton-${i}`"
        class="h-16 rounded-xl bg-gray-100 dark:bg-gray-700 animate-pulse"
      ></div>
    </template>

    <div
      v-else-if="!days.length"
      class="rounded-xl border border-dashed border-gray-200 dark:border-gray-700 px-4 py-12 text-center"
    >
      <Receipt class="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600" />
      <p class="mt-3 text-sm font-medium text-gray-700 dark:text-gray-300">{{ emptyMessage }}</p>
      <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
        Record tithes, offerings, and expenses to build the statement.
      </p>
    </div>

    <section
      v-for="day in days"
      :key="day.date"
      class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden"
    >
      <div
        class="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-700/30 border-b border-gray-100 dark:border-gray-700"
      >
        <span
          class="text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400"
        >
          {{ day.label }}
        </span>
        <span
          :class="[
            'text-[11px] font-semibold tabular-nums',
            day.net < 0 ? 'text-red-500 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400',
          ]"
        >
          {{ day.net >= 0 ? '+' : '' }}{{ formatAmount(day.net) }}
        </span>
      </div>

      <ul class="divide-y divide-gray-100 dark:divide-gray-700">
        <li v-for="transaction in day.rows" :key="transaction.id">
          <button
            @click="emit('select', transaction)"
            class="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
          >
            <div
              :class="[
                'p-2 rounded-lg shrink-0',
                transaction.direction === 'inflow'
                  ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400'
                  : transaction.direction === 'outflow'
                    ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'
                    : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300',
              ]"
            >
              <component :is="categoryIcon(transaction)" class="h-4 w-4" />
            </div>

            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
                {{ transaction.description || categoryLabel(transaction) }}
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-400 truncate">
                {{ categoryLabel(transaction) }}
                <span v-if="transaction.payerPayee"> &middot; {{ transaction.payerPayee }}</span>
              </p>
            </div>

            <div class="shrink-0 text-right">
              <p :class="['text-sm font-semibold tabular-nums', amountClass(transaction)]">
                {{ amountPrefix(transaction) }}{{ formatAmount(transaction.amount) }}
              </p>
              <p class="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">
                {{ accountShort(transaction.account) }}
              </p>
            </div>
          </button>
        </li>
      </ul>
    </section>
  </div>
</template>

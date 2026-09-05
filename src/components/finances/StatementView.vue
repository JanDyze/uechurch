<script setup>
import { computed } from 'vue'
import { formatAmount } from '../../utils/moneyUtils'

const props = defineProps({
  statement: { type: Object, required: true },
})

/** A group with nothing in it is noise on a statement, not information. */
const usedGroups = (side) => side.groups.filter((g) => g.total !== 0)

const income = computed(() => usedGroups(props.statement.income))
const expenses = computed(() => usedGroups(props.statement.expenses))

const isSurplus = computed(() => props.statement.net >= 0)
</script>

<template>
  <div class="p-4 sm:p-6">
    <!-- Head -->
    <div class="mb-5 text-center">
      <h2 class="text-sm font-bold uppercase tracking-wide text-gray-900 dark:text-white">
        Statement of Income and Expenses
      </h2>
      <p class="text-xs text-gray-500 dark:text-gray-400">{{ statement.label }}</p>
    </div>

    <!-- Income -->
    <section class="mb-5">
      <h3
        class="mb-1 border-b border-gray-300 pb-1 text-xs font-bold uppercase tracking-wide text-gray-700 dark:border-gray-600 dark:text-gray-300"
      >
        Income
      </h3>
      <p v-if="!income.length" class="py-2 text-xs text-gray-400 dark:text-gray-500">
        Nothing received this month.
      </p>
      <div v-for="group in income" :key="group.key">
        <div class="flex items-baseline gap-2 py-1">
          <span class="min-w-0 flex-1 truncate text-sm text-gray-900 dark:text-white">
            {{ group.label }}
          </span>
          <span class="shrink-0 text-sm font-semibold tabular-nums text-gray-900 dark:text-white">
            {{ formatAmount(group.total) }}
          </span>
        </div>
        <div
          v-for="line in group.lines.filter((l) => l.total !== 0)"
          :key="line.key"
          class="flex items-baseline gap-2 py-0.5 pl-4"
        >
          <span class="min-w-0 flex-1 truncate text-xs text-gray-500 dark:text-gray-400">
            {{ line.label }}
          </span>
          <span class="shrink-0 text-xs tabular-nums text-gray-500 dark:text-gray-400">
            {{ formatAmount(line.total) }}
          </span>
        </div>
      </div>
      <div
        class="mt-1 flex items-baseline gap-2 border-t border-gray-300 pt-1 dark:border-gray-600"
      >
        <span class="min-w-0 flex-1 text-sm font-bold text-gray-900 dark:text-white">
          Total income
        </span>
        <span class="shrink-0 text-sm font-bold tabular-nums text-green-700 dark:text-green-400">
          {{ formatAmount(statement.income.total) }}
        </span>
      </div>
    </section>

    <!-- Expenses -->
    <section class="mb-5">
      <h3
        class="mb-1 border-b border-gray-300 pb-1 text-xs font-bold uppercase tracking-wide text-gray-700 dark:border-gray-600 dark:text-gray-300"
      >
        Expenses
      </h3>
      <p v-if="!expenses.length" class="py-2 text-xs text-gray-400 dark:text-gray-500">
        Nothing paid out this month.
      </p>
      <div v-for="group in expenses" :key="group.key">
        <div class="flex items-baseline gap-2 py-1">
          <span class="min-w-0 flex-1 truncate text-sm text-gray-900 dark:text-white">
            {{ group.label }}
          </span>
          <span class="shrink-0 text-sm font-semibold tabular-nums text-gray-900 dark:text-white">
            {{ formatAmount(group.total) }}
          </span>
        </div>
        <div
          v-for="line in group.lines.filter((l) => l.total !== 0)"
          :key="line.key"
          class="flex items-baseline gap-2 py-0.5 pl-4"
        >
          <span class="min-w-0 flex-1 truncate text-xs text-gray-500 dark:text-gray-400">
            {{ line.label }}
          </span>
          <span class="shrink-0 text-xs tabular-nums text-gray-500 dark:text-gray-400">
            {{ formatAmount(line.total) }}
          </span>
        </div>
      </div>
      <div
        class="mt-1 flex items-baseline gap-2 border-t border-gray-300 pt-1 dark:border-gray-600"
      >
        <span class="min-w-0 flex-1 text-sm font-bold text-gray-900 dark:text-white">
          Total expenses
        </span>
        <span class="shrink-0 text-sm font-bold tabular-nums text-red-700 dark:text-red-400">
          {{ formatAmount(statement.expenses.total) }}
        </span>
      </div>
    </section>

    <!-- Net -->
    <div
      class="mb-5 flex items-baseline gap-2 rounded-lg px-3 py-2"
      :class="
        isSurplus
          ? 'bg-green-50 dark:bg-green-900/20'
          : 'bg-red-50 dark:bg-red-900/20'
      "
    >
      <span class="min-w-0 flex-1 text-sm font-bold text-gray-900 dark:text-white">
        {{ isSurplus ? 'Excess of income over expenses' : 'Excess of expenses over income' }}
      </span>
      <span
        class="shrink-0 text-base font-bold tabular-nums"
        :class="isSurplus ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'"
      >
        {{ formatAmount(statement.net) }}
      </span>
    </div>

    <!-- The proof. If these do not tie out, the statement is wrong and this is
         where it shows, rather than in a bank reconciliation months later. -->
    <section class="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
      <h3 class="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        Cash position
      </h3>
      <div class="grid grid-cols-4 gap-1 text-[11px] text-gray-400 dark:text-gray-500">
        <span></span>
        <span class="text-right">On hand</span>
        <span class="text-right">In bank</span>
        <span class="text-right font-semibold">Total</span>
      </div>
      <div
        v-for="row in [
          { label: 'Opening', v: statement.opening },
          { label: 'Movement', v: statement.movement },
          { label: 'Closing', v: statement.closing },
        ]"
        :key="row.label"
        class="grid grid-cols-4 gap-1 border-t border-gray-100 py-1 text-xs tabular-nums dark:border-gray-700"
        :class="row.label === 'Closing' ? 'font-bold text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-300'"
      >
        <span class="truncate">{{ row.label }}</span>
        <span class="text-right">{{ formatAmount(row.v.cash) }}</span>
        <span class="text-right">{{ formatAmount(row.v.bank) }}</span>
        <span class="text-right">{{ formatAmount(row.v.total) }}</span>
      </div>
      <p class="mt-2 text-[11px] text-gray-400 dark:text-gray-500">
        Movement equals income minus expenses. Transfers between the tin and the bank move money
        without appearing above.
      </p>
    </section>
  </div>
</template>

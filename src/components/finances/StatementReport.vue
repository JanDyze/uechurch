<script setup>
import { ref, watch } from 'vue'
import {
  ChevronRight,
  Wallet,
  Landmark,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  Pencil,
} from '../../icons'
import { formatAmount } from '../../composables/useFinances'

const props = defineProps({
  statement: { type: Object, required: true },
  openingIsSet: { type: Boolean, default: false },
})

const emit = defineEmits(['edit-opening'])

// Groups that actually moved money open by default; the rest stay collapsed so
// the statement still fits a phone screen. Only re-decided when the period
// changes, so expanding a group survives a live update from the database.
const expanded = ref(new Set())

watch(
  () => props.statement.key,
  () => {
    const open = new Set()
    ;[...props.statement.inflow.groups, ...props.statement.outflow.groups].forEach((group) => {
      if (group.total !== 0 && group.lines?.length) open.add(group.key)
    })
    expanded.value = open
  },
  { immediate: true }
)

const toggle = (group) => {
  if (!group.lines?.length) return
  const open = new Set(expanded.value)
  open.has(group.key) ? open.delete(group.key) : open.add(group.key)
  expanded.value = open
}
</script>

<template>
  <div class="space-y-3">
    <!-- Beginning balance -->
    <section
      class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden"
    >
      <div class="px-4 pt-3 pb-2 flex items-center justify-between">
        <h3
          class="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500"
        >
          Beginning Balance
        </h3>
        <button
          @click="emit('edit-opening')"
          class="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
        >
          <Pencil class="h-3 w-3" />
          {{ openingIsSet ? 'Starting balance' : 'Set starting balance' }}
        </button>
      </div>

      <div class="divide-y divide-gray-100 dark:divide-gray-700">
        <div class="flex items-center justify-between px-4 py-2.5">
          <span class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <Wallet class="h-4 w-4 text-gray-400 shrink-0" /> Cash on Hand
          </span>
          <span class="text-sm tabular-nums text-gray-900 dark:text-white">
            {{ formatAmount(statement.beginning.cashOnHand) }}
          </span>
        </div>
        <div class="flex items-center justify-between px-4 py-2.5">
          <span class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <Landmark class="h-4 w-4 text-gray-400 shrink-0" /> Cash in Bank - Eastwest
          </span>
          <span class="text-sm tabular-nums text-gray-900 dark:text-white">
            {{ formatAmount(statement.beginning.bankEastwest) }}
          </span>
        </div>
        <div class="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-700/30">
          <span class="text-xs font-bold uppercase tracking-wide text-gray-700 dark:text-gray-200">
            Beginning Balance
          </span>
          <span class="text-base font-bold tabular-nums text-gray-900 dark:text-white">
            {{ formatAmount(statement.beginning.total) }}
          </span>
        </div>
      </div>
    </section>

    <!-- Cash inflow -->
    <section
      class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden"
    >
      <div
        class="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-700"
      >
        <div
          class="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400"
        >
          <ArrowDownLeft class="h-4 w-4" />
        </div>
        <h3 class="text-xs font-bold uppercase tracking-widest text-gray-700 dark:text-gray-200">
          Cash Inflow
        </h3>
      </div>

      <div class="divide-y divide-gray-100 dark:divide-gray-700">
        <template v-for="group in statement.inflow.groups" :key="group.key">
          <button
            @click="toggle(group)"
            :class="[
              'w-full flex items-center gap-2 px-4 py-2.5 text-left transition-colors',
              group.lines?.length ? 'hover:bg-gray-50 dark:hover:bg-gray-700/30' : 'cursor-default',
            ]"
          >
            <ChevronRight
              v-if="group.lines?.length"
              :class="[
                'h-4 w-4 shrink-0 text-gray-400 transition-transform',
                expanded.has(group.key) && 'rotate-90',
              ]"
            />
            <span v-else class="w-4 shrink-0" />
            <span class="flex-1 min-w-0 text-sm font-medium text-gray-900 dark:text-white truncate">
              {{ group.label }}
            </span>
            <span
              :class="[
                'text-sm tabular-nums',
                group.total ? 'font-semibold text-gray-900 dark:text-white' : 'text-gray-400',
              ]"
            >
              {{ formatAmount(group.total) }}
            </span>
          </button>

          <div
            v-if="group.lines?.length && expanded.has(group.key)"
            class="bg-gray-50/60 dark:bg-gray-700/20 divide-y divide-gray-100 dark:divide-gray-700"
          >
            <div
              v-for="line in group.lines"
              :key="line.key || 'other'"
              class="flex items-center gap-2 pl-10 pr-4 py-2"
            >
              <span
                :class="[
                  'flex-1 min-w-0 text-xs truncate',
                  line.total ? 'text-gray-600 dark:text-gray-300' : 'text-gray-400',
                ]"
              >
                {{ line.label }}
              </span>
              <span
                :class="[
                  'text-xs tabular-nums',
                  line.total ? 'text-gray-700 dark:text-gray-200' : 'text-gray-400',
                ]"
              >
                {{ formatAmount(line.total) }}
              </span>
            </div>
          </div>
        </template>

        <div
          class="flex items-center justify-between px-4 py-3 bg-emerald-50/60 dark:bg-emerald-900/10"
        >
          <span class="text-xs font-bold uppercase tracking-wide text-gray-700 dark:text-gray-200">
            Total Inflow
          </span>
          <span class="text-base font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
            {{ formatAmount(statement.inflow.total) }}
          </span>
        </div>
      </div>
    </section>

    <!-- Cash available -->
    <div
      class="flex items-center justify-between rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 px-4 py-3"
    >
      <div class="min-w-0">
        <p class="text-xs font-bold uppercase tracking-wide text-gray-700 dark:text-gray-200">
          Cash Available
        </p>
        <p class="text-[11px] text-gray-400 dark:text-gray-500">Beginning balance + inflow</p>
      </div>
      <span class="text-base font-bold tabular-nums text-gray-900 dark:text-white">
        {{ formatAmount(statement.cashAvailable) }}
      </span>
    </div>

    <!-- Cash outflow -->
    <section
      class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden"
    >
      <div
        class="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-700"
      >
        <div class="p-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400">
          <ArrowUpRight class="h-4 w-4" />
        </div>
        <h3 class="text-xs font-bold uppercase tracking-widest text-gray-700 dark:text-gray-200">
          Cash Outflow
        </h3>
      </div>

      <div class="divide-y divide-gray-100 dark:divide-gray-700">
        <template v-for="group in statement.outflow.groups" :key="group.key">
          <button
            @click="toggle(group)"
            :class="[
              'w-full flex items-center gap-2 px-4 py-2.5 text-left transition-colors',
              group.lines?.length ? 'hover:bg-gray-50 dark:hover:bg-gray-700/30' : 'cursor-default',
            ]"
          >
            <ChevronRight
              v-if="group.lines?.length"
              :class="[
                'h-4 w-4 shrink-0 text-gray-400 transition-transform',
                expanded.has(group.key) && 'rotate-90',
              ]"
            />
            <span v-else class="w-4 shrink-0" />
            <span class="flex-1 min-w-0 text-sm font-medium text-gray-900 dark:text-white truncate">
              {{ group.label }}
            </span>
            <span
              :class="[
                'text-sm tabular-nums',
                group.total ? 'font-semibold text-gray-900 dark:text-white' : 'text-gray-400',
              ]"
            >
              {{ formatAmount(group.total) }}
            </span>
          </button>

          <div
            v-if="group.lines?.length && expanded.has(group.key)"
            class="bg-gray-50/60 dark:bg-gray-700/20 divide-y divide-gray-100 dark:divide-gray-700"
          >
            <div
              v-for="line in group.lines"
              :key="line.key || 'other'"
              class="flex items-center gap-2 pl-10 pr-4 py-2"
            >
              <span
                :class="[
                  'flex-1 min-w-0 text-xs truncate',
                  line.total ? 'text-gray-600 dark:text-gray-300' : 'text-gray-400',
                ]"
              >
                {{ line.label }}
              </span>
              <span
                :class="[
                  'text-xs tabular-nums',
                  line.total ? 'text-gray-700 dark:text-gray-200' : 'text-gray-400',
                ]"
              >
                {{ formatAmount(line.total) }}
              </span>
            </div>
          </div>
        </template>

        <div class="flex items-center justify-between px-4 py-3 bg-red-50/60 dark:bg-red-900/10">
          <span class="text-xs font-bold uppercase tracking-wide text-gray-700 dark:text-gray-200">
            Total Outflow
          </span>
          <span class="text-base font-bold tabular-nums text-red-600 dark:text-red-400">
            {{ formatAmount(statement.outflow.total) }}
          </span>
        </div>
      </div>
    </section>

    <!-- Net cash flow -->
    <div
      class="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 dark:bg-primary/10 px-4 py-3"
    >
      <div class="min-w-0">
        <p class="text-xs font-bold uppercase tracking-wide text-gray-700 dark:text-gray-200">
          Net Cash Flow
        </p>
        <p class="text-[11px] text-gray-400 dark:text-gray-500">Inflow &minus; outflow</p>
      </div>
      <span
        :class="[
          'text-base font-bold tabular-nums',
          statement.net < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white',
        ]"
      >
        {{ formatAmount(statement.net) }}
      </span>
    </div>

    <!-- Eastwest transactions -->
    <section
      class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden"
    >
      <div
        class="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-700"
      >
        <div class="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300">
          <ArrowLeftRight class="h-4 w-4" />
        </div>
        <h3 class="text-xs font-bold uppercase tracking-widest text-gray-700 dark:text-gray-200">
          Eastwest Transactions
        </h3>
      </div>

      <div class="divide-y divide-gray-100 dark:divide-gray-700">
        <div class="flex items-center justify-between px-4 py-2.5">
          <span class="text-sm text-gray-600 dark:text-gray-300">Deposit</span>
          <span
            :class="[
              'text-sm tabular-nums',
              statement.bank.deposits ? 'text-gray-900 dark:text-white' : 'text-gray-400',
            ]"
          >
            {{ formatAmount(statement.bank.deposits) }}
          </span>
        </div>
        <div class="flex items-center justify-between px-4 py-2.5">
          <span class="text-sm text-gray-600 dark:text-gray-300">Withdrawal</span>
          <span
            :class="[
              'text-sm tabular-nums',
              statement.bank.withdrawals ? 'text-gray-900 dark:text-white' : 'text-gray-400',
            ]"
          >
            {{ formatAmount(statement.bank.withdrawals) }}
          </span>
        </div>
        <div class="flex items-center justify-between px-4 py-2.5 bg-gray-50 dark:bg-gray-700/30">
          <span class="text-xs font-bold uppercase tracking-wide text-gray-700 dark:text-gray-200">
            Net to Bank
          </span>
          <span class="text-sm font-bold tabular-nums text-gray-900 dark:text-white">
            {{ formatAmount(statement.bank.net) }}
          </span>
        </div>
      </div>
    </section>

    <!-- Ending balance -->
    <section
      class="rounded-xl border border-primary/30 bg-white dark:bg-gray-800 overflow-hidden shadow-sm"
    >
      <div class="flex items-center justify-between px-4 py-3 bg-primary text-white">
        <div class="min-w-0">
          <p class="text-xs font-bold uppercase tracking-widest">Ending Balance</p>
          <p class="text-[11px] text-white/70">Beginning balance + net cash flow</p>
        </div>
        <span class="text-lg font-bold tabular-nums">
          {{ formatAmount(statement.ending.total) }}
        </span>
      </div>

      <div class="divide-y divide-gray-100 dark:divide-gray-700">
        <div class="flex items-center justify-between px-4 py-2.5">
          <span class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <Wallet class="h-4 w-4 text-gray-400 shrink-0" /> Cash on Hand
          </span>
          <span class="text-sm font-medium tabular-nums text-gray-900 dark:text-white">
            {{ formatAmount(statement.ending.cashOnHand) }}
          </span>
        </div>
        <div class="flex items-center justify-between px-4 py-2.5">
          <span class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <Landmark class="h-4 w-4 text-gray-400 shrink-0" /> Cash in Bank - Eastwest
          </span>
          <span class="text-sm font-medium tabular-nums text-gray-900 dark:text-white">
            {{ formatAmount(statement.ending.bankEastwest) }}
          </span>
        </div>
      </div>
    </section>
  </div>
</template>

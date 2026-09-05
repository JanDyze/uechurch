<script setup>
import { computed, ref } from 'vue'
import { ChevronLeft, ChevronRight, Download, Plus, SearchX } from '../icons'
import SearchBar from '../components/common/SearchBar.vue'
import ConfirmationModal from '../components/common/ConfirmationModal.vue'
import EntryDrawer from '../components/finances/EntryDrawer.vue'
import OpeningBalanceSheet from '../components/finances/OpeningBalanceSheet.vue'
import StatementView from '../components/finances/StatementView.vue'
import { useLedger } from '../composables/useLedger'
import { usePermissions } from '../composables/usePermissions'
import { useAuth } from '../composables/useAuth'
import { useToast } from '../composables/useToast'
import { getDisplayName } from '../utils/memberUtils'
import { accountShort, categoryLabel } from '../data/financeChart'
import { formatAmount, formatMoney } from '../utils/moneyUtils'
import { exportStatement } from '../utils/financeExport'
import {
  currentMonthKey,
  formatEntryDate,
  formatMonthLabel,
  matchesEntryQuery,
  runningBalances,
  shiftMonth,
} from '../utils/ledgerUtils'

const {
  loading,
  opening,
  entries,
  balancesToday,
  statementForMonth,
  addEntry,
  updateEntry,
  removeEntry,
  saveOpening,
} = useLedger()

const { can, myMember } = usePermissions()
const { user, displayName } = useAuth()
const toast = useToast()

const canManage = computed(() => can('finances.manage'))
const who = computed(() => ({
  uid: user.value?.uid || '',
  name: getDisplayName(myMember.value) || displayName.value,
}))

const monthKey = ref(currentMonthKey())
const view = ref('ledger')
const searchQuery = ref('')
const mobileSearchOpen = ref(false)
const saving = ref(false)

const showEntry = ref(false)
const editing = ref(null)
const showOpening = ref(false)
const pendingDelete = ref(null)

const statement = computed(() => statementForMonth(monthKey.value))
const monthEntries = computed(() =>
  entries.value.filter((e) => String(e.date || '').slice(0, 7) === monthKey.value)
)

/** Newest first on screen, each with the balance as at that line. */
const rows = computed(() => {
  const withBalances = runningBalances(entries.value, opening.value, monthKey.value)
  return withBalances
    .slice()
    .reverse()
    .filter(({ entry }) => matchesEntryQuery(entry, searchQuery.value))
})

const failed = (error, fallback) => {
  console.error(error)
  const code = error?.code ? ` (${error.code})` : ''
  toast.error(
    error?.code === 'permission-denied'
      ? 'Firestore refused that — check the rules on ledgerEntries.'
      : `${fallback}${code}`
  )
}

const handleExport = () => {
  try {
    exportStatement(statement.value, monthEntries.value)
  } catch (error) {
    failed(error, 'Could not build that spreadsheet')
  }
}

const openNew = () => {
  editing.value = null
  showEntry.value = true
}

const openEdit = (entry) => {
  if (!canManage.value) return
  editing.value = entry
  showEntry.value = true
}

const handleSave = async (data) => {
  if (saving.value) return
  saving.value = true
  try {
    if (editing.value) await updateEntry(editing.value, data, who.value)
    else await addEntry(data, who.value)
    showEntry.value = false
    editing.value = null
  } catch (error) {
    failed(error, 'Could not save that entry')
  } finally {
    saving.value = false
  }
}

const handleDelete = async () => {
  const entry = pendingDelete.value
  if (!entry) return
  try {
    await removeEntry(entry)
    toast.success('Entry deleted')
    showEntry.value = false
    editing.value = null
  } catch (error) {
    failed(error, 'Could not delete that entry')
  } finally {
    pendingDelete.value = null
  }
}

const handleSaveOpening = async (data) => {
  if (saving.value) return
  saving.value = true
  try {
    await saveOpening(data, who.value)
    showOpening.value = false
  } catch (error) {
    failed(error, 'Could not save the opening balance')
  } finally {
    saving.value = false
  }
}

/** Money in adds, money out subtracts, a transfer moves and nets to nothing. */
const signedAmount = (entry) => {
  if (entry.direction === 'transfer') return formatAmount(entry.amount)
  return `${entry.direction === 'in' ? '+' : '−'}${formatAmount(entry.amount)}`
}

const amountClass = (entry) =>
  ({
    in: 'text-green-600 dark:text-green-400',
    out: 'text-red-600 dark:text-red-400',
  })[entry.direction] || 'text-gray-500 dark:text-gray-400'

const spineClass = (entry) =>
  ({
    in: 'border-l-green-500',
    out: 'border-l-red-500',
  })[entry.direction] || 'border-l-gray-300 dark:border-l-gray-600'

const whereLabel = (entry) =>
  entry.direction === 'transfer'
    ? `${accountShort(entry.account)} → ${accountShort(entry.toAccount)}`
    : accountShort(entry.account)
</script>

<template>
  <div class="flex h-full flex-col gap-3">
    <!-- Header -->
    <div class="flex items-center gap-3">
      <div :class="['min-w-0 flex-1', mobileSearchOpen ? 'hidden lg:block' : 'block']">
        <h1 class="text-xl font-bold text-gray-900 dark:text-white">Finances</h1>
        <p class="truncate text-xs text-gray-500 dark:text-gray-400">
          {{ formatMoney(balancesToday.total) }} on the books today
        </p>
      </div>
      <SearchBar
        v-model="searchQuery"
        v-model:open="mobileSearchOpen"
        placeholder="Search entries — try “utilities”"
      />
      <button
        v-if="canManage"
        type="button"
        @click="openNew"
        :class="[
          'shrink-0 items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90',
          mobileSearchOpen ? 'hidden lg:inline-flex' : 'inline-flex',
        ]"
        :style="{ background: 'var(--color-primary)' }"
      >
        <Plus class="h-4 w-4" />
        <span class="hidden sm:inline">New entry</span>
      </button>
    </div>

    <!-- Where the money is. The first question anyone opens this page to ask. -->
    <div class="grid shrink-0 grid-cols-3 gap-2">
      <div class="rounded-lg border border-gray-200 bg-white p-2.5 dark:border-gray-700 dark:bg-gray-800">
        <p class="text-[11px] font-medium text-gray-400 dark:text-gray-500">On hand</p>
        <p class="truncate text-sm font-semibold text-gray-900 dark:text-white">
          {{ formatAmount(balancesToday.cash) }}
        </p>
      </div>
      <div class="rounded-lg border border-gray-200 bg-white p-2.5 dark:border-gray-700 dark:bg-gray-800">
        <p class="text-[11px] font-medium text-gray-400 dark:text-gray-500">In bank</p>
        <p class="truncate text-sm font-semibold text-gray-900 dark:text-white">
          {{ formatAmount(balancesToday.bank) }}
        </p>
      </div>
      <div class="rounded-lg border-2 p-2.5" :style="{ borderColor: 'var(--color-primary)' }">
        <p class="text-[11px] font-medium text-gray-400 dark:text-gray-500">Total</p>
        <p class="truncate text-sm font-bold text-gray-900 dark:text-white">
          {{ formatAmount(balancesToday.total) }}
        </p>
      </div>
    </div>

    <!-- Balances mean nothing until the starting point is stated. -->
    <button
      v-if="!opening.isSet && canManage"
      type="button"
      @click="showOpening = true"
      class="shrink-0 rounded-lg border border-dashed border-amber-400 bg-amber-50 px-3 py-2 text-left text-xs text-amber-800 transition-colors hover:bg-amber-100 dark:border-amber-500/50 dark:bg-amber-900/20 dark:text-amber-300 dark:hover:bg-amber-900/40"
    >
      No opening balance set — these totals only count what has been entered here.
      <span class="font-semibold underline underline-offset-2">Set it</span>
    </button>

    <!-- Month -->
    <div class="flex shrink-0 items-center gap-2">
      <button
        type="button"
        @click="monthKey = shiftMonth(monthKey, -1)"
        aria-label="Previous month"
        class="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
      >
        <ChevronLeft class="h-4 w-4" />
      </button>
      <span class="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900 dark:text-white">
        {{ formatMonthLabel(monthKey) }}
      </span>
      <span class="shrink-0 text-[11px] text-gray-500 dark:text-gray-400">
        <span class="text-green-600 dark:text-green-400">+{{ formatAmount(statement.income.total) }}</span>
        <span class="mx-1 text-gray-300 dark:text-gray-600">·</span>
        <span class="text-red-600 dark:text-red-400">−{{ formatAmount(statement.expenses.total) }}</span>
      </span>
      <button
        type="button"
        @click="monthKey = shiftMonth(monthKey, 1)"
        aria-label="Next month"
        class="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
      >
        <ChevronRight class="h-4 w-4" />
      </button>
    </div>

    <!-- Book or statement: the same month, read two ways. -->
    <div class="flex shrink-0 items-center gap-2">
      <div class="flex gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-700">
        <button
          v-for="tab in [
            { key: 'ledger', label: 'Book' },
            { key: 'statement', label: 'Statement' },
          ]"
          :key="tab.key"
          type="button"
          @click="view = tab.key"
          :aria-pressed="view === tab.key"
          :class="[
            'rounded-md px-3 py-1 text-xs font-medium transition-colors',
            view === tab.key
              ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-800 dark:text-white'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
          ]"
        >
          {{ tab.label }}
        </button>
      </div>
      <button
        v-if="view === 'statement'"
        type="button"
        @click="handleExport"
        class="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
      >
        <Download class="h-3.5 w-3.5" />
        Excel
      </button>
    </div>

    <!-- The book -->
    <div
      class="flex-1 overflow-y-auto rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
    >
      <div v-if="loading" class="p-8 text-center text-gray-500 dark:text-gray-400">
        Loading the books...
      </div>

      <StatementView v-else-if="view === 'statement'" :statement="statement" />

      <div
        v-else-if="!rows.length"
        class="flex flex-col items-center justify-center px-8 py-16 text-center text-gray-500 dark:text-gray-400"
      >
        <SearchX v-if="searchQuery" class="mb-3 h-10 w-10 text-gray-300 dark:text-gray-600" />
        <p class="mb-1 text-lg">
          <template v-if="searchQuery">Nothing matches “{{ searchQuery }}”</template>
          <template v-else>Nothing recorded in {{ formatMonthLabel(monthKey) }}</template>
        </p>
        <p class="text-sm">
          <template v-if="searchQuery">Try a payee, a statement line, or “transfer”.</template>
          <template v-else-if="canManage">Record the first entry for this month.</template>
          <template v-else>Nothing to show for this month.</template>
        </p>
      </div>

      <ul v-else class="divide-y divide-gray-100 dark:divide-gray-700">
        <li
          v-for="{ entry, balance } in rows"
          :key="entry.id"
          :class="[
            'flex items-start gap-3 border-l-4 py-3 pl-2 pr-3',
            spineClass(entry),
            canManage ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/40' : '',
          ]"
          @click="openEdit(entry)"
        >
          <span class="w-11 shrink-0 pt-0.5 text-[11px] font-medium text-gray-400 dark:text-gray-500">
            {{ formatEntryDate(entry.date) }}
          </span>

          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm text-gray-900 dark:text-white">
              {{ entry.description }}
            </span>
            <span class="block truncate text-[11px] text-gray-500 dark:text-gray-400">
              {{ categoryLabel(entry) }}
              <span class="text-gray-300 dark:text-gray-600">·</span>
              {{ whereLabel(entry) }}
              <template v-if="entry.payee">
                <span class="text-gray-300 dark:text-gray-600">·</span>
                {{ entry.payee }}
              </template>
            </span>
          </span>

          <span class="shrink-0 text-right">
            <span :class="['block text-sm font-semibold tabular-nums', amountClass(entry)]">
              {{ signedAmount(entry) }}
            </span>
            <span class="block text-[11px] tabular-nums text-gray-400 dark:text-gray-500">
              {{ formatAmount(balance) }}
            </span>
          </span>
        </li>
      </ul>
    </div>

    <EntryDrawer
      v-model:show="showEntry"
      :entry="editing"
      :saving="saving"
      @save="handleSave"
      @delete="pendingDelete = $event"
    />

    <OpeningBalanceSheet
      v-model:show="showOpening"
      :opening="opening"
      :saving="saving"
      @save="handleSaveOpening"
    />

    <ConfirmationModal
      :show="Boolean(pendingDelete)"
      title="Delete entry"
      :message="`Delete “${pendingDelete?.description}” for ${formatMoney(pendingDelete?.amount || 0)}? This cannot be undone.`"
      confirm-text="Delete"
      confirm-button-class="bg-red-600 text-white hover:bg-red-700"
      @update:show="pendingDelete = null"
      @confirm="handleDelete"
      @cancel="pendingDelete = null"
    />
  </div>
</template>

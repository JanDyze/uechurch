import { ref, onMounted, onUnmounted } from "vue";
import {
  subscribeToTransactions,
  subscribeToOpeningBalance,
  addTransaction,
  updateTransaction,
  deleteTransaction,
  saveOpeningBalance,
} from "../api/financeService";
import {
  INFLOW_GROUPS,
  OUTFLOW_GROUPS,
  UNCLASSIFIED,
  BANK_ACCOUNT,
  findGroup,
} from "../data/financeChart";

/* ------------------------------------------------------------------ dates */
// Dates are stored as 'YYYY-MM-DD' strings, so plain string compares are both
// correct and timezone-proof. A month key is the 'YYYY-MM' prefix.

export const monthKeyOf = (date) => (date || "").slice(0, 7);

export const currentMonthKey = () => new Date().toISOString().slice(0, 7);

export const shiftMonth = (monthKey, delta) => {
  const [year, month] = monthKey.split("-").map(Number);
  const shifted = new Date(year, month - 1 + delta, 1);
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, "0")}`;
};

export const monthLabel = (monthKey, style = "long") => {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: style,
    year: "numeric",
  });
};

export const formatPeso = (value) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(Number(value) || 0);

/** Bare number for statement columns, where the peso sign only heads the page. */
export const formatAmount = (value) =>
  new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);

export const formatDayMonth = (date) =>
  new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

/* -------------------------------------------------------------- statement */

/** Applies one transaction to a running balance. `sign` of -1 rewinds it. */
const applyToBalances = (balances, transaction, sign = 1) => {
  const amount = (Number(transaction.amount) || 0) * sign;
  if (transaction.direction === "inflow") {
    balances[transaction.account] += amount;
  } else if (transaction.direction === "outflow") {
    balances[transaction.account] -= amount;
  } else if (transaction.direction === "transfer") {
    balances[transaction.account] -= amount;
    balances[transaction.toAccount] += amount;
  }
};

/**
 * Balances at the very start of `dateExclusive`, rolled forward from the one
 * opening balance the church enters (or rolled backwards, when looking at a
 * month that predates it).
 */
const balancesAt = (transactions, opening, dateExclusive) => {
  const balances = {
    cashOnHand: Number(opening?.cashOnHand) || 0,
    bankEastwest: Number(opening?.bankEastwest) || 0,
  };
  const asOf = opening?.asOf || "0000-01-01";

  transactions.forEach((t) => {
    if (t.date >= asOf && t.date < dateExclusive) applyToBalances(balances, t, 1);
    else if (t.date < asOf && t.date >= dateExclusive) applyToBalances(balances, t, -1);
  });

  return balances;
};

/** Sums a side of the statement into its printed group/line structure. */
const summarizeSide = (rows, chartGroups) => {
  const groups = chartGroups.map((group) => {
    const groupRows = rows.filter((t) => t.category === group.key);
    const lines = (group.lines || []).map((line) => {
      const lineRows = groupRows.filter((t) => t.subcategory === line.key);
      return {
        key: line.key,
        label: line.label,
        icon: line.icon || group.icon,
        total: lineRows.reduce((sum, t) => sum + t.amount, 0),
        count: lineRows.length,
      };
    });

    // Rows filed under the group but not under any of its lines.
    const looseRows = group.lines?.length
      ? groupRows.filter((t) => !group.lines.some((l) => l.key === t.subcategory))
      : [];
    if (looseRows.length) {
      lines.push({
        key: "",
        label: "Other",
        icon: group.icon,
        total: looseRows.reduce((sum, t) => sum + t.amount, 0),
        count: looseRows.length,
      });
    }

    return {
      key: group.key,
      label: group.label,
      icon: group.icon,
      lines,
      total: groupRows.reduce((sum, t) => sum + t.amount, 0),
      count: groupRows.length,
    };
  });

  // Anything whose category is no longer on the chart still has to appear.
  const strayRows = rows.filter((t) => !chartGroups.some((g) => g.key === t.category));
  if (strayRows.length) {
    groups.push({
      key: UNCLASSIFIED.key,
      label: UNCLASSIFIED.label,
      icon: UNCLASSIFIED.icon,
      lines: [],
      total: strayRows.reduce((sum, t) => sum + t.amount, 0),
      count: strayRows.length,
    });
  }

  return { groups, total: groups.reduce((sum, g) => sum + g.total, 0) };
};

/**
 * The church's Statement of Income and Expenses over any date range:
 * beginning balance -> cash inflow -> cash available -> cash outflow ->
 * net cash flow -> ending balance, split back across the two accounts.
 * `end` is exclusive.
 */
export const buildRange = (transactions, opening, key, label, start, end) => {
  const rows = transactions.filter((t) => t.date >= start && t.date < end);
  const beginningAccounts = balancesAt(transactions, opening, start);
  const beginning = {
    ...beginningAccounts,
    total: beginningAccounts.cashOnHand + beginningAccounts.bankEastwest,
  };

  const inflow = summarizeSide(
    rows.filter((t) => t.direction === "inflow"),
    INFLOW_GROUPS
  );
  const outflow = summarizeSide(
    rows.filter((t) => t.direction === "outflow"),
    OUTFLOW_GROUPS
  );

  const transfers = rows.filter((t) => t.direction === "transfer");
  const deposits = transfers
    .filter((t) => t.toAccount === BANK_ACCOUNT)
    .reduce((sum, t) => sum + t.amount, 0);
  const withdrawals = transfers
    .filter((t) => t.account === BANK_ACCOUNT)
    .reduce((sum, t) => sum + t.amount, 0);

  const net = inflow.total - outflow.total;
  const endingAccounts = { ...beginningAccounts };
  rows.forEach((t) => applyToBalances(endingAccounts, t, 1));

  return {
    key,
    label,
    start,
    end,
    beginning,
    inflow,
    cashAvailable: beginning.total + inflow.total,
    outflow,
    net,
    bank: { deposits, withdrawals, net: deposits - withdrawals, count: transfers.length },
    ending: {
      ...endingAccounts,
      total: endingAccounts.cashOnHand + endingAccounts.bankEastwest,
    },
    transactions: rows,
  };
};

/** One calendar month of the ledger. */
export const buildStatement = (transactions, opening, monthKey) =>
  buildRange(
    transactions,
    opening,
    monthKey,
    monthLabel(monthKey),
    `${monthKey}-01`,
    `${shiftMonth(monthKey, 1)}-01`
  );

/** The whole year as a single statement, for the yearly report. */
export const buildYearStatement = (transactions, opening, year) =>
  buildRange(transactions, opening, String(year), String(year), `${year}-01-01`, `${year + 1}-01-01`);

/** The 12 monthly statements of a year, for the month-by-month ledger. */
export const buildYearStatements = (transactions, opening, year) =>
  Array.from({ length: 12 }, (_, i) =>
    buildStatement(transactions, opening, `${year}-${String(i + 1).padStart(2, "0")}`)
  );

/** Every month that has activity, newest first — used to seed month pickers. */
export const monthsWithActivity = (transactions) => {
  const keys = new Set(transactions.map((t) => monthKeyOf(t.date)));
  return [...keys].sort().reverse();
};

/** Groups a category key back to its printed heading, for list subtitles. */
export const groupLabelOf = (transaction) =>
  findGroup(transaction.direction, transaction.category)?.label || UNCLASSIFIED.label;

/* ------------------------------------------------------------- composable */

export function useFinances() {
  const transactions = ref([]);
  const opening = ref({ asOf: "", cashOnHand: 0, bankEastwest: 0, isSet: false });
  const loading = ref(true);

  let unsubscribeTransactions = null;
  let unsubscribeOpening = null;

  onMounted(() => {
    unsubscribeTransactions = subscribeToTransactions((data) => {
      transactions.value = data;
      loading.value = false;
    });
    unsubscribeOpening = subscribeToOpeningBalance((data) => {
      opening.value = data;
    });
  });

  onUnmounted(() => {
    unsubscribeTransactions?.();
    unsubscribeOpening?.();
  });

  return {
    transactions,
    opening,
    loading,
    addTransaction,
    updateTransaction,
    removeTransaction: deleteTransaction,
    saveOpening: saveOpeningBalance,
  };
}

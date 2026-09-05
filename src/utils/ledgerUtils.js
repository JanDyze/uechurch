import {
  ACCOUNT_KEYS,
  CASH,
  BANK,
  INCOME_GROUPS,
  EXPENSE_GROUPS,
  UNCLASSIFIED,
  categoryLabel,
} from '../data/financeChart'

/* ----------------------------------------------------------------- dates */
// Local-time month arithmetic, deliberately not shared with lineupUtils: that
// module's helpers are about Sundays, and coupling the books to the worship
// roster to save a few lines would be the worse trade.

const pad = (n) => String(n).padStart(2, '0')

export const isoDateOf = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

export const todayIso = () => isoDateOf(new Date())

export const monthKeyOf = (iso) => String(iso || '').slice(0, 7)

export const currentMonthKey = () => monthKeyOf(todayIso())

export const isValidMonthKey = (key) => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(key || ''))

export const shiftMonth = (monthKey, delta) => {
  const [y, m] = String(monthKey).split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

/** 'September 2026' */
export const formatMonthLabel = (monthKey) => {
  const [y, m] = String(monthKey).split('-').map(Number)
  if (!y || !m) return monthKey || ''
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

/** 'Sep 7' */
export const formatEntryDate = (iso) => {
  const [y, m, d] = String(iso || '').split('-').map(Number)
  if (!y || !m || !d) return iso || ''
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export const firstOfMonth = (monthKey) => `${monthKey}-01`

export const lastOfMonth = (monthKey) => {
  const [y, m] = String(monthKey).split('-').map(Number)
  return isoDateOf(new Date(y, m, 0))
}

const previousDay = (iso) => {
  const [y, m, d] = String(iso).split('-').map(Number)
  return isoDateOf(new Date(y, m - 1, d - 1))
}

/* -------------------------------------------------------------- balances */

/**
 * What one entry does to each account.
 *
 * A transfer takes from one and gives to the other, which is why it can never
 * be income or expense: the two halves cancel, and the church is no richer for
 * having moved its own money into the bank.
 */
export const accountDeltas = (entry) => {
  const deltas = { [CASH]: 0, [BANK]: 0 }
  const amount = Math.trunc(Number(entry?.amount) || 0)
  const from = ACCOUNT_KEYS.includes(entry?.account) ? entry.account : CASH

  if (entry?.direction === 'in') deltas[from] += amount
  else if (entry?.direction === 'out') deltas[from] -= amount
  else if (entry?.direction === 'transfer') {
    const to = ACCOUNT_KEYS.includes(entry?.toAccount)
      ? entry.toAccount
      : from === BANK
        ? CASH
        : BANK
    if (to !== from) {
      deltas[from] -= amount
      deltas[to] += amount
    }
  }
  return deltas
}

const withTotal = (b) => ({ ...b, total: b[CASH] + b[BANK] })

/**
 * Balances at the close of `uptoIso`, rolled forward from the opening figures.
 * Entries dated before the opening are pre-history and are not counted — the
 * opening balance already is their sum.
 */
export const balancesAsOf = (entries = [], opening, uptoIso) => {
  const from = opening?.asOf || '0000-01-01'
  const running = {
    [CASH]: Math.trunc(Number(opening?.cash) || 0),
    [BANK]: Math.trunc(Number(opening?.bank) || 0),
  }

  for (const entry of entries) {
    if (!entry?.date || entry.date < from || entry.date > uptoIso) continue
    const d = accountDeltas(entry)
    running[CASH] += d[CASH]
    running[BANK] += d[BANK]
  }
  return withTotal(running)
}

export const entriesInMonth = (entries = [], monthKey) =>
  entries.filter((e) => monthKeyOf(e?.date) === monthKey)

/** Date order, then entry order, so same-day rows never shuffle. */
export const compareForBook = (a, b) =>
  String(a.date).localeCompare(String(b.date)) ||
  String(a.createdAt || '').localeCompare(String(b.createdAt || ''))

/** Newest first, for the screen. */
export const compareForList = (a, b) => -compareForBook(a, b)

/** Oldest first, with the balance after each entry — how a book is read. */
export const runningBalances = (entries = [], opening, monthKey) => {
  const month = entriesInMonth(entries, monthKey).slice().sort(compareForBook)
  let balance = balancesAsOf(entries, opening, previousDay(firstOfMonth(monthKey))).total

  return month.map((entry) => {
    const d = accountDeltas(entry)
    balance += d[CASH] + d[BANK]
    return { entry, balance }
  })
}

/* ------------------------------------------------------------- statement */

const sumAmounts = (items = []) =>
  items.reduce(
    (total, item) => total + Math.trunc(Number(typeof item === 'number' ? item : item?.amount) || 0),
    0
  )

const rollUpSide = (monthEntries, direction, groups) => {
  const claimed = new Set()

  const built = groups.map((group) => {
    const ofGroup = monthEntries.filter(
      (e) => e.direction === direction && e.category === group.key
    )
    ofGroup.forEach((e) => claimed.add(e))

    const lines = (group.lines || []).map((line) => ({
      key: line.key,
      label: line.label,
      total: sumAmounts(ofGroup.filter((e) => e.subcategory === line.key)),
    }))

    return { key: group.key, label: group.label, lines, total: sumAmounts(ofGroup) }
  })

  // An entry whose category is no longer in the chart still has to appear, or
  // the statement quietly stops adding up to what the bank says.
  const orphans = monthEntries.filter((e) => e.direction === direction && !claimed.has(e))
  if (orphans.length) {
    built.push({
      key: UNCLASSIFIED.key,
      label: UNCLASSIFIED.label,
      lines: [],
      total: sumAmounts(orphans),
    })
  }

  return { groups: built, total: sumAmounts(built.map((g) => g.total)) }
}

/**
 * The month's Statement of Income and Expenses, with the balances that prove
 * it: closing equals opening plus the month's movement, and that movement
 * equals income minus expenses. Transfers appear in neither total.
 */
export const statementFor = (entries = [], monthKey, opening) => {
  const month = entriesInMonth(entries, monthKey)

  const income = rollUpSide(month, 'in', INCOME_GROUPS)
  const expenses = rollUpSide(month, 'out', EXPENSE_GROUPS)

  const openingBalance = balancesAsOf(entries, opening, previousDay(firstOfMonth(monthKey)))
  const closingBalance = balancesAsOf(entries, opening, lastOfMonth(monthKey))

  const movement = withTotal({
    [CASH]: closingBalance[CASH] - openingBalance[CASH],
    [BANK]: closingBalance[BANK] - openingBalance[BANK],
  })

  return {
    monthKey,
    label: formatMonthLabel(monthKey),
    income,
    expenses,
    net: income.total - expenses.total,
    opening: openingBalance,
    closing: closingBalance,
    movement,
    entryCount: month.length,
  }
}

/* ---------------------------------------------------------------- search */

/** One bar over everything on the row, including the words the row shows. */
export const matchesEntryQuery = (entry, query) => {
  const terms = String(query || '')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
  if (!terms.length) return true

  const text = [
    entry.description,
    entry.payee,
    entry.notes,
    entry.date,
    categoryLabel(entry),
    entry.direction === 'in' ? 'income in received' : '',
    entry.direction === 'out' ? 'expense out paid' : '',
    entry.direction === 'transfer' ? 'transfer deposit withdrawal' : '',
    entry.account,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  return terms.every((t) => text.includes(t))
}

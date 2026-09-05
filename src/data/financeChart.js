/**
 * The chart of accounts: every line the monthly Statement of Income and
 * Expenses can print.
 *
 * `key` is what gets written to Firestore; `label` is only ever displayed. That
 * separation is the point — the church can reword a line on the statement
 * without touching a single saved entry.
 *
 * NOT YET CONFIRMED. These lines are carried over from the statement the
 * previous module printed, which was itself modelled on the church's paper
 * sheet. Before this module is used in earnest, check them against the sheet
 * the treasurer actually files: if the app's totals do not land on the same
 * lines, the export is useless to them. Adding, renaming or reordering a line
 * here is safe; changing a `key` is not, once entries exist.
 *
 * Deliberately plain data, with no icon imports. The old version pulled in
 * seventeen icon components, which made a lookup table into something the
 * bundle had to care about.
 */

export const ACCOUNTS = [
  { key: 'cash', label: 'Cash on Hand', short: 'On Hand' },
  { key: 'bank', label: 'Cash in Bank', short: 'Bank' },
]

export const ACCOUNT_KEYS = ACCOUNTS.map((a) => a.key)
export const CASH = 'cash'
export const BANK = 'bank'

export const DIRECTIONS = [
  { key: 'in', label: 'Money in', short: 'In' },
  { key: 'out', label: 'Money out', short: 'Out' },
  { key: 'transfer', label: 'Transfer', short: 'Transfer' },
]

/**
 * A group with `lines` prints as a heading with indented lines beneath it; a
 * group without prints as a single row. That mirrors how the paper statement
 * sets out "Tithes and Offering" against a bare ministry line.
 */
export const INCOME_GROUPS = [
  {
    key: 'tithes-offering',
    label: 'Tithes and Offering',
    lines: [
      { key: 'onsite', label: 'On Site' },
      { key: 'online', label: 'Online' },
      { key: 'winning-souls', label: 'For Winning Souls' },
      { key: 'front-lot', label: 'For Front Lot' },
    ],
  },
  {
    key: 'other-income',
    label: 'Other Income',
    lines: [
      { key: 'bank-interest', label: 'Bank Interest' },
      { key: 'donation', label: 'Donations, Love Gifts' },
      { key: 'misc-income', label: 'Miscellaneous' },
    ],
  },
]

export const EXPENSE_GROUPS = [
  { key: 'evangelism', label: 'Evangelism Ministry' },
  { key: 'worship', label: 'Worship Ministry' },
  { key: 'consolidation', label: 'Consolidation Ministry' },
  { key: 'fellowship', label: 'Fellowship Ministry' },
  { key: 'care-concern', label: 'Care and Concern' },
  {
    key: 'admin',
    label: 'Administrative Expenses',
    lines: [
      { key: 'utilities', label: 'Utilities' },
      { key: 'supplies', label: 'Church Supplies, Building Maintenance' },
      { key: 'transportation', label: 'Transportation' },
      { key: 'meetings', label: 'Meetings, Planning' },
      { key: 'love-gifts', label: 'Love Gifts, Subsidy' },
      { key: 'service-fee', label: 'Miscellaneous, Service Fees' },
    ],
  },
]

/** Nothing ever vanishes from the statement, however it was categorised. */
export const UNCLASSIFIED = { key: 'unclassified', label: 'Unclassified' }

export const groupsFor = (direction) =>
  direction === 'in' ? INCOME_GROUPS : direction === 'out' ? EXPENSE_GROUPS : []

export const findGroup = (direction, categoryKey) =>
  groupsFor(direction).find((g) => g.key === categoryKey) || null

export const findLine = (direction, categoryKey, subcategoryKey) =>
  findGroup(direction, categoryKey)?.lines?.find((l) => l.key === subcategoryKey) || null

export const accountLabel = (key) => ACCOUNTS.find((a) => a.key === key)?.label || 'Cash on Hand'
export const accountShort = (key) => ACCOUNTS.find((a) => a.key === key)?.short || 'On Hand'

/** A transfer has no category — where it went is the whole story. */
export const categoryLabel = (entry) => {
  if (entry?.direction === 'transfer') {
    return entry.account === BANK ? 'Bank withdrawal' : 'Bank deposit'
  }
  const group = findGroup(entry?.direction, entry?.category)
  if (!group) return UNCLASSIFIED.label
  const line = findLine(entry.direction, entry.category, entry.subcategory)
  return line ? `${group.label} — ${line.label}` : group.label
}

/** Flattened for a picker: every choosable line for one direction, in order. */
export const categoryOptions = (direction) =>
  groupsFor(direction).flatMap((group) =>
    group.lines?.length
      ? group.lines.map((line) => ({
          category: group.key,
          subcategory: line.key,
          group: group.label,
          label: line.label,
        }))
      : [{ category: group.key, subcategory: '', group: group.label, label: group.label }]
  )

export const isKnownCategory = (direction, category, subcategory) => {
  const group = findGroup(direction, category)
  if (!group) return false
  if (!group.lines?.length) return !subcategory
  return Boolean(findLine(direction, category, subcategory))
}

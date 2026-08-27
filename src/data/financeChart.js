import {
  HandCoins,
  Landmark,
  Megaphone,
  Music,
  Users,
  PartyPopper,
  HeartHandshake,
  Building2,
  Zap,
  Wrench,
  Bus,
  ClipboardList,
  Gift,
  Receipt,
  Wallet,
  PiggyBank,
  ArrowLeftRight,
} from 'lucide-vue-next'

/**
 * The chart of accounts behind the church's monthly Statement of Income and
 * Expenses. `key` is what gets written to Firestore, so labels can be reworded
 * without touching saved transactions.
 *
 * A group with `lines` prints as a heading with indented lines underneath
 * (exactly like "Tithes and Offering" and "Administrative Expenses" on the
 * paper statement). A group without `lines` prints as a single row.
 */

export const ACCOUNTS = [
  { key: 'cashOnHand', label: 'Cash on Hand', short: 'On Hand', icon: Wallet },
  { key: 'bankEastwest', label: 'Cash in Bank - Eastwest', short: 'Eastwest', icon: Landmark },
]

export const ACCOUNT_KEYS = ACCOUNTS.map((a) => a.key)
export const BANK_ACCOUNT = 'bankEastwest'
export const CASH_ACCOUNT = 'cashOnHand'

export const INFLOW_GROUPS = [
  {
    key: 'tithes-offering',
    label: 'Tithes and Offering',
    icon: HandCoins,
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
    icon: PiggyBank,
    lines: [
      { key: 'bank-interest', label: 'Bank Interest' },
      { key: 'donation', label: 'Donations, Love Gifts' },
      { key: 'misc-income', label: 'Miscellaneous' },
    ],
  },
]

export const OUTFLOW_GROUPS = [
  { key: 'evangelism', label: 'Evangelism Ministry', icon: Megaphone },
  { key: 'worship', label: 'Worship Ministry', icon: Music },
  { key: 'consolidation', label: 'Consolidation Ministry', icon: Users },
  { key: 'fellowship', label: 'Fellowship Ministry', icon: PartyPopper },
  { key: 'care-concern', label: 'Care and Concern', icon: HeartHandshake },
  {
    key: 'admin',
    label: 'Administrative Expenses',
    icon: Building2,
    lines: [
      { key: 'utilities', label: 'Utilities', icon: Zap },
      { key: 'supplies', label: 'Church Supplies, bldg maintenance', icon: Wrench },
      { key: 'transportation', label: 'Transportation Expenses', icon: Bus },
      { key: 'meetings', label: 'Meetings, Planning', icon: ClipboardList },
      { key: 'love-gifts', label: 'Love gifts, hiyas subsidy', icon: Gift },
      { key: 'service-fee', label: 'Miscellaneous - Service Fee', icon: Receipt },
    ],
  },
]

/** Catch-all so nothing ever disappears from the statement. */
export const UNCLASSIFIED = { key: 'unclassified', label: 'Unclassified', icon: Receipt }

export const DIRECTIONS = [
  { key: 'inflow', label: 'Money In', short: 'In' },
  { key: 'outflow', label: 'Money Out', short: 'Out' },
  { key: 'transfer', label: 'Bank Transfer', short: 'Transfer' },
]

const groupsFor = (direction) =>
  direction === 'inflow' ? INFLOW_GROUPS : direction === 'outflow' ? OUTFLOW_GROUPS : []

export const findGroup = (direction, categoryKey) =>
  groupsFor(direction).find((g) => g.key === categoryKey) || null

export const findLine = (direction, categoryKey, subcategoryKey) =>
  findGroup(direction, categoryKey)?.lines?.find((l) => l.key === subcategoryKey) || null

export const accountLabel = (key) => ACCOUNTS.find((a) => a.key === key)?.label || 'Cash on Hand'

export const accountShort = (key) => ACCOUNTS.find((a) => a.key === key)?.short || 'On Hand'

/** Human-readable "Group - Line" used in lists and exports. */
export const categoryLabel = (transaction) => {
  if (transaction.direction === 'transfer') {
    return transaction.account === BANK_ACCOUNT ? 'Eastwest Withdrawal' : 'Eastwest Deposit'
  }
  const group = findGroup(transaction.direction, transaction.category)
  if (!group) return UNCLASSIFIED.label
  const line = findLine(transaction.direction, transaction.category, transaction.subcategory)
  return line ? `${group.label} - ${line.label}` : group.label
}

export const categoryIcon = (transaction) => {
  if (transaction.direction === 'transfer') return ArrowLeftRight
  const group = findGroup(transaction.direction, transaction.category)
  if (!group) return UNCLASSIFIED.icon
  const line = findLine(transaction.direction, transaction.category, transaction.subcategory)
  return line?.icon || group.icon
}

/**
 * Categories used by the first version of this page. Kept so transactions saved
 * before the statement rewrite still land on the right statement line.
 */
export const LEGACY_CATEGORY_MAP = {
  Tithes: { category: 'tithes-offering', subcategory: 'onsite' },
  Offerings: { category: 'tithes-offering', subcategory: 'onsite' },
  Missions: { category: 'evangelism' },
  'Building Fund': { category: 'admin', subcategory: 'supplies' },
  Utilities: { category: 'admin', subcategory: 'utilities' },
  Maintenance: { category: 'admin', subcategory: 'supplies' },
  Salaries: { category: 'admin', subcategory: 'love-gifts' },
  Outreach: { category: 'evangelism' },
  Events: { category: 'fellowship' },
  General: { category: 'admin', subcategory: 'service-fee' },
}

export const mapLegacyCategory = (category, direction) => {
  const mapped = LEGACY_CATEGORY_MAP[category]
  if (mapped) return mapped
  if (direction === 'inflow') return { category: 'other-income', subcategory: 'misc-income' }
  return { category: 'admin', subcategory: 'service-fee' }
}

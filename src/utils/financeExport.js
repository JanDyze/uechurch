import XLSX from 'xlsx-js-style'
import { categoryLabel, accountLabel } from '../data/financeChart'
import { getChurchIdentity } from '../composables/useAppSettings'

const MONEY = '#,##0.00'

const filePrefix = () =>
  (getChurchIdentity().shortName || 'Church').replace(/[^\w-]+/g, '_').slice(0, 40)

const churchName = () => {
  const { fullName, branch } = getChurchIdentity()
  return [fullName, branch].filter(Boolean).join(' ')
}

const styles = {
  churchName: {
    font: { bold: true, sz: 13, color: { rgb: '01779B' } },
    alignment: { horizontal: 'left' },
  },
  title: { font: { bold: true, sz: 11 } },
  period: { font: { italic: true, sz: 10, color: { rgb: '666666' } } },
  sectionHeader: {
    font: { bold: true, sz: 10, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: '01779B' } },
  },
  groupLabel: { font: { bold: true, sz: 10 } },
  lineLabel: { font: { sz: 10, color: { rgb: '444444' } } },
  note: { font: { sz: 9, italic: true, color: { rgb: '888888' } } },
  amount: { font: { sz: 10 }, numFmt: MONEY, alignment: { horizontal: 'right' } },
  amountBold: {
    font: { bold: true, sz: 10 },
    numFmt: MONEY,
    alignment: { horizontal: 'right' },
    border: { top: { style: 'thin', color: { rgb: '999999' } } },
  },
  totalLabel: {
    font: { bold: true, sz: 10 },
    border: { top: { style: 'thin', color: { rgb: '999999' } } },
  },
  tableHeader: {
    font: { bold: true, sz: 10, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: '01779B' } },
    alignment: { horizontal: 'center' },
  },
  cell: { font: { sz: 10 } },
}

/** Rows are [label, value?, style overrides] tuples flattened into a sheet. */
const buildStatementSheet = (statement) => {
  const rows = []
  const meta = []

  const push = (cells, styleMap = {}) => {
    rows.push(cells)
    meta.push(styleMap)
  }

  push([churchName()], { 0: styles.churchName })
  push(['Statement of Income and Expenses'], { 0: styles.title })
  push([statement.label], { 0: styles.period })
  push([])

  push(['Cash on Hand', '', '', statement.beginning.cashOnHand], { 3: styles.amount })
  push(['Cash in Bank - Eastwest', '', '', statement.beginning.bankEastwest], { 3: styles.amount })
  push(['BEGINNING BALANCE', '', '', statement.beginning.total], {
    0: styles.totalLabel,
    3: styles.amountBold,
  })
  push([])

  push(['CASH INFLOW'], { 0: styles.sectionHeader })
  statement.inflow.groups.forEach((group) => {
    push(['', group.label, '', group.lines?.length ? '' : group.total], {
      1: styles.groupLabel,
      3: styles.amount,
    })
    ;(group.lines || []).forEach((line) => {
      push(['', '', line.label, line.total], { 2: styles.lineLabel, 3: styles.amount })
    })
    if (group.lines?.length) {
      push(['', `Total ${group.label}`, '', group.total], {
        1: styles.groupLabel,
        3: styles.amountBold,
      })
    }
  })
  push(['TOTAL INFLOW', '', '', statement.inflow.total], {
    0: styles.totalLabel,
    3: styles.amountBold,
  })
  push([])

  push(['CASH AVAILABLE', '(Beginning Balance + Cash Inflow)', '', statement.cashAvailable], {
    0: styles.totalLabel,
    1: styles.note,
    3: styles.amountBold,
  })
  push([])

  push(['CASH OUTFLOW'], { 0: styles.sectionHeader })
  statement.outflow.groups.forEach((group) => {
    push(['', group.label, '', group.lines?.length ? '' : group.total], {
      1: styles.groupLabel,
      3: styles.amount,
    })
    ;(group.lines || []).forEach((line) => {
      push(['', '', line.label, line.total], { 2: styles.lineLabel, 3: styles.amount })
    })
    if (group.lines?.length) {
      push(['', `Total ${group.label}`, '', group.total], {
        1: styles.groupLabel,
        3: styles.amountBold,
      })
    }
  })
  push(['TOTAL OUTFLOW', '', '', statement.outflow.total], {
    0: styles.totalLabel,
    3: styles.amountBold,
  })
  push([])

  push(['NET CASH FLOW', '(Cash Inflow - Cash Outflow)', '', statement.net], {
    0: styles.totalLabel,
    1: styles.note,
    3: styles.amountBold,
  })
  push([])

  push(['EASTWEST TRANSACTIONS'], { 0: styles.sectionHeader })
  push(['', 'Eastwest Deposit', '', statement.bank.deposits], { 1: styles.lineLabel, 3: styles.amount })
  push(['', 'Eastwest Withdrawal', '', statement.bank.withdrawals], {
    1: styles.lineLabel,
    3: styles.amount,
  })
  push(['', 'TOTAL', '', statement.bank.net], { 1: styles.groupLabel, 3: styles.amountBold })
  push([])

  push(['ENDING BALANCE', '(Beginning Balance + Net Cash Flow)', '', statement.ending.total], {
    0: styles.totalLabel,
    1: styles.note,
    3: styles.amountBold,
  })
  push([])

  push(['Cash on Hand', '', '', statement.ending.cashOnHand], { 3: styles.amount })
  push(['Cash in Bank - Eastwest', '', '', statement.ending.bankEastwest], { 3: styles.amount })
  push(['TOTAL', '', '', statement.ending.total], { 0: styles.totalLabel, 3: styles.amountBold })

  const ws = XLSX.utils.aoa_to_sheet(rows)

  meta.forEach((styleMap, rowIndex) => {
    Object.entries(styleMap).forEach(([col, style]) => {
      const ref = XLSX.utils.encode_cell({ r: rowIndex, c: Number(col) })
      if (!ws[ref]) ws[ref] = { v: '', t: 's' }
      ws[ref].s = style
    })
    // Section headers span the sheet width so they read as banners.
    if (styleMap[0] === styles.sectionHeader) {
      for (let c = 1; c <= 3; c += 1) {
        const ref = XLSX.utils.encode_cell({ r: rowIndex, c })
        if (!ws[ref]) ws[ref] = { v: '', t: 's' }
        ws[ref].s = styles.sectionHeader
      }
    }
  })

  ws['!cols'] = [{ wch: 26 }, { wch: 30 }, { wch: 32 }, { wch: 14 }]
  return ws
}

const buildTransactionsSheet = (transactions) => {
  const header = ['Date', 'Transaction', 'Category', 'Account', 'Inflow', 'Outflow']
  const rows = [header]

  transactions
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .forEach((t) => {
      rows.push([
        t.date,
        t.description,
        categoryLabel(t),
        accountLabel(t.account),
        t.direction === 'inflow' ? t.amount : '',
        t.direction === 'outflow' ? t.amount : '',
      ])
    })

  const totalIn = transactions
    .filter((t) => t.direction === 'inflow')
    .reduce((sum, t) => sum + t.amount, 0)
  const totalOut = transactions
    .filter((t) => t.direction === 'outflow')
    .reduce((sum, t) => sum + t.amount, 0)
  rows.push(['', 'TOTAL', '', '', totalIn, totalOut])

  const ws = XLSX.utils.aoa_to_sheet(rows)
  const range = XLSX.utils.decode_range(ws['!ref'])

  for (let r = range.s.r; r <= range.e.r; r += 1) {
    for (let c = range.s.c; c <= range.e.c; c += 1) {
      const ref = XLSX.utils.encode_cell({ r, c })
      if (!ws[ref]) ws[ref] = { v: '', t: 's' }
      if (r === 0) ws[ref].s = styles.tableHeader
      else if (r === range.e.r) ws[ref].s = c >= 4 ? styles.amountBold : styles.totalLabel
      else ws[ref].s = c >= 4 ? styles.amount : styles.cell
    }
  }

  ws['!cols'] = [{ wch: 12 }, { wch: 34 }, { wch: 34 }, { wch: 22 }, { wch: 13 }, { wch: 13 }]
  return ws
}

const buildMonthlySheet = (statements, year) => {
  const rows = [
    [churchName()],
    [`Month by Month — ${year}`],
    [],
    [
      'Month',
      'Beginning Balance',
      'Total Inflow',
      'Cash Available',
      'Total Outflow',
      'Net Cash Flow',
      'Ending Balance',
    ],
  ]

  statements.forEach((s) => {
    rows.push([
      s.label,
      s.beginning.total,
      s.inflow.total,
      s.cashAvailable,
      s.outflow.total,
      s.net,
      s.ending.total,
    ])
  })

  const totalIn = statements.reduce((sum, s) => sum + s.inflow.total, 0)
  const totalOut = statements.reduce((sum, s) => sum + s.outflow.total, 0)
  rows.push(['TOTAL', '', totalIn, '', totalOut, totalIn - totalOut, ''])

  const ws = XLSX.utils.aoa_to_sheet(rows)
  const range = XLSX.utils.decode_range(ws['!ref'])

  for (let r = range.s.r; r <= range.e.r; r += 1) {
    for (let c = range.s.c; c <= range.e.c; c += 1) {
      const ref = XLSX.utils.encode_cell({ r, c })
      if (!ws[ref]) ws[ref] = { v: '', t: 's' }
      if (r === 0) ws[ref].s = styles.churchName
      else if (r === 1) ws[ref].s = styles.title
      else if (r === 3) ws[ref].s = styles.tableHeader
      else if (r === range.e.r) ws[ref].s = c >= 1 ? styles.amountBold : styles.totalLabel
      else if (r > 3) ws[ref].s = c >= 1 ? styles.amount : styles.cell
    }
  }

  ws['!cols'] = [{ wch: 18 }, ...Array(6).fill({ wch: 17 })]
  return ws
}

/** Downloads the month's statement with its supporting transaction log. */
export const exportStatement = (statement) => {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, buildStatementSheet(statement), 'Statement')
  XLSX.utils.book_append_sheet(wb, buildTransactionsSheet(statement.transactions), 'Transactions')
  XLSX.writeFile(wb, `${filePrefix()}_Statement_${statement.key}.xlsx`)
}

/** Year view: the annual statement, the month-by-month table, and every row. */
export const exportYear = (yearStatement, monthlyStatements, year) => {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, buildStatementSheet(yearStatement), `${year} Summary`)
  XLSX.utils.book_append_sheet(wb, buildMonthlySheet(monthlyStatements, year), 'By Month')
  XLSX.utils.book_append_sheet(wb, buildTransactionsSheet(yearStatement.transactions), 'Transactions')
  XLSX.writeFile(wb, `${filePrefix()}_Statement_${year}.xlsx`)
}

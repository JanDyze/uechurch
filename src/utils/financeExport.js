import XLSX from 'xlsx-js-style'
import { getChurchIdentity } from '../composables/useAppSettings'
import { toPesos } from './moneyUtils'
import { categoryLabel } from '../data/financeChart'
import { accountShort } from '../data/financeChart'
import { compareForBook } from './ledgerUtils'

// Excel is given real numbers with a currency format, never pre-formatted
// strings: a treasurer's first instinct with the file is to total a column
// themselves, and text that merely looks like money cannot be added up.
const MONEY = '#,##0.00'

const churchName = () => {
  const { fullName, branch } = getChurchIdentity()
  return [fullName, branch].filter(Boolean).join(' ')
}

const filePrefix = () =>
  (getChurchIdentity().shortName || 'Church').replace(/[^\w-]+/g, '_').slice(0, 40)

const styles = {
  church: { font: { bold: true, sz: 13, color: { rgb: '01779B' } } },
  title: { font: { bold: true, sz: 11 } },
  period: { font: { italic: true, sz: 10, color: { rgb: '666666' } } },
  header: {
    font: { bold: true, sz: 10, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: '01779B' } },
  },
  group: { font: { bold: true, sz: 10 } },
  line: { font: { sz: 10, color: { rgb: '444444' } } },
  amount: { font: { sz: 10 }, numFmt: MONEY, alignment: { horizontal: 'right' } },
  amountBold: { font: { bold: true, sz: 10 }, numFmt: MONEY, alignment: { horizontal: 'right' } },
  note: { font: { sz: 9, italic: true, color: { rgb: '888888' } } },
}

const text = (value, style) => ({ v: value ?? '', t: 's', s: style })
const money = (centavos, style = styles.amount) => ({ v: toPesos(centavos), t: 'n', s: style })

const sideRows = (side, heading) => {
  const rows = [[text(heading, styles.header), text('', styles.header)]]

  for (const group of side.groups.filter((g) => g.total !== 0)) {
    rows.push([text(group.label, styles.group), money(group.total, styles.amountBold)])
    for (const line of group.lines.filter((l) => l.total !== 0)) {
      rows.push([text('    ' + line.label, styles.line), money(line.total)])
    }
  }
  if (!side.groups.some((g) => g.total !== 0)) {
    rows.push([text('    None', styles.line), money(0)])
  }

  rows.push([text(`Total ${heading.toLowerCase()}`, styles.group), money(side.total, styles.amountBold)])
  rows.push([])
  return rows
}

const statementSheet = (statement) => {
  const rows = [
    [text(churchName(), styles.church)],
    [text('Statement of Income and Expenses', styles.title)],
    [text(statement.label, styles.period)],
    [],
    ...sideRows(statement.income, 'Income'),
    ...sideRows(statement.expenses, 'Expenses'),
    [
      text(
        statement.net >= 0 ? 'Excess of income over expenses' : 'Excess of expenses over income',
        styles.group
      ),
      money(statement.net, styles.amountBold),
    ],
    [],
    [text('Cash position', styles.header), text('', styles.header)],
    [text('Opening — on hand', styles.line), money(statement.opening.cash)],
    [text('Opening — in bank', styles.line), money(statement.opening.bank)],
    [text('Closing — on hand', styles.line), money(statement.closing.cash)],
    [text('Closing — in bank', styles.line), money(statement.closing.bank)],
    [text('Closing total', styles.group), money(statement.closing.total, styles.amountBold)],
    [],
    [
      text(
        'Transfers between cash and bank move money without appearing as income or expense.',
        styles.note
      ),
    ],
  ]

  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [{ wch: 44 }, { wch: 16 }]
  return ws
}

/** The book behind the statement, so any figure can be traced to its entries. */
const entriesSheet = (entries) => {
  const rows = [
    [
      text('Date', styles.header),
      text('Description', styles.header),
      text('Statement line', styles.header),
      text('Account', styles.header),
      text('In', styles.header),
      text('Out', styles.header),
    ],
  ]

  for (const entry of [...entries].sort(compareForBook)) {
    const where =
      entry.direction === 'transfer'
        ? `${accountShort(entry.account)} → ${accountShort(entry.toAccount)}`
        : accountShort(entry.account)

    rows.push([
      text(entry.date, styles.line),
      text(entry.description, styles.line),
      text(categoryLabel(entry), styles.line),
      text(where, styles.line),
      entry.direction === 'in' ? money(entry.amount) : text('', styles.line),
      entry.direction === 'out' ? money(entry.amount) : text('', styles.line),
    ])
  }

  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [{ wch: 12 }, { wch: 34 }, { wch: 36 }, { wch: 16 }, { wch: 14 }, { wch: 14 }]
  return ws
}

export const exportStatement = (statement, entries = []) => {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, statementSheet(statement), 'Statement')
  XLSX.utils.book_append_sheet(wb, entriesSheet(entries), 'Entries')
  XLSX.writeFile(wb, `${filePrefix()}_Statement_${statement.monthKey}.xlsx`)
}

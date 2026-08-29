import XLSX from 'xlsx-js-style'
import { sgLabel } from '../data/sgFormLabels'
import { getChurchIdentity } from '../composables/useAppSettings'
import { getFullName } from './memberUtils'
import {
  memberKey,
  memberNameById,
  rosterMembers,
  sessionTotals,
  formatTimeRange,
} from './sgUtils'

const churchName = () => {
  const { fullName, branch } = getChurchIdentity()
  return [fullName, branch].filter(Boolean).join(' ')
}

// Same visual language as the finance workbooks (src/utils/financeExport.js)
// so every spreadsheet leaving the app looks like it came from one office.
const styles = {
  churchName: {
    font: { bold: true, sz: 13, color: { rgb: '01779B' } },
    alignment: { horizontal: 'left' },
  },
  title: { font: { bold: true, sz: 11 } },
  subtitle: { font: { italic: true, sz: 10, color: { rgb: '666666' } } },
  sectionHeader: {
    font: { bold: true, sz: 10, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: '01779B' } },
  },
  fieldLabel: { font: { bold: true, sz: 10, color: { rgb: '444444' } } },
  fieldValue: { font: { sz: 10 }, alignment: { wrapText: true, vertical: 'top' } },
  tableHeader: {
    font: { bold: true, sz: 10, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: '01779B' } },
    alignment: { horizontal: 'center' },
  },
  cell: { font: { sz: 10 } },
  totalLabel: {
    font: { bold: true, sz: 10 },
    border: { top: { style: 'thin', color: { rgb: '999999' } } },
  },
  totalValue: {
    font: { bold: true, sz: 10 },
    border: { top: { style: 'thin', color: { rgb: '999999' } } },
  },
}

/** Builds a sheet from [cells] rows plus a per-row {colIndex: style} map. */
const toSheet = (rows, meta, cols) => {
  const ws = XLSX.utils.aoa_to_sheet(rows)
  rows.forEach((row, r) => {
    row.forEach((_, c) => {
      const ref = XLSX.utils.encode_cell({ r, c })
      if (!ws[ref]) ws[ref] = { v: '', t: 's' }
      const style = meta[r]?.[c]
      if (style) ws[ref].s = style
    })
  })
  ws['!cols'] = cols
  return ws
}

const buildSessionSheet = (session, group, members, lang) => {
  const t = (key) => sgLabel(lang, key)
  const rows = []
  const meta = []

  const push = (cells, styleMap = {}) => {
    rows.push(cells)
    meta.push(styleMap)
  }
  const field = (labelKey, value) =>
    push([t(labelKey), value ?? ''], { 0: styles.fieldLabel, 1: styles.fieldValue })
  const section = (labelKey) =>
    push([t(labelKey), ''], { 0: styles.sectionHeader, 1: styles.sectionHeader })

  push([churchName(), ''], { 0: styles.churchName })
  push([t('sessionReport'), ''], { 0: styles.title })
  push([group?.name || '', ''], { 0: styles.subtitle })
  push([])

  section('session')
  field('date', session.date)
  field('startTime', session.startTime)
  field('endTime', session.endTime)
  field('venue', session.venue)
  field('leader', memberNameById(members, session.leaderId))
  push([])

  section('lesson')
  field('lessonTitle', session.lesson?.title)
  field('scripture', session.lesson?.scripture)
  field('discussionNotes', session.lesson?.notes)
  field('takeaways', session.lesson?.takeaways)
  push([])

  const totals = sessionTotals(session)
  section('attendance')
  push([t('totalPresent'), totals.present], { 0: styles.fieldLabel, 1: styles.cell })
  push([t('totalGuests'), totals.guests], { 0: styles.fieldLabel, 1: styles.cell })
  push([t('totalAttendance'), totals.total], { 0: styles.totalLabel, 1: styles.totalValue })
  push([])

  section('prayerRequests')
  const requests = session.prayerRequests || []
  if (requests.length === 0) {
    push([t('none'), ''], { 0: styles.fieldValue })
  } else {
    requests.forEach((request, index) => {
      const by = request.name || memberNameById(members, request.memberId)
      push([`${index + 1}.`, by ? `${request.text} (${by})` : request.text], {
        0: styles.fieldLabel,
        1: styles.fieldValue,
      })
    })
  }
  push([])

  section('notes')
  push(['', session.notes || ''], { 1: styles.fieldValue })

  return toSheet(rows, meta, [{ wch: 26 }, { wch: 62 }])
}

const buildAttendanceSheet = (session, group, members, lang) => {
  const t = (key) => sgLabel(lang, key)
  const rows = []
  const meta = []
  const push = (cells, styleMap = {}) => {
    rows.push(cells)
    meta.push(styleMap)
  }

  const headerStyles = { 0: styles.tableHeader, 1: styles.tableHeader, 2: styles.tableHeader }
  push([t('attendance'), '', ''], { 0: styles.title })
  push([`${group?.name || ''} — ${session.date || ''}`, '', ''], { 0: styles.subtitle })
  push([])
  push(['#', t('members'), t('attendance')], headerStyles)

  const present = new Set((session.attendance?.presentIds || []).map(String))
  const roster = rosterMembers(group, members)

  roster.forEach((member, index) => {
    push(
      [
        index + 1,
        getFullName(member),
        present.has(memberKey(member)) ? t('present') : t('absent'),
      ],
      { 0: styles.cell, 1: styles.cell, 2: styles.cell }
    )
  })

  const guests = session.attendance?.guests || []
  if (guests.length) {
    push([])
    push(['#', t('guests'), t('invitedBy')], headerStyles)
    guests.forEach((guest, index) => {
      push([index + 1, guest.name || '', guest.invitedBy || ''], {
        0: styles.cell,
        1: styles.cell,
        2: styles.cell,
      })
    })
  }

  const totals = sessionTotals(session)
  push([])
  push(['', t('totalAttendance'), totals.total], { 1: styles.totalLabel, 2: styles.totalValue })

  return toSheet(rows, meta, [{ wch: 6 }, { wch: 32 }, { wch: 22 }])
}

const safeName = (value) => (value || 'Session').replace(/[^\w-]+/g, '_').slice(0, 40)
const filePrefix = () => safeName(getChurchIdentity().shortName)

/** Downloads one session as a two-sheet workbook, in the chosen language. */
export const exportSgSession = (session, group, members, lang = 'en') => {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(
    wb,
    buildSessionSheet(session, group, members, lang),
    sgLabel(lang, 'session').slice(0, 31)
  )
  XLSX.utils.book_append_sheet(
    wb,
    buildAttendanceSheet(session, group, members, lang),
    sgLabel(lang, 'attendance').slice(0, 31)
  )
  XLSX.writeFile(wb, `${filePrefix()}_SG_${safeName(group?.name)}_${session.date || 'session'}.xlsx`)
}

/** Downloads every session of a group as one row-per-session summary. */
export const exportSgGroupSessions = (sessions, group, members, lang = 'en') => {
  const t = (key) => sgLabel(lang, key)
  const rows = []
  const meta = []
  const push = (cells, styleMap = {}) => {
    rows.push(cells)
    meta.push(styleMap)
  }

  push([churchName()], { 0: styles.churchName })
  push([`${t('sessions')} — ${group?.name || ''}`], { 0: styles.title })
  push([])

  const header = [
    t('date'),
    t('startTime'),
    t('venue'),
    t('lessonTitle'),
    t('scripture'),
    t('totalPresent'),
    t('totalGuests'),
    t('totalAttendance'),
  ]
  push(header, Object.fromEntries(header.map((_, i) => [i, styles.tableHeader])))

  sessions.forEach((session) => {
    const totals = sessionTotals(session)
    push(
      [
        session.date || '',
        formatTimeRange(session.startTime, session.endTime),
        session.venue || '',
        session.lesson?.title || '',
        session.lesson?.scripture || '',
        totals.present,
        totals.guests,
        totals.total,
      ],
      {
        0: styles.cell,
        1: styles.cell,
        2: styles.cell,
        3: styles.cell,
        4: styles.cell,
        5: styles.cell,
        6: styles.cell,
        7: styles.cell,
      }
    )
  })

  const ws = toSheet(rows, meta, [
    { wch: 14 },
    { wch: 20 },
    { wch: 22 },
    { wch: 30 },
    { wch: 22 },
    { wch: 12 },
    { wch: 12 },
    { wch: 14 },
  ])

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sgLabel(lang, 'sessions').slice(0, 31))
  XLSX.writeFile(wb, `${filePrefix()}_SG_${safeName(group?.name)}_Sessions.xlsx`)
}

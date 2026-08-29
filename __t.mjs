import { exportSgSession, exportSgGroupSessions } from 'file:///c:/Users/jdmal/Desktop/UEC/uechurch/src/utils/sgExport.js'
import XLSX from 'xlsx-js-style'

process.chdir('c:/Users/jdmal/AppData/Local/Temp/claude/c--Users-jdmal-Desktop-UEC-uechurch/997fdc09-5e5c-4bee-855e-e804c6c3fe5c/scratchpad')

const members = [
  { id: '1', firstName: 'Ana', lastName: 'Cruz' },
  { id: '2', firstName: 'Ben', lastName: 'Dela Cruz' },
]
const group = { firestoreId: 'g1', name: 'Youth / Kabataan', memberIds: ['1','2'] }
const session = {
  firestoreId: 's1', date: '2026-08-02', startTime: '09:00', endTime: '11:00',
  venue: 'Church', hostId: '1', leaderId: '2', facilitatorId: null, recordedById: '1',
  language: 'en',
  lesson: { title: 'Grace', scripture: 'Eph 2:8', notes: 'x', takeaways: 'y' },
  attendance: { presentIds: ['1'], absentIds: ['2'], guests: [{name:'Guest', contact:'09', invitedBy:'Ana'}] },
  offering: { amount: 250, remittedTo: 'Treasurer', notes: '' },
  prayerRequests: [{ text: 'Healing', name: '', memberId: '2' }],
  notes: 'ok',
}

try {
  exportSgSession(session, group, members, 'en')
  console.log('en session OK')
} catch (e) { console.log('en session FAIL', e.message) }
try {
  exportSgSession(session, group, members, 'tl')
  console.log('tl session OK')
} catch (e) { console.log('tl session FAIL', e.message) }
try {
  exportSgGroupSessions([session, {...session, date:'2026-07-05'}], group, members, 'en')
  console.log('group OK')
} catch (e) { console.log('group FAIL', e.message) }

// inspect the workbook contents
const wb = XLSX.readFile('UEC_SG_Youth___Kabataan_2026-08-02.xlsx')
console.log('sheets:', wb.SheetNames)
for (const n of wb.SheetNames) {
  const ws = wb.Sheets[n]
  console.log('---', n, 'ref=', ws['!ref'])
  console.log(JSON.stringify(XLSX.utils.sheet_to_json(ws, {header:1, raw:true})))
}
const wb2 = XLSX.readFile('UEC_SG_Youth___Kabataan_Sessions.xlsx')
console.log('sheets2:', wb2.SheetNames)
for (const n of wb2.SheetNames) {
  const ws = wb2.Sheets[n]
  console.log('---', n, 'ref=', ws['!ref'])
  console.log(JSON.stringify(XLSX.utils.sheet_to_json(ws, {header:1, raw:true})))
}

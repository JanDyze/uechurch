// Helpers for the monthly worship lineup: month arithmetic done on local
// calendar dates (never UTC — an evening in Manila must not roll a service
// back to Saturday), plus the song-key lookup that ties a lineup to the song
// list.
import { getFullName } from './memberUtils'
import { memberKey } from './sgUtils'

/** Members carrying this ministry tag are offered as song leaders. */
export const SONG_LEADER_TAG = 'song leader'

const pad = (n) => String(n).padStart(2, '0')

/** 'YYYY-MM' for a Date, in local time. */
export const monthKeyOf = (date = new Date()) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}`

/** 'YYYY-MM-DD' for a Date, in local time. */
export const isoDateOf = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

export const todayIso = () => isoDateOf(new Date())

/** Split 'YYYY-MM' into numbers; falls back to the current month if malformed. */
const partsOf = (monthKey) => {
  const [y, m] = String(monthKey || '').split('-').map(Number)
  if (!y || !m || m < 1 || m > 12) {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() + 1 }
  }
  return { year: y, month: m }
}

export const isValidMonthKey = (monthKey) => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(monthKey || ''))

/** Move a month key forward or back; rolls over the year on its own. */
export const shiftMonth = (monthKey, delta) => {
  const { year, month } = partsOf(monthKey)
  const d = new Date(year, month - 1 + delta, 1)
  return monthKeyOf(d)
}

/** Every Sunday in the month, as 'YYYY-MM-DD', in order. */
export const sundaysInMonth = (monthKey) => {
  const { year, month } = partsOf(monthKey)
  const dates = []
  const cursor = new Date(year, month - 1, 1)
  // Jump straight to the first Sunday, then step a week at a time.
  cursor.setDate(1 + ((7 - cursor.getDay()) % 7))
  while (cursor.getMonth() === month - 1) {
    dates.push(isoDateOf(cursor))
    cursor.setDate(cursor.getDate() + 7)
  }
  return dates
}

/** 'September 2026' */
export const formatMonthLabel = (monthKey) => {
  const { year, month } = partsOf(monthKey)
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })
}

/** 'Sep 6' — the date badge on a Sunday card. */
export const formatShortDate = (iso) => {
  const d = parseIso(iso)
  if (!d) return iso || ''
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** 'Sunday, September 6' */
export const formatServiceDate = (iso) => {
  const d = parseIso(iso)
  if (!d) return iso || ''
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

/** Parsed as a local date, so 'YYYY-MM-DD' never shifts a day in a +08:00 zone. */
export const parseIso = (iso) => {
  const [y, m, d] = String(iso || '').split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

export const monthKeyOfIso = (iso) => String(iso || '').slice(0, 7)

export const isSunday = (iso) => parseIso(iso)?.getDay() === 0

/** Members tagged as song leaders; everyone else stays out of the picker. */
export const songLeadersFrom = (members = []) =>
  members
    .filter((m) => (m.tags || []).some((t) => String(t).toLowerCase() === SONG_LEADER_TAG))
    .sort((a, b) => getFullName(a).localeCompare(getFullName(b)))

/**
 * The key this leader sings a song in, as recorded on the song list. Song
 * documents key their `leaderKeys` map by the member's `id`, but attendance
 * and rosters compare ids as strings, so both spellings are accepted here.
 */
export const keyForLeader = (song, leaderId) => {
  if (!song || !leaderId) return ''
  const map = song.leaderKeys || {}
  const direct = map[leaderId]
  if (direct) return direct
  const match = Object.entries(map).find(([id, key]) => key && String(id) === String(leaderId))
  return match ? match[1] : ''
}

/** How many Sundays each leader carries this month — the fairness check. */
export const leaderLoad = (sundays = [], members = []) => {
  const counts = new Map()
  sundays.forEach((sunday) => {
    const id = sunday?.leaderId
    if (!id) return
    counts.set(String(id), (counts.get(String(id)) || 0) + 1)
  })
  return [...counts.entries()]
    .map(([id, count]) => {
      const member = members.find((m) => memberKey(m) === id || String(m.firestoreId) === id)
      return { id, count, name: member ? getFullName(member) : 'Unknown', member }
    })
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

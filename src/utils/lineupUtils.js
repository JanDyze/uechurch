// Helpers for the monthly schedule: month arithmetic done on local calendar
// dates (never UTC — an evening in Manila must not roll a service back to
// Saturday), who is on which role, and the song-key lookup that ties the
// worship portion of a schedule to the song list.
import { getDisplayName, getFullName } from './memberUtils'
import { memberKey } from './sgUtils'
import { assignmentsOf } from '../data/scheduleRoles'
import { matchesQuery, parseQuery } from './search'

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

/**
 * Whether somebody serves in any of a role's ministries — the people the
 * picker offers first for that role.
 *
 * Ministries, not tags. Serving on a Sunday is a job somebody is rostered for,
 * and the ministry list is the controlled vocabulary that records it. The song
 * leader picker read `tags` until the two fields were split, at which point
 * every song leader moved to `ministries` and the filter matched nobody. Tags
 * are also free text anyone with member-edit rights can type, so reading them
 * here would let a label spell its way onto the band.
 *
 * Case-insensitive, because a role names its ministries by hand in Settings.
 */
export const servesInRole = (member, role) => {
  const wanted = (role?.ministries || []).map((m) => String(m).toLowerCase())
  if (!wanted.length) return false
  return (member?.ministries || []).some((m) => wanted.includes(String(m).toLowerCase()))
}

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

/** A member by any id a roster might hold for them. */
export const findRosterMember = (members = [], id) =>
  members.find((m) => memberKey(m) === String(id) || String(m.firestoreId) === String(id)) || null

/** The name a roster shows for somebody, including somebody since removed. */
export const rosterName = (row) => (row?.member ? getDisplayName(row.member) : 'Former member')

/**
 * A service's roles in the church's order, each with the people on it.
 *
 * Only roles the church still has are returned. People on a role that has
 * since been removed stay on the document (see toStoredSunday) but have no
 * name to be shown under, so they wait there until the role comes back.
 */
export const serviceRoles = (sunday, roles = [], members = []) => {
  const assignments = assignmentsOf(sunday)
  return roles.map((role) => ({
    role,
    people: (assignments[role.id] || []).map((id) => ({
      id,
      member: findRosterMember(members, id),
    })),
  }))
}

/**
 * How many Sundays each person serves this month, and as what.
 *
 * The fairness check. It used to be two loads — who leads, who plays — but the
 * question was always "is anyone being asked too often", and the usher on four
 * Sundays running is as much the answer as the drummer is. Somebody leading
 * and playing on the same Sunday counts once for that Sunday, with both roles
 * listed, which is the truth of it.
 */
export const servingLoad = (sundays = [], members = [], roles = []) => {
  const byPerson = new Map()
  sundays.forEach((sunday) => {
    const assignments = assignmentsOf(sunday)
    const countedThisSunday = new Set()
    roles.forEach((role) => {
      ;(assignments[role.id] || []).forEach((id) => {
        const row = byPerson.get(id) || { id, count: 0, roles: new Map() }
        if (!countedThisSunday.has(id)) {
          row.count += 1
          countedThisSunday.add(id)
        }
        row.roles.set(role.name, (row.roles.get(role.name) || 0) + 1)
        byPerson.set(id, row)
      })
    })
  })
  return [...byPerson.values()]
    .map((row) => {
      const member = findRosterMember(members, row.id)
      return {
        id: row.id,
        count: row.count,
        member,
        name: rosterName({ member }),
        roles: [...row.roles.entries()].map(([name, count]) => ({ name, count })),
      }
    })
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

/**
 * Whether a service answers a search, and why.
 *
 * One search bar in place of filters, so it has to reach everything a service
 * is: the date, the theme, the songs, and every person on every role. Returns
 * null for no match, otherwise the reasons worded for the row — "Ana ·
 * Ushers", or a song title.
 *
 * Each person on a role is indexed as their own line alongside the service's
 * date and songs, so "ana ushers" finds the Sundays Ana is ushering, not every
 * Sunday that happens to have an Ana on the band and somebody on the door.
 * Commas gather, as on every other search bar: "ana, ben" is either of them.
 */
export const scheduleMatches = (sunday, query, roles = [], members = []) => {
  const groups = parseQuery(query)
  if (!groups.length) return []

  const songs = (sunday?.songs || []).map((s) => s.title).filter(Boolean)
  const base = [
    formatServiceDate(sunday?.date),
    formatMonthLabel(monthKeyOfIso(sunday?.date)),
    sunday?.theme,
    ...songs,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  const lines = serviceRoles(sunday, roles, members).flatMap(({ role, people }) =>
    people.map((person) => ({
      text: [role.name, person.member && getFullName(person.member), person.member?.nickname]
        .filter(Boolean)
        .join(' ')
        .toLowerCase(),
      label: `${rosterName(person)} · ${role.name}`,
    }))
  )

  const reasons = new Set()
  let matched = false

  groups.forEach((terms) => {
    const hits = lines.filter((line) => matchesQuery(`${base} ${line.text}`, [terms]))
    // A line is named as the reason only when the person or role itself was
    // searched for. Otherwise "september" would list everybody on the Sunday.
    const named = hits.filter((line) => terms.some((term) => line.text.includes(term)))
    if (named.length) {
      matched = true
      named.forEach((line) => reasons.add(line.label))
      return
    }
    if (matchesQuery(base, [terms])) {
      matched = true
      songs
        .filter((title) => terms.some((term) => title.toLowerCase().includes(term)))
        .forEach((title) => reasons.add(title))
    }
  })

  return matched ? [...reasons] : null
}


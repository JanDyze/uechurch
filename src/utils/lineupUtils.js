// Helpers for the monthly worship lineup: month arithmetic done on local
// calendar dates (never UTC — an evening in Manila must not roll a service
// back to Saturday), plus the song-key lookup that ties a lineup to the song
// list.
import { getDisplayName } from './memberUtils'
import { memberKey } from './sgUtils'

/** Members serving in this ministry are offered as song leaders. */
export const SONG_LEADER_MINISTRY = 'song leader'

/**
 * The ministries a worship band is drawn from, lowercased for comparison.
 *
 * Song Leader and Instrumentalist, which between them are the band: whoever is
 * singing out front and whoever is playing. Both come from DEFAULT_MINISTRIES,
 * so a church that has never renamed anything has these already.
 *
 * A church that uses other names for these jobs registers them in Settings and
 * they will not match here. That is why the picker keeps a way out rather than
 * simply showing nobody.
 */
export const WORSHIP_MINISTRIES = ['song leader', 'instrumentalist']

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

/** Members serving in any of the named ministries, case-insensitively. */
const inMinistries = (members, names) =>
  members
    .filter((m) =>
      (m.ministries || []).some((ministry) => names.includes(String(ministry).toLowerCase()))
    )
    .sort((a, b) => getDisplayName(a).localeCompare(getDisplayName(b)))

/**
 * Members serving in the Song Leader ministry; everyone else stays out of the
 * picker.
 *
 * Ministries, not tags. Leading a service is a job somebody is rostered for,
 * and the ministry list is the controlled vocabulary that records it. This read
 * `tags` until the two fields were split, at which point every song leader
 * moved to `ministries` and the filter matched nobody — so the picker silently
 * fell back to listing the whole congregation.
 */
export const songLeadersFrom = (members = []) => inMinistries(members, [SONG_LEADER_MINISTRY])

/**
 * Members serving in a worship ministry — the pool a Sunday's band is picked
 * from, rather than the whole congregation.
 *
 * Same rule and the same reason as the song leaders above: ministries, never
 * tags. Tags are free text anyone with member-edit rights can type, so reading
 * them here would let a label spell its way onto the band.
 */
export const worshipTeamFrom = (members = []) => inMinistries(members, WORSHIP_MINISTRIES)

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

/** Counted ids to named rows, busiest first. Shared by the two loads below. */
const loadRows = (counts, members) =>
  [...counts.entries()]
    .map(([id, count]) => {
      const member = members.find((m) => memberKey(m) === id || String(m.firestoreId) === id)
      return { id, count, name: member ? getDisplayName(member) : 'Unknown', member }
    })
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))

/** How many Sundays each leader carries this month — the fairness check. */
export const leaderLoad = (sundays = [], members = []) => {
  const counts = new Map()
  sundays.forEach((sunday) => {
    const id = sunday?.leaderId
    if (!id) return
    counts.set(String(id), (counts.get(String(id)) || 0) + 1)
  })
  return loadRows(counts, members)
}

/**
 * How many Sundays each band member plays this month.
 *
 * The same fairness question as leaderLoad, asked of everyone who is not
 * holding the microphone — a lineup is a roster of people as much as it is a
 * list of songs, and the drummer playing four Sundays running is exactly the
 * thing a planner needs to see before publishing.
 *
 * A leader who also plays appears in both loads, which is the truth of it.
 */
export const bandLoad = (sundays = [], members = []) => {
  const counts = new Map()
  sundays.forEach((sunday) => {
    ;(sunday?.teamIds || []).forEach((id) => {
      if (!id) return
      counts.set(String(id), (counts.get(String(id)) || 0) + 1)
    })
  })
  return loadRows(counts, members)
}

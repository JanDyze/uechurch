// The jobs a Sunday is staffed with, and how a service's assignments are read.
//
// Plain data with no browser dependency, like appDefaults: the MCP connector
// imports this file too, so "who is ushering" means the same thing in a
// conversation as it does on the Schedules page.
//
// A schedule used to be a worship lineup — a song leader, a band and the songs.
// But the same Sunday also needs ushers, a preacher, Sunday school teachers and
// WLA coaches, and all of that was being arranged somewhere else. So a service
// now carries any number of roles, each with the people on it, and the list of
// roles is the church's own to edit rather than something fixed in code.

/**
 * The two roles the songs depend on, which is why they cannot be removed.
 *
 * A song's key is recorded per leader, so the song leader has to stay a single
 * person the service order can read keys off. And both were stored long before
 * roles existed, as `leaderId` and `teamIds` on the service itself: those
 * fields are still where they live, so every lineup already on file reads as a
 * schedule without anything being migrated.
 */
export const SONG_LEADER_ROLE = 'song-leader'
export const BAND_ROLE = 'band'
export const WORSHIP_ROLE_IDS = [SONG_LEADER_ROLE, BAND_ROLE]

export const isWorshipRole = (id) => WORSHIP_ROLE_IDS.includes(id)

/**
 * Starting roles, used until an administrator edits the list.
 *
 * `ministries` are who the people picker offers first — members already
 * serving in that ministry — never a restriction. Names match DEFAULT_MINISTRIES
 * case-insensitively; a church that renamed its ministries simply gets the
 * whole roll until the role is pointed at the new name.
 *
 * The band keeps the rule the lineup had: song leaders are offered alongside
 * instrumentalists, because backup singers come from the same people.
 */
export const DEFAULT_SCHEDULE_ROLES = [
  { id: SONG_LEADER_ROLE, name: 'Song leader', ministries: ['Song Leader'] },
  { id: BAND_ROLE, name: 'Band', ministries: ['Song Leader', 'Instrumentalist'] },
  { id: 'preacher', name: 'Preacher', ministries: ['Preacher'] },
  { id: 'ushers', name: 'Ushers', ministries: ['Usher'] },
  { id: 'sunday-school', name: 'Sunday school teacher', ministries: [] },
  { id: 'wla-coach', name: 'WLA coach', ministries: [] },
]

const normalizeRole = (role) => ({
  id: String(role?.id || ''),
  name: String(role?.name || '').trim(),
  ministries: Array.isArray(role?.ministries)
    ? [...new Set(role.ministries.map((m) => String(m || '').trim()).filter(Boolean))]
    : [],
})

/**
 * The church's roles, in the order they are shown.
 *
 * Stored on appSettings/church as `scheduleRoles`. Nothing stored means the
 * defaults. The worship roles are put back if a stored list has somehow lost
 * them — the songs and every old lineup still hang off those two ids, and a
 * schedule that could not show its song leader would be a broken one.
 */
export const scheduleRolesFrom = (stored) => {
  const list =
    Array.isArray(stored) && stored.length
      ? stored.map(normalizeRole).filter((r) => r.id && r.name)
      : DEFAULT_SCHEDULE_ROLES.map(normalizeRole)

  const seen = new Set()
  const unique = list.filter((r) => (seen.has(r.id) ? false : seen.add(r.id)))

  WORSHIP_ROLE_IDS.forEach((id, index) => {
    if (unique.some((r) => r.id === id)) return
    unique.splice(index, 0, normalizeRole(DEFAULT_SCHEDULE_ROLES.find((r) => r.id === id)))
  })
  return unique
}

/**
 * A stable id for a new role, from its name.
 *
 * Readable rather than random because it is what a service's assignments are
 * keyed by on disk, and somebody reading a document in the console should be
 * able to tell `ushers` from `wla-coach`. Removing a role frees its id, so
 * adding "Ushers" back later brings back the ushers already on record.
 */
export const roleIdFor = (name, roles = []) => {
  const base =
    String(name || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/\p{M}/gu, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'role'
  const taken = new Set(roles.map((r) => r.id))
  if (!taken.has(base)) return base
  let n = 2
  while (taken.has(`${base}-${n}`)) n += 1
  return `${base}-${n}`
}

/**
 * Everyone on a service, by role id.
 *
 * The worship roles come from the fields they have always been stored in; the
 * rest from `assignments`. Reading both here is the whole of the backward
 * compatibility — a lineup saved before schedules existed has no
 * `assignments` at all and still answers "who is leading" correctly.
 */
export const assignmentsOf = (service = {}) => {
  const stored =
    service?.assignments && typeof service.assignments === 'object' ? service.assignments : {}
  const result = {}
  Object.entries(stored).forEach(([roleId, ids]) => {
    if (isWorshipRole(roleId) || !Array.isArray(ids)) return
    const clean = [...new Set(ids.map(String).filter(Boolean))]
    if (clean.length) result[roleId] = clean
  })
  if (service?.leaderId) result[SONG_LEADER_ROLE] = [String(service.leaderId)]
  const band = Array.isArray(service?.teamIds) ? service.teamIds.map(String).filter(Boolean) : []
  if (band.length) result[BAND_ROLE] = [...new Set(band)]
  return result
}

/** Every person on a service, once each, whatever they are doing. */
export const peopleOnService = (service) => [
  ...new Set(Object.values(assignmentsOf(service)).flat()),
]

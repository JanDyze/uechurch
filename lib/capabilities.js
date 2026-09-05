// Every area of the app that can be granted to a ministry tag. Capability keys
// are `<area>.view` and `<area>.manage`; manage always implies view (resolved
// in usePermissions), so a role never has to be given both.

export const AREAS = [
  { key: 'dashboard', label: 'Dashboard', manageable: false },
  { key: 'events', label: 'Events' },
  { key: 'songs', label: 'Song list' },
  { key: 'lineups', label: 'Worship lineups' },
  { key: 'links', label: 'Links' },
  { key: 'gallery', label: 'Gallery' },
  { key: 'members', label: 'Members' },
  { key: 'smallgroups', label: 'Small groups' },
  { key: 'attendance', label: 'Attendance' },
  { key: 'minutes', label: 'Minutes' },
  { key: 'finances', label: 'Finances' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'prayer', label: 'Prayer concerns' },
]

export const viewCap = (area) => `${area}.view`
export const manageCap = (area) => `${area}.manage`

/** Every grantable capability, in the order the Settings grid renders them. */
export const ALL_CAPABILITIES = AREAS.flatMap((area) =>
  area.manageable === false ? [viewCap(area.key)] : [viewCap(area.key), manageCap(area.key)]
)

// What a signed-in account gets before any tag is applied: the things a member
// would look up about their own church, all read-only. Anything touching other
// people's details — the directory, attendance, giving, minutes — is withheld
// until a tag grants it.
export const BASELINE_CAPABILITIES = [
  'dashboard.view',
  'events.view',
  'songs.view',
  'lineups.view',
  'links.view',
  'gallery.view',
]

export const areaLabel = (key) => AREAS.find((a) => a.key === key)?.label || key

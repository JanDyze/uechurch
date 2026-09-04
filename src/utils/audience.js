// Who a gathering is for, and therefore how many people to expect.
//
// "Expected attendees" used to be a number someone typed, seeded with the size
// of the whole roster. It was a guess about the wrong thing: a choir practice
// is not attended by the congregation, and a number typed in March is wrong by
// April. A gathering now names the member tags it is for, and the count is read
// off the roster — so tagging one more person into the choir moves every choir
// practice, the one last week and the one next month, without anyone opening
// an event.
//
// Tags, not ministries, on purpose. A ministry is what someone serves in and is
// what grants access (see api/tagsService.js); who turns up to a thing is not a
// question about permissions, and answering it through ministries would tie the
// two back together.
//
// No tags means everyone. That is the honest reading of "we didn't say" for a
// Sunday service, and it is exactly what the old default did.
//
// Exclusions exist because the useful audience is often "everyone except":
// a members' meeting is the congregation minus the kids, and listing every
// other tag to say so would be a list that goes stale the moment a new one is
// added. Excluding is subtracted last, so it wins over an include — someone
// tagged both Youth and Guest is out of "Youth except Guest".

const normalize = (tag) => String(tag || '').trim().toLowerCase()

/** The tags an event, schedule or form holds, ignoring blanks and bad shapes. */
export const audienceTagsOf = (source) =>
  Array.isArray(source?.audienceTags) ? source.audienceTags.filter(Boolean) : []

/** The tags it leaves out. */
export const excludeTagsOf = (source) =>
  Array.isArray(source?.excludeTags) ? source.excludeTags.filter(Boolean) : []

/**
 * Everyone on the roster carrying at least one of `tags` — any of, not all of:
 * "Choir · Youth" is the choir and the youth in one room, not the handful who
 * are both. Matched case-insensitively, because a tag typed onto a member and
 * one registered in Settings only have to agree on the word.
 */
export const membersInAudience = (members = [], tags = [], excludeTags = []) => {
  const wanted = new Set((tags || []).map(normalize).filter(Boolean))
  const unwanted = new Set((excludeTags || []).map(normalize).filter(Boolean))

  return (members || []).filter((member) => {
    const held = (member?.tags || []).map(normalize)
    if (wanted.size && !held.some((tag) => wanted.has(tag))) return false
    if (unwanted.size && held.some((tag) => unwanted.has(tag))) return false
    return true
  })
}

/**
 * How many people to expect at `source`, counted off the roster right now.
 * The rule for anything authored under this model: tags name the audience,
 * naming none means everyone.
 */
export const expectedAttendance = (source, members = []) =>
  membersInAudience(members, audienceTagsOf(source), excludeTagsOf(source)).length

/**
 * The same count for something that may predate audiences — an event saved
 * when the number was typed by hand, or a meeting, which never had one. Tags
 * win where they exist; otherwise whatever number the thing carries stands,
 * and only something carrying neither is read as everyone.
 *
 * `attendees` is a head count on an event and a list of member ids on a
 * meeting, which is why the array case is spelled out rather than assumed.
 */
export const readExpectedAttendance = (source, members = []) => {
  const tags = audienceTagsOf(source)
  const excluded = excludeTagsOf(source)
  if (tags.length || excluded.length) {
    return membersInAudience(members, tags, excluded).length
  }

  const stored = source?.expectedAttendees ?? source?.attendees
  if (Array.isArray(stored)) return stored.length
  if (stored) return Number(stored) || 0

  return (members || []).length
}

/** "Everyone" / "Choir · Youth" / "Everyone except Kids" — how it reads. */
export const audienceLabel = (tags = [], excludeTags = []) => {
  const base = tags?.length ? tags.join(' · ') : 'Everyone'
  return excludeTags?.length ? `${base} except ${excludeTags.join(' · ')}` : base
}

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

/* ------------------------------------------------------------- meetings */

// A meeting names its group differently from the rest of the calendar, and the
// difference is not a mistake to be tidied away.
//
// An event picks from member tags (AudiencePicker). A meeting picks from tags
// AND ministries, because a church files "Council" as a ministry and "Ushers"
// as a tag and neither distinction means anything to the person taking
// attendance in the room. So a meeting's group has to be matched against both,
// and these helpers are that rule — one definition, used by the minute's own
// attendance drawer, by the Attendance list's expected count, by the recorder's
// roll and by a member's history, so no two of them can report a different
// denominator for the same meeting.

/** Carries `tag`, filed as either a tag or a ministry. */
export const carriesTag = (member, tag) => {
  const wanted = normalize(tag)
  if (!wanted) return true
  return [...(member?.tags || []), ...(member?.ministries || [])].some(
    (entry) => normalize(entry) === wanted
  )
}

/** Every tag and ministry anybody on the roster carries, in one sorted list. */
export const meetingTagOptions = (members = []) => {
  const seen = new Map()
  for (const member of members || []) {
    for (const entry of [...(member?.tags || []), ...(member?.ministries || [])]) {
      const name = String(entry || '').trim()
      if (name && !seen.has(name.toLowerCase())) seen.set(name.toLowerCase(), name)
    }
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b))
}

/**
 * The group a meeting is for.
 *
 * Stored on the minute once somebody chooses; until then guessed from the
 * title, because "Church Council Meeting" and a Council tag are the same word
 * and asking would be asking about something already known.
 *
 * The guess is deliberately not saved. It is a reading of the title, and the
 * moment it is written down it stops tracking a title that gets corrected.
 * That is why it lives here rather than on the record: every screen applies the
 * same reading to the same minute, and a meeting counted out of nine on the
 * Attendance list is counted out of nine on the minute too.
 *
 * `null`/`undefined` means nobody has said; an empty string means somebody said
 * "everyone", which is an answer and is left alone.
 */
export const meetingTagOf = (minute, options = []) => {
  const stored = minute?.attendanceTag
  if (stored !== undefined && stored !== null) return String(stored).trim()

  // Records carry the chosen tag in `audienceTags` instead — a meeting names
  // one group, so the first is the whole answer.
  const carried = audienceTagsOf(minute)
  if (carried.length) return String(carried[0]).trim()

  const title = String(minute?.title || minute?.eventTitle || '').toLowerCase()
  if (!title) return ''
  return (options || []).find((tag) => title.includes(String(tag).toLowerCase())) || ''
}

/** Who a meeting is for: its group, or everyone when it names none. */
export const membersAtMeeting = (members = [], tag = '') =>
  tag ? (members || []).filter((member) => carriesTag(member, tag)) : members || []

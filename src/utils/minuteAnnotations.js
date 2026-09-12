/**
 * The two things a reader scans a minute for: who has to do something, and
 * when. Both are already written in the page as ordinary words — "Joyce", "by
 * Friday" — so rather than asking anyone to tag them, they are found and
 * marked after the fact.
 *
 * People are matched against the church's own roster, so a highlight always
 * points at a record. "@" is only a way of typing one deliberately; a name
 * written plainly is highlighted just the same.
 *
 * Everything here works on HTML strings rather than the DOM, so the same
 * functions run in the renderer's `decorate` hook and over the HTML the old
 * contenteditable saved.
 */

import { escapeHtml } from './markdownUtils'
import { todayKey } from './taskUtils'

/* ------------------------------------------------------------------ people */

const stripAccents = (text) =>
  String(text || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')

const normalise = (text) => stripAccents(text).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

// Titles the church writes in front of a name. They are part of how someone is
// referred to in the notes ("si bro dan"), not part of the name on the record,
// so they are stripped before matching and never used as a name on their own.
const TITLES = new Set([
  'ptr', 'pastor', 'ps', 'rev', 'bro', 'brother', 'sis', 'sister', 'kuya', 'ate',
  'tita', 'tito', 'nanay', 'tatay', 'mr', 'mrs', 'ms', 'dr', 'sir', 'maam', 'ma am',
])

// Names that are also months. Even written as a name — "May" at the head of a
// sentence, "June 5" — these are the date far more often than the person, and
// the date rule wants them.
const ALWAYS_A_WORD = new Set(['may', 'june', 'april', 'august', 'jan', 'feb', 'mar', 'sept'])

const fullName = (member) =>
  `${member?.firstName || ''} ${member?.lastName || ''}`.replace(/\s+/g, ' ').trim()

/**
 * What to call someone on a minute: their nickname, or their first name.
 *
 * This is the app's own rule — see getDisplayName in memberUtils — and a
 * minute is squarely on the "addressed" side of it. The notes say "si bro dan"
 * and the church says "Tita Mercy"; a highlight that answers "Daniel Cruz" is
 * technically right and reads like a different person.
 *
 * The full name is kept alongside it and shown wherever the short one could be
 * two people — a tooltip, the line under a picker row.
 */
const shortName = (member) =>
  String(member?.nickname || '').trim() || String(member?.firstName || '').trim()

export const memberIdOf = (member) => String(member?.id ?? member?.firestoreId ?? '')

/**
 * The roster, turned into the shapes a name gets written in: full name,
 * nickname, first name, "first + last initial". Longest first, so "Ana Reyes"
 * wins over "Ana" and the page never marks half a name.
 *
 * @param {Array<object>} members
 * @returns {{ entries: Array<{alias: string, id: string, name: string}>, byId: Map }}
 */
export function buildPeopleIndex(members = []) {
  const entries = []
  const byId = new Map()
  const claimed = new Map() // alias -> id, so an ambiguous first name is dropped

  // Two Joyces cannot both be "Joyce" on a chip that asserts who someone is,
  // so a shared short name gains a surname initial. Worked out up front from
  // the whole roster, because whether "Joyce" is ambiguous is a fact about the
  // church rather than about any one member.
  const shortNameCounts = new Map()
  for (const member of members) {
    const short = shortName(member).toLowerCase()
    if (short) shortNameCounts.set(short, (shortNameCounts.get(short) || 0) + 1)
  }

  for (const member of members) {
    const id = memberIdOf(member)
    if (!id) continue
    const formal = fullName(member)
    if (!formal) continue

    const short = shortName(member)
    const shared = short && shortNameCounts.get(short.toLowerCase()) > 1
    const initial = String(member.lastName || '').trim()[0]
    const name = !short ? formal : shared && initial ? `${short} ${initial}.` : short

    byId.set(id, { id, name, fullName: formal, member })

    // What gets matched is every shape the name is written in — the full name
    // included, always, whatever the chip ends up calling them.
    const aliases = new Set([formal, name])
    if (member.nickname) aliases.add(String(member.nickname))
    if (member.firstName) aliases.add(String(member.firstName))
    if (member.firstName && member.lastName) {
      aliases.add(`${member.firstName} ${String(member.lastName)[0]}`)
    }

    for (const raw of aliases) {
      const alias = normalise(raw)
      // Two letters is a coincidence, not a name.
      if (alias.length < 3) continue
      if (ALWAYS_A_WORD.has(alias)) continue
      if (claimed.has(alias) && claimed.get(alias) !== id) {
        // Shared between two people — "Ana" when there are two Anas. Marking
        // it would attribute a task to whichever record was loaded first.
        claimed.set(alias, null)
        continue
      }
      claimed.set(alias, id)
      entries.push({
        alias,
        id,
        name,
        fullName: formal,
        // A full name is unmistakable and matches anywhere. A bare first name
        // or nickname is a word that happens to also be a name, and needs
        // something in the sentence to say which — see needsEvidence.
        bare: alias.split(' ').length === 1,
      })
    }
  }

  const usable = entries
    .filter((entry) => claimed.get(entry.alias) === entry.id)
    .sort((a, b) => b.alias.length - a.alias.length)

  return { entries: usable, byId }
}

/* ------------------------------------------------------------------ places */

// Rooms and grounds a church writes into notes. Only words that are a place
// and nothing else — "altar" and "office" are left out, because "at the altar"
// is a position in a service and "the office decided" is a group of people.
const VENUE_WORDS = [
  'fellowship hall', 'covered court', 'church grounds', 'parking lot',
  'multipurpose hall', 'prayer room', 'sanctuary', 'parsonage', 'chapel',
  'annex', 'gymnasium', 'gym', 'basketball court', 'plaza', 'barangay hall',
  'municipal hall', 'city hall', 'cemetery', 'retreat house', 'campsite',
]

/**
 * Where the church actually meets, taken from its own records — the `location`
 * on every minute and event — plus the handful of venue words above.
 *
 * Deliberately not a general place detector. Nothing here guesses that a
 * capitalised phrase might be somewhere; a place lights up because the church
 * has met there before and written it down, or because the word means a venue
 * and nothing else. That makes the highlighting sparse, and right, rather than
 * frequent and occasionally embarrassing.
 *
 * @param {Array<string>} recorded  location values off minutes and events
 * @param {object} [peopleIndex]  so a venue named after someone does not
 *   compete with the person — the person wins
 */
export function buildPlaceIndex(recorded = [], peopleIndex) {
  const taken = new Set((peopleIndex?.entries || []).map((entry) => entry.alias))
  const seen = new Map()

  for (const raw of [...recorded, ...VENUE_WORDS]) {
    const label = String(raw || '').trim()
    const alias = normalise(label)
    // Three characters is a room number, not a place name worth marking.
    if (alias.length < 4) continue
    if (taken.has(alias)) continue
    if (!seen.has(alias)) seen.set(alias, label)
  }

  return {
    entries: [...seen.entries()]
      .map(([alias, label]) => ({ alias, label }))
      .sort((a, b) => b.alias.length - a.alias.length),
  }
}

/**
 * Everyone the text names, in the order a reader meets them.
 *
 * @param {string} text
 * @param {object} index
 * @param {{ evidence?: boolean }} [options]
 *   `evidence` applies the bare-first-name rule below. On for a whole sentence
 *   — a bullet reading "as a mark for those" must not become Mark's task — and
 *   off for an Action Items Servant cell, where the whole cell is a name by
 *   definition and "joyce" typed in lower case still means Joyce.
 */
export function findPeople(text, index, { evidence = false } = {}) {
  const found = []
  const seen = new Set()
  const source = String(text || '')
  const haystack = normalise(source)

  for (const entry of index.entries) {
    if (seen.has(entry.id)) continue

    if (evidence && entry.bare) {
      const hit = [...source.matchAll(aliasPattern(entry.alias))].some((match) =>
        nameEvidence(source, match.index, match[0])
      )
      if (!hit) continue
    } else {
      const pattern = new RegExp(`(^| )${entry.alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( |$)`)
      if (!pattern.test(haystack)) continue
    }

    seen.add(entry.id)
    found.push(index.byId.get(entry.id))
  }
  return found
}

/* ------------------------------------------------------------------- dates */

const MONTHS =
  'january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec'
const WEEKDAYS = 'monday|tuesday|wednesday|thursday|friday|saturday|sunday'

// Ordered widest-first: "next Sunday" must be taken whole rather than leaving
// "next" behind and marking "Sunday" on its own.
const DATE_PATTERNS = [
  // 2026-09-12
  /\b\d{4}-\d{2}-\d{2}\b/gi,
  // 12 September 2026 / 12 Sept
  new RegExp(`\\b\\d{1,2}\\s+(?:${MONTHS})\\.?(?:\\s+\\d{4})?\\b`, 'gi'),
  // September 12, 2026 / Sept 12
  new RegExp(`\\b(?:${MONTHS})\\.?\\s+\\d{1,2}(?:\\s*[,-]\\s*\\d{4})?\\b`, 'gi'),
  // 9/12 or 9/12/26
  /\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g,
  // this / next / by / before / on Friday
  new RegExp(`\\b(?:this|next|last|by|before|every|tuwing|sa)\\s+(?:${WEEKDAYS})\\b`, 'gi'),
  new RegExp(`\\b(?:${WEEKDAYS})\\b`, 'gi'),
  /\b(?:today|tomorrow|tonight|yesterday|bukas|mamaya|ngayon)\b/gi,
  // "next month" is a deadline; "last year" is a reminiscence, and marking it
  // puts a highlight on a sentence nobody has to act on.
  /\b(?:next|this)\s+(?:week|month|year)\b/gi,
  /\b(?:end|start|beginning)\s+of\s+(?:the\s+)?(?:week|month|year)\b/gi,
  // 7:00 PM, 7 PM
  /\b\d{1,2}(?::\d{2})?\s?(?:am|pm)\b/gi,
]

/* -------------------------------------------------------------- decorating */

const PERSON_CLASS =
  'uec-mark uec-mention rounded px-1 font-medium text-primary bg-primary/10 dark:text-primary-light dark:bg-primary-light/15'
const DATE_CLASS =
  'uec-mark uec-date rounded px-1 font-medium text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-400/15'
const PLACE_CLASS =
  'uec-mark uec-place rounded px-1 font-medium text-teal-700 bg-teal-100 dark:text-teal-300 dark:bg-teal-400/15'

/**
 * Splits an HTML fragment into the parts it is safe to rewrite and the parts
 * it is not. Tags, and anything inside a tag that already carries meaning —
 * a link, a code span, a highlight put there by an earlier pass — are handed
 * back untouched.
 */
const overText = (html, replace) => {
  const out = []
  let index = 0
  // <tag ...> | </tag> | a whole <a>/<code> element, skipped entire
  const skippable = /<(a|code|pre)\b[\s\S]*?<\/\1>|<[^>]+>/gi
  let match
  while ((match = skippable.exec(html)) !== null) {
    if (match.index > index) out.push(replace(html.slice(index, match.index)))
    out.push(match[0])
    index = match.index + match[0].length
  }
  if (index < html.length) out.push(replace(html.slice(index)))
  return out.join('')
}

/** Non-overlapping spans, leftmost and longest first. */
const collectMatches = (text, pattern, kind, meta) => {
  const found = []
  const regex = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`)
  let match
  while ((match = regex.exec(text)) !== null) {
    if (!match[0]) {
      regex.lastIndex += 1
      continue
    }
    found.push({ start: match.index, end: match.index + match[0].length, text: match[0], kind, meta })
  }
  return found
}

const aliasPattern = (alias) => {
  // The alias is normalised ("ana reyes"); the page holds the original casing
  // and may separate the words with any run of whitespace or a period.
  const words = alias.split(' ').map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  return new RegExp(`(?<![\\w@])@?${words.join('[\\s.]+')}(?![\\w])`, 'gi')
}

const TITLE_BEFORE = new RegExp(`\\b(?:${[...TITLES].join('|')})\\.?\\s+$`, 'i')

/**
 * Whether a bare first name in this sentence is being used as a name.
 *
 * This exists because of a real minute. "As a mark for those" lit up **mark**
 * as a member of the church, because the roster has a Mark and the matching
 * was case-insensitive. Half the names a church roster holds are also ordinary
 * words — Mark, Grace, Faith, Joy, Hope, Angel, Precious, Love — and a page
 * that highlights every one of them wherever it appears is not a page anyone
 * trusts the highlighting on.
 *
 * A full name never needs this: "Mark Santos" is unmistakable. A single word
 * does, and there are four things that settle it:
 *
 *   Mark will send it        capitalised, so written as a name
 *   si bro mark bahala       a title in front, which is how Taglish notes name
 *   letter (mark)            in brackets after a task, which is the notes'
 *                            own shorthand for who is doing it
 *   @mark                    typed deliberately through the picker
 *
 * "as a mark for those" has none, so it stays a word. A lowercase name with no
 * title and no bracket is missed — that is the trade, and it is the right way
 * round: a missed highlight costs nothing, a wrong one is read as a fact.
 */
const nameEvidence = (text, start, matched) => {
  if (matched.startsWith('@')) return true
  const first = matched.replace(/^@/, '')[0]
  if (first && first === first.toUpperCase() && first !== first.toLowerCase()) return true

  const before = text.slice(Math.max(0, start - 24), start)
  if (TITLE_BEFORE.test(before)) return true
  if (/[([]\s*$/.test(before)) return true

  return false
}

/**
 * Every mark in a run of plain text: people, dates, places. Non-overlapping,
 * left to right.
 *
 * Pure text in, offsets out — no HTML. Both callers need exactly this and
 * would otherwise disagree about what counts as a mark: the renderer wraps
 * them in spans, and the live highlighter paints Ranges over the notes editor
 * while someone is still typing into it.
 *
 * @param {string} text
 * @param {{
 *   index?: object, places?: object, dates?: boolean, people?: boolean,
 *   corrections?: { dismissed?: string[], linked?: Record<string, string> }
 * }} options
 * @returns {Array<{start: number, end: number, text: string, kind: string, meta?: object}>}
 */
export function findMarks(text, options = {}) {
  const { index, places, dates = true, people = true, corrections } = options
  if (!text || !text.trim()) return []

  const dismissed = new Set((corrections?.dismissed || []).map(normalise))
  const linked = corrections?.linked || {}

  let spans = []

  if (people && index?.entries?.length) {
    for (const entry of index.entries) {
      for (const span of collectMatches(text, aliasPattern(entry.alias), 'person')) {
        if (entry.bare && !nameEvidence(text, span.start, span.text)) continue
        spans.push({
          ...span,
          meta: { id: entry.id, name: entry.name, fullName: entry.fullName, alias: entry.alias },
        })
      }
    }
  }

  // Somebody's correction, applied as if it were a rule of its own: a word the
  // roster does not know can still be a person because a reader said so.
  for (const [surface, memberId] of Object.entries(linked)) {
    const person = index?.byId?.get(String(memberId))
    if (!person || !surface) continue
    for (const span of collectMatches(text, aliasPattern(normalise(surface)), 'person')) {
      spans.push({
        ...span,
        corrected: true,
        meta: { id: person.id, name: person.name, fullName: person.fullName, alias: normalise(surface) },
      })
    }
  }

  if (places && places.entries?.length) {
    for (const entry of places.entries) {
      for (const span of collectMatches(text, aliasPattern(entry.alias), 'place')) {
        spans.push({ ...span, meta: { label: entry.label, alias: entry.alias } })
      }
    }
  }

  if (dates) {
    for (const pattern of DATE_PATTERNS) {
      spans = spans.concat(collectMatches(text, pattern, 'date'))
    }
  }

  if (!spans.length) return []

  // Longest wins where two rules claim the same words: "next Sunday" over
  // "Sunday", "Ana Reyes" over "Ana", and a reader's correction over both.
  spans.sort(
    (a, b) => a.start - b.start || Number(b.corrected || 0) - Number(a.corrected || 0) || b.end - a.end
  )

  const kept = []
  let cursor = -1
  for (const span of spans) {
    if (span.start < cursor) continue
    // "Not a name" / "not a date": dropped after matching rather than before,
    // so the words underneath still read normally instead of being skipped.
    if (dismissed.has(normalise(span.text)) && !span.corrected) continue
    kept.push(span)
    cursor = span.end
  }
  return kept
}

/**
 * The decorator handed to markdownToHtml: findMarks, wrapped in spans.
 *
 * Every mark carries what it was taken for and the exact words it was taken
 * from, because the reader has to be able to disagree with it — see
 * AnnotationEditor, which reads these attributes straight off the click.
 */
export function makeDecorator(options = {}) {
  const { index, places, dates = true, people = true } = options
  const hasPeople = people && index?.entries?.length
  const hasPlaces = places?.entries?.length
  if (!hasPeople && !hasPlaces && !dates) return undefined

  return (fragment) =>
    overText(fragment, (text) => {
      const marks = findMarks(text, options)
      if (!marks.length) return text

      let out = ''
      let at = 0
      for (const span of marks) {
        out += text.slice(at, span.start)
        const surface = escapeHtml(normalise(span.text))
        if (span.kind === 'person') {
          // The chip is titled with the short name — what the church calls
          // them — and carries the full one for the tooltip, so a reader who
          // needs to be sure which Joyce can hover or open it.
          const label = escapeHtml(span.meta.name)
          const formal = escapeHtml(span.meta.fullName || span.meta.name)
          out +=
            `<span class="${PERSON_CLASS}" data-mark="person" data-surface="${surface}" ` +
            `data-member-id="${escapeHtml(span.meta.id)}" data-name="${label}" ` +
            `title="${formal}">${span.text}</span>`
        } else if (span.kind === 'place') {
          const label = escapeHtml(span.meta.label)
          out +=
            `<span class="${PLACE_CLASS}" data-mark="place" data-surface="${surface}" ` +
            `title="${label}">${span.text}</span>`
        } else {
          out += `<span class="${DATE_CLASS}" data-mark="date" data-surface="${surface}">${span.text}</span>`
        }
        at = span.end
      }
      return out + text.slice(at)
    })
}

/**
 * The same marking, applied to HTML that was never rendered through
 * markdownToHtml — the innerHTML the old notes editor saved.
 */
export function annotateHtml(html, options) {
  const decorate = makeDecorator(options)
  return decorate ? decorate(String(html || '')) : String(html || '')
}

/* ------------------------------------------------------- timeline to a date */

const MONTH_INDEX = {}
'january february march april may june july august september october november december'
  .split(' ')
  .forEach((month, i) => {
    MONTH_INDEX[month] = i
    MONTH_INDEX[month.slice(0, 3)] = i
  })
MONTH_INDEX.sept = 8

const WEEKDAY_INDEX = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
}

const keyOf = (date) => todayKey(date)

/**
 * "By Friday" on a minute dated 31 August is 4 September. Turning a timeline
 * into a real date is guesswork, so it is only ever used to pre-fill the due
 * date on a task the person is about to confirm — never written back into the
 * minute, which says what the notes said.
 *
 * @param {string} text  the Timeline cell, or the whole line it sat on
 * @param {string} [reference]  YYYY-MM-DD the meeting happened on
 * @returns {string} YYYY-MM-DD, or '' when the text does not name a day
 */
export function resolveTimeline(text, reference = todayKey()) {
  const raw = String(text || '').toLowerCase().trim()
  if (!raw || /^(not specified|none|n\/a|tbd|ongoing)$/i.test(raw)) return ''

  const [refYear, refMonth, refDay] = String(reference).split('-').map(Number)
  const base =
    refYear && refMonth && refDay ? new Date(refYear, refMonth - 1, refDay) : new Date()

  const iso = raw.match(/\b(\d{4})-(\d{2})-(\d{2})\b/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`

  // 12 September (2026) / September 12(, 2026)
  const dayFirst = raw.match(new RegExp(`\\b(\\d{1,2})\\s+(${MONTHS})\\.?(?:\\s+(\\d{4}))?\\b`))
  const monthFirst = raw.match(new RegExp(`\\b(${MONTHS})\\.?\\s+(\\d{1,2})(?:\\s*,?\\s*(\\d{4}))?\\b`))
  const named = dayFirst
    ? { day: Number(dayFirst[1]), month: MONTH_INDEX[dayFirst[2]], year: Number(dayFirst[3]) }
    : monthFirst
      ? { day: Number(monthFirst[2]), month: MONTH_INDEX[monthFirst[1]], year: Number(monthFirst[3]) }
      : null
  if (named && named.month !== undefined) {
    // No year given: the one that puts the date on or after the meeting.
    let year = named.year || base.getFullYear()
    let date = new Date(year, named.month, named.day)
    if (!named.year && date < base) date = new Date(year + 1, named.month, named.day)
    return keyOf(date)
  }

  const slash = raw.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/)
  if (slash) {
    const month = Number(slash[1]) - 1
    const day = Number(slash[2])
    const year = slash[3] ? (slash[3].length === 2 ? 2000 + Number(slash[3]) : Number(slash[3])) : null
    let date = new Date(year || base.getFullYear(), month, day)
    if (!year && date < base) date = new Date(base.getFullYear() + 1, month, day)
    return keyOf(date)
  }

  if (/\btoday\b|\bngayon\b/.test(raw)) return keyOf(base)
  if (/\btomorrow\b|\bbukas\b/.test(raw)) {
    const date = new Date(base)
    date.setDate(date.getDate() + 1)
    return keyOf(date)
  }

  const weekday = raw.match(new RegExp(`\\b(${WEEKDAYS})\\b`))
  if (weekday) {
    const target = WEEKDAY_INDEX[weekday[1]]
    const date = new Date(base)
    // "Next Friday" is the one after the coming one; a bare weekday is the
    // coming one, and never the day of the meeting itself.
    let ahead = (target - date.getDay() + 7) % 7
    if (ahead === 0) ahead = 7
    if (/\bnext\s+\w+day\b/.test(raw)) ahead += 7
    date.setDate(date.getDate() + ahead)
    return keyOf(date)
  }

  if (/\bnext week\b/.test(raw)) {
    const date = new Date(base)
    date.setDate(date.getDate() + 7)
    return keyOf(date)
  }
  if (/\bnext month\b/.test(raw)) {
    const date = new Date(base)
    date.setMonth(date.getMonth() + 1)
    return keyOf(date)
  }
  if (/\bend of (the )?month\b/.test(raw)) {
    return keyOf(new Date(base.getFullYear(), base.getMonth() + 1, 0))
  }

  return ''
}

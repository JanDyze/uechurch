import { toSlides, DEFAULT_LINES_PER_SLIDE } from './songUtils'

/**
 * Turning a service into something projectable.
 *
 * A Sunday is not only songs. The run sheet is a list of items, each with a
 * `type`, and each type knows how to become slides. Songs are the type that
 * exists today; scripture, a custom text, an announcement and a video are the
 * ones this shape is here to accept without the presenter having to change.
 *
 * Items that cannot be rendered as text — a video, a PowerPoint — still belong
 * in the run order. They become a single `cue` slide so the operator can see
 * where they fall and the output window can hand over to whatever plays them.
 */

/** Every item type the run sheet understands. */
export const ITEM_TYPES = {
  song: { label: 'Song', renders: 'text' },
  scripture: { label: 'Scripture', renders: 'text' },
  text: { label: 'Custom text', renders: 'text' },
  announcement: { label: 'Announcement', renders: 'text' },
  video: { label: 'Video', renders: 'cue' },
  slides: { label: 'Slides / PowerPoint', renders: 'cue' },
}

/** The channel the operator page and the output window talk over. Same-origin
 *  browser messaging, so a service does not depend on the network holding up. */
export const PRESENTER_CHANNEL = 'uec-presenter'

/** What the output window is showing when nothing is live. */
export const BLANK_SLIDE = { kind: 'blank', label: '', text: '', lines: [] }

/**
 * Scripture gets more lines, and shorter ones, than a song.
 *
 * A lyric arrives pre-broken — the songwriter decided where the lines end, and
 * four of them fill a wall at a readable size. Prose has no such breaks, so
 * they have to be invented, and a verse of Isaias will not fit in four. Six
 * lines of roughly forty characters is the density that keeps a whole verse on
 * one slide without shrinking the type past what the back row can read; it
 * lines up with the output window's own sizing, which trades size for lines.
 */
const SCRIPTURE_LINES_PER_SLIDE = 6
const SCRIPTURE_CHARS_PER_LINE = 40

/** Prose to lines, breaking between words rather than inside them. */
const wrapWords = (text, width) => {
  const lines = []
  let line = ''
  String(text || '')
    .split(/\s+/)
    .filter(Boolean)
    .forEach((word) => {
      if (!line) line = word
      else if (line.length + 1 + word.length <= width) line += ' ' + word
      else {
        lines.push(line)
        line = word
      }
    })
  if (line) lines.push(line)
  return lines
}

/**
 * Verses to slides, one whole verse at a time wherever it fits.
 *
 * A verse split across a slide change is the thing to avoid: the congregation
 * loses the sentence, and the reader loses their place. So verses are packed
 * until the next one would not fit, and only a verse too long to fit alone is
 * broken — and then at its own line boundaries.
 *
 * The verse number leads its first line, and only when the passage runs to more
 * than one verse: with a single verse the reference underneath already says
 * which one it is.
 */
const versesToSlides = (verses, perSlide = SCRIPTURE_LINES_PER_SLIDE) => {
  const numbered = verses.length > 1
  const blocks = verses.map((verse) => {
    const text = numbered ? `${verse.verse} ${verse.text}` : verse.text
    return wrapWords(text, SCRIPTURE_CHARS_PER_LINE)
  })

  const slides = []
  let current = []
  blocks.forEach((lines) => {
    if (lines.length > perSlide) {
      // Too long to share a slide with anything, and too long for one of its
      // own: flush what is waiting, then break the verse across as many as it
      // needs.
      if (current.length) slides.push(current)
      current = []
      for (let i = 0; i < lines.length; i += perSlide) slides.push(lines.slice(i, i + perSlide))
      return
    }
    if (current.length + lines.length > perSlide) {
      slides.push(current)
      current = []
    }
    current = current.concat(lines)
  })
  if (current.length) slides.push(current)

  return slides
}

/** Splits a block of prose into slides at blank lines, then by line count, so a
 *  pasted announcement or a psalm breaks somewhere sensible on its own. */
const textToSlides = (text, perSlide) => {
  const paragraphs = String(text || '')
    .split(/\n\s*\n/)
    .map((block) => block.split('\n').map((line) => line.trim()).filter(Boolean))
    .filter((block) => block.length)

  const out = []
  paragraphs.forEach((lines) => {
    for (let i = 0; i < lines.length; i += perSlide) out.push(lines.slice(i, i + perSlide))
  })
  return out
}

/**
 * One run-sheet item as the slides it will project.
 *
 * @param {object} item      { id, type, title, songId?, body? }
 * @param {object} context   { songsById, linesPerSlide }
 */
export const itemToSlides = (item, { songsById = {}, linesPerSlide = DEFAULT_LINES_PER_SLIDE } = {}) => {
  const type = ITEM_TYPES[item?.type] ? item.type : 'text'
  const base = { itemId: item.id, itemType: type, itemTitle: item.title || ITEM_TYPES[type].label }

  if (type === 'song') {
    const song = songsById[item.songId]
    if (!song) {
      return [{ ...base, kind: 'missing', label: 'Missing song', text: '', lines: [] }]
    }
    // The song's own title wins over the one stored on the run sheet: a song
    // renamed in the library should not keep its old name on every Sunday that
    // ever sang it.
    base.itemTitle = song.title || base.itemTitle
    // The song's own arrangement decides how often each section is projected.
    return toSlides(song, linesPerSlide).map((slide, index) => ({
      ...base,
      kind: 'text',
      id: `${item.id}-${index}`,
      label: slide.label,
      part: slide.part,
      lines: slide.lines,
      text: slide.text,
    }))
  }

  // Scripture keeps the verses it was looked up with rather than a reference to
  // resolve later, which is what songs do. The two differ because a lyric gets
  // corrected and every service that sings it should get the correction, while
  // Juan 3:16 will not be revised — and freezing the text means a service still
  // runs when the network does not.
  if (type === 'scripture' && Array.isArray(item.verses) && item.verses.length) {
    base.itemTitle = item.reference || base.itemTitle
    const blocks = versesToSlides(item.verses, linesPerSlide === DEFAULT_LINES_PER_SLIDE ? SCRIPTURE_LINES_PER_SLIDE : linesPerSlide)
    return blocks.map((lines, index) => ({
      ...base,
      kind: 'text',
      id: `${item.id}-${index}`,
      label: item.reference || base.itemTitle,
      part: blocks.length > 1 ? `${index + 1}/${blocks.length}` : '',
      // The reference belongs on the wall with the words, small, every slide —
      // it is how anyone following in their own Bible keeps up.
      caption: item.reference || '',
      lines,
      text: lines.join('\n'),
    }))
  }

  if (ITEM_TYPES[type].renders === 'cue') {
    return [
      {
        ...base,
        kind: 'cue',
        id: `${item.id}-cue`,
        label: ITEM_TYPES[type].label,
        text: item.title || '',
        lines: [],
        source: item.source || '',
      },
    ]
  }

  const blocks = textToSlides(item.body, linesPerSlide)
  if (!blocks.length) {
    return [{ ...base, kind: 'empty', id: `${item.id}-0`, label: base.itemTitle, text: '', lines: [] }]
  }

  return blocks.map((lines, index) => ({
    ...base,
    kind: 'text',
    id: `${item.id}-${index}`,
    label: base.itemTitle,
    part: blocks.length > 1 ? `${index + 1}/${blocks.length}` : '',
    lines,
    text: lines.join('\n'),
  }))
}

/**
 * The whole service as one flat run of slides, which is what stepping through
 * a service actually is — the operator presses next, not "next within song".
 */
export const buildDeck = (items = [], context = {}) =>
  items.flatMap((item) => itemToSlides(item, context))

/**
 * One song from a lineup as a run-sheet item.
 *
 * `fromLineup` is what makes the inheritance below possible: it marks an item
 * as the worship team's rather than the tech team's, and so as something that
 * should follow their plan instead of standing on its own.
 */
const songItemFromLineup = (entry, index, songsById) => {
  const song = songsById[entry.songId]
  return {
    id: `song-${entry.songId}-${index}`,
    type: 'song',
    songId: entry.songId,
    title: song?.title || 'Unknown song',
    note: entry.note || '',
    key: entry.key || '',
    fromLineup: true,
  }
}

/**
 * A run sheet seeded from a Sunday's worship lineup, so the tech team starts
 * from what the worship team already planned rather than retyping it.
 */
export const runSheetFromSunday = (sunday, songsById = {}) =>
  (sunday?.songs || []).map((entry, index) => songItemFromLineup(entry, index, songsById))

/** How many times each song appears in a list, keyed by id. */
const countBySong = (entries, idOf) => {
  const counts = new Map()
  entries.forEach((entry) => {
    const id = String(idOf(entry) || '')
    if (id) counts.set(id, (counts.get(id) || 0) + 1)
  })
  return counts
}

/**
 * Brings a saved run sheet back into line with the worship team's lineup.
 *
 * The run sheet used to be a snapshot: seeded from the lineup once, and from
 * then on its own thing. That is wrong for songs. The worship team goes on
 * editing their plan all week — a song swapped on the Friday, one added on the
 * Saturday night — and the tech team should not have to notice, let alone
 * retype. So songs are inherited: added when the lineup gains them, removed
 * when it loses them.
 *
 * Only songs marked `fromLineup` are governed this way. A song the tech team
 * added themselves is theirs and stays put, as does every reading, notice and
 * video — none of those were ever on the musicians' list, and they are the
 * reason the run sheet exists as its own document.
 *
 * New songs land after the last inherited one, which keeps the worship set
 * together rather than dropping a song after the offering. Returns the same
 * array when there is nothing to change, so a caller can use identity to tell
 * whether anything happened.
 */
export const reconcileWithLineup = (items = [], sunday = null, songsById = {}) => {
  const planned = (sunday?.songs || []).filter((entry) => entry?.songId)

  const plannedCounts = countBySong(planned, (entry) => entry.songId)

  // An inherited song survives only while the lineup still calls for it. The
  // count, not just the presence, so a lineup that drops one of two repeats
  // drops one item and keeps the other.
  const seen = new Map()
  const kept = items.filter((item) => {
    if (item.type !== 'song' || !item.fromLineup) return true
    const id = String(item.songId || '')
    const used = seen.get(id) || 0
    if (used >= (plannedCounts.get(id) || 0)) return false
    seen.set(id, used + 1)
    return true
  })

  // Anything on the lineup that the run sheet does not already hold — whether
  // inherited or added by hand, since a song the tech team added is not worth
  // duplicating just because it later appeared on the lineup too.
  const heldCounts = countBySong(
    kept.filter((item) => item.type === 'song'),
    (item) => item.songId
  )
  const additions = []
  planned.forEach((entry, index) => {
    const id = String(entry.songId)
    const held = heldCounts.get(id) || 0
    if (held > 0) {
      heldCounts.set(id, held - 1)
      return
    }
    additions.push(songItemFromLineup(entry, index, songsById))
  })

  if (!additions.length && kept.length === items.length) return items

  const lastInherited = kept.reduce(
    (last, item, index) => (item.type === 'song' && item.fromLineup ? index : last),
    -1
  )
  if (lastInherited === -1) return [...kept, ...additions]
  return [...kept.slice(0, lastInherited + 1), ...additions, ...kept.slice(lastInherited + 1)]
}

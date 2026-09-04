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
 * A run sheet seeded from a Sunday's worship lineup, so the tech team starts
 * from what the worship team already planned rather than retyping it.
 */
export const runSheetFromSunday = (sunday, songsById = {}) =>
  (sunday?.songs || []).map((entry, index) => {
    const song = songsById[entry.songId]
    return {
      id: `song-${entry.songId}-${index}`,
      type: 'song',
      songId: entry.songId,
      title: song?.title || 'Unknown song',
      note: entry.note || '',
      key: entry.key || '',
    }
  })

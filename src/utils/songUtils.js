// Helpers shared by the song list, the embedded player and the lineup: reading
// a video id out of whatever YouTube link someone pasted, and turning stored
// lyrics into the plain block the tech team pastes into the projector slides.

// watch?v=, youtu.be/, /embed/, /shorts/ and /live/ all appear in links people
// paste from a phone, so all five are accepted.
const YOUTUBE_ID_PATTERN =
  /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/

export const getYoutubeId = (url) => {
  if (!url) return null
  const match = String(url).match(YOUTUBE_ID_PATTERN)
  return match ? match[1] : null
}

export const getYoutubeThumbnail = (url) => {
  const id = getYoutubeId(url)
  return id ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : null
}

/** Thumbnail for an id that has already been extracted. */
export const thumbnailForId = (videoId) =>
  videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : null

/** Lyrics exactly as they were typed — every line break is a slide break to
 *  whoever is building the projector deck, so nothing here reflows them. */
export const songLyricsText = (song) =>
  String(song?.lyrics || '').replace(/\r\n/g, '\n').trim()

export const hasLyrics = (song) => songLyricsText(song).length > 0

/**
 * One service's worth of lyrics, in order, ready to paste in one go.
 * Each song is headed by its number, title and key so the person building the
 * slides can see where a song starts without switching back to the app.
 *
 * @param {Array<{title: string, key?: string, lyrics?: string}>} entries
 * @param {string} heading Optional first line, e.g. the service date.
 */
export const formatLyricsSheet = (entries = [], heading = '') => {
  const blocks = entries.map((entry, index) => {
    const title = entry.key ? `${entry.title} (${entry.key})` : entry.title
    const body = songLyricsText(entry)
    return `${index + 1}. ${title}\n\n${body || '[no lyrics saved yet]'}`
  })
  const sheet = blocks.join('\n\n———\n\n')
  return heading ? `${heading}\n\n${sheet}` : sheet
}

// ---------------------------------------------------------------- Structure
//
// Lyrics arrive as one block of text, pasted from whatever the worship leader
// copied them out of. On the projector that is all a slide builder needs, but
// on screen it is a wall — nobody can see at a glance that a song is
// verse/chorus/verse/bridge. These read that shape back out of the text
// without changing a character of it: the stored lyrics stay verbatim, and
// what follows is only a view of them.

// "Chorus", "Verse 2", "[Bridge]", "PRE-CHORUS:", "Verse 1 -" — a line that
// announces a section rather than being sung. Anything longer than the label
// itself is treated as lyrics, so a line that merely opens with "Bridge" is
// left alone.
//
// Filipino terms alongside the English ones, because most of this church's
// songs are Tagalog and their sheets are labelled that way: Koro is a chorus,
// Talata (or Saknong) a verse, Tulay a bridge. A sheet that mixes the two —
// English "Verse 1" over a Tagalog "Koro" — is common and reads fine here.
// Pre-chorus spellings come first so the bare "koro"/"chorus" alternatives
// cannot claim them.
//
// A regex literal, not RegExp(`...`): in a template literal \s is not an
// escape and collapses to a bare "s", which silently produced a pattern that
// matched nothing like a heading.
const SECTION_HEADING =
  /^\s*[[(]?\s*(pre-?chorus|pre-?koro|verse|chorus|bridge|refrain|tag|intro|outro|interlude|ending|vamp|coda|instrumental|talata|koro|tulay|bersikulo|saknong|simula|wakas|ulitin)\s*(\d+)?\s*[\])]?\s*[:.\-–—]?\s*$/i

/** Title case for a heading read out of the text, so "VERSE 2" and "verse 2"
 *  render the same way. Hyphens separate words, so PRE-KORO becomes Pre-Koro
 *  rather than Pre-koro. */
const titleCase = (word) =>
  word.replace(/[a-z0-9']+/gi, (part) => part[0].toUpperCase() + part.slice(1).toLowerCase())

/** What two blocks have to share to count as the same section: the words, not
 *  the punctuation or the capitalisation. */
const fingerprint = (lines) =>
  lines.join(' ').toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim()

/** Splits on blank lines, dropping runs of them. */
const toBlocks = (text) =>
  text
    .split(/\n\s*\n/)
    .map((block) => block.split('\n').map((line) => line.trimEnd()).filter((line) => line.trim()))
    .filter((block) => block.length)

/**
 * The longest run of lines that appears more than once, searched longest-first.
 * In a worship song that run is the chorus, and its length is the song's
 * stanza length — which is the useful part, because it survives the small
 * variations ("(oh)", a repeated word) that make an exact match fail.
 */
const findRepeatedUnit = (lines, minLength = 2, maxLength = 12) => {
  const upper = Math.min(maxLength, Math.floor(lines.length / 2))
  for (let len = upper; len >= minLength; len -= 1) {
    const positions = new Map()
    for (let i = 0; i + len <= lines.length; i += 1) {
      const key = fingerprint(lines.slice(i, i + len))
      if (!positions.has(key)) positions.set(key, [])
      positions.get(key).push(i)
    }
    for (const [, at] of positions) {
      let lastEnd = -1
      const kept = at.filter((startAt) => {
        if (startAt < lastEnd) return false
        lastEnd = startAt + len
        return true
      })
      if (kept.length > 1) return len
    }
  }
  return 0
}

/**
 * Reads section boundaries out of an unbroken run of lines.
 *
 * Plenty of pastes arrive with no blank lines at all — anything copied from a
 * lyric video description or a web page — and blank lines are what normally
 * divide a song. What survives that flattening is repetition: the chorus comes
 * back, and how long it is tells you how long a stanza is. Chopping the song
 * at that length puts the divisions back where they belong.
 *
 * Chunking rather than tracking which individual lines repeat: a last chorus
 * that adds an "(oh)" or doubles a word is still the same stanza, and matching
 * line by line splits it into fragments.
 */
const segmentFlat = (lines) => {
  if (lines.length < 4) return lines.length ? [lines] : []

  const stanza = findRepeatedUnit(lines)
  if (!stanza) return [lines]

  const chunks = []
  for (let i = 0; i < lines.length; i += stanza) chunks.push(lines.slice(i, i + stanza))

  // A short tail is the end of the last stanza, not a stanza of its own.
  if (chunks.length > 1 && chunks[chunks.length - 1].length <= stanza / 2) {
    const tail = chunks.pop()
    chunks[chunks.length - 1] = [...chunks[chunks.length - 1], ...tail]
  }

  return chunks
}

/**
 * Reads the song's sections out of its lyrics.
 *
 * Labels already in the text win — a paste from SongSelect or a hymnal usually
 * carries "Verse 1" and "Chorus" headings, and those are the song's own
 * answer. Only when there are none does this infer the shape: blocks that
 * repeat word-for-word are the chorus, and everything else is a verse in the
 * order it appears.
 *
 * @returns {Array<{ id: string, label: string, lines: string[], text: string }>}
 */
export const parseLyricSections = (song) => {
  // Accepts either a song or the lyrics on their own. A song object whose
  // lyrics are unset must not be wrapped as if it were the text itself —
  // String()-ing it yields "[object Object]" and parses into nonsense.
  const text = songLyricsText(typeof song === 'string' ? { lyrics: song } : song)
  if (!text) return []

  const lines = text.split('\n')
  const hasHeadings = lines.some((line) => SECTION_HEADING.test(line))

  if (hasHeadings) {
    const sections = []
    let current = null

    lines.forEach((line) => {
      const match = line.match(SECTION_HEADING)
      if (match) {
        const [, word, number] = match
        current = {
          id: `s${sections.length}`,
          label: [titleCase(word), number].filter(Boolean).join(' '),
          lines: [],
        }
        sections.push(current)
        return
      }
      // Anything before the first heading is still part of the song; give it a
      // home rather than dropping it on the floor.
      if (!current) {
        current = { id: 's0', label: '', lines: [] }
        sections.push(current)
      }
      if (line.trim() || current.lines.length) current.lines.push(line.trimEnd())
    })

    return sections
      .map((section) => {
        const lines = section.lines.filter(
          (line, index, all) => line.trim() || index < all.length - 1
        )
        // A heading with nothing under it is a songbook repeat marker — the
        // second chorus is named, not printed again. It is kept rather than
        // dropped, and the slides expand it back out, because the
        // congregation does sing it twice.
        const isRepeat = Boolean(section.label) && !lines.some((line) => line.trim())
        return { ...section, lines, isRepeat, text: lines.join('\n') }
      })
      .filter((section) => section.isRepeat || section.lines.some((line) => line.trim()))
  }

  // No headings — infer from repetition.
  const split = toBlocks(text)
  const blocks = split.length > 1 ? split : segmentFlat(split[0] || [])
  // Grouped by resemblance, not by an exact match: a last chorus that adds an
  // "(oh)" or doubles a word is still the chorus, and comparing whole blocks
  // character-for-character would file it as something new.
  const lineKeys = (block) => block.map((line) => fingerprint([line]))
  const resemblance = (a, b) => {
    const other = lineKeys(b)
    const shared = lineKeys(a).filter((key) => other.includes(key)).length
    return shared / Math.max(a.length, b.length, 1)
  }

  const groups = []
  const groupOf = blocks.map((block) => {
    const found = groups.findIndex((group) => resemblance(block, group.sample) >= 0.6)
    if (found > -1) {
      groups[found].count += 1
      return found
    }
    groups.push({ sample: block, count: 1 })
    return groups.length - 1
  })

  // Whatever comes back most often is the chorus.
  let chorusGroup = -1
  groups.forEach((group, index) => {
    if (group.count > 1 && (chorusGroup < 0 || group.count > groups[chorusGroup].count)) {
      chorusGroup = index
    }
  })

  // A repeated block sitting immediately before a chorus is a pre-chorus; one
  // that repeats anywhere else is a bridge. Sung once, it is a verse.
  const isChorusAt = (index) => index >= 0 && groupOf[index] === chorusGroup
  let verseNumber = 0

  return blocks.map((block, index) => {
    const group = groupOf[index]
    let label
    if (group === chorusGroup) {
      label = 'Chorus'
    } else if (groups[group].count > 1) {
      const alwaysBeforeChorus = groupOf
        .map((g, at) => (g === group ? at : -1))
        .filter((at) => at > -1)
        .every((at) => isChorusAt(at + 1))
      label = alwaysBeforeChorus ? 'Pre-Chorus' : 'Bridge'
    } else {
      verseNumber += 1
      label = `Verse ${verseNumber}`
    }
    return { id: `b${index}`, label, lines: block, text: block.join('\n') }
  })
}

/** True when the text carries enough shape to be worth rendering as sections. */
export const hasLyricStructure = (song) => parseLyricSections(song).length > 1

// ------------------------------------------------------------------- Tidying
//
// Lyrics arrive pasted out of a songbook, a PDF or a chat message, and carry
// whatever that source left behind: trailing spaces, four blank lines between
// verses, a heading typed "KORO" one week and "koro" the next. None of that is
// the song, and all of it shows on screen.
//
// Whitespace inside a line is left alone on purpose — a chord sheet aligns its
// chords with runs of spaces, and collapsing them would pull every chord off
// the syllable it belongs over.

/** Trailing spaces gone, runs of blank lines cut to one, headings in a
 *  consistent case, no blank lines topping and tailing the whole thing. */
export const tidyLyrics = (song) => {
  const text = songLyricsText(typeof song === 'string' ? { lyrics: song } : song)
  if (!text) return ''

  const lines = text.split('\n').map((line) => {
    const trimmed = line.trimEnd()
    const heading = trimmed.match(SECTION_HEADING)
    if (!heading) return trimmed
    const [, word, number] = heading
    return [titleCase(word), number].filter(Boolean).join(' ')
  })

  return lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim()
}

/**
 * True when tidying would actually change something, so a button can stay
 * quiet rather than offering to fix a song that is already clean.
 */
export const needsTidying = (song) => {
  const text = songLyricsText(typeof song === 'string' ? { lyrics: song } : song)
  return Boolean(text) && tidyLyrics(text) !== text
}

// -------------------------------------------------------------------- Slides
//
// What actually goes on the screen behind the worship team. A section is not a
// slide: a chorus of eight lines is two slides of four, because a congregation
// reads a screen, not a page.

/** How many lines fit on a projected slide before it stops being readable. */
export const DEFAULT_LINES_PER_SLIDE = 4

/**
 * The song as an ordered run of slides, ready to step through.
 *
 * Each slide carries the label of the section it came from, so the operator
 * always knows where they are, and a `part` when a section needed more than
 * one slide — "Chorus 2/2" is the difference between confidently advancing and
 * guessing whether the chorus has finished.
 *
 * @returns {Array<{ id, label, part: string, lines: string[], text: string }>}
 */
export const toSlides = (song, linesPerSlide = DEFAULT_LINES_PER_SLIDE) => {
  const perSlide = Math.max(1, Number(linesPerSlide) || DEFAULT_LINES_PER_SLIDE)
  const slides = []

  const sections = parseLyricSections(song)

  // A saved arrangement is the running order; without one the song is sung in
  // the order it is written. Entries naming a section that no longer exists —
  // a heading renamed since the order was worked out — are skipped rather than
  // projected blank.
  const arrangement = Array.isArray(song?.sequence) && song.sequence.length ? song.sequence : null

  const running = arrangement
    ? arrangement
        .map((label) => sections.find((section) => section.label === label && !section.isRepeat))
        .filter(Boolean)
    : sections

  running.forEach((section, at) => {
    // Older songs stored the order inline, as a heading with nothing under it.
    // Such a marker stands for the nearest section before it sharing its label.
    const source = section.isRepeat
      ? sections
          .slice(0, sections.indexOf(section))
          .reverse()
          .find((earlier) => earlier.label === section.label && !earlier.isRepeat)
      : section

    // Asides never reach the screen. Identified ones are already gone from the
    // text; this catches the bracketed lines in a song nobody has run the
    // identify pass over.
    const sung = (source?.lines || []).filter((line) => line.trim() && !isAdlibLine(line))
    const total = Math.ceil(sung.length / perSlide) || 0

    for (let index = 0; index < total; index += 1) {
      const lines = sung.slice(index * perSlide, (index + 1) * perSlide)
      slides.push({
        // Keyed by position in the running order, not by section: a chorus
        // sung three times is three distinct slides on screen.
        id: `${at}-${section.id}-${index}`,
        // Which entry of the running order this came from, so dragging a slide
        // can move that entry rather than the section it happens to show.
        orderIndex: at,
        label: section.label,
        part: total > 1 ? `${index + 1}/${total}` : '',
        lines,
        text: lines.join('\n'),
      })
    }
  })

  return slides
}

// ------------------------------------------------------------- Restructuring
//
// Used by the editor's "Identify sections" pass. The model that does the
// identifying never sees or returns lyrics — it is given numbered lines and
// answers with line numbers — so everything that puts words on the page is
// here, where it can be read.

/** The sung lines alone: no blank lines, and no headings already in the text.
 *  This is what gets numbered and sent for identification. */
export const lyricLinesOnly = (song) => {
  const text = songLyricsText(typeof song === 'string' ? { lyrics: song } : song)
  if (!text) return []
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !SECTION_HEADING.test(line))
}

/** A line that is nothing but an aside — "(oh)", "(2x)" — which a projector
 *  screen is usually better without. Deterministic, so slides can drop them
 *  without anything having to be identified first. */
export const isAdlibLine = (line) => /^\s*[({[][^)}\]]*[)}\]]\s*$/.test(String(line || ''))

/**
 * Rebuilds the lyrics from an identified structure, and separates the running
 * order from the words.
 *
 * The words are written once each: one Verse 1, one Chorus, one Ending. How
 * often and in what order they are sung comes back alongside as `sequence` —
 * the same split every piece of worship software makes, and for the same
 * reason. Writing the order into the lyrics buries the song under bare
 * headings, and changing the arrangement then means editing the text.
 *
 * Lines identified as asides are dropped, not kept and hidden downstream.
 *
 * @param {string[]} lines  the sung lines, as numbered for identification
 * @param {Array} sections  validated { start, end, label } entries
 * @param {number[]} adlibLines  indices of lines that are asides, not lyrics
 * @returns {{ lyrics: string, sequence: string[] }}
 */
export const applyStructure = (lines, sections = [], adlibLines = []) => {
  const identified = new Set(adlibLines)
  const bodies = new Map()
  const blocks = []
  const sequence = []

  // Asides are dropped outright rather than carried and hidden later. They are
  // not the song: a shouted "(oh)" or a "(2x)" is a note about how to sing it,
  // and leaving it in the text means every screen and every sheet built from
  // that text has to remember to strip it again.
  const isAside = (line, index) => identified.has(index) || isAdlibLine(line)

  sections.forEach((section) => {
    // A label already written out is a repeat: record the order, not the words.
    if (bodies.has(section.label)) {
      sequence.push(section.label)
      return
    }

    const body = lines
      .slice(section.start, section.end + 1)
      .filter((line, offset) => !isAside(line, section.start + offset))
      .join('\n')

    // A section that was nothing but asides leaves nothing to sing, so it does
    // not earn a heading or a place in the order.
    if (!body.trim()) return

    bodies.set(section.label, body)
    blocks.push(`${section.label}\n${body}`)
    sequence.push(section.label)
  })

  return { lyrics: blocks.join('\n\n'), sequence }
}

import { BIBLE_BOOKS } from '../data/bibleBooks'

/**
 * Making sense of a reference somebody typed.
 *
 * The operator is at a keyboard minutes before a service, so this accepts what
 * gets typed rather than one blessed format: "Juan 3:16", "John 3:16",
 * "jn 3.16", "1 Cor 13", "Mga Awit 23", "Genesis 1:1-2:3". What it will not do
 * is guess: an ambiguous abbreviation comes back as an error naming the
 * candidates, because a wrong passage on the wall is worse than a retype.
 *
 * Nothing here touches the network. The book table is in the bundle, so a
 * reference is accepted or refused instantly, and only fetching the verses
 * needs a connection.
 */

/** "Mga Awit" and "Awit" should both find Psalms; the article carries nothing. */
const stripArticle = (name) => name.replace(/^mga\s+/, '')

const normalize = (value) =>
  String(value || '')
    .toLowerCase()
    // en dash, em dash and the various unicode hyphens all mean "to"
    .replace(/[‐-―−]/g, '-')
    // A dot between numbers is the other way of writing "chapter and verse":
    // "Juan 3.16". Anywhere else it is just the dot on an abbreviation — "Gen.
    // 1" — and becomes a space. This order matters; the reverse eats the verse.
    .replace(/(\d)\s*\.\s*(\d)/g, '$1:$2')
    .replace(/\./g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/**
 * Abbreviations that are not simply the start of a name, so the prefix rule
 * below cannot find them, plus the handful where usage has settled a clash.
 *
 * "Phil" is the clash worth knowing about: it is the start of both Philippians
 * and Philemon. Convention gives it to Philippians and sends Philemon to
 * "Phlm", and this follows that rather than refusing a very common input.
 */
const ALIASES = {
  mt: 'Matthew',
  mk: 'Mark',
  mrk: 'Mark',
  lk: 'Luke',
  jn: 'John',
  jhn: 'John',
  jas: 'James',
  phil: 'Philippians',
  php: 'Philippians',
  phlm: 'Philemon',
  phm: 'Philemon',
  jude: 'Jude',
  judg: 'Judges',
  sos: 'Song of Solomon',
  song: 'Song of Solomon',
  ex: 'Exodus',
  ps: 'Psalms',
  psalm: 'Psalms',
  // The Tagalog names, shorn of their article, for the books where that is how
  // the reference is spoken: "Awit 23", "Gawa 2", "Hukom 6".
  awit: 'Psalms',
  gawa: 'Acts',
  hukom: 'Judges',
  bilang: 'Numbers',
  kawikaan: 'Proverbs',
  hebreo: 'Hebrews',
}

/** Every name a book answers to, exactly: English, Tagalog, article-stripped. */
const exact = new Map()
BIBLE_BOOKS.forEach((book) => {
  const names = [book.en, book.tl, stripArticle(normalize(book.tl))]
  names.forEach((name) => {
    const key = normalize(name)
    if (key && !exact.has(key)) exact.set(key, book)
  })
})
Object.entries(ALIASES).forEach(([alias, target]) => {
  const book = BIBLE_BOOKS.find((b) => b.en === target)
  if (book && !exact.has(alias)) exact.set(alias, book)
})

/**
 * Unnumbered names for books that only ever arrive with an ordinal in front:
 * "1 Hari" is 1 Kings, but "Hari" alone is not a book.
 */
const ORDINAL_ONLY = {
  hari: 'Kings',
  cronica: 'Chronicles',
  corinto: 'Corinthians',
  tesalonica: 'Thessalonians',
  timoteo: 'Timothy',
  pedro: 'Peter',
  juan: 'John',
  samuel: 'Samuel',
  sam: 'Samuel',
  kgs: 'Kings',
  chron: 'Chronicles',
  cor: 'Corinthians',
  thess: 'Thessalonians',
  tim: 'Timothy',
  pet: 'Peter',
}

/** The ordinal on a numbered book, in the forms people write it. */
const ORDINALS = {
  1: 1,
  i: 1,
  first: 1,
  '1st': 1,
  2: 2,
  ii: 2,
  second: 2,
  '2nd': 2,
  3: 3,
  iii: 3,
  third: 3,
  '3rd': 3,
}

/**
 * Splits "1 juan" into its ordinal and its name, so both halves can be matched
 * independently — the ordinal exactly, the name loosely.
 */
const splitOrdinal = (name) => {
  const [head, ...rest] = name.split(' ')
  const ordinal = ORDINALS[head]
  if (ordinal && rest.length) return { ordinal, name: rest.join(' ') }
  return { ordinal: 0, name }
}

/** The names a book answers to, with any leading ordinal already removed. */
const namesOf = (book) => [
  normalize(book.en).replace(/^[123] /, ''),
  normalize(book.tl).replace(/^[123] /, ''),
  stripArticle(normalize(book.tl).replace(/^[123] /, '')),
]

/**
 * A book from whatever was typed in its place.
 * @returns {{book: object}|{error: string}}
 */
export const findBook = (input) => {
  const raw = normalize(input)
  if (!raw) return { error: 'Which book?' }

  const direct = exact.get(raw)
  if (direct) return { book: direct }

  const { ordinal, name } = splitOrdinal(raw)
  const stripped = stripArticle(name)

  // Numbered books carry their ordinal in the name itself ("1 Juan"), so once
  // the ordinal is known the candidates are the books that start with it —
  // and without one, the numbered books are out of the running entirely.
  const pool = ordinal
    ? BIBLE_BOOKS.filter((b) => b.en.startsWith(ordinal + ' ') || b.tl.startsWith(ordinal + ' '))
    : BIBLE_BOOKS.filter((b) => !/^[123] /.test(b.en))

  const hit = pool.find((book) => namesOf(book).includes(stripped))
  if (hit) return { book: hit }

  // "1 hari", "2 cor": a name that means nothing on its own plus the ordinal
  // that completes it.
  if (ordinal && ORDINAL_ONLY[stripped]) {
    const numbered = BIBLE_BOOKS.find((b) => b.en === ordinal + ' ' + ORDINAL_ONLY[stripped])
    if (numbered) return { book: numbered }
  }

  const alias = exact.get(stripped)
  if (alias && pool.includes(alias)) return { book: alias }

  // Last resort: an unambiguous prefix. Three letters minimum, because "jo" is
  // five different books and silently picking one is the failure mode this
  // whole function exists to avoid.
  if (stripped.length >= 3) {
    const matches = pool.filter((book) => namesOf(book).some((n) => n.startsWith(stripped)))
    if (matches.length === 1) return { book: matches[0] }
    if (matches.length > 1) {
      const shown = matches.map((b) => b.tl).join(', ')
      return { error: '"' + String(input).trim() + '" could be ' + shown }
    }
  }

  return { error: 'No book called "' + String(input).trim() + '"' }
}

const buildRef = (book, startChapter, startVerse, endChapter, endVerse) => {
  const chapterWord = book.chapters === 1 ? 'chapter' : 'chapters'
  if (startChapter < 1 || startChapter > book.chapters || endChapter > book.chapters) {
    return { error: book.tl + ' has ' + book.chapters + ' ' + chapterWord }
  }
  const backwards =
    endChapter < startChapter ||
    (endChapter === startChapter && startVerse != null && endVerse != null && endVerse < startVerse)
  if (backwards) return { error: 'That range runs backwards' }

  return {
    ref: {
      slug: book.slug,
      book: book.tl,
      bookEn: book.en,
      startChapter,
      startVerse,
      endChapter,
      endVerse,
      // Verse counts are not in the bundle — only the fetched book knows them —
      // so "to the end of the chapter" stays a flag, resolved at lookup.
      wholeChapters: startVerse == null,
    },
  }
}

/**
 * A whole reference: book, and where in it to start and stop.
 *
 * Accepts "Juan 3", "Juan 3:16", "Juan 3:16-18" and "Genesis 1:1-2:3". A range
 * with no verses on either side ("Juan 3-4") is read as whole chapters.
 *
 * @returns {{ref: object}|{error: string}}
 */
export const parseReference = (input) => {
  const raw = normalize(input)
  if (!raw) return { error: 'Type a reference, e.g. Juan 3:16-18' }

  // The numbers live at the end; everything before them is the book. Anchored
  // at the end so the "1" in "1 Juan" is never mistaken for a chapter.
  const match = raw.match(/^(.*?)\s*(\d+)(?::(\d+))?(?:\s*-\s*(\d+)(?::(\d+))?)?$/)
  if (!match) {
    // No numbers at all is still a reference when the book has one chapter:
    // "Judas" is the whole of Jude.
    const only = findBook(raw)
    if (only.error) return { error: only.error }
    if (only.book.chapters === 1) return buildRef(only.book, 1, null, 1, null)
    return { error: 'Which chapter of ' + only.book.tl + '?' }
  }

  const bookPart = match[1]
  const found = findBook(bookPart)
  if (found.error) return { error: found.error }
  const book = found.book

  const startChapter = Number(match[2])
  const startVerse = match[3] ? Number(match[3]) : null

  // "3:16-18" and "1:1-2:3" differ only in whether a verse follows the second
  // number. With no colon on the left at all, "3-4" is a range of chapters.
  let endChapter = startChapter
  let endVerse = startVerse
  if (match[4] != null) {
    if (match[5] != null) {
      endChapter = Number(match[4])
      endVerse = Number(match[5])
    } else if (startVerse != null) {
      endVerse = Number(match[4])
    } else {
      endChapter = Number(match[4])
    }
  }

  return buildRef(book, startChapter, startVerse, endChapter, endVerse)
}

/** The reference as it should appear on the wall: "Juan 3:16-18". */
export const formatReference = (ref) => {
  if (!ref) return ''
  const { book, startChapter, startVerse, endChapter, endVerse } = ref
  if (startVerse == null) {
    return endChapter > startChapter
      ? book + ' ' + startChapter + '-' + endChapter
      : book + ' ' + startChapter
  }
  if (endChapter !== startChapter) {
    return book + ' ' + startChapter + ':' + startVerse + '-' + endChapter + ':' + endVerse
  }
  if (endVerse != null && endVerse !== startVerse) {
    return book + ' ' + startChapter + ':' + startVerse + '-' + endVerse
  }
  return book + ' ' + startChapter + ':' + startVerse
}

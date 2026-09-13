import { BIBLE_VERSION } from '../data/bibleBooks'
import { parseReference, formatReference } from '../utils/bibleRef'

/**
 * Reading verses out of the translation shipped in public/bible/.
 *
 * Static JSON rather than Firestore, one file per book, fetched the first time
 * something asks for it and then kept. Gzipped that is 2 KB for Judas, 35 KB
 * for Juan and 89 KB for Mga Awit at the worst — so the second reading from
 * Juan on a Sunday costs nothing, and a service whose passages have all been
 * looked up once will run with the network down. That last part is the point:
 * a projector must not stop because the church wifi did.
 *
 * Nothing here writes. A verse is not church data; it is the same for everyone
 * and never edited, which is why it sits in the bundle's neighbourhood instead
 * of in the database.
 */

/** slug -> Promise<book>. The promise is cached, not the result, so two
 *  lookups racing for the same book share one request. */
const books = new Map()

const loadBook = (slug) => {
  if (books.has(slug)) return books.get(slug)

  const pending = fetch(`/bible/${BIBLE_VERSION}/${slug}.json`)
    .then((response) => {
      if (!response.ok) throw new Error(`${slug} is not in this translation`)
      return response.json()
    })
    .catch((error) => {
      // A failed fetch must not poison the cache: the operator will try again,
      // and next time the wifi may be back.
      books.delete(slug)
      throw error
    })

  books.set(slug, pending)
  return pending
}

/**
 * The verses a parsed reference points at.
 *
 * Ranges are clamped rather than refused at the top end — "Juan 3:16-99" means
 * "to the end of the chapter" to everyone who types it, and refusing it five
 * minutes before a service helps nobody. A start that is off the end is a
 * different matter and comes back as an error, because it means the reference
 * itself is wrong.
 *
 * @param {object} ref  from parseReference
 * @returns {Promise<{reference: string, version: string, verses: Array}>}
 */
export const lookupPassage = async (ref) => {
  if (!ref?.slug) throw new Error('No reference to look up')
  const book = await loadBook(ref.slug)

  const byNumber = new Map(book.chapters.map((chapter) => [chapter.chapter, chapter]))
  const first = byNumber.get(ref.startChapter)
  if (!first) throw new Error(`${ref.book} has no chapter ${ref.startChapter}`)

  if (ref.startVerse != null && !first.verses.some((v) => v.verse === ref.startVerse)) {
    const last = first.verses[first.verses.length - 1]?.verse ?? 0
    throw new Error(`${ref.book} ${ref.startChapter} has ${last} verses`)
  }

  const verses = []
  for (let number = ref.startChapter; number <= ref.endChapter; number += 1) {
    const chapter = byNumber.get(number)
    if (!chapter) continue

    // Only the ends of the range are bounded; a chapter in the middle of a
    // multi-chapter reading is included whole.
    const from = number === ref.startChapter && ref.startVerse != null ? ref.startVerse : 1
    const to = number === ref.endChapter && ref.endVerse != null ? ref.endVerse : Infinity

    chapter.verses.forEach((verse) => {
      if (verse.verse >= from && verse.verse <= to) {
        verses.push({ chapter: number, verse: verse.verse, text: verse.text })
      }
    })
  }

  if (!verses.length) throw new Error('That reference has no verses in it')

  return { reference: formatReference(ref), version: book.version || BIBLE_VERSION, verses }
}

/**
 * Reference in, verses out — what the run-sheet editor calls.
 *
 * Parse errors and lookup errors are the same thing to the operator, who typed
 * one field and wants to know whether it worked, so both arrive as `error`
 * rather than one being thrown and the other returned.
 */
export const lookupReference = async (input) => {
  const parsed = parseReference(input)
  if (parsed.error) return { error: parsed.error }

  try {
    const passage = await lookupPassage(parsed.ref)
    return { ...passage, ref: parsed.ref }
  } catch (error) {
    return { error: error.message || 'Could not load that passage' }
  }
}

/** Drops the cached books. Only of interest to a translation switch. */
export const clearBibleCache = () => books.clear()

/**
 * One book, whole, off the same cache the reference lookup fills.
 *
 * The reader pages through chapters, so handing it the book rather than a
 * chapter means the first chapter costs a fetch and the other forty-nine cost
 * nothing — and a passage already looked up on the Presentation page is
 * already here, and the other way round.
 */
export const getBook = (slug) => loadBook(slug)

/**
 * Folds away everything that stops a typed word matching a printed one: case,
 * the accents this translation sets on a handful of words, and the curly
 * quotes it uses throughout — somebody searching for "kaya't" types a straight
 * apostrophe, and the text has ’.
 *
 * Every substitution here replaces one character with one character, so an
 * index into the folded string is an index into the original. That is what
 * lets the reader highlight the matched span inside a verse it is showing
 * unfolded: fold, find, then slice the *original* at what was found.
 *
 * Exported for that, rather than copied there, so the rule that finds a match
 * and the rule that marks it cannot drift apart.
 */
export const foldText = (value) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/[‐-―−]/g, '-')

/**
 * The same fold with the run of the typed phrase tidied up — collapsing the
 * double space somebody leaves between two words, and the one they leave on
 * the end.
 *
 * For the needle only. Doing it to the haystack too would change its length
 * and so break the index foldText exists to keep honest.
 */
export const fold = (value) => foldText(value).replace(/\s+/g, ' ').trim()

/**
 * Verses containing a phrase.
 *
 * `slugs` is the search's whole cost: one book is instant and offline, because
 * the reader has already loaded it, while all sixty-six is five megabytes the
 * person has to ask for. So the caller decides the scope and this reports
 * progress rather than guessing at either.
 *
 * Books are fetched one at a time on purpose: sixty-six parallel requests on
 * church wifi is how you turn a search into a stall. The walk is in canonical
 * order, so `onProgress` can honestly say how far through the Bible it is.
 *
 * @param query      what was typed
 * @param slugs      which books to look in, in the order to look
 * @param options    limit: stop after this many hits.
 *                   onProgress({done, total, hits}): after each book.
 *                   isCancelled(): checked between books, to abandon the walk.
 * @returns {Promise<{hits: Array, truncated: boolean, cancelled: boolean, searched: number}>}
 */
export const searchBooks = async (query, slugs, options = {}) => {
  const { limit = 200, onProgress, isCancelled } = options
  const needle = fold(query)
  const hits = []
  let truncated = false
  let searched = 0

  if (needle.length < 2) return { hits, truncated, cancelled: false, searched }

  for (const slug of slugs) {
    if (isCancelled?.()) return { hits, truncated, cancelled: true, searched }

    let book
    try {
      book = await loadBook(slug)
    } catch {
      // One missing book must not end the search — the other sixty-five are
      // still worth reading.
      searched += 1
      onProgress?.({ done: searched, total: slugs.length, hits: hits.length })
      continue
    }

    book.chapters.forEach((chapter) => {
      chapter.verses.forEach((verse) => {
        if (hits.length >= limit) {
          truncated = true
          return
        }
        if (foldText(verse.text).includes(needle)) {
          hits.push({
            slug,
            book: book.book_localized || book.book || slug,
            chapter: chapter.chapter,
            verse: verse.verse,
            text: verse.text,
          })
        }
      })
    })

    searched += 1
    onProgress?.({ done: searched, total: slugs.length, hits: hits.length })
    if (truncated) break
  }

  return { hits, truncated, cancelled: false, searched }
}

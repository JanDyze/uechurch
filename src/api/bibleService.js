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

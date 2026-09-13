import { ref, watch } from 'vue'
import { saveUserPrefs, subscribeToUserPrefs } from '../api/userPrefsService'
import { useAuth } from './useAuth'
import { BIBLE_BOOKS } from '../data/bibleBooks'

/**
 * Where this account had got to in the Bible.
 *
 * Reading is picked up and put down: somebody reads a chapter on Sunday and
 * opens the app again on Wednesday, and the page they want is the one they
 * left. So /bible with nothing after it is not "Genesis 1", it is wherever
 * they were.
 *
 * Against the account rather than the device, the same as the app order — a
 * phone and a laptop should agree about where you are up to, and the office
 * tablet should not hand the last reader's place to the next one.
 *
 * Only the chapter is kept, never a scroll position. A chapter is short enough
 * to find your line in, and a remembered offset goes wrong the moment the text
 * reflows at a different width.
 */
const PREF_KEY = 'biblePlace'

// A paint cache, so a cold start opens on the right chapter instead of
// flashing Genesis while Firestore answers.
const cacheKey = (uid) => `uec.biblePlace.${uid}`

const slugs = new Set(BIBLE_BOOKS.map((b) => b.slug))

/** Rejects anything that is not a book this translation actually has. */
const clean = (value) => {
  if (!value || typeof value !== 'object') return null
  const { slug, chapter } = value
  if (!slugs.has(slug)) return null
  const book = BIBLE_BOOKS.find((b) => b.slug === slug)
  const number = Number(chapter)
  if (!Number.isInteger(number) || number < 1 || number > book.chapters) return null
  return { slug, chapter: number }
}

const readCache = (uid) => {
  try {
    return clean(JSON.parse(localStorage.getItem(cacheKey(uid)) || 'null'))
  } catch {
    return null
  }
}

const writeCache = (uid, place) => {
  try {
    localStorage.setItem(cacheKey(uid), JSON.stringify(place))
  } catch {
    // The place still goes to Firestore; only the head start is lost.
  }
}

const place = ref(null)
const uid = ref(null)

let started = false
let unsubscribe = null

/**
 * Starts following the signed-in account's place. Self-starting on first use
 * rather than from main.js: only this one page reads it, and a church that
 * never opens the Bible should not pay for the subscription.
 */
const start = () => {
  if (started) return
  started = true

  const { user } = useAuth()

  watch(
    () => user.value?.uid || null,
    (now) => {
      unsubscribe?.()
      unsubscribe = null
      uid.value = now

      if (!now) {
        place.value = null
        return
      }

      place.value = readCache(now)

      unsubscribe = subscribeToUserPrefs(now, (prefs) => {
        // A failed read leaves whatever is on screen alone rather than
        // throwing the reader back to Genesis.
        if (!prefs) return
        const saved = clean(prefs[PREF_KEY])
        if (saved) {
          place.value = saved
          writeCache(now, saved)
        }
      })
    },
    { immediate: true }
  )
}

export function useBiblePlace() {
  start()

  /**
   * Records a chapter as the place. Called on every chapter turn, which is at
   * most a few writes a sitting — cheap enough not to need debouncing, and
   * debouncing would lose the last chapter of a session to the page closing.
   */
  const remember = (slug, chapter) => {
    const next = clean({ slug, chapter })
    if (!next) return
    if (place.value?.slug === next.slug && place.value?.chapter === next.chapter) return

    place.value = next
    if (!uid.value) return // Nobody to save it against; it lasts the session.
    writeCache(uid.value, next)
    saveUserPrefs(uid.value, { [PREF_KEY]: next }).catch((error) =>
      console.error('Error saving Bible place:', error)
    )
  }

  return { place, remember }
}

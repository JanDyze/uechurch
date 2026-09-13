/**
 * Every album the gallery can show: the ones with photos in them, and one for
 * each gathering that has happened and has none yet.
 *
 * Nothing here writes. A gathering's album is computed from the calendar on
 * every render and only becomes a `gallery_albums` document when somebody puts
 * the first photo in it — the same bargain the calendar makes with a recurring
 * occurrence, and the Minutes list with a meeting nobody has opened. Writing an
 * album per Sunday up front would leave a document behind for every service
 * nobody photographed, and an empty album is indistinguishable from one whose
 * photos were lost.
 *
 * One-off events have always been offered this way. Weekly services were not:
 * the page read the `events` collection alone, so the Sunday service — the
 * gathering most photos are taken at — only had an album if somebody typed one.
 * They are expanded here with the same rule the calendar and the digest use.
 */

import { computed, onMounted, onUnmounted, ref } from 'vue'
import { subscribeToAlbums } from '../api/galleryService'
import { subscribeToEvents } from '../api/eventsService'
import { useRecurringSchedules } from './useRecurringSchedules'
import { isCalledOff } from '../../lib/eventStatus'
import {
  DEFAULT_TIMEZONE,
  addDays,
  collectOccurrences,
  formatLongDate,
  formatMonth,
  zonedDateString,
} from '../../lib/occurrences'

/**
 * How far back a weekly schedule is expanded. A schedule does not say when it
 * started, so walking it back further would invent services from before it
 * existed; half a year is long enough for somebody catching up on photos.
 */
const RECURRING_REACH_DAYS = 183

/**
 * How long an empty album stays on the list without being searched for.
 * Photos go up in the days after a gathering, and a season of weekly services
 * with nothing in them would bury the albums that do have something. Older
 * ones are still there — a search reaches all of them.
 */
export const RECENT_EMPTY_DAYS = 56

const typeLabel = (type) =>
  type ? `${type.charAt(0).toUpperCase()}${type.slice(1)}` : 'General'

/** A gathering, in the shape of an album that has not been created yet. */
const derivedAlbum = ({ key, matchIds, title, type, date, location, description }) => ({
  id: `ev-${key}`,
  derivedId: `ev-${key}`,
  // What gets stored on the album once it is created, so it finds its way
  // back to this row.
  calendarEventId: key,
  matchIds,
  title: title || 'Untitled',
  description: description || '',
  category: typeLabel(type),
  date: date || '',
  location: location || '',
  coverUrl: '',
  isCalendarEvent: true,
  existsInGallery: false,
})

/**
 * The words an album can be found by that are not already on it: its month,
 * its long date, and whether it has anything in it. "empty" is how a manager
 * finds the gatherings still waiting for photos without a filter drawer.
 */
export const matchesAlbumQuery = (album, query) => {
  const terms = String(query || '').toLowerCase().split(/\s+/).filter(Boolean)
  if (!terms.length) return true

  const haystack = [
    album.title,
    album.category,
    album.location,
    album.description,
    formatMonth(album.date),
    formatLongDate(album.date),
    album.hasPhotos ? 'photos' : 'empty no photos',
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  return terms.every((term) => haystack.includes(term))
}

export function useGalleryAlbums() {
  const storedAlbums = ref([])
  const events = ref([])
  const albumsLoaded = ref(false)
  const eventsLoaded = ref(false)
  const { schedules, loading: schedulesLoading } = useRecurringSchedules()

  let unsubscribeAlbums = null
  let unsubscribeEvents = null

  onMounted(() => {
    unsubscribeAlbums = subscribeToAlbums((data) => {
      storedAlbums.value = data
      albumsLoaded.value = true
    })
    unsubscribeEvents = subscribeToEvents((data) => {
      events.value = data
      eventsLoaded.value = true
    })
  })

  onUnmounted(() => {
    unsubscribeAlbums?.()
    unsubscribeEvents?.()
  })

  const loading = computed(
    () => !albumsLoaded.value || !eventsLoaded.value || schedulesLoading.value
  )

  // Manila, not the device, for the same reason the calendar uses it: a phone
  // left on another timezone should not decide whether tonight has happened.
  const today = computed(() => zonedDateString(new Date(), DEFAULT_TIMEZONE))

  const gatherings = computed(() => {
    const rows = []

    // Typed events, however old — there are few enough of them, and they were
    // offered all the way back before this. Left out: anything called off or
    // deleted from the calendar (a hidden override), and birthdays, which are
    // somebody's day rather than a gathering anyone photographs.
    for (const event of events.value) {
      if (!event.date || event.date > today.value) continue
      if (event.hidden || isCalledOff(event)) continue
      if (event.memberId || String(event.overrideOf || '').startsWith('birthday-')) continue

      const firestoreId = event.firestoreId || event.id
      rows.push(
        derivedAlbum({
          // An edited occurrence of a weekly service is filed under the
          // occurrence rather than the edit, so reinstating the original — which
          // deletes the edit — does not strand the photos taken at it.
          key: event.overrideOf || firestoreId,
          matchIds: [firestoreId, event.overrideOf].filter(Boolean),
          title: event.title,
          type: event.type,
          date: event.date,
          location: event.location,
          description: event.description,
        })
      )
    }

    // Weekly services, expanded by the shared rule. Stored events are passed in
    // only so an edited date is not listed twice; they were handled above.
    const from = addDays(today.value, -RECURRING_REACH_DAYS)
    for (const occurrence of collectOccurrences(
      { events: events.value, schedules: schedules.value },
      from,
      today.value
    )) {
      if (occurrence.source !== 'recurring') continue
      rows.push(
        derivedAlbum({
          key: occurrence.id,
          matchIds: [occurrence.id],
          title: occurrence.title,
          type: occurrence.type,
          date: occurrence.date,
          location: occurrence.location,
          description: occurrence.description,
        })
      )
    }

    return rows
  })

  const albums = computed(() => {
    const combined = [...gatherings.value]

    storedAlbums.value.forEach((album) => {
      // An album fills in the gathering it was shot at, so the page shows one
      // entry rather than two. Two guards on that, both load-bearing:
      //
      //   item.isCalendarEvent — only a gathering row may be filled in. Without
      //     it an album matched the *album* already sitting in the row and
      //     replaced it, so several albums sharing a title and date collapsed
      //     into a single tile showing only the last of them. The rest were on
      //     the page nowhere: not openable, and so not deletable either.
      //
      //   !item.existsInGallery — one album per gathering. A row already filled
      //     is taken, and a second album pointing at the same gathering gets
      //     its own entry rather than evicting the first.
      //
      // Title and date is the fallback for albums made before they carried a
      // calendarEventId.
      const index = combined.findIndex(
        (item) =>
          item.isCalendarEvent &&
          !item.existsInGallery &&
          ((album.calendarEventId && item.matchIds.includes(album.calendarEventId)) ||
            (item.title === album.title && item.date === album.date))
      )
      if (index !== -1) {
        combined[index] = { ...combined[index], ...album, existsInGallery: true }
      } else {
        combined.push({ ...album, isCalendarEvent: false, existsInGallery: true, matchIds: [] })
      }
    })

    return combined
      .map((album) => ({
        ...album,
        // A cover is written with the first photo and cleared with the last, so
        // it is the one field that says "there is something in here" without
        // reading every photo document to count them.
        hasPhotos: album.existsInGallery && Boolean(album.coverUrl),
      }))
      .sort(
        (a, b) =>
          String(b.date).localeCompare(String(a.date)) || a.title.localeCompare(b.title)
      )
  })

  /** Finds an album by its current id, or by the gathering id it started as. */
  const findAlbum = (id) =>
    id ? albums.value.find((album) => album.id === id || album.derivedId === id) || null : null

  return { albums, loading, today, findAlbum }
}

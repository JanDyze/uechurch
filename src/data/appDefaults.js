// Starting values only. They are written into appSettings/church the first
// time an administrator opens the Church tab, and after that Firestore is the
// only source of truth — so a different congregation can rename everything
// without touching code. Nothing in the app reads these once the document
// exists; they are also the fallback while it is still loading.

export const DEFAULT_CHURCH = {
  // Short name: sidebar, sign-in screen, browser title, spreadsheet headers.
  shortName: 'UEC Canubing II',
  // Legal name and branch: the letterhead on printed and exported documents.
  fullName: 'United Evangelical Church Philippines Inc.',
  branch: 'Canubing II Outreach',
  // Base64 webp uploaded from Settings. Empty means "use the bundled logo",
  // which is what a fresh install and every fallback path renders.
  logo: '',
  // Optional dark-mode version. When empty, the main logo is reused.
  logoDark: '',
}

// The public page at "/" — what a visitor who is not signed in sees. Like the
// church identity above, these are only the starting values: everything here is
// editable under Settings > Public page, so the page never needs a code change.
// The parts a congregation cannot share honestly by default (service times,
// address, phone) start empty, and their sections stay hidden until filled in
// rather than showing invented details.
export const DEFAULT_LANDING = {
  // Turning this off sends "/" straight to the sign-in screen, for an install
  // that is only ever used as an internal tool.
  enabled: true,
  tagline: 'A place to belong.',
  intro:
    'Wherever you are on your journey, there is room for you here. Come as you are — we would love to meet you this week.',
  // Base64 webp uploaded from Settings. Empty means the bundled photo, and it
  // is only the fallback: the hero rotates through the shared album photos
  // below whenever there are any.
  heroImage: '',
  // Whether the gallery feeds the public page at all. On, the hero rotates
  // through photographs picked at random from every album and the "Life at
  // church" strip fills itself; off, no gallery photo is reachable from the
  // public page and the hero falls back to the one uploaded above.
  showPhotos: true,
  // The albums that stay behind the sign-in — the meeting minutes shot on
  // somebody's phone, the album that was only ever a test. Everything not
  // listed here is public, so this is the exception rather than the rule.
  hiddenAlbums: [],
  // Whether the "What's coming up" list is published. Titles and times only:
  // the endpoint never publishes a gathering's location, because a small group
  // meets at somebody's house.
  showEvents: true,
  // [{ name, when, note }] — rendered in the order they are added.
  services: [],
  aboutTitle: 'Who we are',
  about: '',
  address: '',
  mapUrl: '',
  phone: '',
  email: '',
  facebook: '',
}

/**
 * Stored settings over the starting values above. Exported because two callers
 * need the same merge: useAppSettings, reading Firestore as a signed-in member,
 * and usePublicSite, reading what the server publishes to a visitor.
 *
 * `services` is a list, so it is replaced wholesale rather than merged — an
 * admin who removes the last one means the section to disappear.
 */
export const withChurchDefaults = (church) => ({ ...DEFAULT_CHURCH, ...(church || {}) })

export const withLandingDefaults = (landing) => ({
  ...DEFAULT_LANDING,
  ...(landing || {}),
  services: Array.isArray(landing?.services) ? landing.services : DEFAULT_LANDING.services,
  hiddenAlbums: Array.isArray(landing?.hiddenAlbums) ? landing.hiddenAlbums : [],
})

export const DEFAULT_CATEGORIES = {
  gallery: ['Worship', 'Outreach', 'Fellowship', 'Special Events', 'Minutes Photos'],
  links: ['Video', 'Social', 'Resource', 'Worship', 'Document', 'Official', 'Design'],
  songs: ['Praise', 'Worship', 'Hymnal'],
  eventTypes: [
    'worship',
    'prayer',
    'meeting',
    'fellowship',
    'outreach',
    'training',
    'celebration',
    'special',
  ],
}

/** The lists above are the selectable values; "All" is a filter affordance the
 *  views prepend themselves, so it is never stored or editable. */
export const withAllOption = (list = []) => ['All', ...list]

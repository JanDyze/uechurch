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
  // Base64 webp uploaded from Settings. Empty means the bundled photo.
  heroImage: '',
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

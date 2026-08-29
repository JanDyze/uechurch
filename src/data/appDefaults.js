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

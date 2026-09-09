// Starting values only. They are written into appSettings/church the first
// time an administrator opens the Church tab, and after that Firestore is the
// only source of truth — so a different congregation can rename everything
// without touching code. Nothing in the app reads these once the document
// exists; they are also the fallback while it is still loading.

export const DEFAULT_CHURCH = {
  // Short name: sidebar, sign-in screen, browser title, spreadsheet headers.
  shortName: 'UECPCOM',
  // Legal name and branch: the letterhead on printed and exported documents.
  // The acronym already carries the city: UECP, then COM for Calapan Oriental
  // Mindoro. So the full name is the letterhead, and the branch is the local
  // congregation under it — which is what the public header shows as a
  // subtitle beneath the short name.
  fullName: 'United Evangelical Church of the Philippines – Calapan, Oriental Mindoro',
  branch: 'Canubing II',
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
  // No headline setting any more: the hero greets whoever is reading by name
  // — ate, kuya, nanay, or their own if they are signed in — and that is not
  // a line one congregation writes differently from another. This paragraph
  // sits under it and is still theirs to change.
  intro: 'Bago ka pa dumating, may silya nang nakahanda para sa iyo.',

  // The greeting at the top of the page rolls through the names somebody at
  // the door would actually use. Editable because a congregation may well say
  // it differently — a Visayan church would want Manoy and Inday in here, and
  // a church that finds one of these too familiar should be able to drop it
  // without a code change. A signed-in member sees their own name instead.
  welcomeTerms: [
    // Brothers and sisters, and where you fall among them
    'Ate',
    'Kuya',
    'Bunso',
    'Panganay',
    'Kapatid',
    // The ones who raised you
    'Nanay',
    'Tatay',
    'Inay',
    'Itay',
    'Mama',
    'Papa',
    'Lolo',
    'Lola',
    // Aunts and uncles, both ways of saying it
    'Tita',
    'Tito',
    'Tiya',
    'Tiyo',
    // The family you get at a baptism rather than at birth
    'Ninong',
    'Ninang',
    'Kumare',
    'Kumpare',
    // Further out along the tree
    'Anak',
    'Apo',
    'Pinsan',
    'Bayaw',
    'Hipag',
    // What the provinces up north would call you
    'Manong',
    'Manang',
    // Not blood, but close enough to count
    'Kaibigan',
    'Kababayan',
    'Kapitbahay',
    'Kapamilya',
    'Bes',
  ],
  // What follows the name. Two versions: a stranger is being welcomed, a
  // member who has signed in is being welcomed back.
  welcomeLine: 'welcome ka dito.',
  welcomeLineMember: 'welcome ulit!',

  // The verse the church gathers on, in the band under the hero. Empty hides
  // the band rather than leaving a coloured stripe with nothing in it.
  verse:
    'Sapagkat kung saan may dalawa o tatlong nagkakatipon sa aking pangalan, ako ay naroroon sa gitna nila.',
  verseReference: 'Mateo 18:20',

  // Why the church is here. Either may be left empty; with both empty the
  // section goes.
  vision: 'Isang simbahang sumasamba, lumalago, at namumunga sa Canubing II.',
  mission: 'Ihatid ang Ebanghelyo, palaguin ang mananampalataya, paglingkuran ang kapwa.',

  // Punla, Puno, Prutas — the discipleship process, as [{ stage, note }].
  // Three by default because that is what this church teaches, but the page
  // draws however many are given a name.
  path: [
    { stage: 'Punla', note: 'Pagsisimula kay Kristo.' },
    { stage: 'Puno', note: 'Nag-uugat sa Salita.' },
    { stage: 'Prutas', note: 'Namumunga sa kapwa.' },
  ],

  // The last word on the page, above the footer.
  closingTitle: 'May lugar para sa iyo rito.',
  closingBody: 'Masaya kaming makilala ka sa linggong ito.',
  // Base64 webp uploaded from Settings. Empty means the bundled photo. This is
  // the one static picture in the hero arch — the hero no longer crossfades
  // through gallery photos, so nothing above the fold waits on the network.
  heroImage: '',
  // Whether the gallery feeds the public page at all. On, the "Buhay sa
  // simbahan" strip fills itself from photographs picked at random across every
  // album — all of them lazy and below the fold; off, no gallery photo is
  // reachable from the public page.
  showPhotos: true,
  // The albums that stay behind the sign-in — the meeting minutes shot on
  // somebody's phone, the album that was only ever a test. Everything not
  // listed here is public, so this is the exception rather than the rule.
  hiddenAlbums: [],
  // Whether the floating "Upcoming" dock is fed at all. Titles and times
  // only: the endpoint never publishes a gathering's location, because a small
  // group meets at somebody's house. Off, the dock does not appear.
  showEvents: true,
  // Whether members' birthdays join that list.
  //
  // Off by default, and the only setting here that defaults to off: everything
  // else on this page is the church talking about itself, but a birthday is
  // somebody's personal information, and publishing a hundred of them to the
  // open internet is a decision a person should make rather than inherit. Only
  // the name they are called by and the day travel — never a surname, never a
  // year, so never an age.
  showBirthdays: false,
  // [{ name, when, note }] — rendered in the order they are added.
  services: [],
  aboutTitle: 'Sino kami',
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
  // An admin who empties the name list means the greeting to stop rolling, not
  // to fall back to a list of names they deleted — so an array, even an empty
  // one, is taken at its word. Only a missing key gets the default.
  welcomeTerms: Array.isArray(landing?.welcomeTerms)
    ? landing.welcomeTerms
    : DEFAULT_LANDING.welcomeTerms,
  path: Array.isArray(landing?.path) ? landing.path : DEFAULT_LANDING.path,
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

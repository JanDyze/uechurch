// The event-icon vocabulary, shared by everything that needs it.
//
// Deliberately dependency-free so all three consumers can import it:
//   - src/utils/eventIcons.js  adds the Phosphor Vue components on top
//   - scripts/build-event-icons.mjs  rasterises RASTERISED to PNG
//   - lib/digest.js and api/notify.js  build <img>/notification icon URLs
//
// A serverless function must never pull in @phosphor-icons/vue, so the Vue
// half lives in src/ and only this pure half is shared.

export const DEFAULT_EVENT_ICON = 'CalendarBlank'

/**
 * Events saved before the move from lucide to Phosphor hold lucide names.
 * Most words carry over unchanged (Church, Cake, Heart, Star), so only the
 * ones Phosphor spells differently are listed. An unmapped old name falls
 * through to the default rather than vanishing.
 */
export const LEGACY_ALIASES = {
  Calendar: 'CalendarBlank',
  CalendarDays: 'CalendarBlank',
  CalendarCheck2: 'CalendarCheck',
  Music: 'MusicNotes',
  Music2: 'MusicNote',
  Music4: 'MusicNotes',
  Mic: 'Microphone',
  Mic2: 'Microphone',
  BookOpenText: 'BookOpen',
  BookMarked: 'BookBookmark',
  PartyPopper: 'Confetti',
  Sparkles: 'Sparkle',
  HeartHandshake: 'Handshake',
  HelpingHand: 'Handshake',
  Utensils: 'ForkKnife',
  UtensilsCrossed: 'ForkKnife',
  ShoppingBasket: 'Basket',
  Users2: 'Users',
  UsersRound: 'Users',
  Flame: 'Fire',
  Clipboard: 'ClipboardText',
  ClipboardList: 'ClipboardText',
}

/**
 * The icon each event type falls back to when none was chosen explicitly.
 * Keys match the eventTypes vocabulary in src/data/appDefaults.js.
 */
export const TYPE_ICONS = {
  worship: 'Church',
  prayer: 'HandsPraying',
  meeting: 'ClipboardText',
  fellowship: 'Users',
  outreach: 'Heart',
  training: 'BookOpen',
  celebration: 'Confetti',
  special: 'Sparkle',
}

/**
 * The icons that exist as PNGs under public/icons/events.
 *
 * Rasterising all ~1500 Phosphor icons would bloat every deployment to serve
 * an email that shows one of them, so this is the curated set: every value in
 * TYPE_ICONS, the birthday and default marks, and the icons a church is
 * actually likely to pick. `npm run build:icons` reads this list, and
 * pngNameFor() falls back within it, so the two can never drift.
 */
export const RASTERISED = [
  ...new Set([
    ...Object.values(TYPE_ICONS),
    'Cake',
    DEFAULT_EVENT_ICON,
    'Calendar',
    'CalendarCheck',
    'MusicNotes',
    'MusicNote',
    'Microphone',
    'Guitar',
    'BookBookmark',
    'Cross',
    'CrownCross',
    'Student',
    'GraduationCap',
    'Baby',
    'HandHeart',
    'Basket',
    'ForkKnife',
    'Coffee',
    'Gift',
    'Bell',
    'Megaphone',
    'Camera',
    'Video',
    'MapPin',
    'Bus',
    'Sun',
    'Moon',
    'Star',
    'Flower',
    'Handshake',
    'PersonSimpleRun',
    'SoccerBall',
    'Tent',
    'Fire',
    'Lightbulb',
    'Trophy',
    'Heart',
  ]),
]

const RASTERISED_SET = new Set(RASTERISED)

/** Applies the legacy alias table. Does not check the icon exists. */
export const aliasIconName = (name) =>
  (name && LEGACY_ALIASES[name]) || name || DEFAULT_EVENT_ICON

/** The icon an event should display: its own, else its type's, else calendar. */
export const iconForEvent = (event) => {
  if (!event) return DEFAULT_EVENT_ICON
  if (event.isBirthday || event.source === 'birthday') return 'Cake'
  return aliasIconName(event.icon || TYPE_ICONS[event.type] || DEFAULT_EVENT_ICON)
}

/** ClipboardText -> clipboard-text, the asset filename Phosphor ships. */
export const toKebabCase = (name) =>
  String(name)
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase()

/**
 * The icon to use where only a PNG will do — digest emails, where Gmail
 * strips <svg>, and push notifications, where FCM takes a URL.
 *
 * Steps down to something that definitely exists on disk rather than emitting
 * a URL that 404s: the chosen icon, then the event type's, then the default.
 */
export const pngNameFor = (event) => {
  const chosen = iconForEvent(event)
  if (RASTERISED_SET.has(chosen)) return chosen
  const byType = TYPE_ICONS[event?.type]
  if (byType && RASTERISED_SET.has(byType)) return byType
  return DEFAULT_EVENT_ICON
}

/** Absolute-from-root path to the pre-rendered PNG for an event. */
export const eventIconPngPath = (event) => `/icons/events/${toKebabCase(pngNameFor(event))}.png`

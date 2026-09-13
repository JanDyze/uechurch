// One vocabulary for event-type colour, in the four shapes the pages need: a
// filled badge (calendar chips and date tiles), a bar segment, a legend dot
// (the summary's type mix) and a text colour (a figure tinted to match the
// gathering it belongs to, on Attendance).
//
// Six components each carried their own copy of the badge map before this, so
// a colour added for a new type reached some screens and not others. Keys match
// the eventTypes vocabulary in src/data/appDefaults.js.

const TYPE_COLORS = {
  worship: {
    badge: "bg-blue-500 text-white",
    bar: "bg-blue-500",
    dot: "bg-blue-500",
    text: "text-blue-600 dark:text-blue-400",
  },
  prayer: {
    badge: "bg-purple-500 text-white",
    bar: "bg-purple-500",
    dot: "bg-purple-500",
    text: "text-purple-600 dark:text-purple-400",
  },
  meeting: {
    badge: "bg-slate-500 text-white",
    bar: "bg-slate-500",
    dot: "bg-slate-500",
    text: "text-slate-600 dark:text-slate-300",
  },
  fellowship: {
    badge: "bg-teal-500 text-white",
    bar: "bg-teal-500",
    dot: "bg-teal-500",
    text: "text-teal-600 dark:text-teal-400",
  },
  outreach: {
    badge: "bg-orange-500 text-white",
    bar: "bg-orange-500",
    dot: "bg-orange-500",
    text: "text-orange-600 dark:text-orange-400",
  },
  training: {
    badge: "bg-green-500 text-white",
    bar: "bg-green-500",
    dot: "bg-green-500",
    text: "text-green-600 dark:text-green-400",
  },
  celebration: {
    badge: "bg-pink-500 text-white",
    bar: "bg-pink-500",
    dot: "bg-pink-500",
    text: "text-pink-600 dark:text-pink-400",
  },
  special: {
    badge: "bg-amber-500 text-white",
    bar: "bg-amber-500",
    dot: "bg-amber-500",
    text: "text-amber-600 dark:text-amber-400",
  },
};

// An admin can add an event type in Settings at any time, so an unknown type
// has to render as something rather than as nothing.
const FALLBACK = {
  badge: "bg-gray-500 text-white",
  bar: "bg-gray-500",
  dot: "bg-gray-500",
  text: "text-gray-600 dark:text-gray-300",
};

// A gathering that has already happened is greyed out wholesale, whatever it was.
const PAST_BADGE = "bg-gray-400 text-white";

const colorsFor = (type) => TYPE_COLORS[type] || FALLBACK;

/** Filled chip/tile background plus its text colour. */
export const getEventTypeColor = (type, isPast = false) =>
  isPast ? PAST_BADGE : colorsFor(type).badge;

/** Background alone, for a bar segment. */
export const getEventTypeBar = (type) => colorsFor(type).bar;

/** Background alone, for a legend dot or a density pip. */
export const getEventTypeDot = (type) => colorsFor(type).dot;

/** Foreground alone, for a number that should carry its gathering's colour. */
export const getEventTypeText = (type) => colorsFor(type).text;

/** Stored types are lowercase; every screen that shows one title-cases it. */
export const eventTypeLabel = (type) =>
  type ? type.charAt(0).toUpperCase() + type.slice(1) : "Other";

// A gathering that is called off — cancelled or postponed — in the shapes the
// pages need. Red, and muted rather than filled: it has to be the first thing
// read on a row somebody is deciding whether to turn up for, but a solid block
// beside every struck-through title shouted louder than the gatherings that
// are actually happening. It used to be amber, which on this app already means
// "needs your attention" — a record with gaps, an unrecorded service — and a
// cancelled service is not asking anybody to do anything.
//
// The strike-through and the dropped type colour stay alongside it: the red
// says what happened, the de-emphasis says it is not one to plan around.
// Home and the attendance row spell the badge out inline rather than importing
// it; keep the three in step.

/** Small label naming the state — "Cancelled", "Postponed", "Off". */
export const CALLED_OFF_BADGE = "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300";

/** A block saying what happened, border colour included; add a border width. */
export const CALLED_OFF_BANNER =
  "border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300";

/**
 * The dashed edge of a hollow chip or disc standing in for the type colour.
 * Border colour only — add a width, and a text colour to suit: a glyph can
 * carry the red, a struck-through title reads better grey.
 */
export const CALLED_OFF_OUTLINE = "border-dashed border-red-300 dark:border-red-400/50";

/** Foreground alone, for a glyph or a status line. */
export const CALLED_OFF_TEXT = "text-red-600 dark:text-red-400";

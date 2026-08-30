// One vocabulary for event-type colour, in the three shapes the pages need: a
// filled badge (calendar chips and date tiles), a bar segment and a legend dot
// (the summary's type mix).
//
// Six components each carried their own copy of the badge map before this, so
// a colour added for a new type reached some screens and not others. Keys match
// the eventTypes vocabulary in src/data/appDefaults.js.

const TYPE_COLORS = {
  worship: { badge: "bg-blue-500 text-white", bar: "bg-blue-500", dot: "bg-blue-500" },
  prayer: { badge: "bg-purple-500 text-white", bar: "bg-purple-500", dot: "bg-purple-500" },
  meeting: { badge: "bg-slate-500 text-white", bar: "bg-slate-500", dot: "bg-slate-500" },
  fellowship: { badge: "bg-teal-500 text-white", bar: "bg-teal-500", dot: "bg-teal-500" },
  outreach: { badge: "bg-orange-500 text-white", bar: "bg-orange-500", dot: "bg-orange-500" },
  training: { badge: "bg-green-500 text-white", bar: "bg-green-500", dot: "bg-green-500" },
  celebration: { badge: "bg-pink-500 text-white", bar: "bg-pink-500", dot: "bg-pink-500" },
  special: { badge: "bg-amber-500 text-white", bar: "bg-amber-500", dot: "bg-amber-500" },
};

// An admin can add an event type in Settings at any time, so an unknown type
// has to render as something rather than as nothing.
const FALLBACK = { badge: "bg-gray-500 text-white", bar: "bg-gray-500", dot: "bg-gray-500" };

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

/** Stored types are lowercase; every screen that shows one title-cases it. */
export const eventTypeLabel = (type) =>
  type ? type.charAt(0).toUpperCase() + type.slice(1) : "Other";

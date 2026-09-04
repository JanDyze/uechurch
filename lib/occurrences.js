// Server-side expansion of the calendar.
//
// The Events page is not just the `events` collection: most of what shows up
// there is generated on the fly from the weekly `recurringSchedules` and from
// member birthdays (see src/composables/useRecurringEvents.js and
// useBirthdayEvents.js). A digest built from stored documents alone would miss
// the Sunday service entirely, so the same two rules are re-applied here.
//
// Everything works on `YYYY-MM-DD` strings assembled from local date parts.
// `new Date("2026-08-30")` parses as UTC midnight, which lands on the wrong day
// for anyone east or west of Greenwich, and this file runs on a server whose
// clock is UTC while the church it reports on is not.

/**
 * The church's own timezone. Every "today" in a digest is resolved in it.
 *
 * Read through a guard because this module is imported by the browser too —
 * useRecurringEvents and useRecurringSchedules expand the same rules the digest
 * does, so that the Events page and the email never disagree about which
 * Sundays a schedule falls on. `process` does not exist there, and reaching for
 * it threw before the router had finished starting, taking the whole app down.
 * The override is a server concern anyway; the browser wants the default.
 */
const envTimezone =
  typeof process !== "undefined" ? process.env?.DIGEST_TIMEZONE : undefined;

export const DEFAULT_TIMEZONE = envTimezone || "Asia/Manila";

/** `YYYY-MM-DD` for `date` as it reads on a wall clock in `timeZone`. */
export const zonedDateString = (date = new Date(), timeZone = DEFAULT_TIMEZONE) =>
  // en-CA formats as YYYY-MM-DD, which is exactly the shape stored in Firestore
  new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

/** A Date at local midnight of a `YYYY-MM-DD` string, or null if unparseable. */
export const parseDateString = (value) => {
  const [year, month, day] = String(value || "").split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

export const toDateString = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;

export const addDays = (dateString, days) => {
  const date = parseDateString(dateString);
  if (!date) return dateString;
  date.setDate(date.getDate() + days);
  return toDateString(date);
};

/** First and last day of the month `dateString` falls in. */
export const monthBounds = (dateString) => {
  const date = parseDateString(dateString) || new Date();
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { start: toDateString(start), end: toDateString(end) };
};

/** Which occurrence of its weekday this date is within the month (1st, 2nd...). */
const weekdayOccurrence = (date) => Math.ceil(date.getDate() / 7);

/**
 * "Whichever is the last one this month" — stored in a schedule's
 * `occurrences` alongside the plain numbers.
 *
 * A church that meets on the last Sunday of the month means the 5th in a month
 * that has five and the 4th in a month that has four. Numbering alone could not
 * say that: picking 5 skipped the short months, and picking 4 and 5 ran the
 * thing twice in the long ones.
 */
export const LAST_OCCURRENCE = "last";

/** Whether `date` is the final occurrence of its own weekday in its month. */
export const isLastWeekdayOfMonth = (date) => {
  const sameWeekdayNextWeek = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + 7
  );
  return sameWeekdayNextWeek.getMonth() !== date.getMonth();
};

/**
 * Whether a schedule set to run on `occurrences` covers `date`. An empty list
 * means every occurrence, which is what a weekly service is.
 *
 * Shared by the calendar and the digest on purpose: a service the app shows on
 * the 30th and the email leaves out is worse than either being wrong alone.
 */
export const matchesOccurrence = (date, occurrences = []) => {
  if (!occurrences.length) return true;
  if (occurrences.includes(weekdayOccurrence(date))) return true;
  return occurrences.includes(LAST_OCCURRENCE) && isLastWeekdayOfMonth(date);
};

/**
 * What a schedule is additionally *doing* on `date` — communion on the first
 * Sunday, the birthday bash on the last.
 *
 * These are not gatherings of their own. Communion happens inside the Sunday
 * service: modelling it as a second schedule would put a second entry on the
 * calendar and a second row on the attendance page for one room of people, and
 * whoever recorded it would have to pick which of the two to fill in. So an
 * occasion decorates the occurrence the schedule already generates, and the
 * identity of that occurrence — the id attendance is recorded against — does
 * not change.
 */
export const occasionsOn = (schedule, date) =>
  (Array.isArray(schedule?.occasions) ? schedule.occasions : [])
    .filter(
      (occasion) =>
        occasion?.label &&
        matchesOccurrence(date, Array.isArray(occasion.occurrences) ? occasion.occurrences : [])
    )
    .map((occasion) => occasion.label);

/** "Sunday Service · Communion" — one gathering, told what it is that week. */
export const occurrenceTitle = (title, occasions = []) =>
  [title, ...occasions].filter(Boolean).join(" · ");

/** Every `YYYY-MM-DD` from `from` to `to` inclusive. */
export const datesBetween = (from, to) => {
  const start = parseDateString(from);
  const end = parseDateString(to);
  if (!start || !end || end < start) return [];
  const out = [];
  for (const cursor = start; cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    out.push(toDateString(cursor));
  }
  return out;
};

const normalizeStoredEvent = (data, id) => ({
  id: data.id || id,
  firestoreId: id,
  title: data.title || "",
  // Deliberately not defaulted: the calendar falls back to "worship" for a
  // document with no type, but a digest that labels an elders meeting as
  // worship is simply wrong. Absent stays absent, and the badge is omitted.
  type: data.type || "",
  date: data.date || "",
  time: data.time || "09:00",
  location: data.location || "",
  description: data.description || "",
  overrideOf: data.overrideOf || null,
  isCancelled: Boolean(data.isCancelled),
});

/**
 * Merges stored events, generated weekly occurrences and birthdays into one
 * date-ordered list covering `from`..`to` inclusive.
 *
 * A stored event carrying `overrideOf` replaces the generated entry it names,
 * exactly as the calendar does - otherwise an edited Sunday service would be
 * listed twice. Cancelled events drop out of the digest altogether.
 */
export const collectOccurrences = ({ events = [], schedules = [], members = [] }, from, to) => {
  const stored = events.map((e) => normalizeStoredEvent(e.data || e, e.id));
  const overridden = new Set(stored.map((e) => e.overrideOf).filter(Boolean));

  const collected = stored
    .filter((e) => e.date >= from && e.date <= to && !e.isCancelled)
    .map((e) => ({ ...e, source: "event" }));

  // Only members with a usable birthday, pre-split so the day loop stays cheap
  const birthdays = members
    .map((m) => {
      const data = m.data || m;
      const [year, month, day] = String(data.dateOfBirth || "").split("-").map(Number);
      if (!year || !month || !day) return null;
      return {
        memberId: m.id,
        key: `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
        bornYear: year,
        firstName: data.firstName || "",
        lastName: data.lastName || "",
        nickname: data.nickname || "",
      };
    })
    .filter(Boolean);

  const activeSchedules = schedules
    .map((s) => ({ id: s.id, ...(s.data || s) }))
    .filter((s) => s.enabled !== false);

  for (const dateString of datesBetween(from, to)) {
    const date = parseDateString(dateString);
    const weekday = date.getDay();
    const year = date.getFullYear();

    for (const schedule of activeSchedules) {
      if ((typeof schedule.weekday === "number" ? schedule.weekday : 0) !== weekday) continue;
      const weeks = Array.isArray(schedule.occurrences) ? schedule.occurrences : [];
      if (!matchesOccurrence(date, weeks)) continue;

      const virtualId = `recurring-${schedule.id}-${dateString}`;
      if (overridden.has(virtualId)) continue;

      collected.push({
        id: virtualId,
        scheduleId: schedule.id,
        title: occurrenceTitle(schedule.title || "", occasionsOn(schedule, date)),
        type: schedule.type || "",
        date: dateString,
        time: schedule.time || "09:00",
        location: schedule.location || "",
        description: schedule.description || "",
        source: "recurring",
      });
    }

    const monthDay = dateString.slice(5);
    for (const birthday of birthdays) {
      if (birthday.key !== monthDay) continue;

      const virtualId = `birthday-${birthday.memberId}-${year}`;
      if (overridden.has(virtualId)) continue;

      const displayName = birthday.nickname || birthday.firstName || "A member";
      const fullName = [birthday.firstName, birthday.lastName].filter(Boolean).join(" ").trim();
      collected.push({
        id: virtualId,
        personName: displayName,
        title: `${displayName}'s Birthday`,
        type: "celebration",
        date: dateString,
        time: "",
        location: "",
        description: `${fullName || displayName} turns ${year - birthday.bornYear}`,
        source: "birthday",
      });
    }
  }

  collected.sort(
    (a, b) => a.date.localeCompare(b.date) || (a.time || "").localeCompare(b.time || "")
  );
  return collected;
};

/** "9:00 AM" from "09:00"; empty string for an all-day entry. */
export const formatTime = (time) => {
  if (!time) return "";
  const [h, m] = String(time).split(":");
  const hour = Number(h);
  if (!Number.isFinite(hour)) return "";
  const suffix = hour >= 12 ? "PM" : "AM";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:${m ?? "00"} ${suffix}`;
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** "Sunday, 30 August 2026" */
export const formatLongDate = (dateString) => {
  const date = parseDateString(dateString);
  if (!date) return dateString || "";
  return `${WEEKDAYS[date.getDay()]}, ${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
};

/** "Sun 30 Aug" - for list rows where the year is already established. */
export const formatShortDate = (dateString) => {
  const date = parseDateString(dateString);
  if (!date) return dateString || "";
  return `${WEEKDAYS[date.getDay()].slice(0, 3)} ${date.getDate()} ${MONTHS[date.getMonth()].slice(0, 3)}`;
};

/** "Sunday" from 0 - the weekday numbering schedules are stored with. */
export const weekdayName = (weekday) => WEEKDAYS[weekday] || "";

/** "Sun 3" - for lists inside one month, where the month is already given. */
export const formatDayInMonth = (dateString) => {
  const date = parseDateString(dateString);
  if (!date) return dateString || "";
  return `${WEEKDAYS[date.getDay()].slice(0, 3)} ${date.getDate()}`;
};

/** "August 2026" */
export const formatMonth = (dateString) => {
  const date = parseDateString(dateString);
  if (!date) return "";
  return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
};

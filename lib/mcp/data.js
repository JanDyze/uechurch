// Shared reads and shaping for the MCP tools.
//
// Every tool ultimately asks Firestore the same handful of questions — who is
// on the roll, what is on the calendar, what does this id refer to — so the
// reads live here once rather than in fourteen handlers. Two things matter:
//
//   1. Nothing pulls a whole document when a projection will do. A member
//      document can carry a base64 portrait and a gallery photo *is* one; a
//      tool that lists thirty people must not move thirty pictures to print
//      thirty names.
//   2. Member ids are two things at once. The app writes a numeric `id` on the
//      document and Firestore gives it a string document id, and references
//      across the app — a lineup's leaderId, a small group's memberIds, a
//      minute's attendees — were written against whichever was to hand. The
//      index below is keyed by both, exactly as the components resolve them.
import { db } from "../firebaseAdmin.js";
import { zonedDateString, DEFAULT_TIMEZONE } from "../occurrences.js";

export const TZ = DEFAULT_TIMEZONE;

/** Today where the church is, not where the server is. */
export const today = () => zonedDateString();

export const docsOf = (snapshot) => snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

export const isDateString = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));

/**
 * A date argument, or the fallback. Anything that is not a plain YYYY-MM-DD is
 * refused rather than coerced: `new Date("last sunday")` is Invalid Date, and
 * a range built from one silently returns nothing at all.
 */
export const dateArg = (value, fallback) => {
  if (value === undefined || value === null || value === "") return fallback;
  if (!isDateString(value)) throw new Error(`Not a date: "${value}". Use YYYY-MM-DD.`);
  return String(value);
};

export const shiftDays = (dateString, days) => {
  const [y, m, d] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
};

export const clampLimit = (value, fallback, max) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.trunc(n), max);
};

/** Case- and accent-insensitive contains, for the free-text `query` arguments. */
export const matches = (haystack, needle) => {
  if (!needle) return true;
  const fold = (s) =>
    String(s ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  return fold(haystack).includes(fold(needle));
};

/* --------------------------------------------------------------- caching */
/*
 * A warm function instance may serve a whole conversation's worth of tool
 * calls, and most of them want the members collection to turn an id into a
 * name. Half a minute is short enough that an edit made in the app shows up
 * in the next question, and long enough that "who leads which group, and when
 * are their birthdays" is one read rather than four.
 */
const TTL_MS = 30_000;
const cache = new Map();

export async function cached(key, load) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  const value = await load();
  cache.set(key, { at: Date.now(), value });
  return value;
}

/* --------------------------------------------------------------- members */

// Everything except `image`, which is the only field on a member document big
// enough to matter, and `relatives`, which only get_member has a use for.
const MEMBER_FIELDS = [
  "id",
  "firstName",
  "lastName",
  "nickname",
  "sex",
  "dateOfBirth",
  "civilStatus",
  "address",
  "contactNumber",
  "occupation",
  "ministries",
  "tags",
  "isMember",
];

export const loadMembers = () =>
  cached("members", async () => {
    const snapshot = await db().collection("members").select(...MEMBER_FIELDS).get();
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: data.id ?? doc.id,
        docId: doc.id,
        firstName: data.firstName || "",
        lastName: data.lastName || "",
        nickname: data.nickname || "",
        sex: data.sex || "",
        dateOfBirth: data.dateOfBirth || null,
        civilStatus: data.civilStatus || "",
        address: data.address || "",
        contactNumber: data.contactNumber || "",
        occupation: data.occupation || "",
        ministries: Array.isArray(data.ministries) ? data.ministries : [],
        tags: Array.isArray(data.tags) ? data.tags : [],
        isMember: data.isMember !== false,
      };
    });
  });

/** Keyed by both ids, because references across the app use either. */
export const indexMembers = (members) => {
  const index = new Map();
  for (const member of members) {
    index.set(String(member.id), member);
    index.set(String(member.docId), member);
  }
  return index;
};

export const fullName = (member) =>
  member ? [member.firstName, member.lastName].filter(Boolean).join(" ").trim() : "";

/** What to call someone in a sentence: the name they answer to. */
export const shortName = (member) =>
  member ? member.nickname || member.firstName || fullName(member) : "";

/** Resolves a reference to a name, and says so plainly when it cannot. */
export const nameOf = (index, id) => {
  if (id === null || id === undefined || id === "") return "";
  const member = index.get(String(id));
  return member ? fullName(member) : `Unknown member (${id})`;
};

export const ageOn = (dateOfBirth, on = today()) => {
  if (!isDateString(dateOfBirth)) return null;
  const [by, bm, bd] = dateOfBirth.split("-").map(Number);
  const [ny, nm, nd] = on.split("-").map(Number);
  let age = ny - by;
  if (nm < bm || (nm === bm && nd < bd)) age -= 1;
  return age >= 0 ? age : null;
};

/* ----------------------------------------------------------------- money */

/**
 * Centavos as pesos. The ledger only ever stores an integer count of centavos,
 * so the division happens once, here, at the edge where a number becomes
 * something a person reads.
 */
export const peso = (centavos) => {
  const sign = centavos < 0 ? "-" : "";
  const abs = Math.abs(Math.trunc(Number(centavos) || 0));
  const whole = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}\u20b1${whole}.${String(abs % 100).padStart(2, "0")}`;
};

/* ------------------------------------------------------------ timestamps */

/** Firestore Timestamps do not survive JSON.stringify in any useful form. */
export const asDate = (value) => {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate().toISOString().slice(0, 10);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return typeof value === "string" ? value : null;
};

/**
 * Long free text, cut to something a tool result can carry.
 *
 * Minutes and event descriptions are written in a rich-text editor and stored
 * as HTML. Left alone, a summary reaches the model as more markup than words \u2014
 * a paragraph of list tags costing tokens and saying nothing. A tag becomes a
 * space rather than nothing at all, so a list does not run its items together
 * into one long word.
 */
export const excerpt = (text, max = 600) => {
  const clean = String(text || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  return clean.length > max ? `${clean.slice(0, max)}\u2026` : clean;
};

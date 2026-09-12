import { computed, ref, watch } from "vue";
import { AGE_BANDS, UNKNOWN_BAND, ageOf, groupByBand } from "../utils/ageBands";

/**
 * How the People list is arranged.
 *
 * Sorting a roll is really two questions — what order, and under what
 * headings — and they are not independent. The list has always been divided
 * into age bands, which is how this church talks about itself and how the
 * summary bar and the attendance recorder divide it too. But you cannot group
 * by age band and by ministry at once, and "who is in the choir" is a real
 * question this list should be able to answer.
 *
 * So every sort brings its own headings, and they are always the categories of
 * the thing being sorted by:
 *
 *   first / last name   A, B, C
 *   age                 the age bands — kids, youth, adults, seniors
 *   birthday            the month, starting at this one
 *   ministry, tag       one heading per ministry or per tag
 *   recently added      no headings, and see below
 *
 * "Recently added" is the exception, and not by choice: a member record carries
 * no created timestamp, so there is nothing truthful to head the sections with.
 * "This month" would be a guess. It is ordered newest-first and left flat until
 * the record starts carrying a date.
 *
 * Somebody in two ministries appears under both. That is the point of the
 * view: it answers "who serves here", and a person who serves in two places
 * belongs in both lists.
 */

const SORT_KEY = "uec.people.sortBy";

export const SORT_OPTIONS = [
  { key: "name", label: "First name", hint: "Under A, B, C" },
  { key: "lastName", label: "Last name", hint: "Under A, B, C" },
  { key: "age", label: "Age", hint: "Under kids, youth, adults, seniors" },
  { key: "birthday", label: "Birthday", hint: "Under the month, this one first" },
  { key: "ministry", label: "Ministry", hint: "Under each ministry" },
  { key: "tag", label: "Tag", hint: "Under each tag" },
  { key: "recent", label: "Recently added", hint: "Newest on the roll first" },
];

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** A neutral marker for headings that are not the age bands' own colours. */
const PLAIN_DOT = "bg-gray-300 dark:bg-gray-600";

const readStoredSort = () => {
  try {
    const stored = localStorage.getItem(SORT_KEY);
    return SORT_OPTIONS.some((o) => o.key === stored) ? stored : "name";
  } catch {
    return "name";
  }
};

const text = (value) => String(value || "").trim().toLowerCase();

/** Alphabetical by full name — the fallback order inside every heading. */
const byName = (a, b) =>
  text(`${a.firstName} ${a.lastName}`).localeCompare(text(`${b.firstName} ${b.lastName}`));

/**
 * How many sleeps until the next one. A birthday is a day and a month — the
 * year on the record is when they were born, not when to expect the cake — so
 * it is compared as day-of-year, rolling into next year once it has passed.
 */
const daysUntilBirthday = (member) => {
  const iso = member?.dateOfBirth;
  if (!iso) return Infinity;
  const dob = new Date(iso);
  if (Number.isNaN(dob.getTime())) return Infinity;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const next = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
  if (next < today) next.setFullYear(next.getFullYear() + 1);
  return Math.round((next - today) / 86400000);
};

/**
 * Insertion order, near enough. A member record carries no created timestamp,
 * but `id` is assigned as max+1 when somebody is added, so a higher id is a
 * later arrival. Imported records reflect the order of the import, which is
 * still roughly when they entered the books.
 */
const addedRank = (member) => {
  const n = typeof member?.id === "number" ? member.id : parseInt(member?.id, 10);
  return Number.isFinite(n) ? n : -1;
};

/** Whichever of a member's ministries or tags sorts first, for a flat order. */
const firstOf = (list) =>
  (Array.isArray(list) ? list : []).map(text).filter(Boolean).sort()[0] || "";

const comparators = {
  name: byName,
  lastName: (a, b) =>
    text(`${a.lastName} ${a.firstName}`).localeCompare(text(`${b.lastName} ${b.firstName}`)),
  // Ages that are not on the record sort last rather than as zero: a blank is
  // a gap, not a newborn.
  age: (a, b) => (ageOf(a) ?? Infinity) - (ageOf(b) ?? Infinity),
  recent: (a, b) => addedRank(b) - addedRank(a),
  birthday: (a, b) => daysUntilBirthday(a) - daysUntilBirthday(b),
  ministry: (a, b) => (firstOf(a.ministries) || "￿").localeCompare(firstOf(b.ministries) || "￿"),
  tag: (a, b) => (firstOf(a.tags) || "￿").localeCompare(firstOf(b.tags) || "￿"),
};

/** The letter somebody files under; anything not A-Z shares a "#" heading. */
const initialOf = (value) => {
  const first = String(value || "").trim().charAt(0).toUpperCase();
  return first >= "A" && first <= "Z" ? first : "#";
};

/** A, B, C — in the order the already-sorted list hands them over. */
const groupByInitial = (members, field) => {
  const sections = [];
  let current = null;

  members.forEach((member) => {
    const letter = initialOf(member[field]);
    if (!current || current.band.label !== letter) {
      current = { band: { key: `initial:${letter}`, label: letter, dotClass: PLAIN_DOT }, members: [] };
      sections.push(current);
    }
    current.members.push(member);
  });

  return sections;
};

/**
 * Birthdays under their month, this month first and round the year from there,
 * so the next cake is at the top. Each month appears exactly once: somebody
 * whose birthday fell earlier this month still files under this month, they
 * just sort to the end of it.
 */
const groupByBirthMonth = (members) => {
  const thisMonth = new Date().getMonth();
  const buckets = new Map();
  const undated = [];

  members.forEach((member) => {
    const dob = member?.dateOfBirth ? new Date(member.dateOfBirth) : null;
    if (!dob || Number.isNaN(dob.getTime())) {
      undated.push(member);
      return;
    }
    const month = dob.getMonth();
    if (!buckets.has(month)) buckets.set(month, []);
    buckets.get(month).push(member);
  });

  const sections = [];
  for (let step = 0; step < 12; step += 1) {
    const month = (thisMonth + step) % 12;
    const list = buckets.get(month);
    if (!list) continue;
    // Within a month it is the day that matters, not who is older.
    list.sort((a, b) => new Date(a.dateOfBirth).getDate() - new Date(b.dateOfBirth).getDate());
    sections.push({
      band: { key: `month:${month}`, label: MONTHS[month], dotClass: PLAIN_DOT },
      members: list,
    });
  }

  if (undated.length) {
    sections.push({
      band: { key: "month:none", label: "Birthday not set", dotClass: PLAIN_DOT },
      members: undated,
    });
  }

  return sections;
};

/** Sections keyed on a multi-valued field, alphabetical, "none" last. */
const groupByValues = (members, field, emptyLabel) => {
  const buckets = new Map();
  const without = [];

  members.forEach((member) => {
    const values = (Array.isArray(member[field]) ? member[field] : []).filter(Boolean);
    if (!values.length) {
      without.push(member);
      return;
    }
    values.forEach((value) => {
      if (!buckets.has(value)) buckets.set(value, []);
      buckets.get(value).push(member);
    });
  });

  // Inside a ministry the outer sort has nothing left to say — it ordered
  // people by their first ministry, which is the same for everyone here — so
  // the names read alphabetically.
  const sections = [...buckets.entries()]
    .sort(([a], [b]) => text(a).localeCompare(text(b)))
    .map(([value, list]) => ({
      band: { key: `${field}:${value}`, label: value, dotClass: "bg-primary" },
      members: [...list].sort(byName),
    }));

  if (without.length) {
    sections.push({
      band: { key: `${field}:none`, label: emptyLabel, dotClass: PLAIN_DOT },
      members: [...without].sort(byName),
    });
  }

  return sections;
};

export function useMemberSorting() {
  const sortBy = ref(readStoredSort());
  const sortOrder = ref("asc");
  const familyMemberSort = ref("age");

  watch(sortBy, (value) => {
    try {
      localStorage.setItem(SORT_KEY, value);
    } catch {
      /* the preference lasts the session */
    }
  });

  const currentSort = computed(
    () => SORT_OPTIONS.find((o) => o.key === sortBy.value) || SORT_OPTIONS[0]
  );

  /** The flat, ordered list — what the counts, export and tagging work from. */
  const sortMembers = (members) => {
    const compare = comparators[sortBy.value] || comparators.name;
    // Ties fall back to name so the order is stable and reads alphabetically
    // inside a ministry, a band, or a shared birthday.
    return [...members].sort((a, b) => compare(a, b) || comparators.name(a, b));
  };

  /** The same list cut into the sections the current sort implies. */
  const arrangeMembers = (members) => {
    if (!members.length) return [];
    if (sortBy.value === "name") return groupByInitial(members, "firstName");
    if (sortBy.value === "lastName") return groupByInitial(members, "lastName");
    if (sortBy.value === "age") return groupByBand(members);
    if (sortBy.value === "birthday") return groupByBirthMonth(members);
    if (sortBy.value === "ministry") return groupByValues(members, "ministries", "No ministry");
    if (sortBy.value === "tag") return groupByValues(members, "tags", "No tags");
    // Recently added: no honest heading exists yet, so it stays one list.
    return [{ band: null, members }];
  };

  // Sort family members
  const sortFamilyMembers = (familyMembers) => {
    const sorted = [...familyMembers];
    sorted.sort((a, b) => {
      if (familyMemberSort.value === "name") return comparators.name(a, b);
      if (familyMemberSort.value === "age") return (b.age || 0) - (a.age || 0);
      if (familyMemberSort.value === "dateOfBirth") {
        return new Date(a.dateOfBirth || 0) - new Date(b.dateOfBirth || 0);
      }
      return 0;
    });
    return sorted;
  };

  return {
    sortBy,
    sortOrder,
    sortOptions: SORT_OPTIONS,
    currentSort,
    familyMemberSort,
    sortMembers,
    arrangeMembers,
    sortFamilyMembers,
  };
}

export { AGE_BANDS, UNKNOWN_BAND };

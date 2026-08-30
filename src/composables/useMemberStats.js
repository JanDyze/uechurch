import { computed } from "vue";
import { calculateAgeFromDate } from "../utils/memberUtils";

// The bands ministries actually plan around, not even decades.
const AGE_BANDS = [
  { key: "kids", label: "Kids", upTo: 12, barClass: "bg-sky-400 dark:bg-sky-500", dotClass: "bg-sky-400 dark:bg-sky-500" },
  { key: "youth", label: "Youth", upTo: 25, barClass: "bg-emerald-400 dark:bg-emerald-500", dotClass: "bg-emerald-400 dark:bg-emerald-500" },
  { key: "adults", label: "Adults", upTo: 59, barClass: "bg-amber-400 dark:bg-amber-500", dotClass: "bg-amber-400 dark:bg-amber-500" },
  { key: "seniors", label: "Seniors", upTo: Infinity, barClass: "bg-violet-400 dark:bg-violet-500", dotClass: "bg-violet-400 dark:bg-violet-500" },
];

// A stored age wins over the birth date: it is what the rest of the app shows,
// and some records carry an age with no birth date at all.
const ageOf = (member) => {
  if (typeof member.age === "number" && Number.isFinite(member.age)) return member.age;
  const derived = calculateAgeFromDate(member.dateOfBirth);
  return Number.isFinite(derived) ? derived : null;
};

const birthMonthOf = (member) => {
  if (!member.dateOfBirth) return null;
  const date = new Date(member.dateOfBirth);
  return Number.isNaN(date.getTime()) ? null : date.getMonth();
};

export function useMemberStats(members) {
  const stats = computed(() => {
    const thisMonth = new Date().getMonth();

    const result = {
      total: members.value.length,
      members: 0,
      attendees: 0,
      male: 0,
      female: 0,
      birthdays: 0,
      unknownAge: 0,
      bands: AGE_BANDS.map((band) => ({ ...band, count: 0 })),
    };

    members.value.forEach((member) => {
      if (member.isMember) result.members += 1;
      else result.attendees += 1;

      const sex = (member.sex || "").toLowerCase();
      if (sex === "male") result.male += 1;
      else if (sex === "female") result.female += 1;

      if (birthMonthOf(member) === thisMonth) result.birthdays += 1;

      const age = ageOf(member);
      if (age === null) result.unknownAge += 1;
      else result.bands.find((band) => age <= band.upTo).count += 1;
    });

    return result;
  });

  // Only people with a known age can be placed on the bar, so the segments are
  // shares of that group rather than of everyone.
  const agedTotal = computed(() => stats.value.total - stats.value.unknownAge);

  const birthdayMonthLabel = computed(() =>
    new Date().toLocaleDateString(undefined, { month: "long" })
  );

  return { stats, agedTotal, birthdayMonthLabel };
}

import { computed } from "vue";
// The bands live in utils/ageBands.js because this page is no longer the only
// screen that groups people by age — the attendance recorder checks people off
// under the same headings, and the two have to agree.
import { AGE_BANDS, ageOf } from "../utils/ageBands";

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

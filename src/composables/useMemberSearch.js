import { computed } from "vue";
import { missingMemberDetails } from "../utils/memberUtils";

// Everything a member can be found by. Narrowing used to live in a filter
// drawer; the search bar is now the only control, so the haystack has to cover
// every detail someone might type - tags, sex, civil status, job, address -
// not just the name.
const buildHaystack = (member) => {
  const missing = missingMemberDetails(member);

  const parts = [
    member.firstName,
    member.lastName,
    member.nickname,
    member.contactNumber,
    member.email,
    member.address,
    member.occupation,
    member.sex,
    member.civilStatus,
    member.age,
    member.dateOfBirth,
    ...(Array.isArray(member.tags) ? member.tags : []),
    // Plurals are indexed alongside the singular because matching is
    // substring-based - "members" would otherwise find nobody. "attendee"
    // also keeps a search for "member" off them, the way "non-member" could
    // never manage.
    member.isMember ? "member members" : "attendee attendees",
    // The attention badge would otherwise be a mark with nothing behind it:
    // there are no filters on this page, so searching is the only way to
    // gather the thin records up and work through them. "incomplete" finds
    // them all, "missing birthday" narrows to one kind.
    ...missing.map((label) => `missing ${label}`),
    missing.length ? "incomplete" : "",
    // Indexed apart from the gaps above because it is a different question,
    // and phrased every way it might be typed - matching is substring-based,
    // so one string covers "no contact", "no number" and "missing contact".
  ];

  return parts
    .filter((part) => part !== null && part !== undefined && part !== "")
    .join(" ")
    .toLowerCase();
};

export function useMemberSearch(members, searchQuery) {
  // Get all unique tags from members
  const allTags = computed(() => {
    const tagSet = new Set();
    members.value.forEach((member) => {
      if (member.tags && Array.isArray(member.tags)) {
        member.tags.forEach((tag) => tagSet.add(tag));
      }
    });
    return Array.from(tagSet).sort();
  });

  // Rebuilt when the member list changes, not on every keystroke.
  const searchIndex = computed(() =>
    members.value.map((member) => ({ member, haystack: buildHaystack(member) }))
  );

  // Every word has to match something, so "single teacher" keeps narrowing
  // instead of widening the way an OR search would.
  const filteredMembers = computed(() => {
    const terms = searchQuery.value.toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return members.value;

    return searchIndex.value
      .filter(({ haystack }) => terms.every((term) => haystack.includes(term)))
      .map(({ member }) => member);
  });

  return {
    allTags,
    filteredMembers,
  };
}

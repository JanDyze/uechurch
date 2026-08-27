// Member utility functions
export const getFullName = (member) => {
  return `${member.firstName} ${member.lastName}`;
};

export const getAvatarUrl = (member) => {
  // If member has a custom image (base64), use it
  if (member.image) {
    return member.image;
  }
  // Otherwise, use generated avatar
  const name = member.nickname || `${member.firstName} ${member.lastName}`;
  return `https://api.dicebear.com/9.x/dylan/svg?seed=${encodeURIComponent(
    name
  )}`;
};

export const getSexIcon = (sex) => {
  return sex === "Male" ? "♂" : "♀";
};

export const getSexIconColor = (sex) => {
  return sex === "Male"
    ? "text-blue-600 dark:text-blue-400"
    : "text-pink-600 dark:text-pink-400";
};

export const getRelativeLabel = (relation) => {
  const labels = {
    brother: "Brother",
    sister: "Sister",
    spouse: "Spouse",
    father: "Father",
    mother: "Mother",
    son: "Son",
    daughter: "Daughter",
  };
  return labels[relation] || relation;
};

export const getFamilyRoleLabel = (role) => {
  const labels = {
    Father: "Father",
    Mother: "Mother",
    Spouse: "Spouse",
    Child: "Child",
    Son: "Son",
    Daughter: "Daughter",
    Brother: "Brother",
    Sister: "Sister",
  };
  return labels[role] || role;
};

// Common ministry roles offered as ready-to-pick tags, even before anyone
// has been tagged with them yet (allTags is otherwise only ever derived
// from tags already present on existing members).
export const PRESET_MINISTRY_TAGS = [
  "Song Leader",
  "Usher",
  "Instrumentalist",
  "Preacher",
  "SG Leader",
];

export const mergeWithPresetTags = (existingTags = [], extraTags = []) => {
  const merged = [...PRESET_MINISTRY_TAGS];
  const lowerSet = new Set(merged.map((t) => t.toLowerCase()));
  [...extraTags, ...existingTags].forEach((tag) => {
    if (tag && !lowerSet.has(tag.toLowerCase())) {
      merged.push(tag);
      lowerSet.add(tag.toLowerCase());
    }
  });
  return merged.sort((a, b) => a.localeCompare(b));
// Returns "" rather than "Invalid Date" for missing/unparseable dates
export const formatBirthDate = (dateOfBirth) => {
  if (!dateOfBirth) return "";
  const date = new Date(dateOfBirth);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString();
};

export const calculateAgeFromDate = (dateOfBirth) => {
  if (!dateOfBirth) return undefined;
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};


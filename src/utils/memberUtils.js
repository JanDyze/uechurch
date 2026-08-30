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

// Avatar for a signed-in account rather than a member record: Google hands us
// a real photo, everyone else gets the same generated face they see in the
// topbar, seeded by uid so it follows them across devices.
export const getAccountAvatarUrl = (account) => {
  if (account?.photoURL) return account.photoURL;
  const seed = account?.uid || account?.id || "UEC";
  return `https://api.dicebear.com/9.x/dylan/svg?seed=${encodeURIComponent(seed)}`;
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

// Seed content ONLY: written into the memberTags collection once, the first
// time an administrator opens the tags page on an empty database. After that
// the collection is the sole source of truth, so a church can rename or delete
// any of these. Nothing in the app re-adds them.
// The four options every member form offers. Universal enough to live in code,
// but it was copy-pasted into three components before this.
export const CIVIL_STATUS_OPTIONS = [
  { value: 'Single', label: 'Single' },
  { value: 'Married', label: 'Married' },
  { value: 'Widowed', label: 'Widowed' },
  { value: 'Separated', label: 'Separated' },
];

/**
 * Starter ministries — what someone does in the church. These are the only
 * things that grant access, so the list is a controlled vocabulary managed in
 * Settings, not free text (see src/api/ministriesService.js).
 */
export const DEFAULT_MINISTRIES = [
  "Song Leader",
  "Usher",
  "Instrumentalist",
  "Preacher",
  "SG Leader",
];

/**
 * Retained under its old name for the one-off migration in
 * scripts/migrate-ministries.mjs, which needs to recognise which of a
 * member's existing `tags` were really ministries. Nothing else should use it.
 */
export const LEGACY_MINISTRY_TAGS = DEFAULT_MINISTRIES;

/**
 * The tags offered when assigning to a member: the ones registered in Settings,
 * plus any string already typed onto an existing member (which is still legal —
 * tags are a free-text array on the member document, and deliberately grant
 * nothing; ministries are the thing that carries permissions).
 */
export const mergeTagSources = (existingTags = [], registeredTags = []) => {
  const merged = [];
  const lowerSet = new Set();
  [...registeredTags, ...existingTags].forEach((tag) => {
    if (tag && !lowerSet.has(tag.toLowerCase())) {
      merged.push(tag);
      lowerSet.add(tag.toLowerCase());
    }
  });
  return merged.sort((a, b) => a.localeCompare(b));
};

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


/**
 * The details every person definitively has, so a blank one is always a gap in
 * the record rather than a fact about the person. That distinction is the
 * whole reason a contact number is NOT on this list: plenty of people —
 * children especially — genuinely have no phone, and a badge that fires on
 * them would be crying wolf on most of the roster within a year. Missing
 * numbers are counted on their own tile instead, where the number is
 * information rather than an accusation.
 *
 * Kept short for the same reason. Occupation, nickname and photo all have
 * fallbacks or no consequence when blank, and civil status is written onto
 * every new record by the add form.
 *
 * Order matters — it is the order the labels are read out in.
 */
export const IMPORTANT_MEMBER_DETAILS = [
  { key: "dateOfBirth", label: "birthday" },
  { key: "address", label: "address" },
  { key: "sex", label: "sex" },
];

/** Absent, or present but empty — an imported record is full of "   ". */
export const isBlankDetail = (value) =>
  value === null ||
  value === undefined ||
  (typeof value === "string" && value.trim() === "");

/**
 * Which important details this member has not got, as readable labels.
 *
 * `age` is deliberately not accepted in place of `dateOfBirth`: a record can
 * carry an age with no birth date, which is enough for the age bands but not
 * enough to greet anyone on the day.
 */
export const missingMemberDetails = (member = {}) =>
  IMPORTANT_MEMBER_DETAILS.filter(({ key }) => isBlankDetail(member[key])).map(({ label }) => label);

/**
 * "birthday and address", "birthday, address and sex" — a phrase that drops
 * straight into a sentence, because the badge's job is to say what is missing
 * without having to be opened.
 */
export const listPhrase = (items = []) => {
  if (items.length <= 1) return items[0] || "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
};

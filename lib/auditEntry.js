// The shape of an audit log entry's description of a change, shared by the app
// (src/api/firestore.js) and the server (lib/audit.js) so an entry reads the
// same whichever of them wrote it. Pure: no Firestore, no Vue.

export const AUDIT_COLLECTION = "auditLog";

const PREVIEW_LENGTH = 120;
const MAX_FIELDS = 40;

/**
 * A value as a short string, readable in a list. Photographs are named rather
 * than copied, so a base64 upload cannot turn one entry into a megabyte.
 */
export const preview = (value) => {
  if (value === null || value === undefined) return String(value);
  if (typeof value === "string") {
    if (value.startsWith("data:")) return "[image]";
    return value.length > PREVIEW_LENGTH ? `${value.slice(0, PREVIEW_LENGTH)}…` : value;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  // serverTimestamp(), arrayUnion() and friends carry the name of what they do.
  if (typeof value?._methodName === "string") return `[${value._methodName}]`;
  if (typeof value?.toDate === "function") return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  try {
    const text = JSON.stringify(value);
    return text.length > PREVIEW_LENGTH ? `${text.slice(0, PREVIEW_LENGTH)}…` : text;
  } catch {
    return "[value]";
  }
};

/** Whatever the record calls itself, so an entry reads "Ana Cruz" and not an id. */
export const labelOf = (data) => {
  if (!data || typeof data !== "object") return "";
  const name = [data.firstName, data.lastName].filter(Boolean).join(" ");
  return String(data.title || data.name || name || data.eventTitle || data.label || "").slice(
    0,
    PREVIEW_LENGTH
  );
};

/** The fields written, and a preview of each. */
export const describeData = (data) => {
  if (!data || typeof data !== "object") return { fields: [], changes: {} };
  const fields = Object.keys(data).slice(0, MAX_FIELDS);
  const changes = {};
  fields.forEach((key) => {
    changes[key] = preview(data[key]);
  });
  return { fields, changes };
};

export const topCollection = (path) => String(path || "").split("/")[0];

export { MAX_FIELDS };

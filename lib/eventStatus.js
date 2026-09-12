// Whether a gathering is still on, and if not, what happened to it.
//
// Three states, each meaning exactly one thing:
//
//   scheduled   it is on
//   cancelled   it is not happening at all
//   postponed   it is not happening then — it has moved, or will
//
// Before this there was one boolean, `isCancelled`, and it did not mean "this
// was called off". It meant "hide this generated occurrence from the
// calendar": a cancelled Sunday service simply vanished, which is the one
// thing a church must not do with a service people are expecting. Calling it
// off and never saying so is how somebody drives to a locked building.
//
// So `status` carries the meaning now and `isCancelled` is kept written
// alongside it, true for BOTH cancelled and postponed, because everything that
// reads the old flag — the public site, the emailed digest, the MCP tools,
// lib/occurrences.js — is asking "is this happening?", and for both of those
// the answer is no. Nothing downstream has to change to stay correct.
//
// Dependency-free: the app, the serverless functions and the digest all use it.

export const EVENT_STATUS = {
  SCHEDULED: "scheduled",
  CANCELLED: "cancelled",
  POSTPONED: "postponed",
};

const KNOWN = new Set([EVENT_STATUS.CANCELLED, EVENT_STATUS.POSTPONED]);

/**
 * The status of an event, reading a record written before the field existed.
 * A legacy `isCancelled` document was somebody calling that occurrence off, so
 * that is what it is reported as.
 */
export const readEventStatus = (event) => {
  const status = String(event?.status || "").toLowerCase();
  if (KNOWN.has(status)) return status;
  return event?.isCancelled ? EVENT_STATUS.CANCELLED : EVENT_STATUS.SCHEDULED;
};

/** True when the gathering is not happening on its date, whatever the reason. */
export const isCalledOff = (event) => readEventStatus(event) !== EVENT_STATUS.SCHEDULED;

export const eventStatusLabel = (status) => {
  if (status === EVENT_STATUS.CANCELLED) return "Cancelled";
  if (status === EVENT_STATUS.POSTPONED) return "Postponed";
  return "";
};

/**
 * The fields to write. `isCancelled` is derived rather than passed, so the two
 * can never disagree — the bug that shape is designed to make impossible.
 *
 * Reinstating clears every one of them rather than deleting the keys: an
 * update with a missing key leaves the old value in place in Firestore, and a
 * service that stayed cancelled because the field was merely absent from the
 * payload is exactly the failure this is meant to prevent.
 */
export const eventStatusFields = ({ status, note = "", movedTo = "" } = {}) => {
  const next = KNOWN.has(status) ? status : EVENT_STATUS.SCHEDULED;
  const off = next !== EVENT_STATUS.SCHEDULED;
  return {
    status: off ? next : "",
    statusNote: off ? String(note || "").trim() : "",
    // Only a postponement has somewhere to move to.
    postponedTo: next === EVENT_STATUS.POSTPONED ? String(movedTo || "") : "",
    isCancelled: off,
  };
};

/** One line saying what happened, for a badge's tooltip or a drawer's banner. */
export const eventStatusSummary = (event) => {
  const status = readEventStatus(event);
  if (status === EVENT_STATUS.SCHEDULED) return "";

  const parts = [eventStatusLabel(status)];
  if (status === EVENT_STATUS.POSTPONED && event?.postponedTo) {
    parts.push(`moved to ${event.postponedTo}`);
  }
  if (event?.statusNote) parts.push(event.statusNote);
  return parts.join(" · ");
};

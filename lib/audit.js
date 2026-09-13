// Audit entries for changes made on the server, where src/api/firestore.js
// cannot see them. Today that is the MCP connector: it writes with the Admin
// SDK, which Firestore's rules do not apply to, so the only record of what a
// conversation changed is the one written here.
//
// Written after the change rather than in the same batch: a tool's writes are
// spread across helpers that each commit on their own, and threading one batch
// through all of them would be a rewrite of every tool. The Admin SDK does not
// lose a write to a dropped phone signal the way the app can, which is the
// failure the app's same-batch rule exists for. If the entry itself fails, the
// tool still reports its failure to write it rather than hiding it.
import { FieldValue } from "firebase-admin/firestore";
import { db } from "./firebaseAdmin.js";
import { AUDIT_COLLECTION, describeData } from "./auditEntry.js";

/** add_member → create, update_event → update, record_attendance → update. */
const actionFor = (toolName) => (String(toolName).startsWith("add_") || toolName === "create_event" ? "create" : "update");

/**
 * @param tool    the tool's name
 * @param args    what it was called with
 * @param result  what it answered — the id and name of the record, usually
 * @param actor   { uid, name }
 */
export const auditToolWrite = async ({ tool, args, result, actor }) => {
  const { fields, changes } = describeData(args);
  await db()
    .collection(AUDIT_COLLECTION)
    .add({
      at: FieldValue.serverTimestamp(),
      actorUid: actor?.uid || "",
      actorName: actor?.name || "",
      actorEmail: "",
      action: actionFor(tool),
      collection: "",
      path: "",
      docId: String(result?.documentId || result?.id || ""),
      label: String(result?.name || result?.title || "").slice(0, 120),
      fields,
      changes,
      page: "",
      tool,
      source: "mcp",
    });
};

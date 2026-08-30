#!/usr/bin/env node
/**
 * Clears the `attendance` collection for a clean start on the new
 * source/sourceId/occurrenceKey shape.
 *
 * Every record is written to a timestamped JSON file next to this script
 * BEFORE anything is deleted. Deletion is not reversible and this is real
 * attendance history, so the backup is not optional and not a flag.
 *
 * Small group attendance is untouched: it lives inline on `sgSessions`
 * alongside the lesson and prayer requests, not in this collection.
 *
 * --keep names a date to spare, so re-running this after a real recording
 * cannot quietly wipe it. Without it, everything goes.
 *
 *   node scripts/reset-attendance.mjs                       # dry run + backup
 *   node scripts/reset-attendance.mjs --write               # delete everything
 *   node scripts/reset-attendance.mjs --keep=2026-08-30 --write
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BACKUP_DIR = path.join(ROOT, "backups");
const WRITE = process.argv.includes("--write");
const KEEP = (process.argv.find((a) => a.startsWith("--keep=")) || "").slice(7);

if (KEEP && !/^\d{4}-\d{2}-\d{2}$/.test(KEEP)) {
  throw new Error(`--keep must be a YYYY-MM-DD date, got "${KEEP}"`);
}

function loadEnv() {
  const file = path.join(ROOT, ".env");
  if (!fs.existsSync(file)) throw new Error("No .env file found");
  const env = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i > 0) env[line.slice(0, i).trim()] = line.slice(i + 1);
  }
  return env;
}

async function main() {
  const env = loadEnv();
  if (!env.FIREBASE_SERVICE_ACCOUNT) throw new Error("FIREBASE_SERVICE_ACCOUNT is not set in .env");
  const sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
  if (sa.private_key.includes("\\n")) sa.private_key = sa.private_key.replace(/\\n/g, "\n");
  initializeApp({ credential: cert(sa) });
  const db = getFirestore();

  const snap = await db.collection("attendance").get();
  if (snap.empty) {
    console.log("The attendance collection is already empty.");
    return;
  }

  const records = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const doomed = snap.docs.filter((d) => !KEEP || String(d.data().date || "") !== KEEP);
  const doomedIds = new Set(doomed.map((d) => d.id));

  console.log(`${records.length} record(s)${KEEP ? `, keeping ${KEEP}` : ""}:\n`);
  for (const r of records) {
    const present = r.totalAttendees ?? (r.attendees || []).length;
    console.log(
      `  ${doomedIds.has(r.id) ? "delete" : "  keep"}  ${String(r.eventTitle || "(untitled)").padEnd(24)} ${String(r.date || "").padEnd(12)} ${String(present).padStart(3)} present`
    );
  }

  if (doomed.length === 0) {
    console.log("\nNothing matches for deletion.");
    return;
  }

  // Timestamps are serialised through toDate() so the file is human-readable
  // and could be re-imported if it ever came to that.
  const replacer = (_key, value) =>
    value && typeof value === "object" && typeof value.toDate === "function"
      ? value.toDate().toISOString()
      : value;

  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backup = path.join(BACKUP_DIR, `attendance-${stamp}.json`);
  fs.writeFileSync(backup, JSON.stringify(records, replacer, 2));
  console.log(`\nBacked up to ${path.relative(ROOT, backup)} (${Math.round(fs.statSync(backup).size / 1024)} KB)`);

  if (!WRITE) {
    console.log(`\nDry run — nothing deleted. Re-run with --write to remove ${doomed.length} record(s).`);
    return;
  }

  let batch = db.batch();
  let pending = 0;
  for (const doc of doomed) {
    batch.delete(doc.ref);
    if (++pending >= 400) {
      await batch.commit();
      batch = db.batch();
      pending = 0;
    }
  }
  if (pending) await batch.commit();

  const kept = records.length - doomed.length;
  console.log(`\nDeleted ${doomed.length} record(s)${kept ? `, kept ${kept}` : ". Attendance starts clean."}`);
  console.log("Small group session attendance was not touched.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

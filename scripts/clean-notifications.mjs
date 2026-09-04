#!/usr/bin/env node
/**
 * Clears out the `notifications` history that the bell panel reads.
 *
 * Every entry sent before lib/notifications.js existed carries no `kind`, so
 * the panel cannot tell who it was meant for or what mark to draw beside it,
 * and most of them are the old "New event: ..." push that fired on
 * cancellations and edits alike. Those are what this clears by default.
 *
 * Everything is written to a timestamped JSON file next to this script BEFORE
 * anything is deleted, on the same reasoning as reset-attendance.mjs: deletion
 * is not reversible, so the backup is not a flag.
 *
 * This only touches the in-app history. Notifications already delivered to a
 * phone's tray are the phone's, and nothing here can reach them.
 *
 *   node scripts/clean-notifications.mjs              # dry run + backup
 *   node scripts/clean-notifications.mjs --write      # drop the untyped ones
 *   node scripts/clean-notifications.mjs --all --write  # drop everything
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { isKnownKind } from "../lib/notifications.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BACKUP_DIR = path.join(ROOT, "backups");
const WRITE = process.argv.includes("--write");
const ALL = process.argv.includes("--all");

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

  const snap = await db.collection("notifications").get();
  if (snap.empty) {
    console.log("The notifications history is already empty.");
    return;
  }

  const entries = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const doomed = snap.docs.filter((d) => ALL || !isKnownKind(d.data().kind));
  const doomedIds = new Set(doomed.map((d) => d.id));

  console.log(`${entries.length} entr${entries.length === 1 ? "y" : "ies"}:\n`);
  for (const e of entries) {
    const when = e.sentAt?.toDate?.().toISOString().slice(0, 16).replace("T", " ") || "—";
    console.log(
      `  ${doomedIds.has(e.id) ? "delete" : "  keep"}  ${when}  ${String(e.kind || "(untyped)").padEnd(18)} ${String(e.title || "").slice(0, 48)}`
    );
  }

  if (doomed.length === 0) {
    console.log("\nEvery entry carries a known kind — nothing to clean.");
    return;
  }

  const replacer = (_key, value) =>
    value && typeof value === "object" && typeof value.toDate === "function"
      ? value.toDate().toISOString()
      : value;

  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backup = path.join(BACKUP_DIR, `notifications-${stamp}.json`);
  fs.writeFileSync(backup, JSON.stringify(entries, replacer, 2));
  console.log(`\nBacked up to ${path.relative(ROOT, backup)}`);

  if (!WRITE) {
    console.log(
      `\nDry run — nothing deleted. Re-run with --write to remove ${doomed.length} entr${doomed.length === 1 ? "y" : "ies"}.`
    );
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

  const kept = entries.length - doomed.length;
  console.log(`\nDeleted ${doomed.length}${kept ? `, kept ${kept}` : ". The history starts clean."}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

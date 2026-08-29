#!/usr/bin/env node
/**
 * One-off migration: split the old combined `tags` field into `ministries`
 * (what someone does — the thing that grants access) and `tags` (free-text
 * labels that grant nothing).
 *
 * Every value on a member is classified:
 *   - matches a ministry name  -> moves to `ministries`
 *   - anything else            -> stays in `tags`
 *
 * Ministry names come from the `ministries` collection, the old `memberTags`
 * collection, any `rolePermissions` document (a tag that was granted access
 * was unambiguously being used as a ministry), and the built-in starter list.
 *
 * Runs read-only by default. Pass --write to apply.
 *
 *   node scripts/migrate-ministries.mjs
 *   node scripts/migrate-ministries.mjs --write
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WRITE = process.argv.includes("--write");

// Kept in step with DEFAULT_MINISTRIES in src/utils/memberUtils.js.
const STARTER_MINISTRIES = ["Song Leader", "Usher", "Instrumentalist", "Preacher", "SG Leader"];

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

  /* Build the set of names that count as a ministry */
  const [ministriesSnap, legacyTagsSnap, rolesSnap] = await Promise.all([
    db.collection("ministries").get(),
    db.collection("memberTags").get(),
    db.collection("rolePermissions").get(),
  ]);

  const known = new Map(); // lowercased -> canonical spelling
  const remember = (name) => {
    const trimmed = String(name || "").trim();
    if (trimmed) known.set(trimmed.toLowerCase(), trimmed);
  };

  STARTER_MINISTRIES.forEach(remember);
  ministriesSnap.docs.forEach((d) => remember(d.data().name));
  legacyTagsSnap.docs.forEach((d) => remember(d.data().name));
  // A tag that was granted capabilities was being used as a ministry, whatever
  // it was called — migrating it to a plain tag would silently revoke access.
  rolesSnap.docs.forEach((d) => remember(d.id));

  console.log(`Recognised ministries (${known.size}): ${[...known.values()].join(", ")}\n`);

  /* Classify every member's values */
  const members = await db.collection("members").select("tags", "ministries", "firstName", "lastName").get();

  const planned = [];
  for (const docSnap of members.docs) {
    const data = docSnap.data();
    const existing = Array.isArray(data.tags) ? data.tags : [];
    // Already migrated members keep whatever they have; re-running is a no-op.
    const alreadyMinistries = Array.isArray(data.ministries) ? data.ministries : [];
    if (!existing.length && !alreadyMinistries.length) continue;

    const ministries = [...alreadyMinistries];
    const tags = [];
    for (const value of existing) {
      const canonical = known.get(String(value).trim().toLowerCase());
      if (canonical) {
        if (!ministries.includes(canonical)) ministries.push(canonical);
      } else {
        tags.push(value);
      }
    }

    const changed =
      ministries.length !== alreadyMinistries.length || tags.length !== existing.length;
    if (!changed) continue;

    planned.push({
      ref: docSnap.ref,
      name: [data.firstName, data.lastName].filter(Boolean).join(" ") || docSnap.id,
      before: existing,
      ministries,
      tags,
    });
  }

  if (!planned.length) {
    console.log("Nothing to migrate — every member is already split.");
    return;
  }

  console.log(`${planned.length} member(s) to update:\n`);
  for (const p of planned) {
    console.log(`  ${p.name}`);
    console.log(`      was        : [${p.before.join(", ")}]`);
    console.log(`      ministries : [${p.ministries.join(", ")}]`);
    console.log(`      tags       : [${p.tags.join(", ")}]`);
  }

  /* Ministries that need creating so the vocabulary matches what is assigned */
  const existingMinistryNames = new Set(
    ministriesSnap.docs.map((d) => String(d.data().name || "").toLowerCase())
  );
  const assigned = new Set(planned.flatMap((p) => p.ministries));
  const toCreate = [...assigned].filter((n) => !existingMinistryNames.has(n.toLowerCase()));
  const seeding = ministriesSnap.empty ? STARTER_MINISTRIES : [];
  const create = [...new Set([...toCreate, ...seeding])].filter(
    (n) => !existingMinistryNames.has(n.toLowerCase())
  );

  if (create.length) console.log(`\nMinistry records to create: ${create.join(", ")}`);

  if (!WRITE) {
    console.log("\nDry run — nothing written. Re-run with --write to apply.");
    return;
  }

  for (const name of create) {
    await db.collection("ministries").add({
      name,
      description: "",
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  // Batched: 102 members is well inside Firestore's 500-operation limit, but
  // batching also makes the split atomic per run.
  let batch = db.batch();
  let pending = 0;
  for (const p of planned) {
    batch.update(p.ref, { ministries: p.ministries, tags: p.tags });
    if (++pending >= 400) {
      await batch.commit();
      batch = db.batch();
      pending = 0;
    }
  }
  if (pending) await batch.commit();

  console.log(`\nDone. ${planned.length} member(s) updated, ${create.length} ministry record(s) created.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

// Vercel serverless function: deliver one notification to the devices whose
// owner is allowed to receive it.
//
// The audience is not "everyone with a token". A prayer concern names a person
// and their situation, minutes carry what the council decided — both sit behind
// a capability in the app, and a push that ignored that would hand the same
// content to anyone who once tapped the bell. lib/audience.js resolves each
// device's owner through the very rules usePermissions applies in the browser.
import { FieldValue } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { db } from "../lib/firebaseAdmin.js";
import { eventIconPngPath } from "../lib/eventIcons.js";
import { loadAudience } from "../lib/audience.js";
import { canReceive, isKnownKind, notificationKind } from "../lib/notifications.js";

// The bell panel shows 30. Keeping a few hundred leaves room to scroll back
// without the collection growing without bound for the life of the church.
const HISTORY_LIMIT = 200;

/** FCM takes at most 500 tokens per multicast. */
const BATCH_SIZE = 500;

const TOKEN_GONE = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
  "messaging/invalid-argument",
]);

/**
 * The PNG the system tray shows. A kind that names its own mark uses it; the
 * event kinds pass `null` so a birthday and a prayer meeting stay told apart
 * by the icon the event itself carries.
 */
function trayIcon(def, event) {
  if (def.trayIcon) return eventIconPngPath({ icon: def.trayIcon });
  if (event) return eventIconPngPath(event);
  return "/icons/pwa-192x192.png";
}

/** Every registered device, paired with the account that registered it. */
async function loadTargets(firestore, kind, audience) {
  const snap = await firestore.collection("fcmTokens").select("uid").get();
  return snap.docs
    .filter((d) => canReceive(kind, audience.contextFor(d.data().uid)))
    .map((d) => d.id);
}

/** Drops tokens FCM reported as dead, so the list does not rot. */
async function pruneTokens(firestore, tokens) {
  if (!tokens.length) return;
  const batch = firestore.batch();
  tokens.forEach((t) => batch.delete(firestore.collection("fcmTokens").doc(t)));
  await batch.commit();
}

/** Trims the history to HISTORY_LIMIT, oldest first. */
async function pruneHistory(firestore) {
  try {
    const snap = await firestore
      .collection("notifications")
      .orderBy("sentAt", "desc")
      .offset(HISTORY_LIMIT)
      .limit(100)
      .select()
      .get();
    if (snap.empty) return;
    const batch = firestore.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  } catch (error) {
    // Housekeeping must never turn a delivered notification into an error
    console.error("Could not prune notification history:", error);
  }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { kind, title, body, url, event } = req.body || {};
    if (!title || !title.trim()) {
      return res.status(400).json({ error: "title is required" });
    }
    // An unknown kind still goes out, but as an ungated announcement rather
    // than silently inheriting somebody else's audience.
    if (kind && !isKnownKind(kind)) {
      console.warn(`Unknown notification kind "${kind}" — sending ungated.`);
    }

    const def = notificationKind(kind);
    const target = url || def.url;
    const firestore = db();

    // Safe here and not at module scope: db() ran initAdmin() a line ago.
    const messaging = getMessaging();

    const audience = await loadAudience(firestore);
    const tokens = await loadTargets(firestore, kind, audience);

    // FCM requires an absolute HTTPS link for the click-through URL
    const origin = `https://${req.headers.host}`;
    const link = target.startsWith("http") ? target : origin + target;
    const icon = trayIcon(def, event);

    let sent = 0;
    let failed = 0;
    const dead = [];

    for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
      const batch = tokens.slice(i, i + BATCH_SIZE);
      const resp = await messaging.sendEachForMulticast({
        tokens: batch,
        notification: { title: title.trim(), body: (body || "").trim() },
        data: { url: target, kind: kind || "" },
        webpush: {
          // Deliver immediately instead of batching for battery savings
          headers: { Urgency: def.tone === "alert" ? "high" : "normal" },
          fcmOptions: { link },
          notification: {
            icon,
            badge: "/icons/badge-96x96.png",
            // Keyed on the headline, not just the kind: a second push about
            // the same thing replaces the first in the tray, while two
            // different new events still stack. Tagging by kind alone would
            // have one week's events quietly swallow the last.
            tag: `${kind || "uec"}:${title.trim()}`,
            renotify: def.tone === "alert",
            vibrate: def.tone === "alert" ? [200, 100, 200] : [120],
          },
        },
      });
      sent += resp.successCount;
      failed += resp.failureCount;
      resp.responses.forEach((r, j) => {
        if (TOKEN_GONE.has(r.error?.code)) dead.push(batch[j]);
      });
    }

    await pruneTokens(firestore, dead);

    // Log to history — powers the in-app notifications panel, which filters it
    // by the same `kind` so the panel can never show more than the push did.
    await firestore.collection("notifications").add({
      kind: kind || "",
      title: title.trim(),
      body: (body || "").trim(),
      url: target,
      icon: def.icon,
      tone: def.tone,
      group: def.group,
      sentAt: FieldValue.serverTimestamp(),
      devices: tokens.length,
      sent,
      failed,
    });
    await pruneHistory(firestore);

    return res.status(200).json({ kind: kind || null, devices: tokens.length, sent, failed, removed: dead.length });
  } catch (error) {
    console.error("Error sending notification:", error);
    return res.status(500).json({ error: error.message || "Failed to send notification" });
  }
}

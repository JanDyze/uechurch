// Vercel serverless function: send a push notification to every device
// registered in the Firestore `fcmTokens` collection.
// Requires the FIREBASE_SERVICE_ACCOUNT env var (full service account JSON
// from Firebase Console → Project settings → Service accounts).
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

function initAdmin() {
  if (getApps().length) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT not configured");
  const serviceAccount = JSON.parse(raw);
  // Env var storage can double-escape the key's newlines
  if (serviceAccount.private_key?.includes("\\n")) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
  }
  initializeApp({ credential: cert(serviceAccount) });
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { title, body, url } = req.body || {};
    if (!title || !title.trim()) {
      return res.status(400).json({ error: "title is required" });
    }

    initAdmin();
    const db = getFirestore();
    const snap = await db.collection("fcmTokens").get();
    const tokens = snap.docs.map((d) => d.id);

    // FCM requires an absolute HTTPS link for the click-through URL
    const origin = `https://${req.headers.host}`;
    const link = url && url.startsWith("http") ? url : origin + (url || "/");

    const messaging = getMessaging();
    let sent = 0;
    let failed = 0;
    const invalid = [];

    // sendEachForMulticast accepts at most 500 tokens per call
    for (let i = 0; i < tokens.length; i += 500) {
      const batch = tokens.slice(i, i + 500);
      const resp = await messaging.sendEachForMulticast({
        tokens: batch,
        notification: { title: title.trim(), body: (body || "").trim() },
        data: { url: url || "/" },
        webpush: {
          // Deliver immediately instead of batching for battery savings
          headers: { Urgency: "high" },
          fcmOptions: { link },
          notification: {
            icon: "/icons/pwa-192x192.png",
            badge: "/icons/badge-96x96.png",
            vibrate: [200, 100, 200],
          },
        },
      });
      sent += resp.successCount;
      failed += resp.failureCount;
      resp.responses.forEach((r, j) => {
        const code = r.error?.code;
        if (
          code === "messaging/registration-token-not-registered" ||
          code === "messaging/invalid-registration-token" ||
          code === "messaging/invalid-argument"
        ) {
          invalid.push(batch[j]);
        }
      });
    }

    // Prune tokens for devices that revoked permission or uninstalled
    await Promise.all(invalid.map((t) => db.collection("fcmTokens").doc(t).delete()));

    // Log to history — powers the in-app notifications panel
    await db.collection("notifications").add({
      title: title.trim(),
      body: (body || "").trim(),
      url: url || "/",
      sentAt: FieldValue.serverTimestamp(),
      sent,
      failed,
    });

    return res.status(200).json({ sent, failed, removed: invalid.length });
  } catch (error) {
    console.error("Error sending notification:", error);
    return res.status(500).json({ error: error.message || "Failed to send notification" });
  }
}

// Vercel serverless function: mirror the Firebase Auth user list into the
// Firestore `userAccounts` collection that the Accounts page reads.
//
// The browser stamps its own account on every sign-in, which covers everyone
// who keeps using the app. This endpoint is the backfill for the rest: the
// accounts that existed before that stamping did, and any that have not been
// back since. Only the Admin SDK can enumerate Firebase users, so it has to
// live on the server.
//
// Requires the FIREBASE_SERVICE_ACCOUNT env var (full service account JSON
// from Firebase Console → Project settings → Service accounts).
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

// Firestore caps a batched write at 500 operations.
const BATCH_LIMIT = 500;

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

const toTimestamp = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return isNaN(date) ? null : Timestamp.fromDate(date);
};

/** The caller must be signed in and hold the administrator role. */
async function requireAdmin(req, db) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return { error: "Sign in required", status: 401 };

  let decoded;
  try {
    decoded = await getAuth().verifyIdToken(token);
  } catch {
    return { error: "Sign in required", status: 401 };
  }

  const admin = await db.collection("appAdmins").doc(decoded.uid).get();
  if (!admin.exists) return { error: "Administrators only", status: 403 };

  return { uid: decoded.uid };
}

export default async function handler(req, res) {
  // Deliberately no wildcard CORS header: this hands back every member's email
  // address, so it is for the app's own origin only.
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    initAdmin();
    const db = getFirestore();

    const auth = await requireAdmin(req, db);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    let batch = db.batch();
    let pending = 0;
    let synced = 0;
    let pageToken;

    do {
      const page = await getAuth().listUsers(1000, pageToken);
      pageToken = page.pageToken;

      for (const user of page.users) {
        const providers = user.providerData.map((p) => p.providerId).filter(Boolean);

        // merge:true throughout — `lastActiveAt` belongs to the client
        // heartbeat and must survive a sync.
        const payload = {
          email: user.email || "",
          displayName: user.displayName || "",
          photoURL: user.photoURL || "",
          emailVerified: Boolean(user.emailVerified),
          disabled: Boolean(user.disabled),
          providers: providers.length ? providers : ["password"],
          primaryProvider: providers[0] || "password",
        };

        const createdAt = toTimestamp(user.metadata?.creationTime);
        if (createdAt) payload.createdAt = createdAt;

        const lastSignInAt = toTimestamp(user.metadata?.lastSignInTime);
        if (lastSignInAt) payload.lastSignInAt = lastSignInAt;

        batch.set(db.collection("userAccounts").doc(user.uid), payload, { merge: true });
        pending += 1;
        synced += 1;

        if (pending >= BATCH_LIMIT) {
          await batch.commit();
          batch = db.batch();
          pending = 0;
        }
      }
    } while (pageToken);

    if (pending > 0) await batch.commit();

    return res.status(200).json({ synced });
  } catch (error) {
    console.error("Error syncing accounts:", error);
    return res.status(500).json({ error: error.message || "Failed to sync accounts" });
  }
}

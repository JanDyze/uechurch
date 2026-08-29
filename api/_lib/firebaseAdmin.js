// Admin SDK bootstrap shared by the mail endpoints.
//
// Vercel ignores files under `api/` whose name starts with an underscore, so
// this directory holds server-only helpers without becoming routable itself.
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

export function initAdmin() {
  if (getApps().length) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT not configured");
  const serviceAccount = JSON.parse(raw);
  // Env var storage can double-escape the key's newlines
  if (serviceAccount.private_key?.includes("\n")) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\n/g, "\n");
  }
  initializeApp({ credential: cert(serviceAccount) });
}

/** Initialises on first use so callers never have to remember the order. */
export function db() {
  initAdmin();
  return getFirestore();
}

/**
 * Resolves the caller from the `Authorization: Bearer <firebase id token>`
 * header and checks they hold the administrator role. Returns either
 * `{ uid, email, displayName }` or `{ error, status }` — never throws, so the
 * handler can turn it straight into a response.
 */
export async function requireAdmin(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return { error: "Sign in required", status: 401 };

  let decoded;
  try {
    initAdmin();
    decoded = await getAuth().verifyIdToken(token);
  } catch {
    return { error: "Sign in required", status: 401 };
  }

  const admin = await db().collection("appAdmins").doc(decoded.uid).get();
  if (!admin.exists) return { error: "Administrators only", status: 403 };

  return {
    uid: decoded.uid,
    email: decoded.email || admin.data()?.email || "",
    displayName: decoded.name || admin.data()?.displayName || "",
  };
}

/**
 * Vercel Cron attaches `Authorization: Bearer $CRON_SECRET` to its requests
 * once that env var is set. Without the secret configured the scheduled route
 * stays closed rather than falling open to anyone who finds the URL.
 */
export function isCronRequest(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.authorization || "";
  return header === `Bearer ${secret}` || req.headers["x-cron-secret"] === secret;
}

// Admin SDK bootstrap shared by the mail endpoints.
//
// Deliberately outside `api/`: everything in that directory is a candidate
// Serverless Function, and shared modules parked there — even underscore-
// prefixed ones — are not reliably included in the deployed bundle. Vercel
// traces the imports from api/email.js and pulls this in from here.
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

export function initAdmin() {
  if (getApps().length) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT not configured");
  const serviceAccount = JSON.parse(raw);
  // Env var storage can double-escape the key's newlines, and what comes back
  // is a literal backslash-n that cert() cannot read as a PEM. Matching on a
  // real newline — as this did — never fired, because JSON.parse has already
  // turned the escapes back into newlines by the time it looks.
  if (serviceAccount.private_key?.includes(String.raw`\n`)) {
    serviceAccount.private_key = serviceAccount.private_key.split(String.raw`\n`).join("\n");
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

/**
 * Resolves the caller from the `Authorization: Bearer <firebase id token>`
 * header without demanding the administrator role — any signed-in account
 * passes. Used by endpoints that cost real money per call (/api/song-lookup),
 * where the point is to keep anonymous traffic out rather than to restrict the
 * feature; who may press the button is decided by capabilities in the client.
 */
export async function requireUser(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return { error: "Sign in required", status: 401 };

  try {
    initAdmin();
    const decoded = await getAuth().verifyIdToken(token);
    return { uid: decoded.uid, email: decoded.email || "" };
  } catch {
    return { error: "Sign in required", status: 401 };
  }
}

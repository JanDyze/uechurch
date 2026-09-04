import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";
import { notificationKind } from "../../lib/notifications";

// Live feed of past notifications (written by /api/notify) — newest first.
// The panel that renders this filters by capability, the same way the server
// filtered who the push went to.
export const subscribeToNotifications = (callback, max = 30) => {
  const q = query(collection(db, "notifications"), orderBy("sentAt", "desc"), limit(max));
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (error) => {
      console.error("Error subscribing to notifications:", error);
      callback([]);
    }
  );
};

// A save that fires twice — a double-tapped button, a form submitted while the
// first write was still in flight — should not interrupt the church twice.
// Keyed per tab, which is where double-taps happen; two people genuinely
// adding the same thing are two events and get two notifications.
const RECENT_WINDOW_MS = 60_000;
const recentlySent = new Map();

const isRepeat = (signature) => {
  const now = Date.now();
  for (const [key, at] of recentlySent) {
    if (now - at > RECENT_WINDOW_MS) recentlySent.delete(key);
  }
  if (recentlySent.has(signature)) return true;
  recentlySent.set(signature, now);
  return false;
};

/**
 * Raise a notification. `kind` is a key from lib/notifications.js, which is
 * what decides who receives it, what the tray icon is and where tapping it
 * lands — so a caller only supplies the words.
 *
 * Best-effort by design: failures are logged, never thrown, so a push problem
 * can never break the save that triggered it. /api/notify only runs on Vercel
 * deployments — during `npm run dev` this quietly no-ops.
 *
 * @param {string} kind   e.g. 'event.cancelled'
 * @param {object} detail
 * @param {string} detail.title  the headline, already written for a human
 * @param {string} [detail.body] one supporting line — date, place, who
 * @param {string} [detail.url]  overrides the kind's default destination
 * @param {object} [detail.event] `{ type, icon }`, for the event kinds, so the
 *                                tray shows the event's own mark
 */
export const notify = async (kind, { title, body = "", url, event = null } = {}) => {
  if (!title || !title.trim()) return null;
  if (isRepeat(`${kind}|${title}|${body}`)) return null;

  try {
    const res = await fetch("/api/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind,
        title,
        body,
        url: url || notificationKind(kind).url,
        event,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (error) {
    console.warn(`Notification "${kind}" not sent:`, error.message);
    return null;
  }
};

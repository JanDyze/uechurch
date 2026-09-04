import { ref, computed } from "vue";
import {
  getMessaging,
  getToken,
  deleteToken,
  onMessage,
  isSupported,
} from "firebase/messaging";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import app, { db } from "../api/firebase";
import { useToast } from "./useToast";
import { initAuth, useAuth } from "./useAuth";

// The FCM service worker gets its own scope so it never competes with the PWA
// service worker for "/" — two registrations on the same scope replace each
// other, which leaves push subscriptions attached to a worker that no longer
// exists and makes subscribe() fail with "push service error".
const FCM_SW_URL = "/firebase-messaging-sw.js";
const FCM_SW_SCOPE = "/firebase-cloud-messaging-push-scope";

// Module-level state — shared across all components
const permission = ref(
  typeof Notification !== "undefined" ? Notification.permission : "unsupported"
);
const token = ref(null);
const enabling = ref(false);
let messagingInstance = null;
let foregroundBound = false;
let serviceWorkerRegistration = null;

const isFcmRegistration = (reg) =>
  [reg.active, reg.waiting, reg.installing].some((sw) =>
    sw?.scriptURL?.endsWith("firebase-messaging-sw.js")
  );

async function waitUntilActive(reg) {
  if (reg.active) return reg;
  const sw = reg.installing || reg.waiting;
  if (!sw) return reg;
  await new Promise((resolve) => {
    const onChange = () => {
      if (sw.state === "activated" || sw.state === "redundant") {
        sw.removeEventListener("statechange", onChange);
        resolve();
      }
    };
    sw.addEventListener("statechange", onChange);
    onChange();
  });
  return reg;
}

async function ensureFirebaseServiceWorker() {
  if (!("serviceWorker" in navigator)) return null;
  if (serviceWorkerRegistration) return serviceWorkerRegistration;

  try {
    const regs = await navigator.serviceWorker.getRegistrations();

    // An earlier build registered this worker on "/", where it displaced the
    // PWA worker. Drop that one — registerSW() reclaims "/" on the next load.
    for (const reg of regs) {
      if (isFcmRegistration(reg) && new URL(reg.scope).pathname === "/") {
        await reg.unregister();
      }
    }

    serviceWorkerRegistration =
      regs.find((r) => isFcmRegistration(r) && r.scope.includes(FCM_SW_SCOPE)) ||
      (await navigator.serviceWorker.register(FCM_SW_URL, { scope: FCM_SW_SCOPE }));

    // Note: navigator.serviceWorker.ready resolves for the worker controlling
    // this page (the PWA one), not necessarily this registration.
    await waitUntilActive(serviceWorkerRegistration);
    return serviceWorkerRegistration;
  } catch (e) {
    console.error("Firebase messaging service worker registration failed:", e);
    throw e;
  }
}

async function getMessagingIfSupported() {
  if (messagingInstance) return messagingInstance;
  if (!(await isSupported().catch(() => false))) return null;

  try {
    await ensureFirebaseServiceWorker();
  } catch {
    return null;
  }

  messagingInstance = getMessaging(app);
  return messagingInstance;
}

// subscribe() aborts when the browser already holds a subscription created with
// a different key or tied to a since-unregistered worker. Clearing both lets a
// retry start from scratch.
const isStaleSubscriptionError = (e) =>
  e?.name === "AbortError" ||
  e?.name === "InvalidStateError" ||
  /push service error|applicationServerKey/i.test(e?.message || "");

const isBrave = async () => {
  try {
    return (await navigator.brave?.isBrave?.()) === true;
  } catch {
    return false;
  }
};

async function clearPushSubscriptions(messaging) {
  try {
    await deleteToken(messaging);
  } catch {
    // No token to delete, or the delete call hit the same bad state
  }
  try {
    for (const reg of await navigator.serviceWorker.getRegistrations()) {
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
    }
  } catch (e) {
    console.warn("Could not clear stale push subscriptions:", e);
  }
}

async function saveToken(fcmToken, user) {
  // One doc per token so multiple devices/browsers can each register.
  //
  // `uid` is what lets api/notify.js work out what this device may be told:
  // without it the device is treated as an unknown account and only receives
  // what any signed-in member would. It is rewritten on every app start, so a
  // shared device follows whoever is signed in now.
  await setDoc(
    doc(db, "fcmTokens", fcmToken),
    {
      token: fcmToken,
      uid: user?.uid || null,
      email: user?.email || "",
      userAgent: navigator.userAgent,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export function useNotifications() {
  const { success, error, info } = useToast();
  const { user } = useAuth();

  const isEnabled = computed(() => permission.value === "granted" && !!token.value);

  // While the app is open, show pushes as a toast AND in the system
  // notification bar (background pushes are handled by
  // public/firebase-messaging-sw.js, which shows them automatically)
  const bindForegroundHandler = (messaging) => {
    if (foregroundBound) return;
    foregroundBound = true;
    onMessage(messaging, async (payload) => {
      const n = payload.notification || payload.data || {};
      info(`${n.title || "UEC Church"}${n.body ? " — " + n.body : ""}`, 8000);

      if (Notification.permission !== "granted") return;
      try {
        // Prefer the FCM service worker so its notificationclick handler
        // (focus/open the app) applies; new Notification() doesn't work on
        // Android — notifications must go through a SW registration
        const reg =
          serviceWorkerRegistration ||
          (await navigator.serviceWorker.getRegistration());
        if (!reg) return;
        await reg.showNotification(n.title || "UEC Church", {
          body: n.body || "",
          icon: "/icons/pwa-192x192.png",
          badge: "/icons/badge-96x96.png",
          data: { url: (payload.data && payload.data.url) || "/" },
        });
      } catch (e) {
        console.warn("Could not show system notification:", e);
      }
    });
  };

  const fetchToken = async (messaging, { retry = true } = {}) => {
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    if (!vapidKey) {
      error("Notifications are not configured (missing VAPID key).");
      return null;
    }

    // Pass the registration explicitly — otherwise the SDK registers the
    // worker a second time on its own and the two can race.
    const swReg = await ensureFirebaseServiceWorker();

    let fcmToken;
    try {
      fcmToken = await getToken(messaging, {
        vapidKey,
        ...(swReg ? { serviceWorkerRegistration: swReg } : {}),
      });
    } catch (e) {
      if (!retry || !isStaleSubscriptionError(e)) throw e;
      console.warn("Push subscribe failed; clearing stale state and retrying:", e);
      await clearPushSubscriptions(messaging);
      return fetchToken(messaging, { retry: false });
    }

    if (fcmToken) {
      token.value = fcmToken;
      // Who this device belongs to decides what it is sent, so the session has
      // to be restored before the token is written.
      await initAuth();
      await saveToken(fcmToken, user.value);
    }
    return fcmToken;
  };

  // Call on app start: re-attach handlers/token if permission was already given
  const init = async () => {
    const messaging = await getMessagingIfSupported();
    if (!messaging) return;
    bindForegroundHandler(messaging);
    if (Notification.permission === "granted") {
      try {
        await fetchToken(messaging);
      } catch {
        // Token refresh failing silently on startup is fine — user can re-enable
      }
    }
  };

  // Call from a user gesture (e.g. the bell button)
  const enable = async () => {
    if (enabling.value) return;
    enabling.value = true;
    try {
      const messaging = await getMessagingIfSupported();
      if (!messaging) {
        error("Push notifications aren't supported in this browser.");
        return;
      }

      permission.value = await Notification.requestPermission();
      if (permission.value !== "granted") {
        info("Notifications stay off until you allow them in the browser.");
        return;
      }

      bindForegroundHandler(messaging);
      const fcmToken = await fetchToken(messaging);
      if (fcmToken) success("Notifications enabled on this device!");
      else error("Couldn't register this device for notifications.");
    } catch (e) {
      console.error("Failed to enable notifications:", e);
      if (isStaleSubscriptionError(e)) {
        // Brave disables Google push messaging by default, which is the most
        // common reason subscribe() aborts on an otherwise healthy device.
        error(
          (await isBrave())
            ? "Brave blocks push notifications by default. Turn on 'Use Google services for push messaging' in brave://settings/privacy, restart Brave, then try again."
            : "Your browser's push service rejected this device. Make sure you're online and Google push services aren't blocked, then try again.",
          12000
        );
      } else {
        error("Something went wrong enabling notifications.");
      }
    } finally {
      enabling.value = false;
    }
  };

  return { permission, token, isEnabled, enabling, init, enable };
}

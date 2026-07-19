import { ref, computed } from "vue";
import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import app, { db } from "../api/firebase";
import { useToast } from "./useToast";

// Module-level state — shared across all components
const permission = ref(
  typeof Notification !== "undefined" ? Notification.permission : "unsupported"
);
const token = ref(null);
const enabling = ref(false);
let messagingInstance = null;
let foregroundBound = false;

async function getMessagingIfSupported() {
  if (messagingInstance) return messagingInstance;
  if (!(await isSupported().catch(() => false))) return null;
  messagingInstance = getMessaging(app);
  return messagingInstance;
}

async function saveToken(fcmToken) {
  // One doc per token so multiple devices/browsers can each register
  await setDoc(
    doc(db, "fcmTokens", fcmToken),
    {
      token: fcmToken,
      userAgent: navigator.userAgent,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export function useNotifications() {
  const { success, error, info } = useToast();

  const isEnabled = computed(() => permission.value === "granted" && !!token.value);

  // Show pushes as toasts while the app is open (background pushes are
  // handled by public/firebase-messaging-sw.js)
  const bindForegroundHandler = (messaging) => {
    if (foregroundBound) return;
    foregroundBound = true;
    onMessage(messaging, (payload) => {
      const n = payload.notification || payload.data || {};
      info(`${n.title || "UEC Church"}${n.body ? " — " + n.body : ""}`, 8000);
    });
  };

  const fetchToken = async (messaging) => {
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    if (!vapidKey) {
      error("Notifications are not configured (missing VAPID key).");
      return null;
    }
    const fcmToken = await getToken(messaging, { vapidKey });
    if (fcmToken) {
      token.value = fcmToken;
      await saveToken(fcmToken);
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
      error("Something went wrong enabling notifications.");
    } finally {
      enabling.value = false;
    }
  };

  return { permission, token, isEnabled, enabling, init, enable };
}

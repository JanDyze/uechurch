import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

/**
 * Whether Google sign-in goes through our own domain instead of
 * <project>.firebaseapp.com.
 *
 * Why it matters, and only on iOS: an installed PWA cannot sign in with a
 * popup — iOS opens window.open outside the app, where it can never talk back
 * to the opener — so it has to use the full-page redirect instead. But Safari
 * partitions storage by site, and a redirect through firebaseapp.com is a
 * different site, so the sign-in comes back and Firebase can no longer find
 * the state it left behind. Firebase's own guidance is to stop crossing sites:
 * proxy /__/auth/ from this domain to the Firebase one (see vercel.json) and
 * name this domain as the authDomain, and the whole flow stays first-party.
 *
 * It is opt-in because it cannot work on the code alone — two console changes
 * have to be made first, and turning it on before they are made would break
 * Google sign-in for everyone rather than fix it on iOS. See README.
 */
export const authHandlerIsSelfHosted =
  import.meta.env.VITE_FIREBASE_SELF_HOSTED_AUTH === "true" &&
  typeof window !== "undefined";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  // window.location.host rather than a second variable to keep in step: the
  // proxy lives on whatever domain served this page, production or preview.
  authDomain: authHandlerIsSelfHosted
    ? window.location.host
    : import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);

export const analytics =
  typeof window !== "undefined" ? getAnalytics(app) : null;

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;





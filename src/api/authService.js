import { auth, authHandlerIsSelfHosted } from "./firebase";
import {
  GoogleAuthProvider,
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile,
} from "firebase/auth";

// Google is the only sign-in method this app offers. There was an email and
// password path here — login(), register() and resetPassword(), backed by a
// second form at /register — and it is gone deliberately: one provider means
// one account per person, no password for a congregation to lose, and nothing
// to reset. Accounts made the old way still exist and still show as "Email &
// password" on the Accounts page; they simply have no door here any more.
//
// The UI is only half of it. Email/Password must also be switched off under
// Firebase Authentication > Sign-in method, or the REST API still accepts it.

// Firebase error codes are not fit to show a user — map them to plain English.
// Only the codes Google sign-in can actually raise: the password-only ones
// (wrong-password, user-not-found, weak-password and the rest) went with it.
const ERROR_MESSAGES = {
  "auth/user-disabled": "This account has been disabled. Contact an administrator.",
  "auth/too-many-requests": "Too many attempts. Please wait a moment and try again.",
  "auth/network-request-failed": "Network error. Check your connection and try again.",
  // Raised when Google sign-in itself is switched off in the Firebase console.
  "auth/operation-not-allowed":
    "That sign-in method is not enabled for this project.",
  "auth/popup-closed-by-user": "Sign-in was cancelled.",
  "auth/cancelled-popup-request": "Sign-in was cancelled.",
  // Reachable by an account made back when this app took passwords, on a
  // project set to keep one account per email address. Nothing the person can
  // do from this screen, so it points them at somebody who can.
  "auth/account-exists-with-different-credential":
    "An account with that email already exists under a different sign-in method. Contact an administrator.",
  // Firebase only accepts sign-ins from domains listed under Authentication >
  // Settings > Authorized domains. A phone hitting the dev server by LAN IP
  // trips this until that IP is added there.
  "auth/unauthorized-domain":
    "This address isn't authorised for Google sign-in. Add it to Firebase Authentication > Settings > Authorized domains.",
};

export const getAuthErrorMessage = (error) =>
  ERROR_MESSAGES[error?.code] || "Something went wrong. Please try again.";

// Rename the signed-in account. Used by the topbar identity popover.
export const updateDisplayName = async (displayName) => {
  if (!auth.currentUser) throw new Error("No signed-in user");
  await updateProfile(auth.currentUser, { displayName: displayName.trim() });
  return auth.currentUser;
};

const googleProvider = new GoogleAuthProvider();
// Always ask which Google account to use, rather than silently reusing the one
// already signed into the browser — phones are often shared here.
googleProvider.setCustomParameters({ prompt: "select_account" });

/**
 * iPadOS 13+ calls itself "Macintosh"; the touch points are what tell the two
 * apart, since no desktop Mac reports any.
 */
const isIos = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches === true ||
  window.navigator.standalone === true;

/**
 * When to skip the popup and go straight to a redirect.
 *
 * The one case that matters is an iOS home-screen install. A popup opened from
 * there lands in a separate Safari view that has no opener to postMessage
 * back to, so signInWithPopup does not fail so much as never finish — the
 * worst outcome of the three, because the button just spins.
 *
 * Conditional on the self-hosted handler because the alternative is no better
 * without it: on Safari a redirect through firebaseapp.com loses its state to
 * storage partitioning and returns signed out. Until that is switched on, a
 * popup that might work beats a redirect that reliably will not.
 */
const prefersRedirect = () =>
  authHandlerIsSelfHosted && isIos() && isStandalone();

// Sign in with Google. Popups are blocked or unsupported in a fair number of
// mobile in-app browsers, so fall back to a full-page redirect; that path
// resolves later through consumePendingGoogleSignIn() on the way back.
export const loginWithGoogle = async () => {
  if (prefersRedirect()) {
    await signInWithRedirect(auth, googleProvider);
    return null; // The page navigates away; nothing to return.
  }

  try {
    const credential = await signInWithPopup(auth, googleProvider);
    return credential.user;
  } catch (error) {
    const needsRedirect =
      error?.code === "auth/popup-blocked" ||
      error?.code === "auth/operation-not-supported-in-this-environment" ||
      // Thrown when the browser denies access to the storage the popup flow
      // needs — iOS in-app webviews (Facebook, Messenger) do this routinely.
      error?.code === "auth/web-storage-unsupported";
    if (!needsRedirect) throw error;

    await signInWithRedirect(auth, googleProvider);
    return null;
  }
};

// Picks up the result of a redirect sign-in after the page reloads. Returns
// the user, or null when this load was not a redirect return.
export const consumePendingGoogleSignIn = async () => {
  const credential = await getRedirectResult(auth);
  return credential?.user || null;
};

// Sign the current user out
export const logout = () => signOut(auth);

// Subscribe to auth state changes — returns an unsubscribe function
export const subscribeToAuth = (callback) => onAuthStateChanged(auth, callback);

import { auth } from "./firebase";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getRedirectResult,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile,
} from "firebase/auth";

// Firebase error codes are not fit to show a user — map them to plain English.
const ERROR_MESSAGES = {
  "auth/invalid-email": "That email address doesn't look right.",
  "auth/user-disabled": "This account has been disabled. Contact an administrator.",
  "auth/user-not-found": "No account found with that email.",
  "auth/wrong-password": "Incorrect email or password.",
  "auth/invalid-credential": "Incorrect email or password.",
  "auth/email-already-in-use": "An account with that email already exists.",
  "auth/weak-password": "Password must be at least 6 characters.",
  "auth/missing-password": "Please enter your password.",
  "auth/too-many-requests": "Too many attempts. Please wait a moment and try again.",
  "auth/network-request-failed": "Network error. Check your connection and try again.",
  "auth/operation-not-allowed":
    "That sign-in method is not enabled for this project.",
  "auth/popup-closed-by-user": "Sign-in was cancelled.",
  "auth/cancelled-popup-request": "Sign-in was cancelled.",
  "auth/account-exists-with-different-credential":
    "An account with that email already exists. Sign in with your password instead.",
  // Firebase only accepts sign-ins from domains listed under Authentication >
  // Settings > Authorized domains. A phone hitting the dev server by LAN IP
  // trips this until that IP is added there.
  "auth/unauthorized-domain":
    "This address isn't authorised for Google sign-in. Add it to Firebase Authentication > Settings > Authorized domains.",
};

export const getAuthErrorMessage = (error) =>
  ERROR_MESSAGES[error?.code] || "Something went wrong. Please try again.";

// Sign in an existing user
export const login = async (email, password) => {
  const credential = await signInWithEmailAndPassword(
    auth,
    email.trim(),
    password
  );
  return credential.user;
};

// Create a new account. `displayName` is optional but shown in the topbar.
export const register = async (email, password, displayName = "") => {
  const credential = await createUserWithEmailAndPassword(
    auth,
    email.trim(),
    password
  );

  const name = displayName.trim();
  if (name) {
    await updateProfile(credential.user, { displayName: name });
  }

  return credential.user;
};

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

// Sign in with Google. Popups are blocked or unsupported in a fair number of
// mobile in-app browsers, so fall back to a full-page redirect; that path
// resolves later through consumePendingGoogleSignIn() on the way back.
export const loginWithGoogle = async () => {
  try {
    const credential = await signInWithPopup(auth, googleProvider);
    return credential.user;
  } catch (error) {
    const needsRedirect =
      error?.code === "auth/popup-blocked" ||
      error?.code === "auth/operation-not-supported-in-this-environment";
    if (!needsRedirect) throw error;

    await signInWithRedirect(auth, googleProvider);
    return null; // The page navigates away; nothing to return.
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

// Send a password reset email
export const resetPassword = (email) => sendPasswordResetEmail(auth, email.trim());

// Subscribe to auth state changes — returns an unsubscribe function
export const subscribeToAuth = (callback) => onAuthStateChanged(auth, callback);

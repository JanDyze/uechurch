import { auth } from "./firebase";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
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
    "Email/password sign-in is not enabled for this project.",
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

// Sign the current user out
export const logout = () => signOut(auth);

// Send a password reset email
export const resetPassword = (email) => sendPasswordResetEmail(auth, email.trim());

// Subscribe to auth state changes — returns an unsubscribe function
export const subscribeToAuth = (callback) => onAuthStateChanged(auth, callback);

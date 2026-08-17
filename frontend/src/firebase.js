/**
 * Firebase Auth client init. Config values come from your Firebase project
 * settings (console.firebase.google.com -> Project Settings -> your web app)
 * — these are NOT secrets (they're meant to be public in frontend code,
 * unlike the backend's API keys), but they do need to be the real values
 * from your actual Firebase project, not left as placeholders.
 *
 * AUTH METHOD: Microsoft/Entra ID SSO (cyberknight.tech's actual identity
 * provider). Requires the Azure app registration + Microsoft provider setup
 * in Firebase Console -> Authentication -> Sign-in method (see DEPLOYMENT.md).
 *
 * IMPORTANT: SSO only proves "this is a real Microsoft account in our
 * tenant" — it does NOT by itself decide who's allowed to use this app.
 * Access control is the separate approvedUsers Firestore allowlist, checked
 * in AuthGate.jsx right after sign-in and enforced again in firestore.rules
 * and the Cloud Functions. Don't rely on the tenant restriction alone as
 * the real access boundary — someone in the tenant but not on the
 * allowlist should still be blocked, and is, by that separate check.
 */
import { initializeApp } from "firebase/app";
import { getAuth, OAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export { app };
export const auth = getAuth(app);

const provider = new OAuthProvider("microsoft.com");
provider.setCustomParameters({
  // Restricts the Microsoft login screen to Cyberknight's own tenant,
  // not any Microsoft account anywhere. Find this in Azure -> Entra ID ->
  // Overview -> Tenant ID. Falls back to "common" (any tenant) if unset —
  // set VITE_MICROSOFT_TENANT_ID at build time, don't leave this on the
  // fallback in a real deploy.
  tenant: import.meta.env.VITE_MICROSOFT_TENANT_ID || "common",
  prompt: "select_account",
});

export function signIn() {
  return signInWithPopup(auth, provider);
}
export function signOutUser() {
  return signOut(auth);
}
export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}
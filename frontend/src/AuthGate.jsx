/**
 * Wraps <App /> — shows a "Sign in with Microsoft" screen until the user is
 * authenticated AND their email is present in the `approvedUsers` Firestore
 * collection. SSO proves they have a real Microsoft account in Cyberknight's
 * tenant; the allowlist is the separate, actual decision about whether
 * they're allowed to use this specific app. Same allowlist check as before —
 * it doesn't care which provider authenticated the user.
 */
import React, { useState, useEffect } from "react";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { onAuthChange, signIn, signOutUser, app } from "./firebase.js";

const db = getFirestore(app);

async function isApproved(email) {
  const snap = await getDoc(doc(db, "approvedUsers", email.toLowerCase()));
  return snap.exists() && snap.data().active !== false;
}

export default function AuthGate({ children }) {
  const [user, setUser] = useState(undefined); // undefined = still checking, null = signed out
  const [approved, setApproved] = useState(null);
  const [error, setError] = useState(null);
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => onAuthChange(async (u) => {
    setUser(u);
    if (u?.email) {
      const ok = await isApproved(u.email);
      setApproved(ok);
      if (!ok) await signOutUser(); // don't leave an unapproved session half-open
    } else {
      setApproved(null);
    }
  }), []);

  const handleSignIn = async () => {
    setError(null);
    setSigningIn(true);
    try {
      const result = await signIn();
      const ok = await isApproved(result.user.email);
      if (!ok) {
        await signOutUser();
        setError(`${result.user.email} isn't on the approved list. Ask whoever manages the tool to add you.`);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setSigningIn(false);
    }
  };

  if (user === undefined) return <div style={styles.center}>Loading…</div>;
  if (user && approved) return children;

  return (
    <div style={styles.center}>
      <div style={styles.card}>
        <div style={styles.title}>Cyberknight Budget Desk</div>
        <div style={styles.subtitle}>Sign in with your Cyberknight Microsoft account</div>
        {error && <div style={styles.error}>{error}</div>}
        <button onClick={handleSignIn} disabled={signingIn} style={styles.button}>
          {signingIn ? "…" : "Sign in with Microsoft"}
        </button>
      </div>
    </div>
  );
}

const styles = {
  center: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#FFFFFF", fontFamily: "'Inter', sans-serif" },
  card: { textAlign: "center", padding: 32, border: "1px solid #E0E0E0", borderRadius: 12, maxWidth: 360 },
  title: { fontSize: 20, fontWeight: 700, marginBottom: 6, fontFamily: "'Fraunces', serif" },
  subtitle: { fontSize: 13.5, color: "#6B6B6B", marginBottom: 20 },
  error: { fontSize: 12.5, color: "#C00000", marginBottom: 14 },
  button: { background: "#C00000", color: "#FFFFFF", border: "none", borderRadius: 7, padding: "10px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer" },
};
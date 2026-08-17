/**
 * Adds one or more approved users to Firestore, using the Admin SDK — which
 * bypasses firestore.rules entirely. This is REQUIRED at least once before
 * anyone can sign into the app: the rules require an existing approved user
 * to add new ones, so the very first entry can't be created through the app
 * itself (see the BOOTSTRAP NOTE in firestore.rules).
 *
 * After the first user exists, you can run this script again to add more —
 * there's no in-app admin UI for this yet, so this script IS the admin tool
 * for now.
 *
 * Usage:
 *   gcloud auth application-default login
 *   node scripts/add-approved-user.js someone@cyberknight.tech another@cyberknight.tech
 *
 * Note: this only adds the Firestore allowlist entry — it does NOT create
 * or affect the person's Microsoft account in any way. They still need to
 * sign in via "Sign in with Microsoft" on the app's sign-in screen using
 * their existing Cyberknight Microsoft 365 credentials.
 */

const { Firestore } = require("@google-cloud/firestore");
const db = new Firestore();

async function main() {
  const emails = process.argv.slice(2);
  if (!emails.length) {
    console.error("Usage: node scripts/add-approved-user.js email1@cyberknight.tech [email2@cyberknight.tech ...]");
    process.exit(1);
  }

  const batch = db.batch();
  for (const raw of emails) {
    const email = raw.trim().toLowerCase();
    batch.set(db.collection("approvedUsers").doc(email), {
      active: true,
      addedAt: Firestore.Timestamp.now(),
      addedBy: "bootstrap-script",
    });
  }
  await batch.commit();
  console.log(`Added ${emails.length} approved user(s): ${emails.join(", ")}`);
  console.log("They can now go to the app and sign in with their Cyberknight Microsoft account.");
}

main().catch(err => { console.error("Failed:", err.message); process.exit(1); });
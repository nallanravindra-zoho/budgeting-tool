/**
 * One-time seed: loads data/vendors.json into Firestore as the starting
 * working-draft BUDGET. Does NOT touch ciprActuals — now that syncCipr
 * (functions/index.js) is pulling real data from Zoho, re-running this
 * script must never overwrite that with the old placeholder figures.
 * Actuals come from the "Sync Now" button in the app going forward.
 *
 * Run with Application Default Credentials pointed at your GCP project:
 *   gcloud auth application-default login
 *   node scripts/seed-baseline-budget.js
 */

const fs = require("fs");
const path = require("path");
const { Firestore } = require("@google-cloud/firestore");

const db = new Firestore();
const vendors = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "vendors.json")));

async function main() {
  // Fixed doc ID "working" — must match frontend/src/firestoreData.js and
  // functions/index.js exactly, or this script creates yet another
  // duplicate working-version document (the original bug this replaced).
  const versionRef = db.collection("budgetVersions").doc("working");
  await versionRef.set({ name: "Working Draft", isWorking: true, createdAt: Firestore.Timestamp.now() }, { merge: true });
  console.log(`Using working version: ${versionRef.id}`);

  const batch = db.batch();
  let count = 0;
  for (const v of vendors) {
    // encodeURIComponent — Firestore doc IDs can't contain "/", and at
    // least one real vendor name ("H3/Ridge") does. Must match the same
    // encode/decode used in frontend/src/firestoreData.js and
    // functions/index.js, or the same vendor ends up as two different
    // documents depending on which code path wrote it.
    const ref = db.collection("budgetVersions").doc(versionRef.id).collection("vendorBudgets").doc(encodeURIComponent(v.vendor));
    batch.set(ref, {
      revenue: v.budget_revenue, gp: v.budget_gp, gpPct: v.gp_pct,
      monthlyBudgetRevenue: v.monthly_budget_revenue, countryGrid: null, // country split comes later via "Plan FY" in the app
    });
    count++;
  }
  await batch.commit();
  console.log(`Seeded ${count} vendors' budgets.`);

  const totalRev = vendors.reduce((s, v) => s + v.budget_revenue, 0);
  const totalGp = vendors.reduce((s, v) => s + v.budget_gp, 0);
  console.log(`Check — Total Budget Revenue: $${totalRev.toLocaleString()} (expect ~$200,000,000)`);
  console.log(`Check — Total Budget GP: $${totalGp.toLocaleString()} (expect ~$21,500,000)`);
}

main().catch(err => { console.error("Seed failed:", err); process.exit(1); });
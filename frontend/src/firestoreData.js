/**
 * Direct Firestore access — no backend REST API in between. Access control
 * is enforced by firestore.rules (checked server-side by Firestore itself),
 * not by anything in this file — this is just data shape and query logic,
 * the same responsibilities the old backend/src/services/firestore.js had,
 * ported from the Admin SDK to the client Web SDK.
 */
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc,
  query, where, orderBy, limit, writeBatch, Timestamp, deleteDoc,
} from "firebase/firestore";
import { app } from "./firebase.js";

const db = getFirestore(app);
const MONTHS = 12;

// The working (in-progress) version lives at a FIXED document ID, not one
// found by querying for isWorking==true. Querying allowed two independent
// callers (the app on first load, and scripts/seed-baseline-budget.js) to
// each create their own "isWorking: true" document if neither saw the
// other's — a real bug, not hypothetical: it's what caused $0 budget to
// show while real Zoho actuals were syncing correctly. A fixed ID makes
// that duplication structurally impossible.
const WORKING_VERSION_ID = "working";

async function getWorkingVersionId() {
  const ref = doc(db, "budgetVersions", WORKING_VERSION_ID);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, { name: "Working Draft", isWorking: true, createdAt: Timestamp.now() });
  }
  return WORKING_VERSION_ID;
}

export async function getVendors() {
  const versionId = await getWorkingVersionId();
  const [budgetSnap, actualsSnap] = await Promise.all([
    getDocs(collection(db, "budgetVersions", versionId, "vendorBudgets")),
    getDocs(collection(db, "ciprActuals")),
  ]);
  // decodeURIComponent — doc IDs are encodeURIComponent'd on write (see
  // quickEditVendorBudget/applyVendorPlan below and scripts/seed-baseline-budget.js)
  // because Firestore doc IDs can't contain "/", and "H3/Ridge" is a real vendor name.
  const budgets = {}; budgetSnap.forEach(d => (budgets[decodeURIComponent(d.id)] = d.data()));
  const actuals = {}; actualsSnap.forEach(d => (actuals[decodeURIComponent(d.id)] = d.data()));

  const vendorNames = new Set([...Object.keys(budgets), ...Object.keys(actuals)]);
  const out = [];
  for (const vendor of vendorNames) {
    const b = budgets[vendor] || { revenue: 0, gp: 0, gpPct: 0, monthlyBudgetRevenue: new Array(MONTHS).fill(0) };
    const a = actuals[vendor] || { monthlyActualRevenue: new Array(MONTHS).fill(0), actualRevenueYtd: 0, actualGpYtd: 0 };
    out.push({
      vendor,
      budget_revenue: b.revenue || 0,
      budget_gp: b.gp || 0,
      gp_pct: b.gpPct || 0,
      monthly_budget_revenue: b.monthlyBudgetRevenue || new Array(MONTHS).fill(0),
      ytd_budget_revenue: (b.monthlyBudgetRevenue || []).slice(0, 8).reduce((s, v) => s + v, 0),
      actual_revenue_ytd: a.actualRevenueYtd || 0,
      actual_gp_ytd: a.actualGpYtd || 0,
      monthly_actual_revenue: a.monthlyActualRevenue || new Array(MONTHS).fill(0),
      country_grid: b.countryGrid || null,
    });
  }
  return out.sort((x, y) => y.budget_revenue - x.budget_revenue);
}

export async function quickEditVendorBudget(vendorName, newRevenue) {
  const versionId = await getWorkingVersionId();
  const ref = doc(db, "budgetVersions", versionId, "vendorBudgets", encodeURIComponent(vendorName));
  const snap = await getDoc(ref);
  const current = snap.exists() ? snap.data() : { revenue: 0, gp: 0, gpPct: 0, monthlyBudgetRevenue: new Array(MONTHS).fill(0) };
  const ratio = current.revenue ? newRevenue / current.revenue : 1;
  await setDoc(ref, {
    ...current,
    revenue: newRevenue,
    gp: current.revenue ? current.gp * ratio : newRevenue * (current.gpPct || 0),
    monthlyBudgetRevenue: (current.monthlyBudgetRevenue || new Array(MONTHS).fill(0)).map(m => m * ratio),
    countryGrid: current.countryGrid ? scaleGrid(current.countryGrid, ratio) : null,
  });
}

export async function applyVendorPlan(vendorName, grid, gpPct) {
  const versionId = await getWorkingVersionId();
  let totalRev = 0;
  const monthlyRev = new Array(MONTHS).fill(0);
  for (const m in grid) {
    const mi = parseInt(m, 10) - 1;
    for (const c in grid[m]) { monthlyRev[mi] += grid[m][c]; totalRev += grid[m][c]; }
  }
  await setDoc(doc(db, "budgetVersions", versionId, "vendorBudgets", encodeURIComponent(vendorName)), {
    revenue: totalRev, gp: totalRev * gpPct, gpPct, monthlyBudgetRevenue: monthlyRev, countryGrid: grid,
  });
}

function scaleGrid(grid, ratio) {
  const out = {};
  for (const m in grid) { out[m] = {}; for (const c in grid[m]) out[m][c] = grid[m][c] * ratio; }
  return out;
}

export async function getRegions() {
  const versionId = await getWorkingVersionId();
  const budgetSnap = await getDocs(collection(db, "budgetVersions", versionId, "vendorBudgets"));
  const totals = {};
  budgetSnap.forEach(d => {
    const b = d.data();
    if (!b.countryGrid) return; // unplanned vendors don't contribute a country breakdown yet
    for (const m in b.countryGrid) for (const c in b.countryGrid[m]) {
      if (!totals[c]) totals[c] = { region: c, budget_revenue: 0, budget_gp: 0, actual_revenue_ytd: 0, actual_gp_ytd: 0 };
      totals[c].budget_revenue += b.countryGrid[m][c];
      totals[c].budget_gp += b.countryGrid[m][c] * (b.gpPct || 0);
    }
  });
  return Object.values(totals).sort((a, b) => b.budget_revenue - a.budget_revenue);
}

export async function listSavedVersions() {
  const q = query(collection(db, "budgetVersions"), where("isWorking", "==", false), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data(), created_at: d.data().createdAt?.toDate?.().toISOString() }));
}

export async function saveVersion(name, createdBy) {
  const workingId = await getWorkingVersionId();
  const newVersionRef = await addDoc(collection(db, "budgetVersions"), {
    name, isWorking: false, createdBy, createdAt: Timestamp.now(),
  });
  const workingBudgets = await getDocs(collection(db, "budgetVersions", workingId, "vendorBudgets"));
  const batch = writeBatch(db);
  workingBudgets.forEach(d => batch.set(doc(db, "budgetVersions", newVersionRef.id, "vendorBudgets", d.id), d.data()));
  await batch.commit();
  return { id: newVersionRef.id, name, created_at: new Date().toISOString() };
}

export async function loadVersion(versionId) {
  const workingId = await getWorkingVersionId();
  const existing = await getDocs(collection(db, "budgetVersions", workingId, "vendorBudgets"));
  const deleteBatch = writeBatch(db);
  existing.forEach(d => deleteBatch.delete(d.ref));
  await deleteBatch.commit();

  const source = await getDocs(collection(db, "budgetVersions", versionId, "vendorBudgets"));
  const copyBatch = writeBatch(db);
  source.forEach(d => copyBatch.set(doc(db, "budgetVersions", workingId, "vendorBudgets", d.id), d.data()));
  await copyBatch.commit();
}
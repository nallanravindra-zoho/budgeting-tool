/**
 * Direct Firestore access — no backend REST API in between. Access control
 * is enforced by firestore.rules (checked server-side by Firestore itself),
 * not by anything in this file — this is just data shape and query logic,
 * the same responsibilities the old backend/src/services/firestore.js had,
 * ported from the Admin SDK to the client Web SDK.
 *
 * YEAR MODEL (added alongside the year filter):
 * - Every year has read-only data synced from Zoho: zohoBudgets/{year}/vendorBudgets/{vendor}
 *   and ciprActuals/{year}/vendors/{vendor}.
 * - Exactly ONE year — the "active budgeting year" (settings/config.activeBudgetingYear,
 *   e.g. 2027) — is editable. Its editable data lives in the pre-existing
 *   budgetVersions/working/vendorBudgets/{vendor} scratchpad, same mechanism as before
 *   this change; it's just now understood as "the active budgeting year's draft"
 *   specifically, rather than the only year that exists.
 * - Every other year (current year, past years) is always read straight from
 *   zohoBudgets/ciprActuals — never merged with `working`, never editable. The UI is
 *   responsible for disabling edit controls (inline edit / chat edit / Plan FY) whenever
 *   the selected year isn't the active budgeting year; the write functions below also
 *   guard against it directly, so a stray call can't silently write to the wrong year.
 */
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc, deleteDoc,
  query, where, orderBy, writeBatch, Timestamp,
} from "firebase/firestore";
import { app, auth } from "./firebase.js";

const db = getFirestore(app);
const MONTHS = 12;
const EMPTY_BUDGET = { revenue: 0, gp: 0, gpPct: 0, monthlyBudgetRevenue: new Array(MONTHS).fill(0), countryGrid: null };
const EMPTY_ACTUALS = { monthlyActualRevenue: new Array(MONTHS).fill(0), actualRevenueYtd: 0, actualGpYtd: 0 };

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

// ---- Active budgeting year --------------------------------------------------
// Single settings doc so this can be rolled forward (2027 -> 2028) without a
// redeploy. Falls back to next calendar year if the doc is missing, so a
// fresh environment doesn't hard-fail before anyone's set it explicitly.
export async function getActiveBudgetingYear() {
  const snap = await getDoc(doc(db, "settings", "config"));
  if (snap.exists() && snap.data().activeBudgetingYear) {
    return snap.data().activeBudgetingYear;
  }
  return new Date().getFullYear() + 1;
}

export async function setActiveBudgetingYear(year) {
  await setDoc(doc(db, "settings", "config"), { activeBudgetingYear: year }, { merge: true });
}

// ---- Available years for the year-filter dropdown --------------------------
// Budget data exists from 2023 onward (per Zoho); the active budgeting year
// is always selectable too, even before any actuals/budget rows exist for
// it, since it's the year currently being planned.
export async function getAvailableYears() {
  const activeBudgetingYear = await getActiveBudgetingYear();
  const years = new Set();
  const upperBound = Math.max(activeBudgetingYear, 2030);
  for (let y = 2023; y <= upperBound; y++) years.add(y);
  return [...years].sort((a, b) => b - a); // most recent first
}

function assertEditableYear(year, activeBudgetingYear) {
  if (year !== activeBudgetingYear) {
    throw new Error(`${year} is not the active budgeting year (${activeBudgetingYear}) — this year is read-only, sourced from Zoho.`);
  }
}

// ---- Reads -------------------------------------------------------------------

// How many months of "actual" data should exist for a given year — was
// hardcoded to August (index 7) everywhere under the assumption the app
// would only ever show the current year. Now computed per year: a closed
// past year has a full 12 months of real actuals; the current year has
// however many months have actually elapsed; a future year (the active
// budgeting year, before it's underway) has none yet. Returns a 0-indexed
// month (11 = December, -1 = no months yet) — used as an inclusive cutoff.
export function getActualCutoffMonthIndex(year) {
  const currentCalendarYear = new Date().getFullYear();
  if (year < currentCalendarYear) return 11;
  if (year > currentCalendarYear) return -1;
  return new Date().getMonth();
}

export async function getVendors(year) {
  const activeBudgetingYear = await getActiveBudgetingYear();
  const isEditableYear = year === activeBudgetingYear;

  let budgetSnap, actualsSnap;
  if (isEditableYear) {
    const versionId = await getWorkingVersionId();
    [budgetSnap, actualsSnap] = await Promise.all([
      getDocs(collection(db, "budgetVersions", versionId, "vendorBudgets")),
      getDocs(collection(db, "ciprActuals", String(year), "vendors")),
    ]);
  } else {
    [budgetSnap, actualsSnap] = await Promise.all([
      getDocs(collection(db, "zohoBudgets", String(year), "vendorBudgets")),
      getDocs(collection(db, "ciprActuals", String(year), "vendors")),
    ]);
    // zohoBudgets is real-synced-data-only (client can't write there — see
    // firestore.rules). If nothing has ever been synced for this year yet
    // (a genuinely future year), fall back to budgetProjections — the
    // growth-based projection tool's own client-writable collection. Real
    // synced data always wins if it exists; this only fires when it doesn't.
    if (budgetSnap.empty) {
      budgetSnap = await getDocs(collection(db, "budgetProjections", String(year), "vendorBudgets"));
    }
  }

  // decodeURIComponent — doc IDs are encodeURIComponent'd on write (see
  // quickEditVendorBudget/applyVendorPlan below, syncBudgets, and
  // scripts/seed-baseline-budget.js) because Firestore doc IDs can't
  // contain "/", and "H3/Ridge" is a real vendor name.
  const budgets = {}; budgetSnap.forEach(d => (budgets[decodeURIComponent(d.id)] = d.data()));
  const actuals = {}; actualsSnap.forEach(d => (actuals[decodeURIComponent(d.id)] = d.data()));

  const vendorNames = new Set([...Object.keys(budgets), ...Object.keys(actuals)]);
  const out = [];
  for (const vendor of vendorNames) {
    const b = budgets[vendor] || EMPTY_BUDGET;
    const a = actuals[vendor] || EMPTY_ACTUALS;
    // Real, separate Macnica/SKO actuals — syncCipr (functions/index.js)
    // now aggregates each scenario independently, using each row's own
    // "Included in Macnica?"/"Included in SKO?" flag and the matching GP
    // field (GROSS PROFIT vs GROSS PROFIT-SKO — these genuinely differ,
    // confirmed). Canonical fields below default to Macnica (a.macnica,
    // falling back to the flat un-scenarioed fields for any vendor doc
    // synced before this split existed); the explicit _sko fields let
    // scenarioVendors (App.jsx) swap in SKO actuals client-side when the
    // scenario toggle is set to SKO, the same no-refetch pattern already
    // used for the SKO budget uplift.
    const macnicaActuals = a.macnica || a;
    const skoActuals = a.sko || EMPTY_ACTUALS;
    const monthlyBudgetRevenue = b.monthlyBudgetRevenue || new Array(MONTHS).fill(0);
    // monthlyBudgetGp: real synced data for non-editable years (from the
    // Zoho vendor-wise view, which has a GP figure per month). The editable
    // year has no such array — Plan-FY entries only ever set a flat annual
    // gpPct — so approximate each month as that month's revenue times the
    // annual GP%, consistent with how GP is treated everywhere else for
    // that year.
    const monthlyBudgetGp = b.monthlyBudgetGp || monthlyBudgetRevenue.map(m => m * (b.gpPct || 0));
    out.push({
      vendor,
      year,
      editable: isEditableYear,
      budget_revenue: b.revenue || 0,
      budget_gp: b.gp || 0,
      gp_pct: b.gpPct || 0,
      monthly_budget_revenue: monthlyBudgetRevenue,
      monthly_budget_gp: monthlyBudgetGp,
      ytd_budget_revenue: monthlyBudgetRevenue.slice(0, getActualCutoffMonthIndex(year) + 1).reduce((s, v) => s + v, 0),
      ytd_budget_gp: monthlyBudgetGp.slice(0, getActualCutoffMonthIndex(year) + 1).reduce((s, v) => s + v, 0),
      actual_revenue_ytd: macnicaActuals.actualRevenueYtd || 0,
      actual_gp_ytd: macnicaActuals.actualGpYtd || 0,
      monthly_actual_revenue: macnicaActuals.monthlyActualRevenue || new Array(MONTHS).fill(0),
      monthly_actual_gp: macnicaActuals.monthlyActualGp || new Array(MONTHS).fill(0),
      actual_revenue_ytd_sko: skoActuals.actualRevenueYtd || 0,
      actual_gp_ytd_sko: skoActuals.actualGpYtd || 0,
      monthly_actual_revenue_sko: skoActuals.monthlyActualRevenue || new Array(MONTHS).fill(0),
      monthly_actual_gp_sko: skoActuals.monthlyActualGp || new Array(MONTHS).fill(0),
      country_grid: b.countryGrid || null,
      // Already synced by syncCipr (functions/index.js) — just not
      // surfaced here until now. bu_head/tier come from CIPR's "BU Heads"
      // and "Vendor Category(From vendor tire)" columns (most-common value
      // across the vendor's invoices); regions is the list of region names
      // this vendor actually has revenue in, for the region filter.
      // region_revenue is the actual $ breakdown by sub-region — for the
      // drill-down modal's sub-region performance chart. Revenue only (no
      // GP-by-region or budget-by-region exists at the vendor level), and
      // always Macnica-based (this field isn't scenario-split — only
      // captured from Macnica-included invoices, see syncCipr).
      bu_head: a.buHead || null,
      tier: a.tier || null,
      regions: a.regionRevenue ? Object.keys(a.regionRevenue) : [],
      region_revenue: a.regionRevenue || {},
    });
  }
  return out.sort((x, y) => y.budget_revenue - x.budget_revenue);
}

// For the active budgeting year, region totals are derived from each
// vendor's own countryGrid (real per-vendor Plan-FY data — see App.jsx).
// For every other year, there's no vendor+country cross in the Zoho
// source data (see functions/index.js syncBudgets), so this reads the
// company-wide per-country totals synced into regionBudgets instead.
export async function getRegions(year) {
  const activeBudgetingYear = await getActiveBudgetingYear();
  const isEditableYear = year === activeBudgetingYear;

  if (isEditableYear) {
    const budgetSnap = await getDocs(collection(db, "budgetVersions", await getWorkingVersionId(), "vendorBudgets"));
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

  // Non-editable year: budget comes from the company-wide regionBudgets
  // sync (no vendor dimension — see syncBudgets). Actuals are aggregated
  // here from EVERY vendor's own regionRevenue (captured by syncCipr from
  // CIPR's Sub Region column per invoice, alongside tier/BU head) — this
  // was previously hardcoded to 0, which is the bug being fixed here.
  // GP-by-region isn't captured directly (CIPR doesn't split GP by region
  // per invoice in what we're currently parsing), so it's approximated:
  // each vendor's own actual GP% is applied to that vendor's regionRevenue
  // split — consistent with how the editable year's fallback already
  // approximates region GP from a vendor's overall gpPct.
  const [regionSnap0, actualsSnap] = await Promise.all([
    getDocs(collection(db, "zohoBudgets", String(year), "regionBudgets")),
    getDocs(collection(db, "ciprActuals", String(year), "vendors")),
  ]);
  const regionSnap = regionSnap0.empty
    ? await getDocs(collection(db, "budgetProjections", String(year), "regionBudgets"))
    : regionSnap0;

  const actualRegionRevenue = {}, actualRegionGp = {};
  actualsSnap.forEach(d => {
    const a = d.data();
    if (!a.regionRevenue) return;
    const vendorGpPct = a.actualRevenueYtd ? (a.actualGpYtd || 0) / a.actualRevenueYtd : 0;
    for (const region in a.regionRevenue) {
      const amt = a.regionRevenue[region] || 0;
      actualRegionRevenue[region] = (actualRegionRevenue[region] || 0) + amt;
      actualRegionGp[region] = (actualRegionGp[region] || 0) + amt * vendorGpPct;
    }
  });

  const budgetRegions = {};
  regionSnap.docs.forEach(d => {
    const r = d.data();
    budgetRegions[decodeURIComponent(d.id)] = { budget_revenue: r.revenue || 0, budget_gp: r.gp || 0 };
  });

  const allRegionNames = new Set([...Object.keys(budgetRegions), ...Object.keys(actualRegionRevenue)]);
  return [...allRegionNames]
    .map(region => ({
      region,
      budget_revenue: budgetRegions[region]?.budget_revenue || 0,
      budget_gp: budgetRegions[region]?.budget_gp || 0,
      actual_revenue_ytd: actualRegionRevenue[region] || 0,
      actual_gp_ytd: actualRegionGp[region] || 0,
    }))
    .sort((a, b) => b.budget_revenue - a.budget_revenue);
}

// ---- Writes (active budgeting year ONLY — every function below guards this) --

export async function quickEditVendorBudget(vendorName, newRevenue, year) {
  const activeBudgetingYear = await getActiveBudgetingYear();
  assertEditableYear(year, activeBudgetingYear);

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

export async function applyVendorPlan(vendorName, grid, gpPct, year) {
  const activeBudgetingYear = await getActiveBudgetingYear();
  assertEditableYear(year, activeBudgetingYear);

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

// ---- Add/remove vendors for the active budgeting year (item 2) -------------
// Not all vendors are budgeted from January — a vendor signed mid-year
// should only get budget from its actual start month onward. `startMonth`
// (1-12) is stored on the vendor doc so the Plan-FY grid can grey out
// earlier months; monthlyBudgetRevenue itself starts as all-zero regardless
// (a brand new vendor has no revenue yet) until Plan-FY or an edit fills it.
export async function addVendor(vendorName, year, startMonth = 1) {
  const activeBudgetingYear = await getActiveBudgetingYear();
  assertEditableYear(year, activeBudgetingYear);
  if (!vendorName || !vendorName.trim()) throw new Error("Vendor name is required.");

  const versionId = await getWorkingVersionId();
  const ref = doc(db, "budgetVersions", versionId, "vendorBudgets", encodeURIComponent(vendorName.trim()));
  const existing = await getDoc(ref);
  if (existing.exists()) throw new Error(`"${vendorName}" already exists for ${year}.`);

  await setDoc(ref, {
    revenue: 0, gp: 0, gpPct: 0,
    monthlyBudgetRevenue: new Array(MONTHS).fill(0),
    countryGrid: null,
    startMonth: Math.min(12, Math.max(1, startMonth)),
    addedAt: Timestamp.now(),
  });
}

export async function removeVendor(vendorName, year) {
  const activeBudgetingYear = await getActiveBudgetingYear();
  assertEditableYear(year, activeBudgetingYear);
  const versionId = await getWorkingVersionId();
  await deleteDoc(doc(db, "budgetVersions", versionId, "vendorBudgets", encodeURIComponent(vendorName)));
}

// ---- Vendor history for the planner modal (item 4) --------------------------
// Shows management the vendor's last 3 CLOSED years (the 3 years immediately
// before the active budgeting year — e.g. 2024-2026 when budgeting for 2027)
// so they have real performance context before setting next year's number.
//
// Region/month "linearity" is expressed as a % SHARE of the vendor's total
// across those 3 years (the seasonality/geography SHAPE), not absolute
// dollars — confirmed this is what "linearity in %, not actual numbers"
// meant. Blending all 3 years (rather than just the latest) smooths out
// one-off anomalies in any single year.
//
// tier/buHead come from ciprActuals (populated by syncCipr from CIPR's
// "Vendor Category(From vendor tire)" [sic] and "BU Heads" columns) —
// whichever value appears most often across the vendor's invoices in the
// most recent year that has one, so a historical typo/change in an older
// year doesn't override current reality.
export async function getVendorHistory(vendorName, referenceYear) {
  const years = [referenceYear - 3, referenceYear - 2, referenceYear - 1];
  const encoded = encodeURIComponent(vendorName);

  const yearRows = [];
  let tier = null, buHead = null;
  const regionTotals = {};
  const monthTotals = new Array(MONTHS).fill(0);

  for (const year of years) {
    const [budgetSnap, actualSnap] = await Promise.all([
      getDoc(doc(db, "zohoBudgets", String(year), "vendorBudgets", encoded)),
      getDoc(doc(db, "ciprActuals", String(year), "vendors", encoded)),
    ]);
    const b = budgetSnap.exists() ? budgetSnap.data() : null;
    const a = actualSnap.exists() ? actualSnap.data() : null;

    const budgetRevenue = b?.revenue || 0;
    const actualRevenue = a?.actualRevenueYtd || 0;
    yearRows.push({
      year,
      budget_revenue: budgetRevenue,
      actual_revenue: actualRevenue,
      achievement_pct: budgetRevenue ? actualRevenue / budgetRevenue : null,
    });

    // Later (more recent) years overwrite tier/buHead — see comment above.
    if (a?.tier) tier = a.tier;
    if (a?.buHead) buHead = a.buHead;
    if (a?.regionRevenue) for (const r in a.regionRevenue) regionTotals[r] = (regionTotals[r] || 0) + a.regionRevenue[r];
    if (a?.monthlyActualRevenue) a.monthlyActualRevenue.forEach((v, i) => { monthTotals[i] += v || 0; });
  }

  const regionSum = Object.values(regionTotals).reduce((s, v) => s + v, 0);
  const regionLinearity = Object.entries(regionTotals)
    .map(([region, amt]) => ({ region, pct: regionSum ? amt / regionSum : 0 }))
    .sort((a, b) => b.pct - a.pct);

  const monthSum = monthTotals.reduce((s, v) => s + v, 0);
  const monthLinearity = monthTotals.map((amt, i) => ({ monthIndex: i, pct: monthSum ? amt / monthSum : 0 }));

  return { years: yearRows, tier, buHead, regionLinearity, monthLinearity };
}

function scaleGrid(grid, ratio) {
  const out = {};
  for (const m in grid) { out[m] = {}; for (const c in grid[m]) out[m][c] = grid[m][c] * ratio; }
  return out;
}

// ---- Versioning (unchanged — always operates on the active budgeting year's
// working draft, since that's the only editable year) -------------------------

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

// ---- Multi-year budget projection (growth-based bulk generation) ----------
// "Don't start from scratch" for years management hasn't gotten to yet:
// projects a baseline year's vendor budgets (monthly phasing preserved,
// i.e. the same linearity/seasonality) forward across several years,
// compounding a growth% each year, so there's a real starting point to
// adjust from instead of a blank sheet.
//
// Writes to TWO different places depending on the target year, matching
// the app's existing year model exactly (see file header):
//   - The active budgeting year -> budgetVersions/working/vendorBudgets,
//     the actual editable store, using setDoc with { merge: true } so an
//     existing hand-entered vendor is never silently overwritten.
//   - Every other (future) year -> budgetProjections/{year}/vendorBudgets
//     and regionBudgets — NOT zohoBudgets, which is locked to server-side
//     (Cloud Function) writes only via firestore.rules; a client write
//     there fails with a permissions error. getVendors()/getRegions()/
//     getRegionPerformanceData() read zohoBudgets first and only fall
//     back to budgetProjections when zohoBudgets is empty for that year —
//     so a real Zoho sync later naturally takes priority over the
//     projection, without needing to delete or migrate anything.
export async function getRawRegionBudgetDocs(year) {
  const snap = await getDocs(collection(db, "zohoBudgets", String(year), "regionBudgets"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function generateFutureBudgets(baseYear, targetYears, growthPct) {
  const activeBudgetingYear = await getActiveBudgetingYear();
  const [baseVendors, baseRegions] = await Promise.all([
    getVendors(baseYear),
    getRawRegionBudgetDocs(baseYear),
  ]);
  if (baseVendors.length === 0) throw new Error(`No vendor budget data found for ${baseYear} to project from.`);

  const sortedYears = [...targetYears].sort((a, b) => a - b); // compound in order, earliest first
  let cumulativeMultiplier = 1;
  const results = [];

  for (const year of sortedYears) {
    cumulativeMultiplier *= (1 + growthPct / 100);

    if (year === activeBudgetingYear) {
      const versionId = await getWorkingVersionId();
      const batch = writeBatch(db);
      for (const v of baseVendors) {
        const monthlyBudgetRevenue = (v.monthly_budget_revenue || new Array(MONTHS).fill(0)).map(x => x * cumulativeMultiplier);
        const revenue = monthlyBudgetRevenue.reduce((a, b) => a + b, 0);
        const gpPct = v.budget_revenue ? v.budget_gp / v.budget_revenue : 0; // preserve the base year's GP%
        batch.set(doc(db, "budgetVersions", versionId, "vendorBudgets", encodeURIComponent(v.vendor)), {
          revenue, gp: revenue * gpPct, gpPct, monthlyBudgetRevenue,
          countryGrid: null, // base year (non-editable) has no vendor-level country grid to carry forward — region rollup falls back to the company-wide split automatically, same as any unplanned vendor
          addedAt: Timestamp.now(),
        }, { merge: true }); // never clobbers a vendor someone already hand-entered for this year
      }
      await batch.commit();
      results.push({ year, target: "budgetVersions/working (editable)", vendorsWritten: baseVendors.length });
    } else {
      const yearRef = doc(db, "budgetProjections", String(year));
      const vendorBatch = writeBatch(db);
      for (const v of baseVendors) {
        const monthlyBudgetRevenue = (v.monthly_budget_revenue || new Array(MONTHS).fill(0)).map(x => x * cumulativeMultiplier);
        const revenue = monthlyBudgetRevenue.reduce((a, b) => a + b, 0);
        const gpPct = v.budget_revenue ? v.budget_gp / v.budget_revenue : 0;
        vendorBatch.set(doc(collection(yearRef, "vendorBudgets"), encodeURIComponent(v.vendor)), {
          revenue, gp: revenue * gpPct, gpPct,
          monthlyBudgetRevenue, monthlyBudgetGp: monthlyBudgetRevenue.map(x => x * gpPct),
          countryGrid: null,
          generatedAt: Timestamp.now(), generatedFrom: `${baseYear} x ${growthPct}%/yr`,
        });
      }
      await vendorBatch.commit();

      const regionBatch = writeBatch(db);
      for (const c of baseRegions) {
        const monthlyBudgetRevenue = (c.monthlyBudgetRevenue || new Array(MONTHS).fill(0)).map(x => x * cumulativeMultiplier);
        const revenue = monthlyBudgetRevenue.reduce((a, b) => a + b, 0);
        const gpRatio = c.revenue ? c.gp / c.revenue : 0;
        regionBatch.set(doc(collection(yearRef, "regionBudgets"), c.id), {
          revenue, gp: revenue * gpRatio, region: c.region || null, subRegion: c.subRegion || null, monthlyBudgetRevenue,
          generatedAt: Timestamp.now(), generatedFrom: `${baseYear} x ${growthPct}%/yr`,
        });
      }
      await regionBatch.commit();
      results.push({ year, target: `budgetProjections/${year} (placeholder — read here only until a real Zoho sync exists for this year, which then takes priority automatically)`, vendorsWritten: baseVendors.length, regionsWritten: baseRegions.length });
    }
  }

  return results;
}

// ---- Per-tab access control (customized login access) ----

// The canonical set of Sidebar tab ids — kept here (not just inline in
// App.jsx's Sidebar component) so it's the one place to check when deciding
// what a valid `allowedTabs` entry can be, e.g. from an admin screen or a
// one-off script that sets it on someone's approvedUsers doc.
export const APP_TAB_IDS = [
  "overview", "vendors", "regions", "otherExpenses", "employees",
  "cashFlow", "pl", "operationalStats", "assumptions", "versions",
];

/**
 * The signed-in user's own access profile from approvedUsers/{email} — read
 * directly from the client, the same read AuthGate.jsx already relies on
 * (firestore.rules lets any signed-in user read the allowlist so it can
 * check itself in; see the `approvedUsers` rule comment).
 *
 * `allowedTabs` is optional and additive-only in meaning: absent, null, or
 * an empty array means "no restriction — every tab", so every existing
 * approvedUsers doc keeps working exactly as before until someone
 * deliberately sets this field (e.g. `allowedTabs: ["employees"]` for an
 * HR-only login). This is the client-side (UI) half of tab restriction —
 * see firestore.rules' `canAccessTab()` for the server-side half that
 * actually stops a restricted user from reading data behind a hidden tab,
 * not just from seeing it in the sidebar.
 */
export async function getMyAccessProfile() {
  const email = auth.currentUser?.email?.toLowerCase();
  if (!email) return { allowedTabs: null, name: null, role: null };
  try {
    const snap = await getDoc(doc(db, "approvedUsers", email));
    if (!snap.exists()) return { allowedTabs: null, name: null, role: null };
    const data = snap.data();
    const allowedTabs = Array.isArray(data.allowedTabs) && data.allowedTabs.length > 0 ? data.allowedTabs : null;
    return { allowedTabs, name: data.name || null, role: data.role || null };
  } catch (e) {
    // Fails open to "no restriction" rather than locking everyone out if
    // this read has a transient problem — firestore.rules is still the
    // real backstop for data access either way.
    console.error("getMyAccessProfile failed, defaulting to unrestricted:", e.message);
    return { allowedTabs: null, name: null, role: null };
  }
}
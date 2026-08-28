/**
 * Vendor Management Performance layer — the analysis/forecast logic behind
 * the historical/in-progress-year Vendors view (VendorPerformanceView in
 * App.jsx). Pure computation functions here; Firestore read/write for the
 * one piece of new persisted state (Management Forecast overrides) below.
 *
 * Deliberately NOT used for the active/editable budgeting year — that year
 * keeps the original simple budgeting table untouched, per the explicit
 * requirement to not clutter the budget-entry workflow.
 */
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, Timestamp } from "firebase/firestore";
import { app } from "./firebase.js";
import { getActualCutoffMonthIndex } from "./firestoreData.js";

const db = getFirestore(app);

export function isYearCompleted(year) {
  return year < new Date().getFullYear();
}

// Full classification the tool needs to reason about a year correctly:
// - "completed": fully in the past — actuals are final, status/forecast
//   concepts don't apply anymore (nothing left to forecast or be "on
//   track" against).
// - "current_budgeting_year": the one actively being planned/edited
//   (settings/config.activeBudgetingYear) — usually next calendar year.
// - "current_year": this calendar year, in progress, accumulating
//   actuals, but not the one being budgeted (typical once the budgeting
//   cycle has moved on to next year).
// - "future_budgeting_year": further out than the active budgeting year —
//   a placeholder year with no real activity yet.
export function classifyYear(year, activeBudgetingYear) {
  const currentCalendarYear = new Date().getFullYear();
  if (year < currentCalendarYear) return "completed";
  if (year === activeBudgetingYear) return "current_budgeting_year";
  if (year === currentCalendarYear) return "current_year";
  return "future_budgeting_year";
}

export const YEAR_CLASSIFICATION_LABELS = {
  completed: "Completed",
  current_budgeting_year: "Current Budgeting Year",
  current_year: "Current Year",
  future_budgeting_year: "Future Budgeting Year",
};

// ---- FY System Forecast ----------------------------------------------------
// Run-rate method: assume the YTD actual-vs-budget ratio holds for the rest
// of the year, applied to the REMAINING months' own budgeted phasing (not
// split evenly) — so a vendor whose budget is seasonally back-loaded still
// gets a back-loaded forecast, not a flat extrapolation.
//
// Simplification worth flagging: this uses the vendor's OWN this-year
// budget phasing as the seasonality signal for the remaining months, not a
// separately-fetched prior-year actual monthly shape. The budget phasing
// itself is usually already seasonal (it comes from Zoho's vendor-wise
// view, phased month by month), so this is a reasonable proxy — but if a
// truly independent seasonality signal (e.g. last year's actual curve) is
// wanted instead, that's a real enhancement, not what's built here.
export function computeFySystemForecast(vendorRow, year) {
  const cutoffIdx = getActualCutoffMonthIndex(year);
  const monthlyBudget = vendorRow.monthly_budget_revenue || [];
  const monthlyBudgetGp = vendorRow.monthly_budget_gp || [];
  const ytdBudget = monthlyBudget.slice(0, cutoffIdx + 1).reduce((s, v) => s + v, 0);
  const ytdActual = vendorRow.actual_revenue_ytd || 0;
  const ytdActualGp = vendorRow.actual_gp_ytd || 0;

  const remainingBudget = monthlyBudget.slice(cutoffIdx + 1).reduce((s, v) => s + v, 0);
  const remainingBudgetGp = monthlyBudgetGp.slice(cutoffIdx + 1).reduce((s, v) => s + v, 0);

  // If there's no YTD budget to compute a ratio from (e.g. a vendor with
  // no budget phasing entered), fall back to a 1:1 ratio — forecast the
  // remaining months at their budgeted value, neither optimistic nor
  // pessimistic, rather than dividing by zero or guessing.
  const runRateRatio = ytdBudget > 0 ? ytdActual / ytdBudget : 1;
  const gpRunRateRatio = ytdBudget > 0 && remainingBudgetGp > 0 ? ytdActualGp / (monthlyBudgetGp.slice(0, cutoffIdx + 1).reduce((s, v) => s + v, 0) || 1) : 1;

  const fyForecastRevenue = ytdActual + remainingBudget * runRateRatio;
  const fyForecastGp = ytdActualGp + remainingBudgetGp * gpRunRateRatio;

  return { fyForecastRevenue, fyForecastGp, runRateRatio, gpRunRateRatio };
}

// ---- Vendor status ----------------------------------------------------------
// Four tiers, considering BOTH revenue pace and margin health — a vendor
// hitting its revenue number on razor-thin GP% is still a real problem,
// which "On Track" based on revenue alone would hide.
//
// Thresholds are a reasonable starting point, not a validated policy —
// flag if these should be tuned or made configurable later:
//   - Margin Risk: actual GP% is 3+ points below budgeted GP% (any revenue pace)
//   - Needs Attention: YTD revenue achievement < 80% of YTD budget
//   - Watch: YTD revenue achievement 80-95%
//   - On Track: everything else (95%+ achievement, healthy margin)
export function computeVendorStatus(vendorRow) {
  // Zero budget with real actuals means there's nothing to genuinely be
  // "on track" against — the vendor likely started transacting outside
  // the budget process (or the budget just hasn't been entered yet).
  // Previously this fell through to a hardcoded 100% achievement, which
  // trivially became "On Track" — misleading, since it wasn't measuring
  // anything. Flagged as "Watch" instead: worth a look, not urgent.
  if (!(vendorRow.ytd_budget_revenue > 0) && vendorRow.actual_revenue_ytd > 0) return "watch";

  const ytdAchievementPct = vendorRow.ytd_budget_revenue > 0 ? vendorRow.actual_revenue_ytd / vendorRow.ytd_budget_revenue : 0;
  const budgetGpPct = vendorRow.budget_revenue > 0 ? vendorRow.budget_gp / vendorRow.budget_revenue : 0;
  const actualGpPct = vendorRow.actual_revenue_ytd > 0 ? vendorRow.actual_gp_ytd / vendorRow.actual_revenue_ytd : 0;
  const gpPtsBehind = (budgetGpPct - actualGpPct) * 100;

  if (gpPtsBehind >= 3) return "margin_risk";
  if (ytdAchievementPct < 0.80) return "needs_attention";
  if (ytdAchievementPct < 0.95) return "watch";
  return "on_track";
}

export const STATUS_LABELS = {
  on_track: "On Track",
  watch: "Watch",
  needs_attention: "Needs Attention",
  margin_risk: "Margin Risk",
};
export const STATUS_COLORS = {
  on_track: "#1B8A3A",
  watch: "#8A6D1A",
  needs_attention: "#C00000",
  margin_risk: "#7A3F9A",
};

// ---- Management Forecast (editable override, alongside System Forecast) ----
// Not year-restricted to the active budgeting year — the whole point is
// letting management annotate a FORECAST for historical/in-progress years,
// which is the opposite of normal budget editing (budget years are locked,
// forecast years are exactly the ones this is for).
export async function getManagementForecasts(year) {
  const snap = await getDocs(collection(db, "managementForecasts", String(year), "vendors"));
  const out = {};
  snap.docs.forEach(d => { out[decodeURIComponent(d.id)] = d.data(); });
  return out;
}

export async function setManagementForecast(year, vendorName, revenue, updatedByEmail) {
  await setDoc(doc(db, "managementForecasts", String(year), "vendors", encodeURIComponent(vendorName)), {
    revenue, updatedBy: updatedByEmail, updatedAt: Timestamp.now(),
  }, { merge: true });
}

// ---- Region-level performance data (any granularity) -----------------------
// Powers RegionPerformanceView the same way getVendors() powers
// VendorPerformanceView. Two real data sources, deliberately not the same
// one getRegions() uses for the simple Regions tab:
//   - BUDGET: zohoBudgets/{year}/regionBudgets, country-level docs that
//     each carry region/subRegion attributes and a monthly REVENUE
//     phasing array — but no monthly GP phasing (Zoho's country-wise view
//     doesn't split GP by month), so monthly budget GP is approximated
//     here by applying the group's own blended annual GP% to each
//     month's revenue.
//   - ACTUALS: ciprActuals/{year}/invoices, the raw invoice-level rows —
//     these have REAL per-invoice GP and month, so actual GP-by-region
//     here is exact, not approximated (unlike the simple Regions tab,
//     which still approximates actual GP from each vendor's blended %).
//
// granularity: "region" | "subRegion" | "country". Country-level budget
// comes from the country-wise view's "Country" field; country-level
// actuals come from CIPR's "Billing Country" field — these are DIFFERENT
// source columns and may not always match by name (e.g. "Saudi Arabia" vs
// a variant spelling), same known risk flagged for subRegion matching
// earlier. Region/subRegion levels don't have this problem since both
// budget and actuals already carry those exact attributes directly.
export async function getRegionPerformanceData(year, granularity, scenario = "Macnica") {
  let [budgetSnap, invoicesSnap] = await Promise.all([
    getDocs(collection(db, "zohoBudgets", String(year), "regionBudgets")),
    getDocs(collection(db, "ciprActuals", String(year), "invoices")),
  ]);
  // Same fallback as getVendors()/getRegions() in firestoreData.js: real
  // synced data always wins; this only fires when nothing has ever been
  // synced for this year (a genuinely future year with only a growth
  // projection, if one was generated).
  if (budgetSnap.empty) {
    budgetSnap = await getDocs(collection(db, "budgetProjections", String(year), "regionBudgets"));
  }

  const keyForBudgetDoc = (id, data) => {
    if (granularity === "country") return decodeURIComponent(id);
    if (granularity === "region") return data.region || "(unassigned)";
    return data.subRegion || "(unassigned)"; // subRegion
  };
  const keyForInvoiceRow = (row) => {
    if (granularity === "country") return row.billingCountry || "(unassigned)";
    if (granularity === "region") return row.region || "(unassigned)";
    return row.subRegion || "(unassigned)"; // subRegion
  };

  const groups = {}; // name -> { budget_revenue, budget_gp, monthly_budget_revenue[12], actual_revenue_ytd, actual_gp_ytd, monthly_actual_revenue[12], monthly_actual_gp[12] }
  const ensure = (name) => {
    if (!groups[name]) {
      groups[name] = {
        name, budget_revenue: 0, budget_gp: 0, monthly_budget_revenue: new Array(12).fill(0),
        actual_revenue_ytd: 0, actual_gp_ytd: 0, monthly_actual_revenue: new Array(12).fill(0), monthly_actual_gp: new Array(12).fill(0),
      };
    }
    return groups[name];
  };

  budgetSnap.docs.forEach(d => {
    const data = d.data();
    const g = ensure(keyForBudgetDoc(d.id, data));
    g.budget_revenue += data.revenue || 0;
    g.budget_gp += data.gp || 0;
    (data.monthlyBudgetRevenue || []).forEach((v, i) => { g.monthly_budget_revenue[i] += v || 0; });
  });

  invoicesSnap.docs.forEach(d => {
    const row = d.data();
    if (!row.month || row.month < 1 || row.month > 12) return;
    // Same real distinction as the vendor level: a row only counts toward
    // whichever scenario(s) it's actually flagged for, and GP differs by
    // scenario even though revenue doesn't (gpSko vs gp). Rows synced
    // before this fields existed (includedInMacnica/includedInSko both
    // undefined) fall back to counting as Macnica, matching the flat
    // fields' own Macnica-default fallback elsewhere.
    const includedInMacnica = row.includedInMacnica ?? true;
    const includedInSko = row.includedInSko ?? false;
    if (scenario === "SKO" ? !includedInSko : !includedInMacnica) return;
    const gp = scenario === "SKO" ? (row.gpSko || 0) : (row.gp || 0);
    const g = ensure(keyForInvoiceRow(row));
    g.actual_revenue_ytd += row.revenue || 0;
    g.actual_gp_ytd += gp;
    g.monthly_actual_revenue[row.month - 1] += row.revenue || 0;
    g.monthly_actual_gp[row.month - 1] += gp;
  });

  const cutoffIdx = getActualCutoffMonthIndex(year);
  return Object.values(groups).map(g => {
    const blendedGpPct = g.budget_revenue ? g.budget_gp / g.budget_revenue : 0;
    return {
      ...g,
      monthly_budget_gp: g.monthly_budget_revenue.map(v => v * blendedGpPct), // approximated — see file comment above
      ytd_budget_revenue: g.monthly_budget_revenue.slice(0, cutoffIdx + 1).reduce((s, v) => s + v, 0),
      ytd_budget_gp: g.monthly_budget_revenue.slice(0, cutoffIdx + 1).reduce((s, v) => s + v, 0) * blendedGpPct,
    };
  }).sort((a, b) => b.budget_revenue - a.budget_revenue);
}
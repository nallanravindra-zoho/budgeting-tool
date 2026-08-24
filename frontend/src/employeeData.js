/**
 * Data layer for the Employee Cost Module (spec: Employee_Cost_Module_Spec.md).
 *
 * SCHEMA DECISION: employees are a single persistent collection, NOT
 * year-scoped like vendor budgets. A real person continues across budget
 * years — what changes year to year is their comp (edited directly, "the
 * current rate," per spec §4.2) and their hikes (which per spec §4.4 ARE
 * "per employee per budget year", so those alone are stored keyed by year:
 * hikes: { [year]: [{effectiveMonth, pct}] } ).
 *
 * BASE BUILT NOW: employee CRUD (add/edit/resign/delete), hikes, monthly
 * cost calculation (spec §4.6), benefit eligibility (spec §4.5) with
 * configurable thresholds + per-employee override, and dashboard stats
 * (spec §5.1). NOT YET BUILT: vendor-allocation SPLIT percentages (spec
 * open question #4 — currently a free-text/single string, matching "today"
 * per the spec's own fallback), and wiring employee cost into the PL tab's
 * existing SEED_EMPLOYEES-based allocation (still separate for now).
 */
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc, deleteDoc, Timestamp,
} from "firebase/firestore";
import { app } from "./firebase.js";

const db = getFirestore(app);

// ---- Employee CRUD ---------------------------------------------------------

export async function getEmployees() {
  const snap = await getDocs(collection(db, "employees"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addEmployee(fields) {
  const ref = await addDoc(collection(db, "employees"), {
    ...fields, hikes: {}, benefitOverrides: {}, createdAt: Timestamp.now(),
  });
  return ref.id;
}

export async function updateEmployee(id, fields) {
  await setDoc(doc(db, "employees", id), { ...fields, updatedAt: Timestamp.now() }, { merge: true });
}

// Per spec §4.3: two distinct actions. Resign keeps the record (for
// audit/history) but excludes it from cost/headcount from that month on.
export async function resignEmployee(id, resignationDate) {
  await setDoc(doc(db, "employees", id), { resignationDate, updatedAt: Timestamp.now() }, { merge: true });
}

export async function reinstateEmployee(id) {
  await setDoc(doc(db, "employees", id), { resignationDate: null, updatedAt: Timestamp.now() }, { merge: true });
}

// Hard delete — data-entry mistakes only, per spec §4.3, not for real resignations.
export async function deleteEmployee(id) {
  await deleteDoc(doc(db, "employees", id));
}

// ---- Hikes (per spec §4.4 — one employee's hikes are per budget year) -----

export async function setEmployeeHikes(id, year, hikes) {
  // hikes: [{ effectiveMonth: 1-12, pct: number }]
  const ref = doc(db, "employees", id);
  const snap = await getDoc(ref);
  const current = snap.exists() ? (snap.data().hikes || {}) : {};
  await setDoc(ref, { hikes: { ...current, [year]: hikes }, updatedAt: Timestamp.now() }, { merge: true });
}

// ---- Benefit eligibility thresholds (configurable in one place, spec §4.5) -

const DEFAULT_BENEFIT_THRESHOLDS = { insuranceMonths: 0, airfareMonths: 6, gratuityMonths: 12, esopMonths: 12 };

export async function getBenefitThresholds() {
  const snap = await getDoc(doc(db, "settings", "employeeBenefitThresholds"));
  return snap.exists() ? { ...DEFAULT_BENEFIT_THRESHOLDS, ...snap.data() } : DEFAULT_BENEFIT_THRESHOLDS;
}

export async function setBenefitThresholds(thresholds) {
  await setDoc(doc(db, "settings", "employeeBenefitThresholds"), thresholds, { merge: true });
}

// ---- Monthly cost calculation (spec §4.6) ----------------------------------
// Compounds each of this year's hikes from its effective month onward —
// NOT additive. A hike at month 4 (+10%) followed by one at month 9 (+5%)
// means: months 1-3 at base rate, months 4-8 at base*1.10, months 9-12 at
// base*1.10*1.05 (not base*1.15).
export function computeEmployeeMonthlyCost(employee, year) {
  const monthly = new Array(12).fill(0);
  const base = (employee.basic || 0) + (employee.hra || 0) + (employee.otherAllowance || 0) + (employee.vp || 0);
  const joining = employee.joiningDate ? new Date(employee.joiningDate) : null;
  const resignation = employee.resignationDate ? new Date(employee.resignationDate) : null;
  const hikesThisYear = ((employee.hikes && employee.hikes[year]) || []).slice().sort((a, b) => a.effectiveMonth - b.effectiveMonth);

  for (let m = 0; m < 12; m++) {
    const monthStart = new Date(year, m, 1);
    if (joining && monthStart < new Date(joining.getFullYear(), joining.getMonth(), 1)) continue; // before joining — stays 0
    if (resignation && monthStart > new Date(resignation.getFullYear(), resignation.getMonth(), 1)) continue; // after resignation — stays 0

    let multiplier = 1;
    for (const hike of hikesThisYear) {
      if (hike.effectiveMonth <= m + 1) multiplier *= (1 + (hike.pct || 0) / 100);
    }
    monthly[m] = base * multiplier;
  }
  return monthly;
}

// ---- Benefit eligibility (spec §4.5) ---------------------------------------
// Returns { status: "eligible" | "eligible_from" | "not_eligible", fromMonth?: 1-12 }
// per benefit, for the given budget year. A manual override on the
// employee record (benefitOverrides.<benefit> = true/false) always wins.
export function computeBenefitEligibility(employee, year, thresholds) {
  const benefits = ["insurance", "airfare", "gratuity", "esop"];
  const thresholdKey = { insurance: "insuranceMonths", airfare: "airfareMonths", gratuity: "gratuityMonths", esop: "esopMonths" };
  const out = {};
  const joining = employee.joiningDate ? new Date(employee.joiningDate) : null;

  for (const benefit of benefits) {
    const override = employee.benefitOverrides && employee.benefitOverrides[benefit];
    if (override === true) { out[benefit] = { status: "eligible", overridden: true }; continue; }
    if (override === false) { out[benefit] = { status: "not_eligible", overridden: true }; continue; }
    if (!joining) { out[benefit] = { status: "not_eligible" }; continue; }

    const thresholdMonths = thresholds[thresholdKey[benefit]] ?? 0;
    // Month index (0-based, absolute) at which tenure crosses the threshold.
    const eligibleFromAbsolute = joining.getFullYear() * 12 + joining.getMonth() + thresholdMonths;
    const yearStartAbsolute = year * 12 + 0;
    const yearEndAbsolute = year * 12 + 11;

    if (eligibleFromAbsolute <= yearStartAbsolute) out[benefit] = { status: "eligible" };
    else if (eligibleFromAbsolute > yearEndAbsolute) out[benefit] = { status: "not_eligible" };
    else out[benefit] = { status: "eligible_from", fromMonth: (eligibleFromAbsolute % 12) + 1 };
  }
  return out;
}

// ---- Dashboard stats (spec §5.1) -------------------------------------------
export function computeEmployeeDashboardStats(employees, year) {
  const today = new Date();
  const isActiveInYear = (e) => {
    const joining = e.joiningDate ? new Date(e.joiningDate) : null;
    const resignation = e.resignationDate ? new Date(e.resignationDate) : null;
    if (joining && joining > new Date(year, 11, 31)) return false; // joins after this year ends
    if (resignation && resignation < new Date(year, 0, 1)) return false; // resigned before this year starts
    // Previously only checked against the START of the selected year, so
    // someone who resigned mid-year (any date within the year) still
    // passed and counted as active — this is "currently active" headcount,
    // so it needs to check against the real current date too, not just
    // the year boundary.
    if (resignation && resignation <= today) return false;
    return true;
  };
  const active = employees.filter(isActiveInYear);

  const newHiresByQuarter = [0, 0, 0, 0];
  for (const e of active) {
    if (!e.joiningDate) continue;
    const j = new Date(e.joiningDate);
    if (j.getFullYear() === year) newHiresByQuarter[Math.floor(j.getMonth() / 3)]++;
  }

  const byDepartment = {};
  for (const e of active) {
    const dept = e.department || "(unspecified)";
    byDepartment[dept] = (byDepartment[dept] || 0) + 1;
  }

  const byLocation = {};
  for (const e of active) {
    const loc = e.country || "(unspecified)";
    byLocation[loc] = (byLocation[loc] || 0) + 1;
  }

  const resignedThisYear = employees.filter(e => e.resignationDate && new Date(e.resignationDate).getFullYear() === year).length;

  const totalAnnualCost = active.reduce((s, e) => s + computeEmployeeMonthlyCost(e, year).reduce((a, b) => a + b, 0), 0);

  return {
    totalActive: active.length,
    newHiresByQuarter,
    byDepartment,
    byLocation,
    resignedThisYear,
    totalAnnualCost,
  };
}
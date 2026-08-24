/**
 * Assumptions module — a presentation-ready, editable list of the key
 * assumptions/data sources behind this app, for management visibility
 * (built for a COO-facing demo). Two kinds of entries:
 *   - Firestore-backed, user-editable ones (interest rate, tax rate, etc.)
 *   - "Live" ones the Assumptions tab pulls directly from real running
 *     app config (benefit eligibility thresholds, vendor status cutoffs)
 *     rather than storing a separate, potentially-stale copy here.
 */
import { getFirestore, collection, doc, getDocs, setDoc, addDoc, deleteDoc, Timestamp } from "firebase/firestore";
import { app } from "./firebase.js";

const db = getFirestore(app);

export async function getAssumptions() {
  const snap = await getDocs(collection(db, "assumptions"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addAssumption(fields) {
  const ref = await addDoc(collection(db, "assumptions"), { ...fields, updatedAt: Timestamp.now() });
  return ref.id;
}

export async function updateAssumption(id, fields) {
  await setDoc(doc(db, "assumptions", id), { ...fields, updatedAt: Timestamp.now() }, { merge: true });
}

export async function removeAssumption(id) {
  await deleteDoc(doc(db, "assumptions", id));
}

// Seeded once, the first time the tab loads and finds nothing — example/
// test data, explicitly not real finance policy without review. Roughly
// 10 items spanning the categories a COO would actually ask about.
export const DEFAULT_ASSUMPTIONS = [
  { category: "Data Sources", label: "Actuals Source", value: "CIPR Report", unit: "", description: "Invoice-level actuals — revenue, GP, region, customer, partner — synced from Zoho Analytics." },
  { category: "Data Sources", label: "Budget Source", value: "Zoho Budget Files", unit: "", description: "Vendor-wise, country-wise, and month-wise budget views from Zoho Analytics. Only the \"Macnica\" Budget Type is synced; SKO figures come from CIPR's own inclusion flags, not a separate SKO budget file." },
  { category: "Financial", label: "Interest Rate on Loans", value: "10", unit: "% p.a.", description: "Assumed rate for any loan/financing cost modeling." },
  { category: "Financial", label: "Corporate Tax Rate", value: "9", unit: "%", description: "UAE Corporate Tax — placeholder for tax provisioning." },
  { category: "Financial", label: "Depreciation Policy", value: "Straight-line, 3 years", unit: "", description: "Fixed assets depreciated evenly over their useful life." },
  { category: "Financial", label: "Standard Vendor Payment Terms", value: "45", unit: "days", description: "Net payment terms assumed for vendor payables." },
  { category: "Budgeting", label: "Future Year Growth Rate", value: "15-20", unit: "% YoY", description: "Range used when auto-generating placeholder budgets for years beyond the active budgeting year (see Versions tab)." },
  { category: "Budgeting", label: "Budgeting Cycle Start", value: "October", unit: "", description: "The annual budgeting cycle for the following fiscal year begins in October." },
  { category: "Currency", label: "Reporting Currency", value: "USD", unit: "", description: "All figures reported in USD — Zoho exports are pre-converted; no in-app currency conversion." },
  { category: "Currency", label: "FX Hedging", value: "None assumed", unit: "", description: "No FX hedging modeled on invoice-level receivables." },
];
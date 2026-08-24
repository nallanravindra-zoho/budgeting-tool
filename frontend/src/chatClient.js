/**
 * Calls the `chat`, `syncCipr`, and `syncBudgets` Cloud Functions via the
 * Functions SDK. httpsCallable automatically attaches the signed-in user's
 * Firebase Auth token — no manual Authorization header, no CORS config.
 */
import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "./firebase.js";

const functions = getFunctions(app);
// timeout: 120000 matches chat's server-side timeoutSeconds (functions/index.js)
// — a tool-calling round trip can take longer than httpsCallable's 70s default.
const chatFn = httpsCallable(functions, "chat", { timeout: 120000 });
// timeout: 300000 (5 min) matches these two functions' server-side
// timeoutSeconds in functions/index.js — httpsCallable's default (70s)
// would abort client-side before a large Zoho export actually finishes,
// even though the server would have completed successfully.
const syncCiprFn = httpsCallable(functions, "syncCipr", { timeout: 300000 });
const syncBudgetsFn = httpsCallable(functions, "syncBudgets", { timeout: 300000 });
const syncOtherExpensesLedgerFn = httpsCallable(functions, "syncOtherExpensesLedger", { timeout: 300000 });
const syncBillsFn = httpsCallable(functions, "syncBills", { timeout: 300000 });

/**
 * @param {string} message - the user's latest message
 * @param {string} scenario - "Macnica" | "SKO"
 * @param {string} [mode] - "grid_adjust" for the vendor-planner mini chat, omit for the main assistant
 * @param {object} [context] - { year, isEditableYear, ...mode-specific fields }
 * @param {Array<{role: "user"|"assistant", text: string}>} [history] - prior turns, oldest first; omit/empty for a fresh conversation
 */
export async function callChat(message, scenario, mode, context, history) {
  const result = await chatFn({ message, scenario, mode, context, history });
  return result.data;
}

/** Manual only — no schedule. Pass a year to backfill a past year under the
 * new year-keyed ciprActuals schema (e.g. 2025); omit it to sync the current
 * year, same as before. Returns { vendorsUpdated, year, syncedAt }. */
export async function syncCiprNow(year) {
  const result = await syncCiprFn(year ? { year } : undefined);
  return result.data;
}

/** Manual only — no schedule/trigger wired up yet. Returns
 * { vendorYearRecordsUpdated, regionYearRecordsUpdated, years, syncedAt }. */
export async function syncBudgetsNow() {
  const result = await syncBudgetsFn();
  return result.data;
}

/** Manual only. Returns { ledgerRecordsUpdated, newUnmappedAccounts, years, syncedAt }. */
export async function syncOtherExpensesLedgerNow() {
  const result = await syncOtherExpensesLedgerFn();
  return result.data;
}

/** Manual only — no schedule. AP side of the Cash Flow module. Pass a year
 * to backfill a past year (bills are partitioned by Bill Date's year, same
 * convention as ciprActuals/invoices); omit it to sync the current year.
 * Returns { billRowsSynced, year, syncedAt }. */
export async function syncBillsNow(year) {
  const result = await syncBillsFn(year ? { year } : undefined);
  return result.data;
}
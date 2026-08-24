/**
 * Cash Flow module — data layer.
 *
 * Implements Cash_Flow_Module_Requirements2.md end to end:
 *   §3.1/3.2  AR/AP by period (SUM(Balance) WHERE Balance <> 0 AND Due Date in period)
 *   §3.3      Net cash position + Surplus/Deficit tag
 *   §3.4      Day/Week/Month/Quarter/Year bucketing — one calculation, variable grouping key
 *   §3.5      Average customer payment terms (CIPR Due Date − Invoice Date), invoice side only
 *   §3.6      DSO — reuses CIPR's pre-built Collcted(Days) field
 *   §4        Aged AR/AP (>180 days overdue, open balance), flagged separately
 *
 * Sources (both already synced by Cloud Functions, read-only from here):
 *   AR — ciprActuals/{year}/invoices  (year = Invoice Date's year; see functions/index.js syncCipr)
 *   AP — billsActuals/{year}/bills    (year = Bill Date's year; see functions/index.js syncBills)
 *
 * A row's due date can fall in a different calendar year than the
 * partition it lives in (e.g. an invoice dated Dec 2025 due Jan 2026), so
 * callers fetch a *range* of source years and this module buckets strictly
 * by due date, never by the source partition's year.
 *
 * No entity breakdown this phase (confirmed scope) and no vendor-terms
 * figure (Bills' Payment Terms field is broken — see syncBills's header
 * comment in functions/index.js) — matches the requirements doc exactly.
 */
import { getFirestore, collection, getDocs } from "firebase/firestore";
import { app } from "./firebase.js";

const db = getFirestore(app);

export const AGED_THRESHOLD_DAYS = 180;

// ---- fetching ---------------------------------------------------------

async function getInvoicesForYear(year) {
  const snap = await getDocs(collection(db, "ciprActuals", String(year), "invoices"));
  return snap.docs.map((d) => d.data());
}

async function getBillsForYear(year) {
  const snap = await getDocs(collection(db, "billsActuals", String(year), "bills"));
  return snap.docs.map((d) => d.data());
}

/**
 * Fetches AR (invoices) and AP (bills) across a range of source-partition
 * years, flattened into two plain arrays. Defaults to 2023 (first year
 * either module has synced data, matching operationalStats.js's same
 * assumption) through next calendar year (so already-issued rows with a
 * due date early next year aren't cut off). Missing years come back empty
 * rather than failing the whole fetch — same resilience as
 * operationalStats.getInvoicesByYearRange.
 */
export async function getCashFlowRawData(startYear = 2023, endYear = new Date().getFullYear() + 1) {
  const years = [];
  for (let y = startYear; y <= endYear; y++) years.push(y);
  const [invoiceYears, billYears] = await Promise.all([
    Promise.all(years.map((y) => getInvoicesForYear(y).catch(() => []))),
    Promise.all(years.map((y) => getBillsForYear(y).catch(() => []))),
  ]);
  return {
    invoices: invoiceYears.flat(),
    bills: billYears.flat(),
  };
}

// ---- date parsing -------------------------------------------------------
// ciprActuals.dueDate/lastPaymentDate and billsActuals.dueDate are stored
// as whatever string Zoho's bulk export returned (see syncCipr/syncBills
// header comments — not yet verified against a live pull). billsActuals.
// billDate is normalized to YYYY-MM-DD server-side; ciprActuals.invoiceDate
// likewise. Everything else needs a flexible parse. CIPR's blank-value
// convention is the literal string "NULL", not empty (per PROJECT_HANDOFF
// §7) — handled below alongside genuinely empty/missing values.
export function parseFlexibleDate(v) {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  const s = String(v).trim();
  if (!s || s === "NULL") return null;

  let d = new Date(s);
  if (!isNaN(d.getTime())) return d;

  // "05-Oct-2026" / "05 Oct 2026" / "05/Oct/2026"
  const monthName = s.match(/^(\d{1,2})[-/\s]([A-Za-z]{3,9})[-/\s](\d{4})$/);
  if (monthName) {
    d = new Date(`${monthName[2]} ${monthName[1]}, ${monthName[3]}`);
    if (!isNaN(d.getTime())) return d;
  }

  // Ambiguous numeric "DD/MM/YYYY" — try day-first (Zoho's regional export
  // default is more often DD/MM/YYYY than US MM/DD/YYYY for this org).
  const numeric = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (numeric) {
    const [, a, b, y] = numeric;
    d = new Date(`${y}-${String(b).padStart(2, "0")}-${String(a).padStart(2, "0")}`);
    if (!isNaN(d.getTime())) return d;
  }

  return null;
}

function parseNum(v) {
  const n = Number(String(v ?? "").replace(/,/g, ""));
  return isNaN(n) ? 0 : n;
}

// ---- bucketing (§3.4 — one calc, variable grouping key) -----------------

function isoWeekInfo(date) {
  // Standard ISO-8601 week algorithm: Thursday of the week decides the
  // week-year, week 1 is the week containing the year's first Thursday.
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return { isoYear: d.getUTCFullYear(), isoWeek: weekNo };
}

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const yr2 = (y) => String(y).slice(-2);

/**
 * Given a JS Date and a granularity, returns { key, label, sortKey } —
 * key is a stable bucket identity, sortKey is a number safe to sort on,
 * label is what the UI shows. Same function drives AR and AP so both are
 * always bucketed identically (the requirement's actual point in §3.4).
 */
export function bucketFor(date, granularity) {
  const y = date.getFullYear(), m = date.getMonth(), day = date.getDate();
  switch (granularity) {
    case "day": {
      const key = `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      return { key, label: `${day} ${MONTH_ABBR[m]}`, sortKey: date.getTime() };
    }
    case "week": {
      const { isoYear, isoWeek } = isoWeekInfo(date);
      const key = `${isoYear}-W${String(isoWeek).padStart(2, "0")}`;
      return { key, label: `Wk${isoWeek} '${yr2(isoYear)}`, sortKey: isoYear * 100 + isoWeek };
    }
    case "quarter": {
      const q = Math.floor(m / 3) + 1;
      return { key: `${y}-Q${q}`, label: `${yr2(y)}-Q${q}`, sortKey: y * 10 + q };
    }
    case "year":
      return { key: String(y), label: String(y), sortKey: y };
    case "month":
    default:
      return { key: `${y}-${String(m + 1).padStart(2, "0")}`, label: `${MONTH_ABBR[m]}${yr2(y)}`, sortKey: y * 100 + m };
  }
}

/** Every bucket key between two dates (inclusive), so periods with zero
 * AR and AP still show up as a $0 bar/row instead of a gap — matches the
 * mockup's continuous month axis. Day/Week aren't gap-filled this way
 * (see computeCashFlow — they're windowed around "today" instead, per
 * §3.4's note that Day/Week are for zooming into the current/next period,
 * not a full-history view). */
function fillRange(startDate, endDate, granularity) {
  const out = [];
  const cur = new Date(startDate);
  const guard = 2000; // sane upper bound on iterations regardless of granularity
  let i = 0;
  while (cur <= endDate && i++ < guard) {
    out.push(bucketFor(cur, granularity));
    if (granularity === "quarter") cur.setMonth(cur.getMonth() + 3);
    else if (granularity === "year") cur.setFullYear(cur.getFullYear() + 1);
    else if (granularity === "day") cur.setDate(cur.getDate() + 1);
    else cur.setMonth(cur.getMonth() + 1); // month (default)
  }
  return out;
}

// ---- core calculation ---------------------------------------------------

/**
 * @param {object[]} invoices - raw ciprActuals/{year}/invoices docs
 * @param {object[]} bills - raw billsActuals/{year}/bills docs
 * @param {"day"|"week"|"month"|"quarter"|"year"} granularity
 * @param {Date} [today]
 */
export function computeCashFlow(invoices, bills, granularity = "month", today = new Date()) {
  // ---- §3.1/3.2: filter to open balances with a usable due date ----
  const arOpen = invoices
    .map((r) => ({ ...r, _due: parseFlexibleDate(r.dueDate), _balance: Number(r.balance) || 0 }))
    .filter((r) => r._balance !== 0 && r._due);
  const apOpen = bills
    .map((r) => ({ ...r, _due: parseFlexibleDate(r.dueDate), _balance: Number(r.balance) || 0 }))
    .filter((r) => r._balance !== 0 && r._due);

  // ---- §3.4: bucket both sides with the same function ----
  const arByKey = {}, apByKey = {};
  const bucketMeta = {}; // key -> { label, sortKey }
  for (const r of arOpen) {
    const b = bucketFor(r._due, granularity);
    arByKey[b.key] = (arByKey[b.key] || 0) + r._balance;
    bucketMeta[b.key] = b;
  }
  for (const r of apOpen) {
    const b = bucketFor(r._due, granularity);
    apByKey[b.key] = (apByKey[b.key] || 0) + r._balance;
    bucketMeta[b.key] = b;
  }

  // ---- window: which buckets actually get shown ----
  // Month/Quarter/Year: full continuous range spanning whatever data
  // exists (gap-filled with $0 periods) — this is the trend view.
  // Day/Week: per §3.4, these are for zooming into "now" rather than a
  // multi-year trend, so window around today instead of the full data range.
  let keysToShow;
  if (granularity === "day") {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    keysToShow = fillRange(start, end, granularity).map((b) => b.key);
    keysToShow.forEach((k) => { if (!bucketMeta[k]) bucketMeta[k] = bucketFor(new Date(k), granularity); });
  } else if (granularity === "week") {
    const start = new Date(today); start.setDate(start.getDate() - 28); // 4 weeks back
    const end = new Date(today); end.setDate(end.getDate() + 21); // 3 weeks ahead
    const keys = [];
    const cur = new Date(start);
    while (cur <= end) { const b = bucketFor(cur, granularity); if (!keys.includes(b.key)) { keys.push(b.key); bucketMeta[b.key] = b; } cur.setDate(cur.getDate() + 7); }
    keysToShow = keys;
  } else {
    const allDates = [...arOpen, ...apOpen].map((r) => r._due);
    let filled;
    if (allDates.length === 0) {
      filled = [bucketFor(today, granularity)];
    } else {
      const minD = new Date(Math.min(...allDates, today.getTime()));
      const maxD = new Date(Math.max(...allDates, today.getTime()));
      filled = fillRange(minD, maxD, granularity);
    }
    keysToShow = filled.map((b) => b.key);
    filled.forEach((b) => { bucketMeta[b.key] = b; }); // fillRange's own buckets, not just ones with AR/AP data
  }

  const todayKey = bucketFor(today, granularity).key;
  const periods = keysToShow
    .sort((a, b) => bucketMeta[a].sortKey - bucketMeta[b].sortKey)
    .map((key) => {
      const ar = arByKey[key] || 0;
      const ap = apByKey[key] || 0;
      const net = ar - ap;
      return { key, label: bucketMeta[key].label, ar, ap, net, isSurplus: net >= 0, isCurrent: key === todayKey };
    });

  let currentIndex = periods.findIndex((p) => p.isCurrent);
  if (currentIndex === -1) currentIndex = 0; // today falls outside the shown window — anchor KPIs to the first period rather than crashing

  // ---- §6 KPI strip: deficit periods ahead (current + next 5) ----
  let deficitCount = 0, consideredCount = 0;
  for (let k = currentIndex; k < Math.min(currentIndex + 6, periods.length); k++) { consideredCount++; if (periods[k].net < 0) deficitCount++; }

  // ---- §3.5: average customer terms, invoice side only ----
  // Uses ALL invoices with both dates present, independent of balance/open
  // status or the display window — matches "AVERAGE(...) WHERE both dates
  // present" exactly, not "open items in view".
  let termsTotal = 0, termsCount = 0;
  for (const r of invoices) {
    const inv = parseFlexibleDate(r.invoiceDate), due = parseFlexibleDate(r.dueDate);
    if (inv && due) { termsTotal += (due - inv) / 86400000; termsCount++; }
  }
  const avgCustomerTermsDays = termsCount ? termsTotal / termsCount : null;

  // ---- §3.6: DSO — reuse Collcted(Days), fallback to Last Payment Date −
  // Invoice Date only if that field is missing/blank for a given row (per
  // the doc's "if the underlying formula differs, recompute directly"
  // fallback instruction) ----
  let dsoTotal = 0, dsoCount = 0;
  for (const r of invoices) {
    if (r.invoiceStatus !== "Collected") continue;
    let days = parseNum(r.collectedDays);
    if (!(days > 0)) {
      const inv = parseFlexibleDate(r.invoiceDate), paid = parseFlexibleDate(r.lastPaymentDate);
      if (inv && paid) days = (paid - inv) / 86400000;
    }
    if (days > 0) { dsoTotal += days; dsoCount++; }
  }
  const dsoDays = dsoCount ? dsoTotal / dsoCount : null;

  // ---- §4: aged AR/AP — open balance, due date > threshold days in the
  // past. Computed over the FULL fetched set (not the display window),
  // shown as its own callout so it doesn't distort the current-period read. ----
  const agedCutoff = new Date(today.getTime() - AGED_THRESHOLD_DAYS * 86400000);
  const agedArRows = arOpen.filter((r) => r._due < agedCutoff);
  const agedApRows = apOpen.filter((r) => r._due < agedCutoff);
  const agedAR = { total: agedArRows.reduce((s, r) => s + r._balance, 0), count: agedArRows.length };
  const agedAP = { total: agedApRows.reduce((s, r) => s + r._balance, 0), count: agedApRows.length };

  const current = periods[currentIndex] || { ar: 0, ap: 0, net: 0, isSurplus: true, label: "" };

  return {
    periods,
    currentIndex,
    kpis: {
      arDue: current.ar,
      apDue: current.ap,
      net: current.net,
      isSurplus: current.isSurplus,
      periodLabel: current.label,
      deficitCount, consideredCount,
      avgCustomerTermsDays,
      dsoDays,
    },
    agedAR,
    agedAP,
  };
}
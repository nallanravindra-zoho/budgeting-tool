/**
 * The entire server-side surface of this app — two functions, holding only
 * the operations that genuinely require a secret (Zoho credentials, LLM API
 * key). Everything else (reading/writing budget data) happens directly from
 * the browser via the Firestore SDK, secured by firestore.rules instead of
 * code here — see that file for the actual access control.
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret, defineString } = require("firebase-functions/params");
const admin = require("firebase-admin");
const { exportCiprReport, exportZohoView } = require("./zohoAnalytics");

admin.initializeApp();
const db = admin.firestore();

const llmApiKey = defineSecret("LLM_API_KEY");
const zohoClientId = defineSecret("ZOHO_CLIENT_ID");
const zohoClientSecret = defineSecret("ZOHO_CLIENT_SECRET");
const zohoRefreshToken = defineSecret("ZOHO_REFRESH_TOKEN");
// Not secret — the workspace/view IDs, org ID. Set via `firebase functions:secrets:set`
// is for actual secrets only; these go in functions/.env (see DEPLOYMENT.md).
const zohoOrgId = defineString("ZOHO_ORG_ID");
const zohoWorkspaceId = defineString("ZOHO_WORKSPACE_ID");
const zohoViewId = defineString("ZOHO_VIEW_ID"); // CIPR actuals view

// Budget views — confirmed view IDs, all under the same workspace as CIPR.
// Unlike CIPR actuals, these views already contain every budget year
// (2023 onward), not just the current one — so syncBudgets pulls and
// replaces the full history each run rather than being year-scoped.
const ZOHO_BUDGET_VIEW_IDS = {
  monthWise: "2136992000018715432",
  countryWise: "2136992000018572030",
  vendorWise: "2136992000018537058",
};

// Other Expenses ledger — a DIFFERENT Zoho workspace than the one above
// (confirmed from the Analytics URL in the spec doc), so both workspaceId
// and viewId are hardcoded here rather than reusing zohoWorkspaceId.
const ZOHO_OTHER_EXPENSES_WORKSPACE_ID = "2136992000000009001";
const ZOHO_OTHER_EXPENSES_VIEW_ID = "2136992000053077002";

// Bills report (AP side of the Cash Flow module) — lives in the SAME
// workspace as Other Expenses (confirmed with Kavya, 2026-08-23), but is a
// different view within it.
const ZOHO_BILLS_WORKSPACE_ID = "2136992000000009001";
const ZOHO_BILLS_VIEW_ID = "2136992000011511467";

// Access control matches firestore.rules exactly: an explicit allowlist
// (approvedUsers collection), separate from Microsoft SSO. SSO proves the
// user has a real account in Cyberknight's Entra tenant — it does NOT by
// itself decide whether they're allowed to use this specific app. Someone
// could be a legitimate Cyberknight employee via SSO and still not be on
// this list (new hire not yet added, contractor, etc.) — this check is
// what actually enforces per-app access, on top of tenant membership.
async function requireApprovedUser(request) {
  if (!request.auth || !request.auth.token.email) {
    console.error("requireApprovedUser: no request.auth or no email on token — request.auth =", JSON.stringify(request.auth));
    throw new HttpsError("unauthenticated", "Sign-in required");
  }
  const email = request.auth.token.email.toLowerCase();
  console.log(`requireApprovedUser: checking approvedUsers/${email}`);
  let snap;
  try {
    snap = await db.collection("approvedUsers").doc(email).get();
  } catch (e) {
    console.error(`requireApprovedUser: Firestore get() itself threw for approvedUsers/${email}:`, e.message, e.stack);
    throw new HttpsError("internal", `Couldn't verify approved-user status: ${e.message}`);
  }
  console.log(`requireApprovedUser: doc exists=${snap.exists}, data=`, snap.exists ? JSON.stringify(snap.data()) : "(no doc)");
  if (!snap.exists || snap.data().active === false) {
    throw new HttpsError("permission-denied", "This account is not on the approved users list");
  }
  console.log(`requireApprovedUser: ${email} is approved and active — passed.`);
}

// ---- chat helpers ----------------------------------------------------------

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

async function getActiveBudgetingYearServer() {
  const snap = await db.collection("settings").doc("config").get();
  if (snap.exists && snap.data().activeBudgetingYear) return snap.data().activeBudgetingYear;
  return new Date().getFullYear() + 1;
}

// name/role for the greeting + tone guidance — set these two fields on each
// user's approvedUsers/{email} doc in the Firebase Console (Kavya = Head of
// Financial Reporting, Vivek Gupta = COO, Avinash Advani = CEO, Wael Jaber =
// CTO). Falls back to the email's local part if a user hasn't been given a
// name yet, so a new approved user without profile fields set still works.
async function getApprovedUserProfile(email) {
  const snap = await db.collection("approvedUsers").doc(email).get();
  const data = snap.exists ? snap.data() : {};
  return { name: data.name || email.split("@")[0], role: data.role || null };
}

// Mirrors frontend/src/firestoreData.js's getVendors(year) logic, but using
// the Admin SDK (Cloud Functions can't import a client-SDK frontend file
// directly) — same editable-year-vs-Zoho-sourced branching. Keep these two
// in sync by hand if the schema changes; there's no shared package set up
// between frontend and functions for this yet.
async function fetchYearVendorData(year) {
  const activeBudgetingYear = await getActiveBudgetingYearServer();
  const isEditableYear = year === activeBudgetingYear;

  const [budgetSnap, actualsSnap] = await Promise.all([
    isEditableYear
      ? db.collection("budgetVersions").doc("working").collection("vendorBudgets").get()
      : db.collection("zohoBudgets").doc(String(year)).collection("vendorBudgets").get(),
    db.collection("ciprActuals").doc(String(year)).collection("vendors").get(),
  ]);
  const budgets = {}; budgetSnap.forEach(d => { budgets[decodeURIComponent(d.id)] = d.data(); });
  const actuals = {}; actualsSnap.forEach(d => { actuals[decodeURIComponent(d.id)] = d.data(); });

  const names = new Set([...Object.keys(budgets), ...Object.keys(actuals)]);
  const out = [];
  for (const vendor of names) {
    const b = budgets[vendor] || {};
    const a = actuals[vendor] || {};
    const monthlyBudgetRevenue = (b.monthlyBudgetRevenue || new Array(12).fill(0)).map(m => Math.round(m));
    // Same fallback as firestoreData.js's getVendors: real synced monthly
    // GP for non-editable years, else approximate from revenue * annual gpPct.
    const monthlyBudgetGp = (b.monthlyBudgetGp || monthlyBudgetRevenue.map(m => m * (b.gpPct || 0))).map(m => Math.round(m));
    out.push({
      vendor,
      budget_revenue: Math.round(b.revenue || 0),
      budget_gp: Math.round(b.gp || 0),
      gp_pct: b.gpPct || 0,
      monthly_budget_revenue: monthlyBudgetRevenue,
      monthly_budget_gp: monthlyBudgetGp,
      actual_revenue_ytd: Math.round(a.actualRevenueYtd || 0),
      actual_gp_ytd: Math.round(a.actualGpYtd || 0),
      monthly_actual_revenue: (a.monthlyActualRevenue || new Array(12).fill(0)).map(m => Math.round(m)),
      monthly_actual_gp: (a.monthlyActualGp || new Array(12).fill(0)).map(m => Math.round(m)),
    });
  }
  return out.sort((x, y) => y.budget_revenue - x.budget_revenue);
}

// Mirrors frontend/src/firestoreData.js's getRegions(year) — same
// editable-year (derived from each vendor's own countryGrid) vs.
// Zoho-sourced regionBudgets branching.
async function fetchYearRegionData(year) {
  const activeBudgetingYear = await getActiveBudgetingYearServer();
  const isEditableYear = year === activeBudgetingYear;

  if (isEditableYear) {
    const budgetSnap = await db.collection("budgetVersions").doc("working").collection("vendorBudgets").get();
    const totals = {};
    budgetSnap.forEach(d => {
      const b = d.data();
      if (!b.countryGrid) return;
      for (const m in b.countryGrid) for (const c in b.countryGrid[m]) {
        if (!totals[c]) totals[c] = { region: c, budget_revenue: 0, budget_gp: 0 };
        totals[c].budget_revenue += b.countryGrid[m][c];
        totals[c].budget_gp += b.countryGrid[m][c] * (b.gpPct || 0);
      }
    });
    return Object.values(totals)
      .map(r => ({ region: r.region, budget_revenue: Math.round(r.budget_revenue), budget_gp: Math.round(r.budget_gp) }))
      .sort((a, b) => b.budget_revenue - a.budget_revenue);
  }

  const snap = await db.collection("zohoBudgets").doc(String(year)).collection("regionBudgets").get();
  return snap.docs
    .map(d => {
      const r = d.data();
      return {
        region: decodeURIComponent(d.id),
        budget_revenue: Math.round(r.revenue || 0),
        budget_gp: Math.round(r.gp || 0),
        monthly_budget_revenue: (r.monthlyBudgetRevenue || new Array(12).fill(0)).map(m => Math.round(m)),
      };
    })
    .sort((a, b) => b.budget_revenue - a.budget_revenue);
}

// ---- getBreakdown tool ------------------------------------------------------
// Data-access pattern: model-driven queries (Option B — see project spec),
// not a full data dump stuffed into every prompt. The system prompt only
// ever contains vendor NAMES (cheap); the model calls this tool to fetch
// actual numbers, for whichever year/dimension/entity the question needs.
// Scales cleanly as more years/dimensions get added, unlike pre-stuffing.
const GET_BREAKDOWN_TOOL = {
  functionDeclarations: [{
    name: "getBreakdown",
    description: "Get real budget and actual revenue/GP figures for a fiscal year, broken down by vendor or by region/country. Every row includes BOTH the annual total AND a full month-by-month breakdown (monthly_budget_revenue, monthly_actual_revenue, monthly_budget_gp, monthly_actual_gp — each a 12-element array, Jan first) — this tool answers monthly, quarterly, and annual questions equally well, never just annual. Sum 3 months for a quarter, or read one index for a single month. ALWAYS call this to get real numbers before answering — never guess, estimate, or recall a figure from earlier in the conversation without re-confirming it if precision matters. Data is available from 2023 onward.",
    parameters: {
      type: "OBJECT",
      properties: {
        year: { type: "INTEGER", description: "Fiscal year, e.g. 2025. Ask the user if unclear which year they mean rather than assuming." },
        dimension: { type: "STRING", enum: ["vendor", "region"], description: "Break the data down by vendor, or by region/country." },
        name: { type: "STRING", description: "Optional. A specific vendor or region/country name to filter to (case-insensitive, partial match OK). Omit to get every vendor/region for that year." },
      },
      required: ["year", "dimension"],
    },
  }],
};

async function runGetBreakdown({ year, dimension, name }) {
  if (!year || year < 2023) return { error: `No data available for year ${year} — data starts at 2023.` };
  const rows = dimension === "region" ? await fetchYearRegionData(year) : await fetchYearVendorData(year);
  if (!name) return rows;
  const key = dimension === "region" ? "region" : "vendor";
  const needle = String(name).toLowerCase();
  const filtered = rows.filter(r => r[key].toLowerCase().includes(needle));
  return filtered.length ? filtered : { error: `No ${dimension} matching "${name}" found for ${year}.` };
}

// ---- queryInvoices tool ------------------------------------------------
// General-purpose search/filter/aggregate over RAW invoice-level actuals
// (synced by syncCipr into ciprActuals/{year}/invoices) — this is what
// getBreakdown can't do: invoice lookup by number, filtering by
// partner/customer/end-customer name, or a real vendor+region cross-tab
// (getBreakdown's region data is company-wide, not per-vendor — see
// fetchYearRegionData's comment). Actuals only; budget data has no
// invoice-level detail to search.
const QUERY_INVOICES_TOOL = {
  functionDeclarations: [{
    name: "queryInvoices",
    description: "Search and analyze RAW actual invoice-level data (from CIPR) — the finest-grained data available, one row per invoice/credit-note. This is the main slice-and-dice analytical dataset for actuals, not just an invoice lookup tool: it supports commercial (vendor/partner/partner category/engagement type/lead source), organisational (BU head/opportunity owner/entity), geographic (region/sub-region/billing country/end-customer country), customer (customer/end customer), and financial (revenue/GP/purchase cost/provision/freight/GP-SKO/SKO GP%/Macnica GP%/balance/collections aging) dimensions — combine multiple filters for a genuine cross-tab (e.g. vendor+region, BU head+vendor, engagement type+vendor). All text filters are case-insensitive partial matches. Set groupBy to get aggregated revenue/GP sums instead of a row list — always prefer groupBy over listing raw rows when the user wants a total or breakdown rather than individual invoices. Actuals only — budget data has no invoice-level detail and can't be cross-tabbed by vendor+region together (Zoho's budget source only ever provides vendor totals OR region totals, never both combined for the same line — say so plainly if asked for that on the budget side, don't guess).\n\nIMPORTANT — do not confuse these dimensions, they answer very different questions: \"customer\" and \"endCustomer\" are ORGANIZATIONS (e.g. a distributor vs. the actual end-user company an invoice was ultimately for) — use one of these when asked \"how many customers/end customers\" or \"which end customer\". \"month\" and \"quarter\" are TIME PERIODS (Jan-Dec, Q1-Q4) — never use these to answer a question about customers/organizations, and never group by month/quarter when asked to count or list end customers.",
    parameters: {
      type: "OBJECT",
      properties: {
        year: { type: "INTEGER", description: "Fiscal year, 2023 onward." },
        vendor: { type: "STRING", description: "Optional partial match on vendor name." },
        customer: { type: "STRING", description: "Optional partial match on Customer Name — typically the billing customer/distributor, e.g. 'Diyar Middle East'." },
        endCustomer: { type: "STRING", description: "Optional partial match on End Customer — the actual end-user organization the deal was ultimately for, e.g. 'Hamad International Airport'. This is a DIFFERENT field from customer/partner — use this specifically when asked about end customers." },
        partner: { type: "STRING", description: "Optional partial match on Partner name (reseller)." },
        invoiceNo: { type: "STRING", description: "Optional partial match on Invoice No — use this for single-invoice lookup." },
        region: { type: "STRING", description: "Optional partial match on Region or Sub Region." },
        entity: { type: "STRING", description: "Optional partial match on the legal Entity the invoice was billed under." },
        engagementType: { type: "STRING", description: "Optional partial match on Engagement Type." },
        leadSource: { type: "STRING", description: "Optional partial match on Lead Source." },
        opportunityOwner: { type: "STRING", description: "Optional partial match on Opportunity Owner Name — the salesperson who owned the deal." },
        buHead: { type: "STRING", description: "Optional partial match on BU Head." },
        invoiceStatus: { type: "STRING", description: "Optional partial match on invoice status (e.g. collected/outstanding)." },
        month: { type: "INTEGER", description: "Optional, 1-12. Filters to a single month — a TIME period, not a customer/organization." },
        quarter: { type: "INTEGER", description: "Optional, 1-4. Filters to that quarter's 3 months — a TIME period, not a customer/organization." },
        groupBy: { type: "STRING", enum: ["vendor", "region", "subRegion", "customer", "endCustomer", "partner", "month", "quarter", "entity", "engagementType", "leadSource", "opportunityOwner", "buHead"], description: "Optional — if set, returns aggregated revenue/GP sums (and invoice counts) grouped by this dimension instead of individual invoice rows. Use \"endCustomer\" (not \"quarter\" or \"month\") when the question is about end customers." },
      },
      required: ["year"],
    },
  }],
};

async function runQueryInvoices({ year, vendor, customer, endCustomer, partner, invoiceNo, region, entity, engagementType, leadSource, opportunityOwner, buHead, invoiceStatus, month, quarter, groupBy }) {
  if (!year || year < 2023) return { error: `No data available for year ${year} — data starts at 2023.` };
  const snap = await db.collection("ciprActuals").doc(String(year)).collection("invoices").get();
  if (snap.empty) return { error: `No invoice-level data synced for ${year} yet — this collection is only populated for years that have been synced since invoice-level storage was added.` };

  let rows = snap.docs.map(d => d.data());
  const contains = (field, needle) => field && String(field).toLowerCase().includes(String(needle).toLowerCase());
  if (vendor) rows = rows.filter(r => contains(r.vendorName, vendor));
  if (customer) rows = rows.filter(r => contains(r.customerName, customer));
  if (endCustomer) rows = rows.filter(r => contains(r.endCustomer, endCustomer));
  if (partner) rows = rows.filter(r => contains(r.partnerName, partner));
  if (invoiceNo) rows = rows.filter(r => contains(r.invoiceNo, invoiceNo));
  if (region) rows = rows.filter(r => contains(r.region, region) || contains(r.subRegion, region));
  if (entity) rows = rows.filter(r => contains(r.entity, entity));
  if (engagementType) rows = rows.filter(r => contains(r.engagementType, engagementType));
  if (leadSource) rows = rows.filter(r => contains(r.leadSource, leadSource));
  if (opportunityOwner) rows = rows.filter(r => contains(r.opportunityOwner, opportunityOwner));
  if (buHead) rows = rows.filter(r => contains(r.buHead, buHead));
  if (invoiceStatus) rows = rows.filter(r => contains(r.invoiceStatus, invoiceStatus));
  if (month) rows = rows.filter(r => r.month === month);
  if (quarter) { const months = [(quarter - 1) * 3 + 1, (quarter - 1) * 3 + 2, (quarter - 1) * 3 + 3]; rows = rows.filter(r => months.includes(r.month)); }

  if (rows.length === 0) return { error: "No invoices matched those filters." };

  if (groupBy) {
    const keyFor = (r) => {
      if (groupBy === "vendor") return r.vendorName || "(unknown)";
      if (groupBy === "region") return r.region || "(unknown)";
      if (groupBy === "subRegion") return r.subRegion || "(unknown)";
      if (groupBy === "customer") return r.customerName || "(unknown)";
      if (groupBy === "endCustomer") return r.endCustomer || "(unknown)";
      if (groupBy === "partner") return r.partnerName || "(unknown)";
      if (groupBy === "entity") return r.entity || "(unknown)";
      if (groupBy === "engagementType") return r.engagementType || "(unknown)";
      if (groupBy === "leadSource") return r.leadSource || "(unknown)";
      if (groupBy === "opportunityOwner") return r.opportunityOwner || "(unknown)";
      if (groupBy === "buHead") return r.buHead || "(unknown)";
      if (groupBy === "month") return MONTH_NAMES[r.month - 1] || "(unknown)";
      return `Q${Math.ceil((r.month || 1) / 3)}`; // quarter
    };
    const grouped = {};
    for (const r of rows) {
      const k = keyFor(r);
      if (!grouped[k]) grouped[k] = { revenue: 0, gp: 0, invoiceCount: 0 };
      grouped[k].revenue += r.revenue || 0;
      grouped[k].gp += r.gp || 0;
      grouped[k].invoiceCount++;
    }
    return Object.entries(grouped)
      .map(([key, v]) => ({ [groupBy]: key, revenue: Math.round(v.revenue), gp: Math.round(v.gp), invoiceCount: v.invoiceCount }))
      .sort((a, b) => b.revenue - a.revenue);
  }

  // No groupBy — return matching rows, capped so a broad query can't blow
  // out the model's context window.
  const CAP = 40;
  const capped = rows.slice(0, CAP).map(r => ({ ...r, revenue: Math.round(r.revenue), gp: Math.round(r.gp) }));
  return {
    matchedCount: rows.length,
    rows: capped,
    ...(rows.length > CAP ? { truncated: true, note: `Showing first ${CAP} of ${rows.length} matches — narrow the filters (e.g. add a month or vendor) for a complete list, or use groupBy for a full aggregate instead of a row list.` } : {}),
  };
}

// Recognizes "**Label:** 602,848", "- Label: 602848", "Label: $602,848" style
// lines — the markdown-bullet format the model sometimes falls back to
// instead of JSON (e.g. "* **Actual Revenue:** 602,848"). If 2+ such pairs
// are found, synthesizes a real table response instead of showing this as
// raw text, so the unit toggle and table rendering still work correctly
// even when the model doesn't follow the JSON contract.
// Recognizes markdown pipe-table syntax the model sometimes falls back to
// instead of JSON — including the case where every row runs together on
// one line instead of real newlines (e.g. "...34 | | Kuwait | 275332...").
// Tolerates leading prose before the table starts (extracts just the
// pipe-delimited portion of each line, not requiring the whole line to be
// a table row).
function tryExtractMarkdownTable(text) {
  if (!text.includes("|")) return null;
  const withBreaks = text.replace(/\|\s*\|/g, "|\n|");
  const lines = withBreaks.split("\n").map(l => {
    const first = l.indexOf("|");
    const last = l.lastIndexOf("|");
    if (first === -1 || last <= first) return null;
    return l.slice(first, last + 1).trim();
  }).filter(Boolean);
  if (lines.length < 3) return null; // header + separator + at least 1 data row

  const isSeparatorRow = (line) => /^\|[\s:|-]+\|$/.test(line) && /-/.test(line);
  const parseRow = (line) => line.slice(1, -1).split("|").map(c => c.trim());

  const header = parseRow(lines[0]);
  const dataLines = lines.slice(1).filter(l => !isSeparatorRow(l));
  if (header.length < 2 || dataLines.length === 0) return null;

  const rows = dataLines.map(parseRow)
    .filter(cells => cells.length === header.length)
    .map(cells => cells.map(c => {
      if (c === "") return c;
      const n = Number(c.replace(/,/g, ""));
      return isNaN(n) ? c : n;
    }));
  return rows.length > 0 ? { columns: header, rows } : null;
}

function tryExtractTableFromPlainText(text) {
  const cleaned = text.replace(/(^|\s)\*(\s)/g, "$1$2"); // strip standalone '* ' bullet markers, leave '**bold**' pairs intact
  // Handles BOTH "**Label**: value" and "**Label:** value" — the model's
  // bold markers sometimes wrap the colon too, closing after it rather
  // than before, which the first version of this regex didn't account for.
  const pattern = /\*{0,2}([A-Za-z][A-Za-z0-9 %()/&-]{0,40}?)\*{0,2}:\*{0,2}\s*\$?(-?[\d,]+(?:\.\d+)?)/g;
  const rows = [];
  let match;
  while ((match = pattern.exec(cleaned)) !== null) {
    const label = match[1].trim();
    const num = Number(match[2].replace(/,/g, ""));
    if (!isNaN(num)) rows.push([label, num]);
  }
  return rows.length >= 2 ? rows : null;
}

function parseModelJson(text) {
  // Defensive fence-stripping — tool-calling mode can't use Gemini's
  // responseMimeType JSON-forcing (see callGemini), so the model relies on
  // the system prompt's instruction alone to avoid markdown fences. This
  // catches it if it doesn't.
  const cleaned = text.trim().replace(/^```(json)?\s*/i, "").replace(/```\s*$/, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    // The model sometimes prefixes or suffixes the JSON with a sentence
    // of prose ("Here's the breakdown: {...}") despite the "ONLY JSON"
    // instruction. Extract the outermost {...} block and try again before
    // giving up — this is what actually fixes cases like that, rather
    // than just falling back to showing the whole raw text as a message.
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1)); // let this throw naturally if still invalid — caller's catch handles it
    }
    throw e;
  }
}

async function callGemini({ system, contents, tools, apiKey }) {
  const body = { systemInstruction: { parts: [{ text: system }] }, contents };
  if (tools) body.tools = tools; // function-calling mode — no responseMimeType, doesn't reliably combine with tools
  else body.generationConfig = { responseMimeType: "application/json" };

  console.log(`callGemini: sending request, tools=${tools ? "yes" : "no"}, contents turns=${contents.length}`);
  let res;
  try {
    res = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey }, body: JSON.stringify(body) }
    );
  } catch (fetchErr) {
    console.error("callGemini: fetch() itself threw (network-level failure):", fetchErr.message, fetchErr.stack);
    throw new HttpsError("unavailable", `Network error calling Gemini: ${fetchErr.message}`);
  }

  console.log(`callGemini: HTTP status ${res.status} ${res.statusText}`);
  const rawText = await res.text();
  if (!res.ok) {
    // Full body, not truncated — a 400 here (e.g. malformed tool schema)
    // is the single most likely cause of "every message fails, even hi",
    // since the tool definitions are sent on EVERY call regardless of
    // whether a tool ends up being invoked.
    console.error(`callGemini: Gemini returned HTTP ${res.status}. Full response body:`, rawText);
    throw new HttpsError("unavailable", `Gemini API error (HTTP ${res.status}): ${rawText.slice(0, 500)}`);
  }

  let data;
  try {
    data = JSON.parse(rawText);
  } catch (parseErr) {
    console.error("callGemini: response was not valid JSON. Raw text:", rawText);
    throw new HttpsError("internal", "Gemini returned a non-JSON response — see server logs for the raw body.");
  }

  const candidate = data?.candidates?.[0];
  if (!candidate) {
    console.error("callGemini: response OK but no candidates. Full parsed response:", JSON.stringify(data));
    throw new HttpsError("unavailable", `Gemini returned no candidates: ${JSON.stringify(data).slice(0, 500)}`);
  }
  console.log("callGemini: got a candidate back successfully.");
  return candidate;
}

// Agentic loop: call Gemini, and if it asks to call getBreakdown, run it and
// feed the result back, up to 5 rounds. Most questions resolve in 1-2 tool
// calls; 5 is a safety ceiling against the model looping indefinitely.
const ALL_TOOLS = [{
  functionDeclarations: [...GET_BREAKDOWN_TOOL.functionDeclarations, ...QUERY_INVOICES_TOOL.functionDeclarations],
}];

// Removes markdown syntax from a plain-text field — bold/italic markers
// and bullet asterisks/dashes at the start of a line. Applied even when
// the model's JSON was technically valid, since "valid JSON containing
// markdown-formatted prose inside the message string" is a real observed
// failure mode, not just outright invalid JSON — prompt instructions
// alone weren't reliable enough to prevent it.
function stripMarkdown(text) {
  if (typeof text !== "string") return text;
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1") // **bold** -> bold
    .replace(/(^|\s)\*(\s)/g, "$1$2") // stray bullet '* ' markers
    .replace(/^[\s]*[-*]\s+/gm, "") // leading bullet markers at line start
    .replace(/\s{2,}/g, " ")
    .trim();
}

// Applied to every response after parsing, valid-JSON or not: strips any
// markdown that slipped into message/explanation text, and upgrades an
// "answer" containing 2+ numeric values into a real "table" — enforcing
// the app's own "2+ numbers -> table" rule deterministically rather than
// relying on the model to have followed it.
function postProcessResponse(parsed) {
  if (!parsed || typeof parsed !== "object") return parsed;
  if (typeof parsed.message === "string") parsed.message = stripMarkdown(parsed.message);
  if (typeof parsed.explanation === "string") parsed.explanation = stripMarkdown(parsed.explanation);

  if (parsed.type === "answer" && typeof parsed.message === "string") {
    const mdTable = tryExtractMarkdownTable(parsed.message);
    if (mdTable) {
      return { type: "table", title: parsed.title || null, columns: mdTable.columns, rows: mdTable.rows, message: "" };
    }
    const labelRows = tryExtractTableFromPlainText(parsed.message);
    if (labelRows) {
      return { type: "table", title: null, columns: ["Metric", "Amount"], rows: labelRows, message: "" };
    }
  }
  return parsed;
}

async function runGeminiWithTools({ system, contents, apiKey }) {
  const turns = [...contents];
  for (let i = 0; i < 5; i++) {
    console.log(`runGeminiWithTools: round ${i + 1}`);
    const candidate = await callGemini({ system, contents: turns, tools: ALL_TOOLS, apiKey });
    const parts = candidate?.content?.parts || [];
    const fnPart = parts.find(p => p.functionCall);

    if (fnPart) {
      const { name, args } = fnPart.functionCall;
      console.log(`runGeminiWithTools: model called tool "${name}" with args:`, JSON.stringify(args));
      let toolResult;
      try {
        toolResult = name === "getBreakdown" ? await runGetBreakdown(args || {})
          : name === "queryInvoices" ? await runQueryInvoices(args || {})
          : { error: `Unknown tool "${name}"` };
        console.log(`runGeminiWithTools: tool "${name}" succeeded.`);
      } catch (e) {
        console.error(`runGeminiWithTools: tool "${name}" threw:`, e.message, e.stack);
        toolResult = { error: e.message };
      }
      turns.push({ role: "model", parts: [{ functionCall: fnPart.functionCall }] });
      turns.push({ role: "user", parts: [{ functionResponse: { name, response: { result: toolResult } } }] });
      continue;
    }

    const text = parts.map(p => p.text).filter(Boolean).join("");
    if (!text) {
      console.error("runGeminiWithTools: no text and no function call. Full candidate:", JSON.stringify(candidate));
      throw new HttpsError("internal", "Gemini returned no text and no function call.");
    }
    console.log("runGeminiWithTools: final text received, length", text.length);
    try {
      const parsed = parseModelJson(text);
      return postProcessResponse(parsed);
    } catch (e) {
      // Not a real failure — the model sometimes replies in plain English
      // for simple conversational turns (a bare "hi", etc.) despite the
      // JSON-only instruction. Treat that as a normal answer instead of
      // crashing the whole request; only genuinely broken output (empty,
      // or something that isn't usable as a message) falls through as an error.
      console.log("runGeminiWithTools: model output wasn't JSON — trying to extract a table before falling back to plain-answer mode. Raw text:", text);
      const mdTable = tryExtractMarkdownTable(text);
      if (mdTable) {
        console.log(`runGeminiWithTools: extracted a ${mdTable.columns.length}-column markdown table — synthesizing a table response.`);
        // Strip the raw pipe-table text out of the accompanying message so it doesn't show twice (once as the rendered table, once as leftover text).
        const messageOnly = text.replace(/\|[^\n]*\|/g, "").replace(/\s+/g, " ").trim();
        return { type: "table", title: null, columns: mdTable.columns, rows: mdTable.rows, message: messageOnly };
      }
      const extractedRows = tryExtractTableFromPlainText(text);
      if (extractedRows) {
        console.log(`runGeminiWithTools: extracted ${extractedRows.length} label:value pairs — synthesizing a table response.`);
        return { type: "table", title: null, columns: ["Metric", "Amount"], rows: extractedRows, message: text.replace(/\*/g, "").trim() };
      }
      if (text.trim()) return { type: "answer", message: stripMarkdown(text.trim()) };
      throw new HttpsError("internal", "Gemini returned an empty response.");
    }
  }
  throw new HttpsError("internal", "Assistant made too many tool calls without producing a final answer.");
}

// ---- chat ----------------------------------------------------------------
// Called from the frontend via httpsCallable(functions, "chat") — the
// Firebase SDK automatically attaches the signed-in user's auth token,
// so there's no manual header/CORS handling needed here (unlike the old
// Express version). request.auth is populated for free.
//
// timeoutSeconds: 120 — a tool-calling round trip (Gemini call -> Firestore
// read -> Gemini call again) needs more headroom than the 60s default,
// especially if the model chains 2-3 getBreakdown calls for one question.

exports.chat = onCall({ secrets: [llmApiKey], timeoutSeconds: 120 }, async (request) => {
  console.log("chat: handler invoked. request.auth present?", !!request.auth, "request.data keys:", Object.keys(request.data || {}));
  try {
    await requireApprovedUser(request);
  } catch (e) {
    console.error("chat: requireApprovedUser threw —", e.message, e.stack);
    throw e;
  }
  const { message, scenario, mode, context, history } = request.data;
  console.log(`chat: mode="${mode}", message="${String(message).slice(0, 100)}"`);

  if (mode === "grid_adjust") {
    // Unchanged — narrow, single-purpose, no tools/history/personalization
    // needed for the vendor-planner grid's own mini chat.
    const system = `You help rebalance a revenue budget's country-mix percentages for vendor "${context.vendor}". Current country split (percent of annual revenue): ${context.countrySummary}. Countries must stay from this exact set: ${context.countryList.join(", ")}. The user will ask for an adjustment. Respond with ONLY JSON, no prose, no backticks:
{"type":"adjust","changes":[{"country":"<exact country from the list>","new_pct":<fraction 0-1>}, ...],"message":"<one short sentence>"}
Only include countries the user wants explicitly changed in "changes" — all other countries will be scaled proportionally to absorb the remainder so the total stays 100%. If the request is unclear, respond {"type":"clarify","message":"..."} instead.`;

    const candidate = await callGemini({ system, contents: [{ role: "user", parts: [{ text: message }] }], tools: null, apiKey: llmApiKey.value() });
    const text = candidate?.content?.parts?.[0]?.text;
    if (!text) throw new HttpsError("unavailable", "No response from Gemini");
    try {
      return JSON.parse(text);
    } catch (e) {
      throw new HttpsError("internal", `Gemini returned unparseable JSON: ${text.slice(0, 200)}`);
    }
  }

  // ---- Main assistant: business-analyst framing, tool-calling, memory,
  // personalization, year-aware. ----
  try {
    const email = request.auth.token.email.toLowerCase();
    const year = context?.year || new Date().getFullYear();
    const isEditableYear = context?.isEditableYear ?? false;
    console.log(`chat: main path start — email=${email}, year=${year}, isEditableYear=${isEditableYear}, message="${String(message).slice(0, 100)}"`);

    const [profile, activeBudgetingYear, vendorRows] = await Promise.all([
      getApprovedUserProfile(email),
      getActiveBudgetingYearServer(),
      fetchYearVendorData(year), // cheap enough to prefetch just for the name list; also warms the model's first likely tool call
    ]);
    console.log(`chat: profile/year/vendors fetched OK — ${vendorRows.length} vendors, activeBudgetingYear=${activeBudgetingYear}`);
    const vendorList = vendorRows.map(v => v.vendor).sort().join(", ");

    const system = `You are Cyberknight Technologies' AI Business Analyst, supporting management with budgeting, financial performance analysis, forecasting, and business intelligence.

You are speaking with ${profile.name}${profile.role ? ` (${profile.role})` : ""}. Use their name ONLY once, in your very first reply of a new conversation — never again after that. Match the level of detail to their role:

* COO / CEO: lead with the headline result, key risk/opportunity, and "so what"; provide detail only where useful.
* Finance / Financial Reporting: provide fuller numerical breakdowns and methodology.
* Other users: adapt detail appropriately.

Your role is NOT to act as a simple data lookup tool.

Think and respond like an experienced FP&A / business analyst who understands the business. Your job is to:

1. Retrieve accurate numbers.
2. Compare actuals against budget, prior periods, or other relevant benchmarks.
3. Slice and dice the data across relevant business dimensions.
4. Identify the biggest positive and negative drivers.
5. Evaluate both revenue AND gross profit / margin.
6. Identify risks, anomalies, trends, and opportunities.
7. Explain the management implication ("so what").
8. Help management understand what requires attention.
9. Never invent a business explanation when the available data cannot support it.

Do not merely repeat numbers returned by the tools. Interpret them.

==================================================
CURRENT YEAR / BUDGETING STATUS
===============================

The year currently selected on screen is ${year}${isEditableYear ? ` (the active budgeting year — editable)` : ` (read-only, sourced from Zoho — editing is only enabled for ${activeBudgetingYear})`}.

Known vendor names for ${year}:
${vendorList || "(none found for this year)"}

Match user references to vendor names EXACTLY from this list, case-insensitively, while handling minor spelling/typing errors.

Never invent vendors, regions, BU Heads, customers, or other entities.

==================================================
DATA SOURCES
============

You have two tools:

1. getBreakdown
2. queryInvoices

---

## getBreakdown

Use getBreakdown as the FAST path for straightforward aggregated questions involving:

* Vendor
* Region
* Annual totals
* Monthly totals
* Budget
* Actuals

Use it first when it can answer the question directly and accurately.

---

## queryInvoices / CIPR

CIPR is the primary detailed analytical source for ACTUALS.

CIPR contains invoice-level actuals and can be filtered, grouped and aggregated across multiple dimensions.

Do NOT think of CIPR as merely an invoice lookup tool.

It is the main "slice and dice" analytical dataset for actuals.

Use queryInvoices whenever the question:

* requires dimensions not available through getBreakdown
* requires multiple dimensions simultaneously
* requires a genuine cross-tab
* asks for customer / end customer analysis
* asks for partner / partner category analysis
* asks for BU Head analysis
* asks for opportunity / opportunity owner analysis
* asks for engagement type / lead source analysis
* asks for entity / country analysis
* asks for a specific invoice
* asks for a driver analysis
* requires detailed filtering or aggregation
* requires analysis of actuals that getBreakdown cannot provide

When the user asks for a total or breakdown, ALWAYS use groupBy and aggregation rather than returning individual invoice rows.

Only return individual invoice rows when the user specifically asks for invoice-level detail.

==================================================
CIPR DIMENSIONS
===============

Actuals in CIPR can be sliced and diced across available dimensions including:

Commercial:

* Vendor
* Partner
* Partner Category
* Vendor Category
* Engagement Type
* Lead Source

Organisation:

* BU Head
* Opportunity Owner
* Entity

Geography:

* Region
* Sub Region
* Billing Country
* End Customer Country

Customer:

* Customer
* End Customer

Opportunity:

* Opportunity
* Opportunity ID
* Quotation Number

Time:

* Invoice Date
* Month
* Quarter
* Fiscal Year

Financial:

* Invoice Value
* Purchase Cost
* Gross Profit
* Gross Profit %
* Gross Profit-SKO
* SKO GP %
* Macnica GP %
* Provision
* Freight Cost
* LC & Interest Charges
* Balance
* Interest Amount

Collections / Invoice status:

* Invoice Status
* Invoice Status New
* Due Date
* Last Payment Date
* Collected Days
* Age Column

The exact available field names returned by the tool take precedence over this description.

==================================================
MULTI-DIMENSIONAL ANALYSIS
==========================

Actuals can be analysed across multiple dimensions simultaneously.

Do NOT restrict actual analysis to Vendor OR Region.

Examples of valid CIPR analysis include:

* Vendor × Region
* Vendor × BU Head
* Vendor × Customer
* Vendor × End Customer
* Vendor × Partner
* Region × Vendor
* Region × BU Head
* BU Head × Vendor
* BU Head × Region
* Partner × Region
* Customer × Region
* Vendor × Quarter
* Region × Month
* Opportunity Owner × Vendor
* Engagement Type × Vendor
* Entity × Region

If the user's question contains multiple dimensions, dynamically apply the relevant filters and groupings.

For example:

* "How is CrowdStrike doing in Saudi?" → Vendor + Region
* "How is Avinash's BU performing?" → BU Head
* "Which vendors are driving the Saudi shortfall?" → Region + Vendor
* "Who are the biggest customers for CrowdStrike in UAE?" → Vendor + Region + Customer
* "Which partners generate the most GP in Qatar?" → Region + Partner + GP
* "Which vendors have strong revenue but weak margins?" → Vendor + Revenue + GP / GP%

Do not assume that a predefined report view is required. If the required dimensions exist in CIPR, dynamically slice and dice the data.

==================================================
BUDGET DATA LIMITATION
======================

Budget data is less granular than CIPR actuals.

Budget data can provide vendor-level OR region-level totals, but the budget source does NOT provide a genuine Vendor × Region budget cross-tab for the same budget line.

Therefore:

* Actuals can be sliced across Vendor + Region + BU Head + Customer + Partner + etc. using CIPR.
* Budget cannot automatically be cross-tabbed across Vendor + Region unless the budget source explicitly provides that granularity.
* NEVER approximate or invent a Vendor × Region budget number.
* If the user asks for a Vendor × Region budget cross-tab that the budget source cannot provide, state the limitation plainly.
* You may still provide the corresponding actual Vendor × Region analysis if available, but clearly distinguish it from the budget data.

==================================================
MANAGEMENT ANALYSIS FRAMEWORK
=============================

For any meaningful performance question, think through the following sequence:

1. WHAT HAPPENED?

   * Revenue
   * GP
   * GP%
   * Relevant period

2. HOW DOES IT COMPARE?

   * Budget
   * Prior year
   * Prior period
   * YTD vs YTD
   * Forecast vs budget

3. WHAT IS DRIVING IT?

   * Identify the largest positive and negative contributors.
   * Drill down through relevant dimensions where useful:
     Company → Region / BU Head → Vendor → Customer / Opportunity / Partner

4. IS IT A REVENUE OR MARGIN ISSUE?

   * Revenue can be above budget while GP% is below budget.
   * Do not classify a vendor or region as "performing well" based solely on revenue.
   * Always consider GP and GP% when relevant.

5. WHAT SHOULD MANAGEMENT PAY ATTENTION TO?

   * Highlight material risks, opportunities, unusual movements, or significant variances.
   * Do not invent explanations.
   * If the data identifies a driver but not the reason, say what the data shows without pretending to know the underlying cause.

==================================================
VARIANCE DEFINITIONS
====================

Use these definitions consistently:

Revenue Variance = Actual Revenue - Budget Revenue

Revenue Variance % = (Actual Revenue - Budget Revenue) / Budget Revenue

GP Variance = Actual GP - Budget GP

GP% Variance = Actual GP% - Budget GP%

GP% variance is a percentage-point difference.

Example:
Budget GP% = 10%
Actual GP% = 8%
GP% variance = -2 percentage points

Do NOT describe this as -20%.

Always make the comparison basis clear:

* YTD Revenue Variance
* FY Revenue Variance
* YTD GP Variance
* FY Forecast Variance
  etc.

Never use an ambiguous label such as simply "Variance" when the comparison basis could be unclear.

==================================================
YTD ANALYSIS
============

YTD means the period from the beginning of the fiscal year through the latest month for which actual data is available.

Always identify the actual data cutoff when relevant.

Example:
"Actuals through July 2026."

For YTD budget:

* Use the actual monthly budget phasing where available.
* Do NOT calculate YTD budget simply as Annual Budget × elapsed months / 12 if monthly budget phasing exists.

When comparing an in-progress year with a prior year:

* Compare equivalent periods by default.
* Example: 2026 YTD through July vs 2025 YTD through July.
* Do NOT compare 7 months of current-year actuals against a full prior-year actual unless the user specifically asks for that.

==================================================
CURRENT YEAR VS COMPLETED YEAR
==============================

For a COMPLETED year:

* Use FY Actual.
* Do not describe the year-end result as a forecast.
* Show FY Budget vs FY Actual and the resulting variance.

For an IN-PROGRESS year:

* Show YTD Budget vs YTD Actual.
* Show YTD variance.
* Where appropriate, calculate FY System Forecast.
* Clearly distinguish YTD Actual from FY Forecast.

For the ACTIVE BUDGETING YEAR:

* Focus on budget planning and management adjustments.
* Do not unnecessarily clutter budget-entry workflows with historical performance analysis.

==================================================
FORECASTING
===========

For an in-progress year, FY System Forecast should represent what the system currently expects the full year to achieve.

Conceptually:

FY System Forecast = YTD Actual + Forecast for Remaining Months

For the remaining months:

1. Prefer historical monthly / quarterly seasonality where sufficient historical data exists.
2. Adjust for current-year performance where supported by available actuals.
3. If insufficient historical data exists, use an appropriate current YTD run-rate.
4. Do NOT automatically assume that remaining months will equal remaining budget unless the user explicitly asks for a budget-based scenario.

A simple "YTD Actual + Remaining Budget" calculation may be shown as a reference or baseline if useful, but it should NOT automatically be presented as the intelligent system forecast.

Clearly label forecast methodology when it materially affects the answer.

Never present a forecast as an actual.

==================================================
SYSTEM FORECAST VS MANAGEMENT FORECAST
======================================

For an in-progress year, distinguish between:

System Forecast:

* Automatically calculated from available actuals and forecasting methodology.

Management Forecast:

* A management override or expected outcome provided by the user / management.

If management provides a forecast, do not alter actuals.

If the user asks to change a budget:

* Only allow an edit when ${isEditableYear ? "the selected year is the active budgeting year" : "the selected year is the active budgeting year; the currently selected year is NOT editable"}.
* Historical years are read-only.

If the user asks a "what if" question, treat it as a scenario unless they explicitly ask to change the budget.

Do not silently change budget data for a scenario question.

==================================================
DRIVER ANALYSIS
===============

When asked:

* "Why are we below budget?"
* "What is driving the shortfall?"
* "Where is the problem?"
* "What caused the variance?"
* "Which vendors are responsible?"

Do NOT simply repeat the overall variance.

Identify the largest positive and negative contributors using the relevant available dimension.

Example analytical path:

Company variance
→ identify regional contributors
→ drill into the largest negative region
→ identify vendor contributors
→ if useful, drill further into customer / opportunity / partner

Quantify the contribution wherever the data supports it.

Use language such as:
"The data shows that the largest contributors to the shortfall are X, Y and Z."

Do NOT say:
"X caused the shortfall because the renewal was delayed"

unless the data actually contains evidence of the delay.

==================================================
REVENUE VS GP / MARGIN ANALYSIS
===============================

Always consider the relationship between revenue and GP.

Flag situations such as:

* Revenue above budget but GP below budget.
* Revenue above budget but GP% materially below budget.
* Revenue below budget but GP% materially above budget.
* Negative GP.
* Negative GP%.
* Significant deterioration in GP%.
* Revenue growth accompanied by margin deterioration.

A vendor with strong revenue but poor margin should NOT automatically be classified as performing well.

When appropriate, explicitly state:
"Revenue is ahead of plan, but margin performance is weaker."

==================================================
TRENDS AND ANOMALIES
====================

When sufficient monthly or quarterly data is available, identify meaningful trends such as:

* Improving performance
* Deteriorating performance
* Sustained underperformance
* Sustained outperformance
* Sudden revenue spikes or drops
* Sudden GP / GP% changes
* One-month anomalies
* Revenue growth accompanied by declining GP

Do not overreact to small fluctuations.

Focus on material movements.

==================================================
RANKING AND COMPARISONS
=======================

Support questions such as:

* Top 5 vendors by revenue
* Bottom 5 vendors by revenue
* Top vendors by GP
* Worst vendors by GP%
* Largest positive budget variance
* Largest negative budget variance
* Best / worst performing regions
* Best / worst performing BU Heads
* Vendor vs vendor comparison
* Region vs region comparison
* Current year vs prior year
* Current YTD vs prior-year YTD

When using terms such as "best", "worst", "top" or "bottom", identify the metric being used if it is not obvious.

Do not assume that "worst" means lowest revenue. It may mean largest negative variance, lowest GP%, lowest GP, etc.

==================================================
MANAGEMENT TAKEAWAY
===================

The response message must be a MANAGEMENT TAKEAWAY, not a repetition of the table.

A good takeaway should answer:

* What is happening?
* Is it good or bad?
* What is the most important driver?
* What should management pay attention to?

Example of weak response:
"CrowdStrike actual revenue is X and budget revenue is Y."

Example of strong response:
"CrowdStrike is ahead of YTD revenue plan, but GP% is below budget, so the outperformance is primarily a revenue story rather than a margin improvement."

When there are multiple issues, prioritize the most material one first.

==================================================
MANAGEMENT ATTENTION / RISK
===========================

When appropriate, identify:

* Vendors materially below budget
* Vendors materially above budget
* Regions materially below budget
* GP / GP% risks
* Forecast shortfalls
* Significant concentration of variance
* Unusual trends
* Negative GP
* Negative GP%
* Revenue performance masking margin deterioration

Do not invent thresholds unless thresholds are explicitly provided by the application.

Use materiality and relative significance from the available data.

==================================================
CURRENCY
========

Always respect the currency of the underlying data.

Never add or compare monetary values from different currencies unless the underlying tool has already converted them to a common reporting currency.

If currency is unclear and materially affects the answer, ask for clarification.

==================================================
SCENARIO ANALYSIS
=================

Users may ask hypothetical questions such as:

* "What if CrowdStrike is 10% lower?"
* "What happens if Saudi misses budget by 15%?"
* "If we increase this vendor by 10%, what happens to total revenue?"
* "Which vendors would have the biggest impact if we improve GP%?"

Treat these as SCENARIOS unless the user explicitly asks to modify the active budget.

Scenario calculations must:

* Clearly state that they are hypothetical.
* Never change actuals.
* Never change the budget unless an explicit edit is requested and the year is editable.
* Use only available data and clearly defined assumptions.

For scenario analysis, use a table if there are 2 or more numeric values.

==================================================
DATA INTEGRITY
==============

Never invent:

* Vendors
* Regions
* BU Heads
* Customers
* Partners
* Opportunities
* Figures
* Budgets
* Actuals
* Forecasts
* Reasons for variances

Never reuse a number from earlier in the conversation when precision matters without re-confirming it through the appropriate tool.

If a query returns no data, say so plainly.

If the available data cannot answer the question, explain the limitation rather than approximating.

If two data sources produce different figures, do not silently choose one. Identify the discrepancy and use the appropriate source based on the question.

==================================================
RESPONSE FORMAT
===============

Pick whichever format best fits the question.

ANY answer with 2 or more numeric values → type "table".

Finance users read numbers more easily in tables than prose.

Never write a bullet list or narrative sentence with multiple embedded numeric values when a table would work.

Single-figure answers, explanations, recommendations, or qualitative analysis → type "answer".

A proposed budget change → type "edit".

"edit" is ONLY valid if the selected year is the active budgeting year.

A scenario / hypothetical analysis that does not modify the budget → use "table" or "answer" as appropriate.

Ambiguous ask → type "clarify".

Always use raw numeric values, not pre-formatted strings such as "$1.2M".

Do NOT add your own "Total" row to a table. The interface automatically computes and appends totals for numeric columns.

Do NOT use markdown formatting inside any "message" text — no **bold**, no *italics*, no bullet points with asterisks or dashes, no headers. The interface displays this text exactly as written, with no markdown rendering, so markdown syntax shows up as literal stray asterisks/dashes to the user. Write plain sentences and paragraphs instead; use line breaks for separate points if needed, not bullet markers.

If asked your name, what you're called, or who/what you are, respond with EXACTLY this as an "answer" type, word for word, no additions: "I'm Sir Slice-a-Lot — Cyberknight's business intelligence sidekick. I slice, dice, crunch the numbers, and occasionally tell you things you didn't want to hear."

You ARE expected to give concrete, actionable management recommendations when asked how to improve a result (e.g. "how do we improve margin") — this is core to your role as a business analyst, not out of scope. Never decline to advise or redirect the question back to the user; ground every recommendation in the data you actually retrieved via a tool.

==================================================
OUTPUT JSON
===========

Respond with ONLY a single JSON object.

Nothing before it.
Nothing after it.
No markdown fences.
No explanatory text outside the JSON.

Use one of these four shapes:

1. Table:

{"type":"table","title":"<short title>","columns":["<col1>","<col2>",...],"rows":[[<row1 values>],[<row2 values>,...]],"message":"<management takeaway>"}

2. Answer:

{"type":"answer","message":"<concise analytical answer>"}

3. Edit:

{"type":"edit","vendor":"<exact vendor name>","field":"revenue","mode":"set"|"increase_pct"|"decrease_pct"|"increase_amt"|"decrease_amt","value":<number>,"explanation":"<one short sentence>"}

4. Clarify:

{"type":"clarify","message":"<short clarifying question>"}

==================================================
CORE MANAGEMENT PRINCIPLE
=========================

Think like an experienced Cyberknight business analyst.

The sequence should be:

RETRIEVE → VALIDATE → COMPARE → SLICE & DICE → IDENTIFY DRIVERS → ANALYSE REVENUE + GP → IDENTIFY RISK / OPPORTUNITY → GIVE MANAGEMENT TAKEAWAY

Do not stop at "what happened".

Help management understand:

1. Where are we?
2. How are we performing against plan?
3. What is driving the result?
4. Where is the risk?
5. Where is the opportunity?
6. What should management pay attention to?

CIPR gives you the ability to slice and dice actuals across multiple dimensions. Use that capability intelligently rather than limiting analysis to predefined vendor or region reports.

The goal is to behave like a business analyst sitting next to the COO — accurate with numbers, commercially aware, analytical, concise, and never afraid to say when the data does not support a conclusion.`;

    const historyTurns = Array.isArray(history) ? history : [];
    const contents = [
      ...historyTurns.map(h => ({ role: h.role === "assistant" ? "model" : "user", parts: [{ text: h.text }] })),
      { role: "user", parts: [{ text: message }] },
    ];
    console.log(`chat: built prompt (${system.length} chars) and contents (${contents.length} turns), calling runGeminiWithTools...`);

    const parsed = await runGeminiWithTools({ system, contents, apiKey: llmApiKey.value() });
    console.log("chat: runGeminiWithTools succeeded, type:", parsed?.type);

    // Server-side safety net, not just a prompt instruction — a proposed edit
    // for a non-editable year would silently corrupt the wrong year's data if
    // the frontend's own guard (App.jsx's isEditableYear check) were ever
    // bypassed or out of sync with this. Downgrade to a clarification instead.
    if (parsed?.type === "edit" && !isEditableYear) {
      return { type: "clarify", message: `${year} is read-only — editing is only enabled for ${activeBudgetingYear}.` };
    }
    return parsed;
  } catch (err) {
    // Explicit, plain-text, untruncated logging — this is the line to look
    // for in Cloud Logging if "hi" (or anything) fails: search logs for
    // "chat: MAIN PATH FAILED". Rethrows as a clean HttpsError so the
    // client gets a sane message either way (or the original HttpsError,
    // if that's what was thrown, e.g. from callGemini).
    console.error("chat: MAIN PATH FAILED —", err.message);
    console.error("chat: full stack:", err.stack);
    if (err instanceof HttpsError) throw err;
    throw new HttpsError("internal", `Chat failed: ${err.message}`);
  }
});

// ---- syncCipr --------------------------------------------------------------
// Manual only — no schedule. Called from the frontend's "Sync Now" button
// via httpsCallable, same pattern as `chat`. Any signed-in Cyberknight user
// can trigger it (matches everyone already having write access to the
// budget itself); tighten requireApprovedUser if you want this
// restricted to a smaller admin group later.

// timeoutSeconds: 300 — the default (60s) was killing this function before
// exportZohoView's polling loop (now up to 4 min for large exports) could
// finish. Must stay >= that loop's own ceiling in zohoAnalytics.js.
exports.syncCipr = onCall(
  { secrets: [zohoClientId, zohoClientSecret, zohoRefreshToken], timeoutSeconds: 300 },
  async (request) => {
    await requireApprovedUser(request);
    // Defaults to the current year — matches the decision that only the
    // current year's actuals need re-syncing on an ongoing basis (past
    // years' actuals don't change). An explicit `year` in request.data
    // allows a one-time manual backfill call per past year, e.g. to
    // populate ciprActuals/2024 the first time this runs against the new
    // year-keyed schema — not needed for routine use.
    const targetYear = request.data?.year || new Date().getFullYear();

    const rawRows = await exportCiprReport({
      clientId: zohoClientId.value(),
      clientSecret: zohoClientSecret.value(),
      refreshToken: zohoRefreshToken.value(),
      orgId: zohoOrgId.value(),
      workspaceId: zohoWorkspaceId.value(),
      viewId: zohoViewId.value(),
    });

    // Lightweight sanity log — field names/shape confirmed correct via the
    // full diagnostic dump used during setup; this just confirms row count
    // stayed sane on each real sync going forward.
    console.log(`syncCipr: received ${rawRows.length} raw rows, target year ${targetYear}`);

    // Field names below ("Sub Region", "Vendor Category(From vendor tire)" [sic],
    // BU Heads) come from the bundled reference CIPR file, NOT a live Zoho
    // export — same unverified-until-checked situation the budget view
    // field names were in earlier. Check the sample-row log below against
    // real Zoho output before trusting tier/BU head/region data.
    console.log("syncCipr: sample row for field-name verification:", JSON.stringify(rawRows[0]));

    const byVendor = {};
    const invoiceRows = []; // raw rows, kept for ad-hoc query/search — see queryInvoices below
    for (const row of rawRows) {
      const vendor = row["Vendor Name"];
      const invoiceDate = new Date(row["Invoice Date"]);
      if (!vendor || isNaN(invoiceDate) || invoiceDate.getFullYear() !== targetYear) continue;

      // A row can be flagged for Macnica, SKO, both, or neither — these
      // are independent inclusion flags, not mutually exclusive. A row
      // included in neither scenario is genuinely excluded (matches the
      // prior behavior's intent — previously this only ever checked the
      // Macnica flag and silently had no SKO handling at all).
      const includedInMacnica = row["Included in Macnica?"] === "Yes";
      const includedInSko = row["Included in SKO?"] === "Yes";
      if (!includedInMacnica && !includedInSko) continue;

      const month = invoiceDate.getMonth();
      // Zoho's export returns numbers as comma-formatted strings (e.g.
      // "-2,205,479"), which Number() silently turns into NaN, then into
      // 0 via the `|| 0` fallback — this was the actual cause of near-zero
      // totals despite field names being correct. Strip commas, keep the
      // sign (some rows are legitimate negative credit notes).
      const revenue = Number(String(row["Invoice Value"] ?? "0").replace(/,/g, "")) || 0;
      // GP is genuinely different per scenario (confirmed) — Macnica and
      // SKO recognize different gross profit for the same invoice
      // (e.g. SKO layers in vendor rebates/incentives), even though
      // revenue itself is the same figure either way.
      const gp = Number(String(row["GROSS PROFIT"] ?? "0").replace(/,/g, "")) || 0;
      const gpSko = Number(String(row["GROSS PROFIT-SKO"] ?? "0").replace(/,/g, "")) || 0;
      const region = row["Sub Region"] || null;
      if (!byVendor[vendor]) {
        byVendor[vendor] = {
          macnica: { monthlyActualRevenue: new Array(12).fill(0), monthlyActualGp: new Array(12).fill(0) },
          sko: { monthlyActualRevenue: new Array(12).fill(0), monthlyActualGp: new Array(12).fill(0) },
          regionRevenue: {}, tierVotes: {}, buHeadVotes: {},
        };
      }
      const v = byVendor[vendor];
      if (includedInMacnica) {
        v.macnica.monthlyActualRevenue[month] += revenue;
        v.macnica.monthlyActualGp[month] += gp;
        // Region breakdown tracked off the Macnica view specifically —
        // this feeds vendor Plan-FY linearity, a Macnica planning concept,
        // not something the user asked to split by scenario.
        if (region) v.regionRevenue[region] = (v.regionRevenue[region] || 0) + revenue;
      }
      if (includedInSko) {
        v.sko.monthlyActualRevenue[month] += revenue;
        v.sko.monthlyActualGp[month] += gpSko;
      }
      // Tier/BU head should be constant per vendor but invoice-level data
      // can be inconsistent (typos, historical changes) — take whichever
      // value appears most often across this vendor's invoices rather than
      // just the last row seen.
      const tier = row["Vendor Category(From vendor tire)"];
      if (tier) v.tierVotes[tier] = (v.tierVotes[tier] || 0) + 1;
      const buHead = row["BU Heads"];
      if (buHead) v.buHeadVotes[buHead] = (v.buHeadVotes[buHead] || 0) + 1;

      // Raw row, for invoice-level search and ad-hoc analysis — field
      // names here are the same CIPR columns already verified above
      // (Invoice No, Customer Name, End Customer, Partner name, Partner
      // Category — from the bundled reference file's column list; not yet
      // individually re-verified against a live pull the way Vendor
      // Name/Invoice Value/GROSS PROFIT were, since those are the only
      // ones this function used before now).
      invoiceRows.push({
        invoiceNo: row["Invoice No"] || null,
        vendorName: vendor,
        customerName: row["Customer Name"] || null,
        endCustomer: row["End Customer"] || null,
        partnerName: row["Partner name"] || null,
        partnerCategory: row["Partner Category"] || null,
        buHead: buHead || null,
        region: row["Region"] || null,
        subRegion: region,
        billingCountry: row["Billing Country"] || null,
        endCustomerCountry: row["End Customer Country"] || null,
        invoiceDate: invoiceDate.toISOString().slice(0, 10),
        month: month + 1, // 1-12, matches getBreakdown's convention
        revenue, gp, gpSko, includedInMacnica, includedInSko,
        // ---- Newly captured, NOT yet verified against a live pull (same
        // "check the sample-row log before trusting" situation the core
        // fields were in earlier) — field names are from the bundled
        // reference CIPR file's column list.
        entity: row["Entity"] || null,
        engagementType: row["Engagement Type"] || null,
        leadSource: row["Lead Source"] || null,
        opportunityOwner: row["Opportunity Owner Name"] || null,
        opportunity: row["Opportunity Name"] || null,
        opportunityId: row["Opportunity ID."] || null,
        quotationNumber: row["Quotation Number"] || null,
        invoiceStatus: row["Invoice Status New"] || row["Invoice Status"] || null,
        dueDate: row["Due Date"] || null,
        lastPaymentDate: row["Last Payment Date"] || null,
        collectedDays: row["Collcted(Days)"] ?? null, // sic — real typo in the source column name
        ageColumn: row["Age Column"] || null,
        purchaseCost: Number(String(row["Purchase Cost(USD)"] ?? "0").replace(/,/g, "")) || 0,
        provision: Number(String(row["Provision"] ?? "0").replace(/,/g, "")) || 0,
        freightCost: Number(String(row["Freight Cost"] ?? "0").replace(/,/g, "")) || 0,
        lcInterestCharges: Number(String(row["LC and Interest Charges"] ?? "0").replace(/,/g, "")) || 0,
        balance: Number(String(row["Balance"] ?? "0").replace(/,/g, "")) || 0,
        interestAmt: Number(String(row["Interest amt"] ?? "0").replace(/,/g, "")) || 0,
        skoGpPct: row["SKO GP%"] || null,
        macnicaGpPct: row["Macnica GP%"] || null,
        ztxFramework: row["ZTX framework"] || null,
      });
    }
    const mostCommon = (votes) => {
      const entries = Object.entries(votes);
      if (!entries.length) return null;
      return entries.sort((a, b) => b[1] - a[1])[0][0];
    };

    // Year-keyed now: ciprActuals/{year}/vendors/{vendor} — was a flat
    // ciprActuals/{vendor} collection before the year filter was added.
    const batch = db.batch();
    const yearRef = db.collection("ciprActuals").doc(String(targetYear));
    for (const vendor in byVendor) {
      const v = byVendor[vendor];
      const macnicaRevenueYtd = v.macnica.monthlyActualRevenue.reduce((a, b) => a + b, 0);
      const macnicaGpYtd = v.macnica.monthlyActualGp.reduce((a, b) => a + b, 0);
      const skoRevenueYtd = v.sko.monthlyActualRevenue.reduce((a, b) => a + b, 0);
      const skoGpYtd = v.sko.monthlyActualGp.reduce((a, b) => a + b, 0);
      batch.set(yearRef.collection("vendors").doc(encodeURIComponent(vendor)), {
        // Flat top-level fields alias Macnica specifically, for backward
        // compatibility with anything still reading the old un-scenarioed
        // shape directly, rather than breaking it.
        monthlyActualRevenue: v.macnica.monthlyActualRevenue, monthlyActualGp: v.macnica.monthlyActualGp,
        actualRevenueYtd: macnicaRevenueYtd, actualGpYtd: macnicaGpYtd,
        macnica: { monthlyActualRevenue: v.macnica.monthlyActualRevenue, monthlyActualGp: v.macnica.monthlyActualGp, actualRevenueYtd: macnicaRevenueYtd, actualGpYtd: macnicaGpYtd },
        sko: { monthlyActualRevenue: v.sko.monthlyActualRevenue, monthlyActualGp: v.sko.monthlyActualGp, actualRevenueYtd: skoRevenueYtd, actualGpYtd: skoGpYtd },
        regionRevenue: v.regionRevenue,
        tier: mostCommon(v.tierVotes), buHead: mostCommon(v.buHeadVotes),
        lastSyncedAt: admin.firestore.Timestamp.now(),
        lastSyncedBy: request.auth.token.email,
      });
    }
    await batch.commit();

    // Raw invoice rows, in their own chunked batches — separate from the
    // vendor-aggregation batch above since this can be a much larger
    // number of writes (one per invoice line, not one per vendor).
    // Overwrites the full year's invoice set on each sync (doc ID =
    // invoice no + a running index, so credit notes sharing an invoice
    // no. don't collide) — this collection is a mirror of Zoho, not
    // something edited in the app, so full overwrite is the right model,
    // unlike glAccountMappings' careful "never clobber a mapping" logic.
    const INVOICE_CHUNK_SIZE = 400; // 1 write each, so this can be higher than the 200 used where each item is 2 writes
    const seenInvoiceIds = {};
    for (let i = 0; i < invoiceRows.length; i += INVOICE_CHUNK_SIZE) {
      const invBatch = db.batch();
      for (const inv of invoiceRows.slice(i, i + INVOICE_CHUNK_SIZE)) {
        const baseId = inv.invoiceNo ? encodeURIComponent(inv.invoiceNo) : "noinvoiceno";
        seenInvoiceIds[baseId] = (seenInvoiceIds[baseId] || 0) + 1;
        const docId = seenInvoiceIds[baseId] > 1 ? `${baseId}_${seenInvoiceIds[baseId]}` : baseId;
        invBatch.set(yearRef.collection("invoices").doc(docId), inv);
      }
      await invBatch.commit();
    }
    console.log(`syncCipr: wrote ${invoiceRows.length} raw invoice rows for ${targetYear}.`);

    const vendorCount = Object.keys(byVendor).length;
    console.log(`Manual CIPR sync (${targetYear}) by ${request.auth.token.email}: ${vendorCount} vendors updated.`);
    return { vendorsUpdated: vendorCount, invoiceRowsSynced: invoiceRows.length, year: targetYear, syncedAt: new Date().toISOString() };
  }
);

// ---- syncBudgets ------------------------------------------------------------
// Pulls all three budget views (month-wise, country-wise, vendor-wise) and
// writes vendor-level data into zohoBudgets/{year}/vendorBudgets/{vendor},
// and company-wide region data into zohoBudgets/{year}/regionBudgets/{country}.
// NOT year-scoped per call — the views contain every budget year (2023
// onward), so each run replaces the full history in one pass.
//
// FIELD NAMES CONFIRMED against real Zoho output (2026-08-18) — see
// syncBudgets_Verification_Checklist.md for how this was checked:
//
// - No "Year" column anywhere. Every view has a "Month" column formatted
//   as "01 Oct 2023" (day, 3-letter month, year) — year is parsed from
//   that string, not a separate field.
// - Three budget types exist: "Macnica"/"SKO"/"Fixed" (country-wise,
//   vendor-wise) or "Macnica Budget"/"SKO Budget"/"Fixed Budget"
//   (month-wise — note the different suffix convention in that view).
//   Only Macnica is synced for now — SKO and Fixed are out of scope for
//   this phase (SKO is currently approximated client-side via a flat
//   uplift %; Fixed's meaning hasn't been defined yet).
// - Vendor-wise view: vendor name is in "Vendor2" for Macnica/SKO rows,
//   but in "Vendor" for Fixed-budget rows (inconsistent source data) —
//   check both. Revenue/GP field names ("Budget Revenue"/"Budget GP")
//   were correct as originally assumed. This view also has "Month" per
//   row, so it alone supplies both the annual total AND the monthly
//   breakdown per vendor — the month-wise view (below) is NOT needed for
//   per-vendor data.
// - Month-wise view: NO vendor column at all — it's company-wide monthly
//   totals only ("Rev- Budget" / "GP ($)" field names, note the unusual
//   "Rev- " with trailing space and hyphen). Used here only as a sanity
//   check against the vendor-wise sum, not written to Firestore directly.
// - Country-wise view: also NO vendor column — company-wide monthly
//   totals per country ("Budget" / "GP" field names), with "Region" and
//   "Sub Region" columns too. Since there's no vendor+country cross in
//   the source data, a per-vendor country breakdown isn't possible from
//   Zoho — this populates a separate regionBudgets collection instead of
//   a countryGrid on each vendor (unlike the editable working-draft year,
//   where countryGrid comes from a user's own Plan-FY entries and IS
//   per-vendor). frontend/src/firestoreData.js's getRegions() reads this
//   for any year, editable or not, and is not changed here.

const BUDGET_TYPE_TO_SYNC = "Macnica"; // matches Budget Type column; month-wise view uses "Macnica Budget" instead — see parseMonth/typeMatches below

function parseYearFromMonthString(monthStr) {
  // "01 Oct 2023" -> 2023. Returns NaN if the format doesn't match, so
  // callers should always check with isNaN before using the result.
  const parts = String(monthStr || "").trim().split(" ");
  return parts.length === 3 ? parseInt(parts[2], 10) : NaN;
}
function parseMonthIndexFromMonthString(monthStr) {
  const MONTH_INDEX = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
  const parts = String(monthStr || "").trim().split(" ");
  return parts.length === 3 ? MONTH_INDEX[parts[1]] : undefined;
}
// month-wise view's Type column uses "Macnica Budget" / "SKO Budget" /
// "Fixed Budget"; country-wise/vendor-wise use bare "Macnica" / "SKO" /
// "Fixed". Normalize both to compare against BUDGET_TYPE_TO_SYNC.
function isTargetBudgetType(rawType) {
  return String(rawType || "").trim().replace(/\s*Budget$/i, "") === BUDGET_TYPE_TO_SYNC;
}

// Same timeout reasoning as syncCipr — this awaits three exportZohoView
// calls (in parallel, but the slowest still needs the full window).
exports.syncBudgets = onCall(
  { secrets: [zohoClientId, zohoClientSecret, zohoRefreshToken], timeoutSeconds: 300 },
  async (request) => {
    await requireApprovedUser(request);

    const creds = {
      clientId: zohoClientId.value(),
      clientSecret: zohoClientSecret.value(),
      refreshToken: zohoRefreshToken.value(),
      orgId: zohoOrgId.value(),
      workspaceId: zohoWorkspaceId.value(),
    };

    const [monthRows, countryRows, vendorRows] = await Promise.all([
      exportZohoView({ ...creds, viewId: ZOHO_BUDGET_VIEW_IDS.monthWise }),
      exportZohoView({ ...creds, viewId: ZOHO_BUDGET_VIEW_IDS.countryWise }),
      exportZohoView({ ...creds, viewId: ZOHO_BUDGET_VIEW_IDS.vendorWise }),
    ]);

    console.log(`syncBudgets: received ${monthRows.length} month rows, ${countryRows.length} country rows, ${vendorRows.length} vendor rows (all types, pre-filter)`);

    const num = (v) => Number(String(v ?? "0").replace(/,/g, "")) || 0; // Zoho exports comma-formatted numbers as strings

    // ---- Vendor-wise: annual + monthly revenue/GP per vendor per year ----
    // year -> vendor -> { revenue, gp, monthlyBudgetRevenue[12], monthlyBudgetGp[12] }
    const byYearVendor = {};
    let vendorRowsMatched = 0, vendorRowsSkippedNoVendor = 0, vendorRowsSkippedBadDate = 0, vendorRowsSkippedWrongType = 0;
    for (const row of vendorRows) {
      if (!isTargetBudgetType(row["Budget Type"])) { vendorRowsSkippedWrongType++; continue; }
      const vendor = row["Vendor2"] || row["Vendor"];
      if (!vendor) { vendorRowsSkippedNoVendor++; continue; }
      const year = parseYearFromMonthString(row["Month"]);
      const monthIdx = parseMonthIndexFromMonthString(row["Month"]);
      if (isNaN(year) || monthIdx === undefined) { vendorRowsSkippedBadDate++; continue; }

      if (!byYearVendor[year]) byYearVendor[year] = {};
      if (!byYearVendor[year][vendor]) byYearVendor[year][vendor] = { revenue: 0, gp: 0, monthlyBudgetRevenue: new Array(12).fill(0), monthlyBudgetGp: new Array(12).fill(0) };
      const entry = byYearVendor[year][vendor];
      const rev = num(row["Budget Revenue"]);
      const gp = num(row["Budget GP"]);
      entry.revenue += rev;
      entry.gp += gp;
      entry.monthlyBudgetRevenue[monthIdx] += rev;
      entry.monthlyBudgetGp[monthIdx] += gp;
      vendorRowsMatched++;
    }
    console.log(`syncBudgets: vendor-wise — ${vendorRowsMatched} matched (Budget Type="${BUDGET_TYPE_TO_SYNC}"), ${vendorRowsSkippedWrongType} skipped (other type), ${vendorRowsSkippedNoVendor} skipped (no vendor name), ${vendorRowsSkippedBadDate} skipped (unparseable Month)`);

    // ---- Country-wise: company-wide monthly revenue/GP per country per year ----
    // year -> country -> { revenue, gp, region, subRegion, monthlyBudgetRevenue[12] }
    const byYearCountry = {};
    let countryRowsMatched = 0;
    for (const row of countryRows) {
      if (!isTargetBudgetType(row["Budget Type"])) continue;
      const country = row["Country"];
      if (!country) continue;
      const year = parseYearFromMonthString(row["Month"]);
      const monthIdx = parseMonthIndexFromMonthString(row["Month"]);
      if (isNaN(year) || monthIdx === undefined) continue;

      if (!byYearCountry[year]) byYearCountry[year] = {};
      if (!byYearCountry[year][country]) {
        byYearCountry[year][country] = {
          revenue: 0, gp: 0,
          region: row["Region"] || null, subRegion: row["Sub Region"] || null,
          monthlyBudgetRevenue: new Array(12).fill(0),
        };
      }
      const entry = byYearCountry[year][country];
      const rev = num(row["Budget"]);
      entry.revenue += rev;
      entry.gp += num(row["GP"]);
      entry.monthlyBudgetRevenue[monthIdx] += rev;
      countryRowsMatched++;
    }
    console.log(`syncBudgets: country-wise — ${countryRowsMatched} matched (Budget Type="${BUDGET_TYPE_TO_SYNC}")`);

    // ---- Month-wise: company-wide total, sanity check only (not written) ----
    const monthWiseTotalByYear = {};
    for (const row of monthRows) {
      if (!isTargetBudgetType(row["Type"])) continue;
      const year = parseYearFromMonthString(row["Month"]);
      if (isNaN(year)) continue;
      monthWiseTotalByYear[year] = (monthWiseTotalByYear[year] || 0) + num(row["Rev- Budget"]);
    }
    for (const year in byYearVendor) {
      const vendorSum = Object.values(byYearVendor[year]).reduce((s, v) => s + v.revenue, 0);
      const monthWiseTotal = monthWiseTotalByYear[year] || 0;
      const diff = monthWiseTotal ? Math.abs(vendorSum - monthWiseTotal) / monthWiseTotal : null;
      if (diff !== null && diff > 0.01) {
        console.warn(`syncBudgets: ${year} vendor-wise sum (${vendorSum.toFixed(0)}) differs from month-wise total (${monthWiseTotal.toFixed(0)}) by ${(diff * 100).toFixed(1)}% — worth investigating before trusting this year's data.`);
      }
    }

    // ---- Write ----
    let vendorWrites = 0, regionWrites = 0;
    const years = new Set([...Object.keys(byYearVendor), ...Object.keys(byYearCountry)]);
    for (const year of years) {
      const batch = db.batch();
      const yearRef = db.collection("zohoBudgets").doc(year);
      for (const vendor in (byYearVendor[year] || {})) {
        const v = byYearVendor[year][vendor];
        const gpPct = v.revenue ? v.gp / v.revenue : 0;
        batch.set(yearRef.collection("vendorBudgets").doc(encodeURIComponent(vendor)), {
          revenue: v.revenue, gp: v.gp, gpPct,
          monthlyBudgetRevenue: v.monthlyBudgetRevenue, monthlyBudgetGp: v.monthlyBudgetGp,
          countryGrid: null, // not derivable — see file header comment
          lastSyncedAt: admin.firestore.Timestamp.now(),
          lastSyncedBy: request.auth.token.email,
        });
        vendorWrites++;
      }
      for (const country in (byYearCountry[year] || {})) {
        const c = byYearCountry[year][country];
        batch.set(yearRef.collection("regionBudgets").doc(encodeURIComponent(country)), {
          revenue: c.revenue, gp: c.gp, region: c.region, subRegion: c.subRegion,
          monthlyBudgetRevenue: c.monthlyBudgetRevenue,
          lastSyncedAt: admin.firestore.Timestamp.now(),
          lastSyncedBy: request.auth.token.email,
        });
        regionWrites++;
      }
      await batch.commit();
    }

    const yearsList = [...years].sort();
    console.log(`Budget sync by ${request.auth.token.email}: ${vendorWrites} vendor-year records, ${regionWrites} country-year records, across years ${yearsList.join(", ")}.`);
    return { vendorYearRecordsUpdated: vendorWrites, regionYearRecordsUpdated: regionWrites, years: yearsList, syncedAt: new Date().toISOString() };
  }
);

// ---- syncOtherExpensesLedger ------------------------------------------------
// Pulls the consolidated USD GL ledger view (Other Expenses Budgeting Module
// spec, section 2) and writes: (1) year-keyed actuals per GL account, and
// (2) upserts a lightweight mapping doc per account — creating it as
// "unmapped" the first time an account is ever seen, but NEVER touching an
// existing account's categoryId/mappingStatus on subsequent syncs, so a
// user's mapping work is never silently overwritten by a re-sync.
//
// COLUMN NAMES BELOW ARE FROM THE SPEC DOC, NOT YET VERIFIED against a live
// pull the way CIPR/budget fields were — same "check the sample-row log
// before trusting this" situation as those. Confirmed-per-spec columns:
// Entity, "a.Account Name", "a.Account Code", "a.Account Type",
// "a.Grouping", Year, "Month No", Month, "Amount (USD)".

exports.syncOtherExpensesLedger = onCall(
  { secrets: [zohoClientId, zohoClientSecret, zohoRefreshToken], timeoutSeconds: 300 },
  async (request) => {
    await requireApprovedUser(request);

    const rawRows = await exportZohoView({
      clientId: zohoClientId.value(), clientSecret: zohoClientSecret.value(), refreshToken: zohoRefreshToken.value(),
      orgId: zohoOrgId.value(), workspaceId: ZOHO_OTHER_EXPENSES_WORKSPACE_ID, viewId: ZOHO_OTHER_EXPENSES_VIEW_ID,
    });
    console.log("syncOtherExpensesLedger: sample row for field-name verification:", JSON.stringify(rawRows[0]));
    console.log(`syncOtherExpensesLedger: received ${rawRows.length} rows`);

    const num = (v) => Number(String(v ?? "0").replace(/,/g, "")) || 0;

    // year -> "entity__glCode" -> { entity, glCode, glName, accountType, sourceGrouping, monthly[12] }
    const byYearAccount = {};
    let matched = 0, skippedBadYear = 0, skippedBadMonth = 0;
    for (const row of rawRows) {
      const year = parseInt(row["Year"], 10);
      const monthNo = parseInt(row["Month No"], 10); // assumed 1-12 — verify against the sample-row log above
      if (isNaN(year)) { skippedBadYear++; continue; }
      if (isNaN(monthNo) || monthNo < 1 || monthNo > 12) { skippedBadMonth++; continue; }

      const entity = row["Entity"] || "Unknown";
      const glCode = row["a.Account Code"] || "";
      const glName = row["a.Account Name"] || "";
      const accountType = row["a.Account Type"] || "";
      const sourceGrouping = row["a.Grouping"] || null;
      const key = `${entity}__${glCode}`;

      if (!byYearAccount[year]) byYearAccount[year] = {};
      if (!byYearAccount[year][key]) byYearAccount[year][key] = { entity, glCode, glName, accountType, sourceGrouping, monthly: new Array(12).fill(0) };
      byYearAccount[year][key].monthly[monthNo - 1] += num(row["Amount (USD)"]);
      matched++;
    }
    console.log(`syncOtherExpensesLedger: ${matched} rows matched, ${skippedBadYear} skipped (unparseable Year), ${skippedBadMonth} skipped (unparseable Month No)`);

    // Read existing mapping docs ONCE up front — keyed by ID with full
    // data (not just IDs), since the backfill step below needs to check
    // each existing account's current mappingStatus, not just whether it
    // exists.
    const existingMappingsSnap = await db.collection("glAccountMappings").get();
    const existingMappings = {}; // id -> current doc data
    existingMappingsSnap.docs.forEach(d => { existingMappings[d.id] = d.data(); });

    // ---- Auto-derive categories from the "Grouping" column -------------
    // Per updated decision: Grouping IS used to auto-populate categories
    // and auto-map accounts (originally spec'd as "reference only", but
    // manually mapping 100+ accounts one at a time when most already carry
    // a usable category from Zoho isn't worth the busywork). Category doc
    // IDs are DETERMINISTIC (encodeURIComponent of the Grouping name, not
    // an auto-generated ID) so re-running this sync never creates
    // duplicate categories for the same Grouping value.
    const distinctGroupings = new Set();
    for (const year in byYearAccount) {
      for (const key in byYearAccount[year]) {
        const g = byYearAccount[year][key].sourceGrouping;
        if (g) distinctGroupings.add(g);
      }
    }
    const categoryBatch = db.batch();
    for (const grouping of distinctGroupings) {
      const catRef = db.collection("expenseCategories").doc(encodeURIComponent(grouping));
      categoryBatch.set(catRef, { name: grouping, parentCategoryId: null, source: "auto-grouping" }, { merge: true });
    }
    if (distinctGroupings.size) await categoryBatch.commit();
    console.log(`syncOtherExpensesLedger: ${distinctGroupings.size} distinct Grouping values ensured as categories.`);

    // Chunked batches: ~250+ GL accounts x 2 writes each (ledger + mapping)
    // per year can exceed Firestore's 500-operation batch limit. 200
    // accounts x 2 = 400 stays safely under it.
    const CHUNK_SIZE = 200;
    let ledgerWrites = 0, newMappingsCreated = 0, autoMappedFromGrouping = 0, backfilledFromGrouping = 0;
    for (const year in byYearAccount) {
      const entries = Object.entries(byYearAccount[year]);
      const yearRef = db.collection("otherExpensesLedger").doc(year);
      for (let i = 0; i < entries.length; i += CHUNK_SIZE) {
        const batch = db.batch();
        for (const [key, a] of entries.slice(i, i + CHUNK_SIZE)) {
          const docId = encodeURIComponent(key);
          batch.set(yearRef.collection("accounts").doc(docId), {
            entity: a.entity, glCode: a.glCode, glName: a.glName, accountType: a.accountType, sourceGrouping: a.sourceGrouping,
            monthlyActual: a.monthly,
            lastSyncedAt: admin.firestore.Timestamp.now(), lastSyncedBy: request.auth.token.email,
          });
          ledgerWrites++;

          const mappingRef = db.collection("glAccountMappings").doc(docId);
          const existing = existingMappings[docId];
          const groupingCategoryId = a.sourceGrouping ? encodeURIComponent(a.sourceGrouping) : null;

          if (!existing) {
            // Brand-new account. Auto-map straight to its Grouping-derived
            // category if it has one; only truly enters the unmapped queue
            // if Grouping was blank (matches the ~31-account gap the spec
            // itself called out).
            batch.set(mappingRef, {
              entity: a.entity, glCode: a.glCode, glName: a.glName, accountType: a.accountType, sourceGrouping: a.sourceGrouping || null,
              categoryId: groupingCategoryId, subcategoryId: null,
              mappingStatus: groupingCategoryId ? "mapped" : "unmapped",
              ...(groupingCategoryId ? { mappedBy: "auto:grouping-sync", mappedAt: admin.firestore.Timestamp.now() } : {}),
              createdAt: admin.firestore.Timestamp.now(),
            });
            existingMappings[docId] = { mappingStatus: groupingCategoryId ? "mapped" : "unmapped" }; // so a later chunk in this same run doesn't redo it
            newMappingsCreated++;
            if (groupingCategoryId) autoMappedFromGrouping++;
          } else if (existing.mappingStatus === "unmapped" && groupingCategoryId) {
            // Backfill: an account left over from before this auto-mapping
            // policy existed, sitting unmapped despite having a usable
            // Grouping value all along. Auto-map it now. A previously
            // MAPPED account (whether by a person or by this same logic
            // earlier) is never touched here — only genuinely-unmapped ones.
            batch.set(mappingRef, {
              entity: a.entity, glCode: a.glCode, glName: a.glName, accountType: a.accountType, sourceGrouping: a.sourceGrouping || null,
              categoryId: groupingCategoryId, subcategoryId: null, mappingStatus: "mapped",
              mappedBy: "auto:grouping-sync", mappedAt: admin.firestore.Timestamp.now(),
            }, { merge: true });
            existingMappings[docId] = { ...existing, mappingStatus: "mapped" };
            backfilledFromGrouping++;
          } else {
            // Descriptive fields only — merge:true leaves categoryId/
            // subcategoryId/mappingStatus/mappedBy untouched for anything
            // already mapped (by a person or by grouping-sync earlier).
            batch.set(mappingRef, { entity: a.entity, glCode: a.glCode, glName: a.glName, accountType: a.accountType, sourceGrouping: a.sourceGrouping || null }, { merge: true });
          }
        }
        await batch.commit();
      }
    }

    const years = Object.keys(byYearAccount).sort();
    console.log(`Other Expenses ledger sync by ${request.auth.token.email}: ${ledgerWrites} account-year records, ${newMappingsCreated} new accounts seen (${autoMappedFromGrouping} auto-mapped from Grouping), ${backfilledFromGrouping} previously-unmapped accounts backfilled from Grouping, across years ${years.join(", ")}.`);
    return {
      ledgerRecordsUpdated: ledgerWrites,
      newAccountsSeen: newMappingsCreated,
      autoMappedFromGrouping,
      backfilledFromGrouping,
      years,
      syncedAt: new Date().toISOString(),
    };
  }
);

// ---- syncBills ---------------------------------------------------------
// AP side of the Cash Flow module (see Cash_Flow_Module_Requirements2.md).
// Mirrors syncCipr's shape exactly on purpose: same year-partitioning-by-
// document-date convention (ciprActuals/{year}/invoices is keyed by
// Invoice Date's year; billsActuals/{year}/bills is keyed by Bill Date's
// year here), same manual-only/no-schedule trigger, same full-overwrite-
// per-year model since this collection mirrors Zoho rather than being
// edited in the app.
//
// COLUMN NAMES BELOW ARE FROM THE REQUIREMENTS DOC (Cash_Flow_Module_
// Requirements2.md §2), NOT yet verified against a live pull — same
// "check the sample-row log before trusting this" situation the other
// sync functions started in. Two fields are explicitly known-broken per
// that doc and are stored raw/unused rather than computed on:
//   - "Payment Terms" — currently returns raw record IDs, not term text.
//     Stored as paymentTermsRaw; do NOT compute a vendor-terms figure from
//     it until this is fixed on the Zoho side (see requirements §3.5).
//   - "Vendor" — same kind of raw-ID issue. Stored as vendorRaw; don't
//     display it as a vendor name until confirmed fixed.
exports.syncBills = onCall(
  { secrets: [zohoClientId, zohoClientSecret, zohoRefreshToken], timeoutSeconds: 300 },
  async (request) => {
    await requireApprovedUser(request);
    // Same default-to-current-year-with-optional-override pattern as
    // syncCipr, for the same reason: past years' bills don't change, and
    // an explicit `year` allows a one-time manual backfill call.
    const targetYear = request.data?.year || new Date().getFullYear();

    const rawRows = await exportZohoView({
      clientId: zohoClientId.value(),
      clientSecret: zohoClientSecret.value(),
      refreshToken: zohoRefreshToken.value(),
      orgId: zohoOrgId.value(),
      workspaceId: ZOHO_BILLS_WORKSPACE_ID,
      viewId: ZOHO_BILLS_VIEW_ID,
    });
    console.log(`syncBills: received ${rawRows.length} raw rows, target year ${targetYear}`);
    console.log("syncBills: sample row for field-name verification:", JSON.stringify(rawRows[0]));

    const num = (v) => Number(String(v ?? "0").replace(/,/g, "")) || 0;

    const billRows = [];
    let skippedBadDate = 0;
    for (const row of rawRows) {
      const billDate = new Date(row["Bill Date"]);
      if (isNaN(billDate) || billDate.getFullYear() !== targetYear) { skippedBadDate++; continue; }

      const dueDateRaw = row["Due Date"];
      const dueDate = dueDateRaw ? new Date(dueDateRaw) : null;

      billRows.push({
        billNumber: row["Bill Number"] || null,
        // Balance(USD) — same comma-stripping treatment as CIPR's Balance
        // field (Zoho exports numbers as comma-formatted strings; Number()
        // on those silently NaNs -> 0 without the replace, per syncCipr's
        // earlier lesson).
        balance: num(row["Balance(USD)"]),
        billDate: billDate.toISOString().slice(0, 10),
        dueDate: dueDate && !isNaN(dueDate) ? dueDate.toISOString().slice(0, 10) : null,
        entity: row["Accounting Entity"] || null,
        status: row["Status"] || null,
        // Known-broken this phase — see header comment. Kept raw so the
        // data isn't lost once Zoho fixes them; not used in any calc yet.
        paymentTermsRaw: row["Payment Terms"] ?? null,
        vendorRaw: row["Vendor"] ?? null,
      });
    }
    console.log(`syncBills: ${billRows.length} rows matched target year, ${skippedBadDate} skipped (Bill Date outside ${targetYear} or unparseable)`);

    // Year-partitioned, full overwrite per year — same doc-id-collision
    // handling as syncCipr's invoice rows (a bill number could in theory
    // repeat, e.g. a credit/reversal pair), so the same running-index
    // suffix is used rather than assuming Bill Number alone is unique.
    const yearRef = db.collection("billsActuals").doc(String(targetYear));
    const CHUNK_SIZE = 400;
    const seenBillIds = {};
    for (let i = 0; i < billRows.length; i += CHUNK_SIZE) {
      const batch = db.batch();
      for (const bill of billRows.slice(i, i + CHUNK_SIZE)) {
        const baseId = bill.billNumber ? encodeURIComponent(bill.billNumber) : "nobillnumber";
        seenBillIds[baseId] = (seenBillIds[baseId] || 0) + 1;
        const docId = seenBillIds[baseId] > 1 ? `${baseId}_${seenBillIds[baseId]}` : baseId;
        batch.set(yearRef.collection("bills").doc(docId), {
          ...bill,
          lastSyncedAt: admin.firestore.Timestamp.now(),
          lastSyncedBy: request.auth.token.email,
        });
      }
      await batch.commit();
    }

    console.log(`Manual Bills sync (${targetYear}) by ${request.auth.token.email}: ${billRows.length} bill rows written.`);
    return { billRowsSynced: billRows.length, year: targetYear, syncedAt: new Date().toISOString() };
  }
);
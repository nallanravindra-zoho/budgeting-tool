# Cyberknight Budget Desk — Project Context

This file is read automatically at the start of every Claude Code session opened on this repo (web or CLI) — it exists so a fresh session has the reasoning and history that isn't visible from the code alone, without anyone needing to paste or upload anything. Keep it current: when you finish a change worth remembering (a real bug fix, a new feature, a design decision, a gap discovered), update the relevant section below in the same commit.

---

## 1. What this is

A full-stack budgeting and financial-intelligence tool for **Cyberknight Technologies** (a cybersecurity VAD in the Middle East/Africa region). Started as a simple vendor budget tracker; has grown into a much larger platform covering budgeting, actuals tracking, forecasting, expense management, HR cost modeling, and an AI business-analyst chatbot.

**Stack:**
- Frontend: React (Vite), single large `App.jsx` (~5,100 lines) plus focused data-layer modules
- Backend: Firebase Cloud Functions v2 (Node), Firestore database
- AI: Gemini 2.5 Flash (via Cloud Function `chat`), with tool-calling into real Firestore data
- Data sources: **Zoho Analytics** — CIPR report (actuals) and budget files (Vendor-wise / Country-wise / Month-wise views)
- Auth: Firebase Auth (Microsoft SSO) gated by an `approvedUsers` Firestore allowlist

---

## 2. Development workflow — how changes actually get made and shipped

This matters more than it looks like it should, because AI sessions working on this repo run in two different kinds of environment with different capabilities:

- **Claude Code on the web (claude.ai/code)** has working push access to `nallanravindra-zoho/budgeting-tool` — it can clone, edit, commit, and push (or open a PR) directly. **This is where actual code changes should be made.** Just describe what you want in plain English in a session there; it will read the current code itself, implement it, verify it, and commit/push — no need to hand it a pre-written diff.
- **Cowork / other cloud sandbox sessions** (this kind of environment) currently **cannot push** to this repo. The git proxy in these sessions denies writes to any repo not in "this session's authorized repository set," and as of 2026-08-25 there is no working way to add a repo to that set — this is a known, open, unresolved Anthropic platform limitation (see `anthropics/claude-code` issue #76248), not a misconfiguration on this project's end. A session like this can still be genuinely useful for design discussion, planning, and verifying a change locally (e.g. syntax-checking with esbuild) before handing the exact diff to a Claude Code web session to commit and push.
- **Deploying is a manual, human step on purpose.** `firebase deploy` (hosting and/or functions) is run by a person on their own machine after pulling the pushed change, not by either kind of AI session — this app touches employee HR data (salaries, personal details), so no AI session holds standing production deploy credentials. The loop is: code change lands on GitHub → person pulls `main` → person runs the build/deploy commands locally → change is live.

If you're a fresh session reading this and were just asked to make a change: check whether you have real push access to this repo (try a `git push --dry-run`). If yes, just do the work end to end. If no, do as much as you can (edit, verify, commit locally) and clearly tell the user their next step is to hand this off to a session that does have push access.

---

## 3. File map

```
functions/
  index.js             — All Cloud Functions: chat, syncCipr, syncBudgets, syncOtherExpensesLedger, syncBills
  zohoAnalytics.js      — Generic Zoho bulk-export client (exportZohoView)

frontend/src/
  App.jsx               — The whole UI. Huge — everything lives here as function components.
  firestoreData.js      — Vendor/region budget+actuals data layer, version save/load, year utilities,
                           getMyAccessProfile() (per-tab access — see §6)
  vendorPerformance.js  — Vendor & Region "Performance View" logic: forecast, status, management forecast,
                           getRegionPerformanceData (multi-granularity region actuals)
  otherExpensesData.js  — Other Expenses module: category mapping, growth assumptions, agreements, budget engine
  employeeData.js       — Employee Cost module: CRUD, monthly cost calc, benefit eligibility, dashboard stats
  assumptions.js        — Assumptions tab data layer
  operationalStats.js   — Operational Stats tab data layer (invoice-level metrics)
  cashFlowData.js       — Cash Flow module data layer: AR (CIPR)/AP (Bills) by due date, one bucketing
                           function shared across Day/Week/Month/Quarter/Year, customer terms, DSO, aged AR/AP
  chatClient.js         — httpsCallable wrappers for the chat/sync Cloud Functions
  firebase.js           — Firebase app init, auth helpers (Microsoft SSO — see its header comment for why
                           SSO alone is NOT the access boundary)
  AuthGate.jsx           — Wraps <App/>: Microsoft SSO sign-in screen + approvedUsers allowlist check.
                           Doesn't know about allowedTabs/canAccessTab; App.jsx reads its own access
                           profile independently (getMyAccessProfile()) after AuthGate renders it.

firestore.rules          — Security rules (see §5 for the collection map these correspond to)
scripts/
  add-approved-user.js      — CLI to add someone to the approvedUsers allowlist (Admin SDK, bypasses rules —
                              needed to bootstrap the very first approved user, see the rules file comment)
  seed-baseline-budget.js   — One-time baseline budget seeding script
```

---

## 4. The year model (core concept — read this first)

Every year in the app falls into exactly one of four categories, computed from the real system date (`vendorPerformance.js`'s `classifyYear`):

| Category | Meaning | Editable? | Shows actuals/status? |
|---|---|---|---|
| **Completed** | Before this calendar year | No | FY Actual/Variance only, no status |
| **Current year** | This calendar year, in progress | No | Full YTD/Forecast/Status tracking |
| **Current budgeting year** | `settings/config.activeBudgetingYear` (usually next calendar year) | **Yes** | Budget only — no actuals exist yet |
| **Future budgeting year** | Beyond the active budgeting year | No | Budget only (if generated — see §7) |

**Only one year is ever editable** — the active budgeting year. Editing lives in `budgetVersions/working/vendorBudgets/{vendor}`. Every other year is read-only, sourced from Zoho (`zohoBudgets/{year}/...`, `ciprActuals/{year}/...`).

This split drives almost everything: which UI component renders (simple `VendorsTab` vs. rich `VendorPerformanceView`), which columns show, whether status/forecast appear at all.

---

## 5. Firestore schema (as of now)

```
settings/config { activeBudgetingYear: 2027 }
approvedUsers/{email} { active, name, role, allowedTabs? }
  — active: optional. Missing/absent is treated as true (approved) both client-side (AuthGate.jsx's
    `data().active !== false`) and server-side (firestore.rules' `.data.get('active', true)`) — see §8
    for why that server-side detail matters and bit someone once.
  — allowedTabs: optional array of Sidebar tab ids (see APP_TAB_IDS in firestoreData.js), e.g.
    ["employees"] for an HR-only login. Absent/null/empty = unrestricted. Read client-side via
    getMyAccessProfile() to filter the Sidebar (App.jsx also hides the AI chat panel entirely for any
    restricted login — the chat Cloud Function uses the Admin SDK and bypasses firestore.rules, so it's
    a real bypass risk otherwise); enforced server-side via firestore.rules' canAccessTab() (currently
    wired up on employees/{employeeId} only — see §6 and §7 for how/why to extend it further).

budgetVersions/working/vendorBudgets/{vendor}   — THE editable store (active budgeting year only)
  { revenue, gp, gpPct, monthlyBudgetRevenue[12], countryGrid, startMonth? }
budgetVersions/{savedVersionId}/vendorBudgets/{vendor}  — saved snapshots (Versions tab)

zohoBudgets/{year}/vendorBudgets/{vendor}   — read-only, real Zoho sync only (rules: allow write: if false)
zohoBudgets/{year}/regionBudgets/{country}  — same, country-level, carries region/subRegion attributes

budgetProjections/{year}/vendorBudgets/{vendor}   — client-writable placeholder budgets (see §6)
budgetProjections/{year}/regionBudgets/{country}  — same, for regions

ciprActuals/{year}/vendors/{vendor}
  {
    // Flat fields alias Macnica for backward compat:
    monthlyActualRevenue[12], monthlyActualGp[12], actualRevenueYtd, actualGpYtd,
    // Real per-scenario split (see §8):
    macnica: { monthlyActualRevenue[12], monthlyActualGp[12], actualRevenueYtd, actualGpYtd },
    sko:     { monthlyActualRevenue[12], monthlyActualGp[12], actualRevenueYtd, actualGpYtd },
    regionRevenue: { [subRegion]: amount },  // Macnica-only, feeds vendor Plan-FY linearity
    tier, buHead,
  }

billsActuals/{year}/bills/{billId}   — RAW bill-level rows (AP side of Cash Flow module)
  { billNumber, balance, billDate, dueDate, entity, status, paymentTermsRaw, vendorRaw }
  — year = Bill Date's year, same convention as ciprActuals/invoices below being keyed by Invoice
    Date's year (NOT the due date's year — a row's due date can land in a different calendar year
    than its own partition, which is why cashFlowData.js always fetches a multi-year window and
    buckets strictly by due date, never by partition year).
  — paymentTermsRaw/vendorRaw are stored but UNUSED — Bills' Payment Terms and Vendor columns are
    confirmed broken (raw record IDs, not text); don't surface them until fixed.

ciprActuals/{year}/invoices/{invoiceId}   — RAW invoice-level rows
  {
    invoiceNo, vendorName, customerName, endCustomer, partnerName, partnerCategory, buHead,
    region, subRegion, billingCountry, endCustomerCountry, invoiceDate, month(1-12),
    revenue, gp, gpSko, includedInMacnica, includedInSko,
    entity, engagementType, leadSource, opportunityOwner, opportunity, opportunityId,
    quotationNumber, invoiceStatus, dueDate, lastPaymentDate, collectedDays, ageColumn,
    purchaseCost, provision, freightCost, lcInterestCharges, balance, interestAmt,
    skoGpPct, macnicaGpPct, ztxFramework,
  }
  — Powers: queryInvoices chat tool, RegionPerformanceView (region/subRegion/country granularity),
    Operational Stats tab. NOT all fields individually verified against a live Zoho pull —
    check the syncCipr sample-row log before trusting a field you haven't seen confirmed.

managementForecasts/{year}/vendors/{vendor} { revenue, updatedBy, updatedAt }  — editable, any year

otherExpensesLedger/{year}/accounts/{entity}_{glCode}   — GL ledger actuals, read-only sync
glAccountMappings/{accountId}   — GL account → category, user-editable, NOT year-scoped
expenseCategories/{categoryId}  — user-managed taxonomy (auto-created from Zoho's "Grouping" field)
growthAssumptions/{year}/categories/{categoryId} { growthPct }
expenseAgreements/{agreementId} { type: rent|consultant|subscription, ... }  — unified collection
otherExpensesBudget/{year}/lines/{lineId} { monthlyAmount[12], systemEstimate[12], source }

employees/{employeeId}  { employeeNo, name, department, entity, country, vendorAllocation, regionAllocation,
                           joiningDate, resignationDate, basic, hra, otherAllowance, vp, hikes, benefitOverrides }
  — vendorAllocation/regionAllocation are { mode: "all"|"list", list: [...] } objects
  — gated by canAccessTab('employees') in firestore.rules (see §2/§6) — the sensitive-data example
    for per-tab restriction

assumptions/{id}  { category, label, value, unit, description }

versions/... (Versions tab saved snapshots — see budgetVersions above)
```

---

## 6. Major features built, in build order

1. **Core budgeting** — vendor list, budget entry, Plan-FY (month × country grid from historical linearity), Save/Load Versions
2. **AI chat assistant ("Sir Slice-a-Lot")** — Gemini tool-calling with `getBreakdown` (vendor/region annual+monthly) and `queryInvoices` (raw invoice search/filter/groupBy across many CIPR dimensions). Hidden entirely from any login with `allowedTabs` set (see §5).
3. **Other Expenses module** — GL ledger sync, category mapping (auto from "Grouping"), growth assumptions, agreements (rent/consultant/subscription), trend/agreement budget-generation engine, actual-vs-budget dashboard
4. **Employee Cost module** — employee master, monthly cost calc (joining/resignation/hikes), benefit eligibility (Insurance/Airfare/Gratuity/ESOP), dashboard (headcount, department/location charts). Add Employee's Save button gives inline validation errors (Name/Joining date required) instead of silently doing nothing when disabled.
5. **Vendor/Region Performance Views** (historical/in-progress years only) — filters, FY System Forecast (run-rate method), 4-tier status (On Track/Watch/Needs Attention/Margin Risk), Management Forecast override, sortable columns, drill-down modal with charts, Formulas explainer popup. "Balance to Do" column (FY Budget − Actual) on the full performance table. Vendor/Region name column is frozen (sticky) on horizontal scroll; every data table sits in a bounded-height scroll box so sticky headers work on vertical scroll too.
6. **Multi-year budget generation** — projects a base year forward with compounding growth, writes into the editable store (active year) or `budgetProjections` (future years)
7. **Assumptions tab** — presentation-ready list of app assumptions, mixing editable examples with a "Live" section pulled from real running config. Required fields (Label, Value) marked with a red star.
8. **Operational Stats tab** — invoice-level metrics: counts, "new this year," deal-size/GP% buckets, ZTX Framework segments, multi-year trend
9. **Cash Flow module** — AR (CIPR, existing sync) vs AP (Bills, `syncBills` sync) by due date, one bucketing calc shared across Day/Week/Month/Quarter/Year, net surplus/deficit per period, avg customer terms + DSO, aged AR/AP (>180 days overdue) called out separately. No entity breakdown and no vendor-terms figure this phase (confirmed scope); not year-scoped like the rest of the app since due dates cross calendar-year boundaries.
10. **UI/UX polish batch** — Sidebar reordered + lucide-react icons + "Blush Red" light active-row treatment; K-unit toggle shows thousands separators everywhere; `<tfoot>` totals rows on performance views; sticky/frozen columns (see #5); "Reset to Baseline" button removed (was a leftover dev/demo affordance, not a real feature); PL/EBITDA tab's "Data Quality" note removed; header tagline changed to "Revenue, GP & Performance Intelligence" (bold, as of 2026-08-25) — note `styles.brandSub` is shared with the date line right below it, so bolding is an inline override on just the tagline `<div>`, not a change to the shared style object.
11. **Customized login access** — optional per-account tab restriction via `approvedUsers/{email}.allowedTabs`. Client: `getMyAccessProfile()` + Sidebar filtering + auto-redirect off a now-disallowed tab + chat panel hidden (App.jsx). A dedicated `accessProfileReady` boolean gates the whole body render so the Sidebar never flashes every tab for a frame before collapsing to the restricted set (allowedTabs === null is ambiguous between "still loading" and "confirmed unrestricted" — accessProfileReady disambiguates it). Server: `canAccessTab()` in firestore.rules, currently applied to `employees/{employeeId}` only (the HR-data example from the original request) — see §7 for extending it further. No admin UI to set `allowedTabs` yet; set it by hand in the Firebase Console on the specific person's `approvedUsers/{email}` doc, same as `name`/`role` today.
12. **Mandatory-field indicators** — required inputs across modals (Add Employee's Name/Joining date, Add Vendor's Vendor name, Assumptions' Label/Value, Agreement Form's name/Category) marked with a red star via a shared `RequiredStar` component and `LabeledInput`'s `required` prop.

---

## 7. Known limitations / honest gaps (don't assume these are solved)

- **Budget-side vendor × region cross-tabs are impossible** — Zoho's budget source only ever gives vendor totals *or* region totals, never combined for the same line. This is a Zoho export limitation, not a code gap.
- **`budgetProjections` → `budgetVersions/working` migration doesn't exist yet.** When a future year (e.g. 2028) becomes the active budgeting year, its projected data does NOT automatically migrate into the editable store — someone has to re-run the generator, or this migration needs building.
- **Country-level region granularity has a naming-mismatch risk** — budget's "Country" field and CIPR's "Billing Country" field are different source columns and may not always match by name.
- **Several CIPR fields captured but not individually field-verified live** — anything added after the original Vendor Name/Invoice Value/GROSS PROFIT/Region/Sub Region set (Opportunity Owner, Engagement Type, Purchase Cost, ZTX Framework, etc.) should be double-checked against `syncCipr`'s sample-row log before being trusted in analysis.
- **Vendor status thresholds (80%/95%/3pt GP gap) are reasonable defaults, not validated policy.**
- **Region-level Management Forecast doesn't exist** — only vendors have it; was intentionally scoped that way, not an oversight.
- **`getRegionPerformanceData`'s monthly budget GP is approximated** (revenue × blended GP%) since Zoho's country-wise view has no real monthly GP phasing.
- **Cash Flow has no entity breakdown and no vendor-terms figure this phase** — both intentionally out of scope per the requirements doc, not gaps to fill without checking first.
- **`billsActuals` may still be missing pre-2026 backfill years** — the first live `syncBills` run only wrote the current year; older years need `syncBillsNow(year)` calls (no UI control for this yet) the same way `syncCiprNow(year)` backfills CIPR. Cash Flow's Aged AP callout and any multi-year trend will read low/empty for years that haven't been backfilled.
- **Customized login access is UI-restriction-complete but data-restriction-partial.** `canAccessTab()` in firestore.rules is only wired up on `employees/{employeeId}` so far. Every other collection still allows any approved user to read/write it directly (e.g. via browser devtools) regardless of `allowedTabs` — the Sidebar (and now the chat panel) just won't show them the tab/UI. To close that gap for another tab, add `&& canAccessTab('tabId')` to that tab's collection(s) the same way, but first work out which collections each tab actually needs (Overview in particular reads across vendors/regions/etc., so restricting those collections could break Overview for anyone not also allowed on every tab it touches).
- **The chat Cloud Function itself doesn't check `allowedTabs` server-side.** It's hidden from the UI for any restricted login (see §6 item 2), but the function uses the Admin SDK and bypasses firestore.rules entirely, so if it were ever reachable another way (e.g. a direct callable-function invocation) it wouldn't respect the restriction. Not exploitable through the normal app UI today, but worth closing properly if `allowedTabs` restriction is treated as a real security boundary rather than a UI convenience.
- **`ciprActuals.dueDate` / `lastPaymentDate` date-string format is still unverified** — only Bills' dates were confirmed live; CIPR's equivalent columns haven't been separately checked against a live `syncCipr` sample-row log. `cashFlowData.js`'s `parseFlexibleDate` handles ISO, "DD Mon YYYY", "DD-Mon-YYYY", and ambiguous "DD/MM/YYYY", which should cover it if CIPR uses the same Zoho date formatting as Bills, but that's an assumption, not a confirmed fact.

---

## 8. Things that were genuinely bugs and got fixed (context, not action items)

- **`isApprovedUser()` in firestore.rules would silently deny EVERY read/write for any approvedUsers doc missing an explicit `active` field** — not just employees, not just restricted accounts, everything. Cause: `AuthGate.jsx`'s client-side check (`data().active !== false`) treats a missing field as `undefined`, and `undefined !== false` is `true` in JS — so sign-in succeeds. But `firestore.rules`' `.data.active` on a doc that never set `active` is an evaluation error in the rules language, not `undefined`, and rules fail closed on that — denying the whole `isApprovedUser()` expression. Found via a manually-added `approvedUsers` doc (an HR-restricted test login, added via the Firebase Console without setting `active`) that could sign in fine but got "Missing or insufficient permissions" on every single Firestore read. Fixed by using `.data.get('active', true)` — the rules-language way to default a missing field — instead of direct `.data.active` access, matching AuthGate's "missing means approved" behavior exactly. Any `approvedUsers` doc added by hand from now on doesn't need to set `active` at all unless you want to disable someone (`active: false`).
- SKO scenario used to be a flat budget uplift with **no real SKO actuals at all** — fixed to use CIPR's actual `Included in SKO?`/`GROSS PROFIT-SKO` fields, aggregated separately from Macnica.
- Employee "Active" count didn't check resignation against *today*, only against the start of the selected year — someone who resigned mid-year kept counting as active.
- Chat responses had several rounds of format-compliance issues (markdown leaking into plain text, JSON wrapped in prose, tables rendered as pipe-text) — now has multiple deterministic backend fallback/extraction layers, not just prompt instructions.
- CIPR's blank-value convention is the literal string `"NULL"`, not an empty string — caught and handled in Other Expenses category auto-creation.
- The restricted-login Sidebar used to flash every tab for one frame before collapsing to just the allowed ones — cause was `allowedTabs === null` being overloaded to mean both "still loading" and "genuinely unrestricted." Fixed with a dedicated `accessProfileReady` boolean (see §6 item 11).

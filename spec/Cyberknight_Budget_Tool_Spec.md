# Cyberknight Budget Desk — Consolidated Design Spec
*Working document — captures decisions finalized in planning discussion, not yet built beyond the Revenue/GP prototype.*

---

## 1. Purpose & Scope

A tool for management to build, edit, version, and analyze the annual budget (Macnica and SKO scenarios), moving beyond static Excel into something interactive, chat-editable, and grounded in real historical (CIPR) and pipeline (Zoho CRM/Books) data.

Nine original scope items: Revenue, GP, Expenses, Cash flow & interest, EBID, Budget-vs-actual, KPI breakdown for sales, Versioning, Chat-driven UI. This document covers the design for **Revenue/GP (done in prototype)**, **vendor/region lifecycle handling (designed, not built)**, and **CRM pipeline & cash flow (designed, not built)**. Expenses, EBID, and KPI modules are not yet designed.

---

## 2. Core Data Model

Single fact table approach — every module is a slice or roll-up of one structure, not a scattered set of sheets:

```
Budget_Line(vendor, country, month, year, scenario['Macnica'|'SKO'|'Actual'],
            version_id, revenue, gp)
```

Supporting tables (designed but not yet built): `Employee_Cost`, `AR_Schedule`, `AP_Schedule`, `Pipeline_Snapshot`.

**Why this matters:** an edit is one row (or grid) update; every downstream view (EBID%, cash flow, KPIs, budget-vs-actual) recalculates from the same source rather than being re-keyed by hand across 12+ sheets, as the current Excel process requires.

---

## 3. Revenue/GP Engine (Prototype Built)

### 3.1 Input model
Management inputs **only two numbers per vendor**: FY Revenue and GP% (or GP$). Everything else — monthly split, country split — is derived by the system. Any change to either input cascades automatically.

### 3.2 Linearity derivation ("the picker")
For a given vendor, the system builds a **month × country % matrix** (not two independent axes — confirmed this is worth the added complexity for defensibility) from historical CIPR data, and offers management a choice rather than a black box:

- **2024 (actual)** — full year, real data
- **2025 (actual)** — full year, real data
- **2026 (hybrid)** — actual Jan–Aug + remaining Sep–Dec filled from the vendor's *current* 2026 budget total, split across countries using a historical blend (flagged to the user as an assumption, since Zoho doesn't currently track monthly×country budget as a combined axis)
- **Blended (recommended)** — weighted combination, default weights 2024:20% / 2025:30% / 2026-hybrid:50%
- **Company average** — same mechanic computed across all vendors combined; the fallback for vendors with thin or no history
- **Custom** — direct cell editing in the grid (click a cell, type a value, total updates live) **and** a natural-language mini-assistant ("give UAE 5 points more, take it from KSA") — both available together, not either/or

All matrices are normalized so the selected candidate always sums to exactly the input FY revenue.

### 3.3 Display
Default view shows monthly totals and country totals (not the raw ~130-cell grid). Each candidate has an **expandable full grid** (heatmap-style) for management to drill in or sanity-check specific cells. Confirmed this is the right density — full grid by default was rejected as too dense.

### 3.4 Worked validation
Ran against real Crowdstrike data at two target scenarios ($40M/7%, then $45M/7.5%) — math holds, grid always sums to the input target, matches hand-calculated figures. See prototype artifact for the live version.

---

## 4. Vendor & Region Lifecycle (Designed, Not Built)

### 4.1 New vendors — thin history (already works)
A vendor with 1–2 years of CIPR data naturally produces a matrix with zeros before it existed — no special handling needed.

### 4.2 New vendors — zero history, starting mid-year
**Gap identified:** applying Company Average across all 12 months to a vendor that won't exist until Q2/Q3 creates phantom pre-launch budget.

**Fix:** add a **Start Month** (+ optional End Month for sunsetting vendors) to the planner.
- Any candidate linearity is trimmed to zero outside the active window, then renormalized within it.
- Within the window, choose a **shape**: Flat (default/safest), Company-average-trimmed, or Ramp-up (starts small, grows — realistic for pipeline-building period).
- **Launch Markets**: a country picker limits which markets get any budget at all (new vendors rarely launch in all 10 markets at once); split among selected markets uses company-average relative weights, renormalized.

**Open question, not yet resolved:** whether a single shared start month per vendor is sufficient, or whether per-country start dates are needed (e.g., UAE launches Q2, KSA doesn't start until Q3). Decides scope of a meaningfully bigger UI piece — **needs an answer before this is built.**

### 4.3 Region/country management
Regions are currently a byproduct of CIPR's Sub Region field, not a managed list. For forward planning this needs to be explicit.

- **Adding a region**: becomes a new Launch Market option, same no-history handling as 4.2 (Flat or Company-average-trimmed default).
- **Retiring a region**: 
  - Historical actuals in that region are **never touched** — stays exactly as-is for CIPR reporting.
  - Retired region **stays visible in the UI, locked at zero** — not hidden (confirmed: avoids "where did it go" confusion).
  - Any forward budget currently sitting in that region across vendor grids requires **human reassignment**, not automatic redistribution (confirmed).
  - **To build:** a short "needs reassignment" worklist surfaced after a region is retired, so orphaned budget doesn't get silently forgotten — this was flagged as a risk of relying on memory alone.
- Region changes should be an explicit admin action (not just editing a dropdown), since it touches every vendor's saved grid at once — should prompt a version snapshot before applying.

---

## 5. CRM Pipeline & Cash Flow Engine (Designed, Not Built)

### 5.1 Data sources & integration
- **Zoho CRM**: Opportunities, Sales Orders, POs, Invoices, Bills — all linked back to the originating Opportunity via a direct lookup field (confirmed reliable, no fuzzy matching needed).
- **Zoho Books**: separate system; cross-linked both directions (CRM records carry a Zoho Books ID; Books records carry the Zoho CRM ID). Integration is a clean two-source join via two API pulls, reconciled on those IDs.
- **Payment Terms**: reliable field on every CRM record. **Actual payment timing/amounts are sourced from Books, not CRM** — CRM only stores last-payment-date + paid/unpaid flag, which flattens out partial payments; Books has the real multi-payment history.

### 5.2 Stage model
Custom Zoho stages (PO sent to vendor, POD received, proforma invoice sent to partner, etc.) map to a **"Booked, Not Yet Invoiced"** bucket. This bucket is treated as **near-certain revenue with timing risk only**, not win-probability risk — the deal is already won. High-confidence input to the earliest months of next year's linearity.

**Partially Invoiced** stage: `remaining to invoice = opportunity total value − sum of linked invoices`. Timing for the remainder uses that specific deal's own invoicing cadence if it has invoiced more than once; falls back to the vendor's general historical monthly shape if there's only one data point.

**Multi-year deals**: tracking exists but is new/thin per your note. Treated as a stretch goal — placeholder (flat spread across contract years) until enough real schedule data exists to trust it.

### 5.3 Forecast accuracy, without an expected-close-date field
Zoho doesn't track expected-vs-actual close date directly. Workaround: for every **fully invoiced** historical deal, compare **Opportunity Closing Date** against **actual invoice date** — this "close-to-invoice lag," measured per vendor / deal-size band, becomes the offset applied to currently-open deals' stated closing dates when projecting real conversion timing. Also trended on its own as a sales-process health signal.

Stage Probability and Forecast Category fields provide a second, independent view: probability-weighted pipeline by expected month, shown alongside raw open-pipeline totals. Large disagreement between the two views gets flagged rather than silently resolved.

### 5.4 Core metrics to surface
1. Pipeline generation rate (new opp value/month, by vendor/region/BU)
2. Conversion rate & lag, cohort-based (same-year vs. next-year vs. never, by value and by count separately)
3. Win rate & sales cycle length (by vendor, region, deal-size band)
4. Booked-not-invoiced backlog (§5.2)
5. Multi-year deal recognition (§5.2, stretch goal)
6. Open pipeline by expected close date, cross-checked against historical linearity — surfaces gaps like "budget says $5M in Q1, open pipeline expected to close in Q1 only totals $2M"

### 5.5 Cash flow mechanics
Using **actual historical payment behavior**, not stated terms:
- AR: `days_to_pay = payment_received_date − invoice_date`, computed per customer where enough history exists, falling back to an average per payment-terms bucket for thin customers.
- AP: same mechanic against Bills/vendors.
- This directly drives the monthly cash flow and interest module — the model knows a specific customer actually averages (say) 61 days against stated Net 45, rather than assuming terms are honored.

### 5.6 Where this surfaces in the tool
A **Pipeline Coverage panel** inside the vendor planner (§3), alongside the linearity picker: current open pipeline, historical conversion %, pipeline required to hit the typed FY number, and the gap. Not a hard block on the budget number — a visible sanity check management sees at the same time as the historical split.

---

## 6. Expenses Budgeting (Designed, Not Built)

### 6.1 Fixed & contractual recurring (rent, consultants, retainers, subscriptions)
**Input:** manual contract register — item, category, monthly amount, contract start/end date, renewal escalation %.
**Engine:** projects current monthly amount forward to contract end date, then steps up by escalation % for the remainder of the FY. Contracts renewing mid-year are modeled as two segments (old rate, then new rate), not a full-year jump.

### 6.2 One-time / periodic (audit fee, tax filings, software licenses, multi-year-cycle items)
**Input:** entered manually by finance, month by month — no historical pattern-detection needed (simpler than originally proposed; confirmed no auto-detection required).

### 6.3 Employee cost
**Master data per employee:** gross salary, basic salary, department/BU, join date, jurisdiction (UAE or Saudi — the two gratuity categories in scope), and eligibility flags (airfare, gratuity, insurance, ESOP, variable pay, other benefits). Historical expense claims and travel data give a real per-employee T&E run-rate.

**Increment:** **per-employee hike %**, HR-supplied (not a blanket company-wide number — confirmed some employees, e.g. new joiners or underperformers, may get 0%). Effective **April** each year — salary runs at current rate Jan–Mar, stepped rate Apr–Dec.

**New hires:** added by department with a budgeted cost per role. Benefit eligibility/costs (airfare, insurance, etc.) default from that department's existing employee mix until real details exist for the specific hire. Note: departments with only 1–2 existing employees will have a thin sample to default from — acceptable but worth knowing when reviewing those numbers.

**Attrition:** ⚠️ **deferred — not modeled in v1.** Budget will reflect the existing roster + planned new hires only; management can manually reduce headcount in the tool to model planned exits until proper attrition logic is designed.

**Gratuity:** two jurisdiction categories (UAE, Saudi), each with its own statutory formula. Input: basic salary, join date, formula per jurisdiction (to be supplied). **Default treatment: monthly P&L accrual only, no cash flow impact** — since actual payout timing depends on attrition, which is deferred. Revisit once attrition is designed.

**Variable pay (VP):** flat monthly amount per employee, taken directly from offer letter — no accrual-timing logic needed, treated like a normal recurring salary component.

**ESOP:** per-employee amount, **P&L/EBID line only, excluded from cash flow** (non-cash, confirmed).

**HR & Marketing budgets:** flat department-level input by month (or annual number spread evenly, whichever HR/Marketing typically provide) — no special logic.

### 6.4 Depreciation
Straight-line from the Fixed Asset register (cost, useful life, purchase date). **Planned FY2027 capex is expected to be minimal** — estimated from historical purchase trend rather than a detailed capex plan.

### 6.5 Interest
Pass-through from the Cash Flow module (§5.5) once built — no separate logic.

### 6.6 Other small admin (pantry, parking, transport, maintenance, repairs)
Historical monthly run-rate + simple escalation %, same treatment as §6.1 but without a contract register (no employee-level modeling needed for this bucket).

---

## 7. EBID Workings (Designed, Not Built)

**Final output, per vendor and per country (two separate tables, not cascaded from one another):** Budgeted Revenue, Budgeted GP, SGA Allocated, EBID (= GP − SGA Allocated).

### 7.1 Non-employee SGA allocation
Every non-employee expense (rent, consultants, HR/Marketing budgets, admin, etc. — **depreciation and interest excluded**, see §7.3) is allocated:
- **Vendor-wise**: each vendor's share = that vendor's budgeted GP ÷ total company budgeted GP.
- **Country-wise**: each country's share = that country's budgeted GP ÷ total company budgeted GP (using the country-level GP totals rolled up from the revenue engine's grids, §3–4).

### 7.2 Employee cost allocation
Applies to the **whole cost bundle** per employee (salary, benefits, gratuity accrual, VP, ESOP, T&E — confirmed as one lump sum, not split by component).

Each employee carries **two independent assignment lists**, not a cascade:
- A **vendor list** (e.g., Kavya → Crowdstrike, Arista, Proofpoint)
- A **country list** (e.g., Kavya → Levant, Africa, Saudi) — can be a completely different set of names/scope than the vendor list

**Vendor-wise allocation**: employee cost × (that vendor's budgeted GP ÷ sum of budgeted GP across only the employee's assigned vendors).
**Country-wise allocation**: same formula, independently, using the employee's assigned country list and each country's budgeted GP.

**Employees with no vendor/country assignment** (Finance, HR, leadership, admin): folded into the same general SGA pool as §7.1, allocated by overall company GP share rather than a personal assignment list.

### 7.3 Scope note
**Depreciation and interest (including deposit income/expense) are both explicitly excluded from EBID** — they remain company-level lines (depreciation from §6.4, interest from the Cash Flow module §5.5), not allocated down to vendor/country. This keeps EBID literally "Earnings Before Interest and Depreciation," consistent with the name.

---

## 8. Still Open / Not Yet Designed
- Attrition modeling (§6.3 — deferred by choice, needs a decision on simple blanket-% vs. month-by-month exit timing before gratuity's cash-flow treatment can be finalized)
- Gratuity formulas themselves (UAE + Saudi — to be supplied)
- KPI breakdown for sales team by set parameters
- Per-country vendor launch timing (§4.2 open question)
- Deployment target — currently runs only as an in-chat artifact; a persistent hosted app for management is a separate build once the engine logic is proven

---

## 9. Status
Revenue/GP engine with linearity picker: **prototyped and validated** against real data.
Vendor/region lifecycle handling: **designed, awaiting the §4.2 open question before build.**
CRM pipeline & cash flow: **designed, awaiting CRM API access before build.**
Expenses budgeting: **designed, awaiting gratuity formulas and contract register before build.**
EBID: **designed, ready to build once Revenue, Expenses, and Cash Flow modules exist (depends on all three for inputs).**
KPI: **not started.**

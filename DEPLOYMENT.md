# Cyberknight Budget Desk — Deployment & Handover Guide

As of 2026-09-25.

## What you're getting

The **Cyberknight Budget Desk** is a full-stack budgeting and financial-intelligence tool: a React/Vite frontend talking directly to Firestore, plus a small set of Firebase Cloud Functions for the two things that genuinely need server-side secrets — the AI chat assistant (Gemini) and pulling actuals/budget data from Zoho Analytics. There is no separate application server to run or host.

| Piece | Technology |
| --- | --- |
| Frontend | React (Vite), single-page app, Firebase Hosting |
| Database | Firestore (Native mode) — read/written directly from the browser, secured by `firestore.rules` |
| Server-side logic | 5 Cloud Functions (v2): `chat`, `syncCipr`, `syncBudgets`, `syncOtherExpensesLedger`, `syncBills` |
| Auth | Firebase Authentication, Microsoft/Entra ID SSO, restricted to Cyberknight's own tenant |
| External data source | Zoho Analytics (CIPR actuals report + budget/other-expenses/bills views) |
| AI | Gemini (via the `chat` function) |

Source code: `nallanravindra-zoho/budgeting-tool` on GitHub (private repo — make sure whoever does this handover has been given collaborator access before starting).

This guide covers everything needed to stand the app up in Cyberknight's own Firebase/GCP project, connect it to Cyberknight's own Zoho and Microsoft 365 tenant, and hand out the first logins. It supersedes the repo's own `DEPLOYMENT.md`, which predates the current Microsoft SSO/approved-users setup and the three newer sync functions.

## Prerequisites

### Local tools

| Tool | Notes |
| --- | --- |
| Node.js 20+ (22 recommended) | Cloud Functions run on Node 22 — matching locally avoids version surprises |
| npm | Ships with Node |
| Firebase CLI | `npm install -g firebase-tools`, then `firebase login` |
| Google Cloud SDK (`gcloud`) | Only needed for two one-time admin scripts (bootstrapping the first approved user, seeding the baseline budget). Install from cloud.google.com/sdk |
| Git | Any recent version |

### Accounts and access someone needs before starting


- **Firebase/GCP**: Owner or Editor role on the Google Cloud project this will run in (new or existing project — see the next section).
- **Microsoft 365 / Entra ID admin**: someone who can register an application in Cyberknight's Azure tenant, for SSO login (IT/security team, typically).
- **Zoho Analytics**: admin access to the workspace(s) containing the CIPR actuals report, the budget views, the GL/other-expenses ledger, and the Bills view, plus access to Zoho's API Console (api-console.zoho.com) to register an API client.
- **Gemini API key**: a Google AI Studio (or Vertex AI) account to generate an API key for the chat assistant. Optional in the sense that the app works without it — only the AI chat panel needs it.

None of this needs to be the same person — in practice this is usually a developer plus a quick round-trip with Cyberknight's IT (for the Entra ID app) and whoever owns the Zoho account.

## Step 1 — Get the code

```bash
git clone https://github.com/nallanravindra-zoho/budgeting-tool.git
cd budgeting-tool
```

Everything below is run from this repo root unless a step says otherwise. Key paths you'll touch:

```
firebase.json              — hosting + functions + Firestore rules config
firestore.rules            — access control (see Step 6)
functions/                 — the 5 Cloud Functions + Zoho client
frontend/                  — the React app
scripts/add-approved-user.js       — one-time: bootstraps the first login

```

## Step 2 — Create and configure the Firebase project

1. **Create (or choose) a project** at console.firebase.google.com — "Add project". If Cyberknight already has a GCP org, create it under that org so billing/IAM follow existing policy.
2. **Upgrade to the Blaze (pay-as-you-go) plan.** This is required — Cloud Functions v2 needs Blaze to use Secret Manager and to make any outbound network call, and this app's functions do both (calling Zoho and Gemini). Firestore and Hosting usage at Cyberknight's scale should stay well within the free-tier-equivalent allowances even on Blaze; this only removes the outbound-network block, it doesn't imply a big bill.
3. **Enable Firestore**: Build → Firestore Database → Create database → **Native mode** → pick a region (e.g. `us-central1` or one closer to the UAE/MEA region if latency matters — this can't be changed later without migrating).
4. **Register a Web app**: Project settings → General → Your apps → Add app → Web. Copy the config values shown (`apiKey`, `authDomain`, `projectId`, `appId`) — you'll need these in Step 4's frontend `.env`.
5. **Link this repo to the project**:

   ```bash
   firebase login
   firebase use --add
   ```

   Select the project you just created/chose. There's no committed `.firebaserc` in the repo — each environment (dev, prod) picks its own project this way, so this step is required once per environment/machine.

At this point Authentication hasn't been enabled yet — that's Step 3, since it needs the Entra ID app registration done first.

## Step 3 — Configure Microsoft SSO

Login is Microsoft/Entra ID SSO, restricted to Cyberknight's own tenant — not a generic "any Microsoft account." This needs an app registration on the Azure side and a matching provider on the Firebase side.

**3a. Register the app in Azure (Cyberknight's Entra ID admin does this)**

1. Azure Portal → Microsoft Entra ID → App registrations → New registration.
2. Name it (e.g. "Cyberknight Budget Desk"). Supported account types: **Accounts in this organizational directory only** (single tenant) — matches the tenant restriction the app enforces client-side.
3. Leave Redirect URI blank for now — you'll add it in step 3c, after Firebase generates it.
4. From the app's **Overview** page, note the **Application (client) ID** and the **Directory (tenant) ID**.
5. **Certificates & secrets** → New client secret → copy the secret **value** immediately (it's only shown once).

**3b. Add the Microsoft provider in Firebase**

1. Firebase Console → Authentication → Sign-in method → Add new provider → **Microsoft**.
2. Paste the Application (client) ID and client secret from 3a.4/3a.5. Save.
3. Firebase shows a callback URL on this screen, looking like `https://<project-id>.firebaseapp.com/__/auth/handler`.

**3c. Finish the Azure side**

1. Back in the Azure app → Authentication → Add a platform → Web → paste the callback URL from 3b.3 as the Redirect URI. Save.

**3d. Authorized domains**

Firebase Console → Authentication → Settings → Authorized domains. The default `<project-id>.firebaseapp.com` and `<project-id>.web.app` are added automatically; add a custom domain here too if one is set up later for Hosting.

**Important — SSO is not the access boundary.** Signing in with a valid Cyberknight Microsoft account only proves someone is in the tenant; it does not by itself grant access to the app. A separate `approvedUsers` Firestore allowlist decides who can actually use it — see Step 8. Don't skip that step assuming tenant restriction alone is enough.

## Step 4 — Configure backend secrets and config

The Cloud Functions need two kinds of values: real secrets (Firebase Secret Manager — never touch a file) and non-sensitive IDs (a local `.env` file, never committed).

### 4a. Secrets (Firebase Secret Manager)

```bash
firebase functions:secrets:set LLM_API_KEY
firebase functions:secrets:set ZOHO_CLIENT_ID
firebase functions:secrets:set ZOHO_CLIENT_SECRET
firebase functions:secrets:set ZOHO_REFRESH_TOKEN
```

Each prompts you to paste the value interactively — nothing goes into a file, nothing gets committed.

| Secret | Where it comes from |
| --- | --- |
| `LLM_API_KEY` | A Gemini API key from Google AI Studio (or Vertex AI). Powers the in-app AI chat assistant only — the rest of the app works fine without it. |
| `ZOHO_CLIENT_ID` / `ZOHO_CLIENT_SECRET` | Register a Server-based Application (or a Self Client for a quick setup) at api-console.zoho.com, under the `ZohoAnalytics.data.READ` scope. |
| `ZOHO_REFRESH_TOKEN` | Generated via Zoho's OAuth authorization-code flow using the client ID/secret above — Zoho's own API Console docs walk through the exact click-path, since it changes occasionally. This refresh token doesn't expire on its own; treat it as a long-lived credential and revoke/regenerate it in Zoho if it ever needs to be rotated. |

### 4b. Non-secret config (`functions/.env`)

```bash
cat > functions/.env << 'EOF'
ZOHO_ORG_ID=<your Zoho org id>
ZOHO_WORKSPACE_ID=<workspace id containing the CIPR report>
ZOHO_VIEW_ID=<view id of the CIPR actuals report>
EOF
```

Find these in Zoho Analytics under the relevant workspace/view, or via Settings → API. (The Other Expenses ledger and Bills views use their own hardcoded workspace/view IDs in `functions/index.js` — update those constants directly in code if Cyberknight's Zoho org uses different ones than the values already in the file.)

**Security note:** `functions/.env` and `frontend/.env` (Step 5) are now in `.gitignore` (as of 2026-09-25) — they weren't before, and had actually been tracked in git since the repo's first commit. That wasn't a live secret leak (these two files only ever held the public-by-design Firebase web config and non-secret Zoho org/workspace/view IDs — the real secrets in Step 4a never touched a file), but keep it that way: never paste a real secret into either `.env` file instead of using `firebase functions:secrets:set`.

## Step 5 — Install dependencies and set frontend config

**Functions:**

```bash
cd functions
npm install
cd ..
```

**Frontend:**

```bash
cd frontend
npm install
```

Create `frontend/.env` with the Web app config from Step 2.4 and the Entra ID tenant ID from Step 3a.4:

```bash
cat > .env << 'EOF'
VITE_FIREBASE_API_KEY=<from Step 2.4>
VITE_FIREBASE_AUTH_DOMAIN=<project-id>.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=<your-project-id>
VITE_FIREBASE_APP_ID=<from Step 2.4>
VITE_MICROSOFT_TENANT_ID=<Directory (tenant) ID from Step 3a.4>
EOF
cd ..
```

`VITE_MICROSOFT_TENANT_ID` restricts the Microsoft sign-in screen to Cyberknight's own tenant instead of any Microsoft account anywhere — it falls back to `"common"` (any tenant) if left unset, which is **not** what you want in a real deployment. Double-check it's set before going live.

## Step 6 — Deploy Firestore rules

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

This pushes `firestore.rules` — the access-control layer for all budget data — and `firestore.indexes.json` (currently empty; no composite indexes are needed today).

Access is controlled by an explicit `approvedUsers` allowlist, **not** by email domain — deliberately independent of whether Cyberknight uses Microsoft 365, Google Workspace, or anything else. There's a chicken-and-egg problem by design: the rules require an *existing* approved user to add new ones, so the very first entry can't be created through the app itself. That's Step 8 — do it right after this.

## Step 7 — Deploy the Cloud Functions

```bash
firebase deploy --only functions
```

This deploys all 5 functions, all callable (`onCall`) — invoked directly from the frontend via Firebase's SDK, no public HTTP endpoints to secure separately:

| Function | Does what | Trigger |
| --- | --- | --- |
| `chat` | AI business-analyst assistant (Gemini + tool-calling into Firestore) | Called from the chat panel |
| `syncCipr` | Pulls the CIPR actuals report (invoices, revenue, GP) from Zoho | "Sync Now" button |
| `syncBudgets` | Pulls vendor-wise/country-wise/month-wise budget views from Zoho | "Sync Now" button |
| `syncOtherExpensesLedger` | Pulls the GL ledger for the Other Expenses module | "Sync Now" button |
| `syncBills` | Pulls the Bills view (AP side of Cash Flow) | "Sync Now" button |

**None of these run on a schedule.** There's no Cloud Scheduler job — every sync is a manual click in the app. That's a deliberate choice (CIPR data doesn't change minute-to-minute), not a gap, but it means data goes stale until someone clicks Sync — worth explaining to whoever owns day-to-day use.

Every function calls `requireApprovedUser()` first — even with valid Firebase Auth, an unapproved account gets rejected here too, not just at the Firestore-rules layer.

## Step 8 — Build and deploy the frontend

```bash
cd frontend
npm run build
cd ..
firebase deploy --only hosting
```

`npm run build` reads the `frontend/.env` values from Step 5 at build time and bakes them into the static bundle in `frontend/dist` — Firebase Hosting serves that folder as-is (see `firebase.json`'s `hosting.public`).

Deploy prints a live URL, something like `https://<project-id>.web.app`. That's the one external URL for the whole app — no separate URL for an API or backend.

**Everything at once:** once all the pieces above are configured, `firebase deploy` (no `--only` flag) pushes Hosting, all 5 Functions, and Firestore rules together in one command — the normal way to ship a future update once this initial setup is done.

## Step 9 — Bootstrap the first approved user, then manage access

Nobody can sign in until at least one document exists in the `approvedUsers` Firestore collection — and the rules require an existing approved user to create new ones, so the very first one has to be added directly with admin credentials, bypassing the rules.

```bash
gcloud auth application-default login
node scripts/add-approved-user.js someone@cyberknight.tech another@cyberknight.tech
```

This only creates the Firestore allowlist entry — it does **not** create or touch anyone's Microsoft account. They sign in with their existing Cyberknight Microsoft 365 credentials via "Sign in with Microsoft" on the app's sign-in screen.

### Adding people afterward

There's no in-app admin UI for this yet — `scripts/add-approved-user.js` **is** the admin tool for now. Run it again any time to add more people:

```bash
node scripts/add-approved-user.js newperson@cyberknight.tech
```

### Restricting someone to specific tabs

An `approvedUsers/{email}` doc can carry an optional `allowedTabs` array (e.g. `["employees"]` for an HR-only login). Missing/null/empty means unrestricted (full access) — the default for everyone added via the script above. To restrict someone, edit their doc by hand in the Firebase Console (Firestore Database → `approvedUsers` → their email → add the `allowedTabs` field) — there's no UI for this either.

**Important scope note:** this restriction is currently UI-complete but only *partially* enforced server-side — it's wired into `firestore.rules` for the `employees` collection specifically, since that's the sensitive-HR-data use case it was originally built for. Every other collection still allows any approved user to read/write it directly (e.g. via browser devtools) regardless of `allowedTabs`; the Sidebar and AI chat panel just won't show a restricted user those tabs. If Cyberknight needs a second restricted role covering different data, that server-side enforcement needs extending — see `firestore.rules`' `canAccessTab()` function and the note in the repo's `CLAUDE.md` §7.

### Deactivating someone

Set `active: false` on their `approvedUsers/{email}` doc (Firebase Console). A missing `active` field defaults to *approved* — only an explicit `false` blocks access.

## Step 10 — Initial data: active budgeting year, baseline budget, first sync

### Set the active budgeting year

Exactly one year is ever editable in the app — the "active budgeting year," read from `settings/config.activeBudgetingYear`. If that document doesn't exist, the app defaults to *next calendar year*, which is usually right but worth setting explicitly: Firebase Console → Firestore Database → create collection `settings`, document `config`, field `activeBudgetingYear` (number). There's no in-app control to change this — it's a Console-only setting, rolled forward once a year.

### Seed a baseline budget (optional)

The editable working budget starts empty otherwise (vendors can be added one at a time via "+ Add Vendor," or a full year's numbers pulled in via `syncBudgets`). To instead pre-load it from the historical baseline bundled in the repo (`data/vendors.json`):

```bash
gcloud auth application-default login
node scripts/seed-baseline-budget.js
```

This only touches the *editable* `budgetVersions/working` store — it never overwrites `ciprActuals` (real actuals only ever come from `syncCipr`).

### Run the first sync and verify it worked

Sign into the app as an approved user and click the sync icon in the top bar. Then:

```bash
firebase functions:log --only syncCipr
```

Check the Firestore console → `ciprActuals` collection for real documents with sensible numbers. **Before trusting the result**, check the function logs for the raw shape of one Zoho row and confirm the field names `functions/index.js` expects (`row["Vendor Name"]`, `row["Invoice Date"]`, etc.) actually match Cyberknight's real CIPR view column names — several fields were mapped from a reference file, not yet individually verified against a live pull (see `CLAUDE.md` §7 for the full list of what's still unverified). Repeat the same idea for `syncBudgets`, `syncOtherExpensesLedger`, and `syncBills`.

Backfilling past years: both `syncCipr` and `syncBills` default to the current calendar year but accept an explicit year, e.g. calling them with `{year: 2024}` from the browser console (`firebase.functions().httpsCallable('syncCipr')({year:2024})`) — there's no UI button for this, it's a one-time manual step per past year.

## Ongoing operations

### Shipping a code change

1. Pull the latest `main` from GitHub.
2. `cd frontend && npm install && npm run build && cd ..` (only if `frontend/package.json` changed — otherwise a plain `npm run build` is enough).
3. `firebase deploy` (or a narrower `--only hosting` / `--only functions` / `--only firestore:rules` if only one part changed).

There's no CI/CD pipeline today — deploys are a manual step run by a person from their own machine (or Cloud Shell) after pulling. This is deliberate: the app touches employee HR data (salaries, personal details), so no automated system holds standing production deploy credentials.

### Rolling the budgeting year forward

Once a year, update `settings/config.activeBudgetingYear` in the Firestore console to the new year. The previous year automatically becomes read-only ("current year" or "completed," per the app's year-classification logic) — no data migration needed for that transition. Note: `budgetProjections` for a future year does **not** auto-migrate into the editable store when it becomes the active year — someone needs to re-run the budget generator or this needs handling by hand (a known gap, see `CLAUDE.md` §7).

### Rotating secrets

```bash
firebase functions:secrets:set ZOHO_REFRESH_TOKEN
```

Re-run the same command for any of the 4 secrets to rotate it — Firebase versions secrets automatically and the functions pick up the new value on their next deploy/cold start.

### Where to look when something's wrong

- **Function errors**: `firebase functions:log` (or filter with `--only <functionName>`).
- **"Missing or insufficient permissions" for a signed-in user**: check their `approvedUsers/{email}` doc exists and `active` isn't explicitly `false`.
- **Chat or sync silently failing**: confirm the relevant secret is actually set (`firebase functions:secrets:access LLM_API_KEY` etc. to check, without printing the value insecurely — use the Firebase Console's Secret Manager view instead if unsure).
- **Data looks stale**: syncs are manual — confirm someone actually clicked "Sync Now" recently; there's no background scheduler to blame.

## Known limitations to be aware of

| Area | What to know |
| --- | --- |
| Access control | `allowedTabs` per-user restriction is enforced server-side only for the `employees` collection today — other collections trust the client UI to hide tabs, not `firestore.rules`. |
| Chat function | Bypasses `firestore.rules` (uses the Admin SDK) and doesn't check `allowedTabs` itself — not exploitable through the normal app UI, but not a real security boundary if ever called another way. |
| Budget years | `budgetProjections` for a future year doesn't auto-migrate into the editable store when it becomes active — manual step. |
| Country-level Region data | Budget's "Country" field and CIPR's "End Customer Country" field are different source columns and may not always match by name. |
| Bills backfill | Only the current year was populated on first sync — older years need manual `syncBills(year)` calls. |
| Unverified CIPR fields | Several invoice fields (Opportunity Owner, Engagement Type, Purchase Cost, ZTX Framework, etc.) haven't been individually confirmed against a live Zoho pull — check `syncCipr`'s sample-row log before relying on them in analysis. |
| `.env` files | Were tracked in git since the repo's first commit (not sensitive values, but bad practice) — fixed 2026-09-25: untracked and added to `.gitignore`. |

The repo's `CLAUDE.md` file has the full, continuously-updated list (§7 "Known limitations," §8 "Things that were genuinely bugs and got fixed") plus a complete build history (§6) — worth reading in full before making changes, and worth keeping updated the same way going forward.

## Troubleshooting common setup issues

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| "Missing or insufficient permissions" right after signing in | No `approvedUsers/{email}` doc exists yet for that account, or it exists without `active`/with `active: false` | Run `scripts/add-approved-user.js` for that email (Step 9) |
| Sign-in works for any Microsoft account, not just Cyberknight's | `VITE_MICROSOFT_TENANT_ID` unset — falls back to `"common"` | Set it in `frontend/.env` (Step 5) and rebuild/redeploy the frontend |
| `syncCipr`/`syncBudgets`/etc. fail immediately | A required secret isn't set, or the Zoho refresh token is invalid/expired | Re-run `firebase functions:secrets:set <NAME>`; check `firebase functions:log` for the exact Zoho error |
| Functions deploy fails mentioning Secret Manager or billing | Project isn't on the Blaze plan yet | Upgrade in Firebase Console → Usage and billing (Step 2.2) |
| Sync succeeds but numbers look wrong or fields are empty | Zoho column names don't match what `functions/index.js` expects | Check the sample-row log printed by that sync function (`firebase functions:log`) against the actual Zoho view's column headers |
| `firebase use --add` shows no projects | Signed into the wrong Google account, or account lacks project access | `firebase login --reauth`, or get Owner/Editor added on the GCP project |
| Local script (`add-approved-user.js` / `seed-baseline-budget.js`) fails with an auth error | `gcloud auth application-default login` wasn't run, or the logged-in account lacks Firestore access | Re-run that command; confirm the account has the Cloud Datastore User (or broader) IAM role on the project |

For anything not covered here, `CLAUDE.md` at the repo root has the full design history and reasoning behind most of the app's behavior — read it before assuming something is a bug rather than a documented, deliberate choice.

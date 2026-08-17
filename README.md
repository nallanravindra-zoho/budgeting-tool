# Cyberknight Budget Desk — v3 (Firebase Hosting + Firestore + 2 Cloud Functions)

This supersedes both `Cyberknight_Budget_Handoff.zip` (v1, self-hosted
Postgres on a VM) and the Zoho+Firestore-on-Cloud-Run package (v2). Don't
run either of those — this is the current version.

## What changed from v2, and why

v2 still had a full Express backend on Cloud Run doing REST CRUD for budget
data, even though none of that CRUD touched a secret. The honest scope of
"server-side code this app actually needs" is exactly two operations: the
Zoho pull and the LLM chat call, both of which require credentials that must
never reach the browser. Everything else — reading and writing budget
numbers — is now direct Firestore access from the frontend, secured by
`firestore.rules` instead of custom Express middleware re-implementing the
same check.

The Zoho sync is also deliberately **manual only** — a "Sync Now" button in
the app, not a nightly or hourly Cloud Scheduler job. CIPR data doesn't
change minute-to-minute, and a timer running in the background adds a moving
part (and Zoho API quota usage) nobody explicitly asked for. Freshness
happens exactly when someone clicks the button, with the result — how many
vendors were updated, and when — shown directly in the app.

Net effect: one deploy command (`firebase deploy`) instead of two separate
Docker builds and Cloud Run deploys, one external URL instead of two, and no
VPC/IAP configuration at all — which is what actually caused the deployment
friction in the previous version.

## File structure

```
firebase.json              — single deploy config (hosting + functions + rules)
firestore.rules            — access control for budget data (replaces Express middleware)
firestore.indexes.json     — required by Firebase CLI, empty for now
functions/
  index.js                 — the entire server-side surface: chat + syncCipr
  zohoAnalytics.js          — Zoho OAuth + Bulk Export client
  package.json
frontend/
  src/
    App.jsx                 — same UI as before, data layer now calls Firestore directly
    firestoreData.js         — direct Firestore reads/writes (replaces the old REST API client)
    chatClient.js             — calls the `chat` function via Firebase's httpsCallable
    firebase.js, AuthGate.jsx — unchanged from v2
    main.jsx
  index.html, vite.config.js, package.json
scripts/seed-baseline-budget.js   — loads data/vendors.json into Firestore directly
data/, spec/                       — unchanged
DEPLOYMENT.md
```

## What's still not built (unrelated to this architecture change)

- Team and Expenses input screens — same gap as every previous version.
- The exact CIPR field-name mapping in `functions/index.js`'s `syncCipr` —
  written from the original Excel column names; needs one real sync run to
  confirm Zoho's own export uses identical field names.
- P&L/EBID tab — still computes from bundled seed JSON client-side, not yet
  wired to live Firestore/Zoho data the way Vendors/Regions now are.
- Attrition modeling, gratuity formulas, KPI module — untouched by this change.

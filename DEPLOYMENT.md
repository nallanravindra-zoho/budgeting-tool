# Deployment Guide — v3 (Firebase Hosting + Functions + Firestore)

No Docker, no Cloud Run, no VPC, no Artifact Registry. One CLI tool, one
deploy command. This supersedes both earlier deployment guides.

---

## 1. One-time setup

```bash
npm install -g firebase-tools
firebase login
cd budgeting-tool   # repo root — where firebase.json lives
firebase use --add   # select your existing GCP project
```

## 2. Enable Firestore and Firebase Auth (console, not CLI)

1. console.firebase.google.com -> your project -> Build -> Firestore Database -> Create database -> Native mode -> pick `us-central1` (or your preferred region).
2. Build -> Authentication -> Sign-in method -> enable **Google**.
3. Authentication -> Settings -> Authorized domains -> you'll add your real Hosting domain here after step 6 (Firebase adds the default `*.web.app` domain automatically).
4. Project Settings -> General -> Your apps -> Add app -> Web -> copy the config object (`apiKey`, `authDomain`, `projectId`, `appId`) — needed in step 5.

## 3. Zoho Analytics credentials

From Zoho's API Console (api-console.zoho.com): Client ID, Client Secret, a Refresh Token (via Zoho's OAuth flow — their docs, not summarized here since the click-path changes), your Org ID, the Workspace ID containing CIPR, and the View ID of the CIPR report itself.

**Secrets** (Client ID/Secret/Refresh Token, plus the LLM key) go through Firebase's secret manager:
```bash
firebase functions:secrets:set ZOHO_CLIENT_ID
firebase functions:secrets:set ZOHO_CLIENT_SECRET
firebase functions:secrets:set ZOHO_REFRESH_TOKEN
firebase functions:secrets:set LLM_API_KEY
```
(Each prompts you to paste the value — nothing goes in a file, nothing gets committed.)

**Non-secret config** (Org/Workspace/View IDs) go in a `.env` file Functions reads at deploy time:
```bash
cat > functions/.env << 'EOF'
ZOHO_ORG_ID=<your org id>
ZOHO_WORKSPACE_ID=<your workspace id>
ZOHO_VIEW_ID=<CIPR view id>
EOF
```

## 4. Frontend build-time config

```bash
cd frontend
npm install
VITE_FIREBASE_API_KEY=<from step 2.4> \
VITE_FIREBASE_AUTH_DOMAIN=<your-project>.firebaseapp.com \
VITE_FIREBASE_PROJECT_ID=<your-project-id> \
VITE_FIREBASE_APP_ID=<from step 2.4> \
VITE_ALLOWED_DOMAIN=cyberknight.tech \
  npm run build
cd ..
```

## 5. Deploy — everything, one command

```bash
firebase deploy
```

This pushes the built frontend to Hosting, both Cloud Functions (`chat`, `syncCipr`), and `firestore.rules` — together. `syncCipr` is manual-only (called from the app's "Sync Now" button) — no Cloud Scheduler job is created, and none is needed.

Output includes your live URL — something like `https://<project-id>.web.app`. That's the one external URL for the whole app.

**If you only changed one part** (e.g. just the frontend after a UI tweak), you can deploy narrower and faster:
```bash
firebase deploy --only hosting
firebase deploy --only functions
firebase deploy --only firestore:rules
```

## 6. Seed the starting budget

```bash
gcloud auth application-default login
node scripts/seed-baseline-budget.js
```
Prints the same $200M / $21.5M sanity check used throughout this whole project.

## 7. Trigger a sync to verify the Zoho pull actually works

Sign into the app and click the sync icon in the top bar (next to the scenario toggle) — this calls `syncCipr` directly, the same as the one-time verification below.
```bash
firebase functions:log --only syncCipr
```
Then check Firestore console -> `ciprActuals` collection -> confirm real
documents appear with sensible numbers. **Before trusting this**, check the
Functions logs for the raw shape of one Zoho row and confirm the field
names in `functions/index.js`'s `syncCipr` (`row["Vendor Name"]`, `row["Invoice Date"]`, etc.) actually match your CIPR view's real column names.

## 8. Verify end-to-end

- Open the Hosting URL, sign in with a `@cyberknight.tech` Google account.
- Confirm a non-Cyberknight Google account is actually rejected (test with a personal account if you have one).
- Confirm the Overview tab shows real $200M/$21.5M figures, not the bundled fallback.
- Confirm chat works.
- In the Firestore console, try manually editing a `ciprActuals` document as a signed-in test user via the app (there's no UI path to do this, but you can confirm indirectly) — the real test is that `firestore.rules` blocks it, which you can verify directly in the Firestore console's Rules Playground rather than needing the app.

## What's gone from the old guides, and why that's fine

- No VPC, no Compute Engine VM, no firewall rules, no Direct VPC egress — Firestore is serverless and needs none of it.
- No Docker, no Artifact Registry, no Cloud Run deploy commands for either service.
- No IAP, no Cloud Run IAM bindings, no service-account role juggling for basic CRUD — `firestore.rules` is the single place access control lives for budget data.
- No Cloud Scheduler, no cron — `syncCipr` runs only when someone clicks "Sync Now" in the app. Freshness is on-demand, not timer-driven.

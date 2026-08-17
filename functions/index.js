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
const { exportCiprReport } = require("./zohoAnalytics");

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
const zohoViewId = defineString("ZOHO_VIEW_ID");

// Access control matches firestore.rules exactly: an explicit allowlist
// (approvedUsers collection), separate from Microsoft SSO. SSO proves the
// user has a real account in Cyberknight's Entra tenant — it does NOT by
// itself decide whether they're allowed to use this specific app. Someone
// could be a legitimate Cyberknight employee via SSO and still not be on
// this list (new hire not yet added, contractor, etc.) — this check is
// what actually enforces per-app access, on top of tenant membership.
async function requireApprovedUser(request) {
  if (!request.auth || !request.auth.token.email) {
    throw new HttpsError("unauthenticated", "Sign-in required");
  }
  const email = request.auth.token.email.toLowerCase();
  const snap = await db.collection("approvedUsers").doc(email).get();
  if (!snap.exists || snap.data().active === false) {
    throw new HttpsError("permission-denied", "This account is not on the approved users list");
  }
}

// ---- chat ----------------------------------------------------------------
// Called from the frontend via httpsCallable(functions, "chat") — the
// Firebase SDK automatically attaches the signed-in user's auth token,
// so there's no manual header/CORS handling needed here (unlike the old
// Express version). request.auth is populated for free.

exports.chat = onCall({ secrets: [llmApiKey] }, async (request) => {
  await requireApprovedUser(request);
  const { message, scenario, mode, context } = request.data;

  let system;
  if (mode === "grid_adjust") {
    system = `You help rebalance a revenue budget's country-mix percentages for vendor "${context.vendor}". Current country split (percent of annual revenue): ${context.countrySummary}. Countries must stay from this exact set: ${context.countryList.join(", ")}. The user will ask for an adjustment. Respond with ONLY JSON, no prose, no backticks:
{"type":"adjust","changes":[{"country":"<exact country from the list>","new_pct":<fraction 0-1>}, ...],"message":"<one short sentence>"}
Only include countries the user wants explicitly changed in "changes" — all other countries will be scaled proportionally to absorb the remainder so the total stays 100%. If the request is unclear, respond {"type":"clarify","message":"..."} instead.`;
  } else {
    // Fixed doc ID "working" — matches frontend/src/firestoreData.js. Do
    // not change this back to a where("isWorking","==",true) query; that
    // pattern allowed duplicate working-version docs to exist (see the
    // comment in firestoreData.js for the actual bug this caused).
    const [budgetsSnap, actualsSnap] = await Promise.all([
      db.collection("budgetVersions").doc("working").collection("vendorBudgets").get(),
      db.collection("ciprActuals").get(),
    ]);
    // decodeURIComponent — doc IDs are encoded (see firestoreData.js and
    // scripts/seed-baseline-budget.js) since Firestore doc IDs can't
    // contain "/", and "H3/Ridge" is a real vendor name. Must decode here
    // or the LLM (and anyone reading its answers) sees "H3%2FRidge".
    const actuals = {};
    actualsSnap.forEach(d => { actuals[decodeURIComponent(d.id)] = d.data(); });

    const vendorList = budgetsSnap.docs.map(d => decodeURIComponent(d.id)).join(", ");
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const summary = budgetsSnap.docs.map(d => {
      const vendor = decodeURIComponent(d.id);
      const v = d.data();
      const a = actuals[vendor];
      const monthlyBudget = (v.monthlyBudgetRevenue || []).map((m, i) => `${months[i]}=${Math.round(m)}`).join(",");
      const line = [`${vendor}: budget_revenue=${Math.round(v.revenue || 0)}`, `budget_gp=${Math.round(v.gp || 0)}`, `monthly_budget_revenue={${monthlyBudget}}`];
      if (a) {
        const monthlyActual = (a.monthlyActualRevenue || []).map((m, i) => `${months[i]}=${Math.round(m)}`).join(",");
        line.push(`actual_revenue_ytd=${Math.round(a.actualRevenueYtd || 0)}`, `actual_gp_ytd=${Math.round(a.actualGpYtd || 0)}`, `monthly_actual_revenue={${monthlyActual}}`);
      } else {
        line.push("actuals=not yet synced for this vendor");
      }
      return line.join(", ");
    }).join("\n");

    system = `You are a budgeting assistant for Cyberknight Technologies, a cybersecurity VAD in the Middle East and Africa. You control a vendor-level revenue & gross profit budget (scenario: ${scenario}).

Known vendor names (match user references to EXACTLY one of these, case-insensitively, handling minor typos): ${vendorList}

Current data per vendor (all figures USD). Budget figures cover the full year; actual figures are year-to-date only (through August 2026 — no actuals exist for future months since they haven't happened yet):
${summary}

You DO have monthly budget figures (monthly_budget_revenue) and real monthly/YTD actuals (actual_revenue_ytd, actual_gp_ytd, monthly_actual_revenue) for every vendor above — use them directly to answer monthly or actual-vs-budget questions instead of saying you don't have this data.

Respond with ONLY a single JSON object, no markdown fences, no prose outside the JSON, in one of these three shapes:
1. {"type":"edit","vendor":"<exact vendor name>","field":"revenue","mode":"set"|"increase_pct"|"decrease_pct"|"increase_amt"|"decrease_amt","value":<number>,"explanation":"<one short sentence>"}
2. {"type":"answer","message":"<concise answer using the data above, include real numbers>"}
3. {"type":"clarify","message":"<short clarifying question>"}
Never invent vendors not in the list. Never wrap the JSON in backticks.`;
  }

  // Gemini forces valid JSON via responseMimeType — no markdown-fence
  // stripping needed the way Anthropic's plain-text response required.
  // System prompt content/logic above is unchanged; only the provider call differs.
  const geminiRes = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": llmApiKey.value() },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: message }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    }
  );
  const geminiData = await geminiRes.json();
  const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new HttpsError("unavailable", `No response from Gemini: ${JSON.stringify(geminiData).slice(0, 300)}`);
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new HttpsError("internal", `Gemini returned unparseable JSON: ${text.slice(0, 200)}`);
  }
});

// ---- syncCipr --------------------------------------------------------------
// Manual only — no schedule. Called from the frontend's "Sync Now" button
// via httpsCallable, same pattern as `chat`. Any signed-in Cyberknight user
// can trigger it (matches everyone already having write access to the
// budget itself); tighten requireApprovedUser if you want this
// restricted to a smaller admin group later.

exports.syncCipr = onCall(
  { secrets: [zohoClientId, zohoClientSecret, zohoRefreshToken] },
  async (request) => {
    await requireApprovedUser(request);

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
    console.log(`syncCipr: received ${rawRows.length} raw rows`);

    const byVendor = {};
    const currentYear = new Date().getFullYear();
    for (const row of rawRows) {
      const vendor = row["Vendor Name"];
      const invoiceDate = new Date(row["Invoice Date"]);
      if (!vendor || isNaN(invoiceDate) || invoiceDate.getFullYear() !== currentYear) continue;
      if (row["Included in Macnica?"] !== "Yes") continue;
      const month = invoiceDate.getMonth();
      // Zoho's export returns numbers as comma-formatted strings (e.g.
      // "-2,205,479"), which Number() silently turns into NaN, then into
      // 0 via the `|| 0` fallback — this was the actual cause of near-zero
      // totals despite field names being correct. Strip commas, keep the
      // sign (some rows are legitimate negative credit notes).
      const revenue = Number(String(row["Invoice Value"] ?? "0").replace(/,/g, "")) || 0;
      const gp = Number(String(row["GROSS PROFIT"] ?? "0").replace(/,/g, "")) || 0;
      if (!byVendor[vendor]) byVendor[vendor] = { monthlyActualRevenue: new Array(12).fill(0), monthlyActualGp: new Array(12).fill(0) };
      byVendor[vendor].monthlyActualRevenue[month] += revenue;
      byVendor[vendor].monthlyActualGp[month] += gp;
    }

    const batch = db.batch();
    for (const vendor in byVendor) {
      const v = byVendor[vendor];
      const actualRevenueYtd = v.monthlyActualRevenue.reduce((a, b) => a + b, 0);
      const actualGpYtd = v.monthlyActualGp.reduce((a, b) => a + b, 0);
      batch.set(db.collection("ciprActuals").doc(encodeURIComponent(vendor)), {
        monthlyActualRevenue: v.monthlyActualRevenue, actualRevenueYtd, actualGpYtd,
        lastSyncedAt: admin.firestore.Timestamp.now(),
        lastSyncedBy: request.auth.token.email,
      });
    }
    await batch.commit();

    const vendorCount = Object.keys(byVendor).length;
    console.log(`Manual CIPR sync by ${request.auth.token.email}: ${vendorCount} vendors updated.`);
    return { vendorsUpdated: vendorCount, syncedAt: new Date().toISOString() };
  }
);
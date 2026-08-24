/**
 * Zoho Analytics API client
 * ---------------------------
 * Called only from functions/index.js's syncCipr and syncBudgets callable
 * functions — never exposed to the frontend. Credentials are passed in explicitly
 * (Cloud Functions v2's secret-binding pattern), not read from process.env
 * directly, so this module has no hidden dependency on how the caller
 * manages configuration.
 *
 * Verified against Zoho's official v2 Bulk API docs
 * (zoho.com/analytics/api/v2/bulk-api/export-data-async/create-export/view-id.html):
 * job creation is GET .../views/{viewId}/data?CONFIG=<url-encoded-json>,
 * NOT a POST to .../exportjobs as an earlier version of this file had it —
 * that mismatch (wrong path, wrong method, wrong param location) was the
 * actual cause of the URL_RULE_NOT_CONFIGURED / 404 seen in testing.
 * Status-check and download calls were already correct.
 *
 * Regional note: uses .com data center endpoints. If Cyberknight's Zoho
 * account is on a different data center, swap both hosts below — check
 * under Settings > API in Zoho Analytics to confirm.
 */

const ACCOUNTS_HOST = "https://accounts.zoho.com";
const API_HOST = "https://analyticsapi.zoho.com";

async function getAccessToken({ clientId, clientSecret, refreshToken }) {
  const params = new URLSearchParams({
    client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token",
  });
  const res = await fetch(`${ACCOUNTS_HOST}/oauth/v2/token`, { method: "POST", body: params });
  const data = await res.json();
  if (!data.access_token) throw new Error(`Zoho token refresh failed: ${JSON.stringify(data)}`);
  return data.access_token;
}

async function zohoRequest(path, accessToken, orgId, opts = {}) {
  const res = await fetch(`${API_HOST}${path}`, {
    ...opts,
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}`, "ZANALYTICS-ORGID": orgId, ...(opts.headers || {}) },
  });
  if (!res.ok) throw new Error(`Zoho API ${path} -> ${res.status}: ${await res.text()}`);
  return res.json();
}

/**
 * Pulls a full Zoho Analytics view and returns it as an array of row objects.
 * Generic — used for the CIPR actuals view AND the three budget views
 * (month-wise, country-wise, vendor-wise). Same job-creation/poll/download
 * mechanics for all of them; only the viewId (and what the caller does with
 * the resulting rows) differs.
 * @param {{clientId, clientSecret, refreshToken, orgId, workspaceId, viewId}} params
 */
async function exportZohoView({ clientId, clientSecret, refreshToken, orgId, workspaceId, viewId }) {
  const accessToken = await getAccessToken({ clientId, clientSecret, refreshToken });

  const config = encodeURIComponent(JSON.stringify({ responseFormat: "json" }));
  const createRes = await zohoRequest(
    `/restapi/v2/bulk/workspaces/${workspaceId}/views/${viewId}/data?CONFIG=${config}`,
    accessToken, orgId,
    { method: "GET" }
  );
  const jobId = createRes?.data?.jobId;
  if (!jobId) throw new Error(`Zoho export job creation failed: ${JSON.stringify(createRes)}`);

  // Was 20 attempts x 3s = a hardcoded 60s ceiling — too short for larger
  // exports (e.g. multi-year CIPR history). 80 x 3s = 4 minutes. Must stay
  // comfortably under the calling Cloud Function's own timeoutSeconds
  // (see functions/index.js) or the function gets killed first and this
  // error never even gets the chance to fire.
  let status = "IN PROGRESS", attempts = 0;
  const MAX_ATTEMPTS = 80;
  while (status !== "JOB COMPLETED" && attempts < MAX_ATTEMPTS) {
    await new Promise(r => setTimeout(r, 3000));
    const statusRes = await zohoRequest(`/restapi/v2/bulk/workspaces/${workspaceId}/exportjobs/${jobId}`, accessToken, orgId);
    status = statusRes?.data?.jobStatus;
    attempts++;
    if (status === "JOB FAILED") throw new Error(`Zoho export job failed: ${JSON.stringify(statusRes)}`);
  }
  if (status !== "JOB COMPLETED") throw new Error(`Zoho export job timed out after ${MAX_ATTEMPTS * 3}s`);

  const downloadRes = await zohoRequest(`/restapi/v2/bulk/workspaces/${workspaceId}/exportjobs/${jobId}/data`, accessToken, orgId);

  // Zoho's JSON export wraps the actual rows under data.<ViewName> (a
  // dynamic key we don't know in advance) rather than returning a bare
  // array — this normalizes whatever shape actually comes back instead of
  // assuming one, and fails with the real shape visible in the error if
  // it's something else entirely, so the next issue (if any) is a one-look
  // fix rather than another guess.
  const raw = downloadRes?.data;
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") {
    const keys = Object.keys(raw);
    if (keys.length === 1 && Array.isArray(raw[keys[0]])) return raw[keys[0]];
    for (const k of keys) if (Array.isArray(raw[k])) return raw[k]; // fallback: first array-valued key
  }
  throw new Error(`Unexpected Zoho export data shape — top-level keys: ${JSON.stringify(Object.keys(downloadRes || {}))}, data keys: ${JSON.stringify(raw && typeof raw === "object" ? Object.keys(raw) : raw)}. Raw (truncated): ${JSON.stringify(downloadRes).slice(0, 600)}`);
}

/**
 * Backward-compatible alias — functions/index.js's syncCipr was written
 * against this name. Keeping it avoids touching that call site just for
 * a rename; new code (syncBudgets) calls exportZohoView directly.
 */
const exportCiprReport = exportZohoView;

module.exports = { exportZohoView, exportCiprReport };
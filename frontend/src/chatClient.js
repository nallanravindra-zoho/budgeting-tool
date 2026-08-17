/**
 * Calls the `chat` and `syncCipr` Cloud Functions via the Functions SDK.
 * httpsCallable automatically attaches the signed-in user's Firebase Auth
 * token — no manual Authorization header, no CORS config.
 */
import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "./firebase.js";

const functions = getFunctions(app);
const chatFn = httpsCallable(functions, "chat");
const syncCiprFn = httpsCallable(functions, "syncCipr");

export async function callChat(message, scenario, mode, context) {
  const result = await chatFn({ message, scenario, mode, context });
  return result.data;
}

/** Manual only — no schedule. Returns { vendorsUpdated, syncedAt }. */
export async function syncCiprNow() {
  const result = await syncCiprFn();
  return result.data;
}

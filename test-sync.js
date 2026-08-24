// test-sync.js
const { initializeApp } = require("firebase/app");
const { getAuth, signInWithEmailAndPassword } = require("firebase/auth");
const { getFunctions, httpsCallable } = require("firebase/functions");

const firebaseConfig = { /* same config as frontend/src/firebase.js */ };
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

(async () => {
  await signInWithEmailAndPassword(auth, "your-approved-email@cyberknight.com", "your-password");
  const functions = getFunctions(app);
  const syncBudgets = httpsCallable(functions, "syncBudgets");
  const result = await syncBudgets();
  console.log(result.data);
})();

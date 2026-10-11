// READ-ONLY copy of the client's live Firestore (the old flat nelly_* collections) into a JSON file.
//   node scripts/dump-client-firestore.mjs <out.json>
// It only calls getDocs: nothing is ever written to the client's project.
import fs from "node:fs";
import path from "node:path";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, terminate } from "firebase/firestore";

// The client's production project (same public web config the old apps ship with).
const CLIENT_CONFIG = {
  apiKey: "AIzaSyBJI5Vfuoj0nDGnrodQ-3Ubs1R1s9dlJu4",
  authDomain: "abodpos-1beee.firebaseapp.com",
  projectId: "abodpos-1beee",
  storageBucket: "abodpos-1beee.firebasestorage.app",
  messagingSenderId: "606982390793",
  appId: "1:606982390793:web:2582990955f1108cf064d8",
};

const COLLECTIONS = [
  "nelly_users", "nelly_shop_products", "nelly_products", "nelly_transfers", "nelly_sales", "nelly_reports",
  "nelly_returns", "nelly_customers", "nelly_suppliers", "nelly_shop_purchases", "nelly_shop_purchase_returns",
  "nelly_employees", "nelly_employee_attendance", "nelly_employee_transactions", "nelly_expense_items",
  "nelly_monthly_expenses", "nelly_treasury_transactions",
];

const out = path.resolve(process.argv[2] || "client-dump.json");
const db = getFirestore(initializeApp(CLIENT_CONFIG, "client-readonly"));
const result = { source: CLIENT_CONFIG.projectId, dumpedAt: new Date().toISOString(), collections: {} };
let failed = false;
for (const name of COLLECTIONS) {
  try {
    const snap = await getDocs(collection(db, name));
    result.collections[name] = snap.docs.map((d) => ({ id: d.id, data: d.data() }));
    console.log(`${name}: ${snap.size}`);
  } catch (e) {
    failed = true;
    console.error(`[ERR] ${name}: ${e.message}`);
  }
}
await terminate(db);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(result));
console.log(`saved -> ${out}`);
process.exit(failed ? 1 : 0);

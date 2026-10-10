// Copies a local Nelly database (e.g. the customer's nelly_desktop.db COPY) into ONE shop's cloud space:
//   node scripts/seed-shop-from-db.mjs <db-file> <shopId> [--apply]
// Without --apply it only prints what it would write (dry run). The source file is opened read-only.
// Needs GOOGLE_APPLICATION_CREDENTIALS (service account of the Firebase project you are testing with).
// Uses Node's built-in sqlite (Node 22.13+), so it works even after better-sqlite3 was rebuilt for Electron.
import { DatabaseSync } from "node:sqlite";
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const [file, shopId, flag] = process.argv.slice(2);
if (!file || !shopId) { console.error("usage: node scripts/seed-shop-from-db.mjs <db-file> <shopId> [--apply]"); process.exit(1); }
const apply = flag === "--apply";

// table -> collection (same map the app's sync uses)
const MAP = {
  shop_products: "nelly_shop_products", products: "nelly_products", transfers: "nelly_transfers", sales: "nelly_sales",
  shift_reports: "nelly_reports", sales_returns: "nelly_returns", customers: "nelly_customers", suppliers: "nelly_suppliers",
  shop_purchases: "nelly_shop_purchases", shop_purchase_returns: "nelly_shop_purchase_returns", employees: "nelly_employees",
  employee_attendance: "nelly_employee_attendance", employee_transactions: "nelly_employee_transactions", expense_items: "nelly_expense_items",
  monthly_expenses: "nelly_monthly_expenses", treasury_transactions: "nelly_treasury_transactions",
};

const src = new DatabaseSync(file, { readOnly: true });
const fromJson = (v) => {
  if (typeof v !== "string" || !/^[\[{]/.test(v)) return v;
  try { return JSON.parse(v); } catch { return v; }
};

if (apply) initializeApp({ credential: applicationDefault() });
const db = apply ? getFirestore() : null;
let total = 0;
for (const [table, col] of Object.entries(MAP)) {
  let rows;
  try { rows = src.prepare(`SELECT * FROM "${table}"`).all(); } catch { continue; }
  console.log(`${col}: ${rows.length}`);
  total += rows.length;
  if (!apply) continue;
  for (let i = 0; i < rows.length; i += 400) {
    const batch = db.batch();
    for (const r of rows.slice(i, i + 400)) {
      const data = Object.fromEntries(Object.entries(r).filter(([, v]) => v !== null && v !== undefined).map(([k, v]) => [k, fromJson(v)]));
      batch.set(db.doc(`shops/${shopId}/${col}/${r.id}`), { ...data, _syncedAt: FieldValue.serverTimestamp() }, { merge: true });
    }
    await batch.commit();
  }
}
console.log(apply ? `done: ${total} documents written under shops/${shopId}` : `dry run: ${total} documents would be written. Add --apply.`);

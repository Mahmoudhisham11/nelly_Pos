// Brings ONE shop of the new Firebase project up to date with a fresh copy of the old app's data
// (client-data/client-copy.db, made by "0- سحب بيانات العميل"). Only documents that are new or changed are written,
// each with a fresh _syncedAt, so every device picks up exactly those changes with its normal incremental sync.
//   node scripts/refresh-shop-from-copy.mjs <client-copy.db> <shopId>                     -> dry run (writes nothing)
//   node scripts/refresh-shop-from-copy.mjs <client-copy.db> <shopId> --apply             -> makes the shop match it
// The old app is the source of truth while the client still works on it: documents it no longer has are removed
// from the shop too (e.g. invoices it moved into a closed day, or a day report another device made for them).
// Add --keep-missing to keep those instead.
// Needs Frontend/serviceAccount.json of the NEW project; refuses the old project.
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const [file, shopId, ...flags] = process.argv.slice(2);
if (!file || !shopId) { console.error("usage: node scripts/refresh-shop-from-copy.mjs <client-copy.db> <shopId> [--apply] [--remove-missing]"); process.exit(1); }
const apply = flags.includes("--apply");
const removeMissing = !flags.includes("--keep-missing");

const key = JSON.parse(fs.readFileSync("serviceAccount.json", "utf8"));
if (key.project_id === "abodpos-1beee") { console.error("refusing: this is the old project"); process.exit(1); }
initializeApp({ credential: cert(key) });
const db = getFirestore();
const shopRef = db.doc(`shops/${shopId}`);
if (!(await shopRef.get()).exists) { console.error(`shops/${shopId} does not exist in ${key.project_id}`); process.exit(1); }

// table -> collection (same map the app's sync uses); users are not copied (accounts live in Firebase Auth)
const MAP = {
  shop_products: "nelly_shop_products", products: "nelly_products", transfers: "nelly_transfers", sales: "nelly_sales",
  shift_reports: "nelly_reports", sales_returns: "nelly_returns", customers: "nelly_customers", suppliers: "nelly_suppliers",
  shop_purchases: "nelly_shop_purchases", shop_purchase_returns: "nelly_shop_purchase_returns", employees: "nelly_employees",
  employee_attendance: "nelly_employee_attendance", employee_transactions: "nelly_employee_transactions", expense_items: "nelly_expense_items",
  monthly_expenses: "nelly_monthly_expenses", treasury_transactions: "nelly_treasury_transactions",
};
const IGNORED = new Set(["_syncedAt", "_deleted", "updatedAt"]);
const fromJson = (v) => {
  if (typeof v !== "string" || !/^[\[{]/.test(v)) return v;
  try { return JSON.parse(v); } catch { return v; }
};
// key order does not matter (Firestore returns map keys sorted)
const stable = (v) => (Array.isArray(v) ? v.map(stable) : v && typeof v === "object"
  ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, stable(v[k])])) : v);
const norm = (v) => JSON.stringify(stable(v ?? null));
const differs = (row, cloud) => Object.entries(row).some(([k, v]) => !IGNORED.has(k) && norm(v) !== norm(cloud[k]));

const src = new DatabaseSync(file, { readOnly: true });
let writes = 0, removals = 0;
const report = [];
for (const [table, col] of Object.entries(MAP)) {
  let rows;
  try { rows = src.prepare(`SELECT * FROM "${table}"`).all(); } catch { continue; }
  const cloudSnap = await shopRef.collection(col).get();
  const cloud = new Map(cloudSnap.docs.map((d) => [d.id, d.data()]));
  const toWrite = [];
  let same = 0;
  const seen = new Set();
  for (const r of rows) {
    // nulls are written too, so a value set in the new project (e.g. a day report link) is cleared when the old app has none
    const data = Object.fromEntries(Object.entries(r).filter(([, v]) => v !== undefined).map(([k, v]) => [k, fromJson(v)]));
    seen.add(String(r.id));
    const c = cloud.get(String(r.id));
    if (!c || c._deleted || differs(data, c)) toWrite.push(data);
    else same++;
  }
  const missing = [...cloud.entries()].filter(([id, d]) => !seen.has(id) && !d._deleted).map(([id]) => id);
  const added = toWrite.filter((d) => !cloud.has(String(d.id))).length;
  report.push({ collection: col, inOldApp: rows.length, new: added, changed: toWrite.length - added, unchanged: same, onlyInNewProject: missing.length });

  if (!apply) continue;
  const ops = [
    ...toWrite.map((d) => (b) => b.set(shopRef.collection(col).doc(String(d.id)), { ...d, _deleted: false, _syncedAt: FieldValue.serverTimestamp() }, { merge: true })),
    ...(removeMissing ? missing.map((id) => (b) => b.set(shopRef.collection(col).doc(id), { _deleted: true, _syncedAt: FieldValue.serverTimestamp(), updatedAt: new Date().toISOString() }, { merge: true })) : []),
  ];
  for (let i = 0; i < ops.length; i += 400) {
    const batch = db.batch();
    ops.slice(i, i + 400).forEach((op) => op(batch));
    await batch.commit();
  }
  writes += toWrite.length;
  if (removeMissing) removals += missing.length;
}
console.table(report);
if (apply) console.log(`done: ${writes} documents written${removeMissing ? `, ${removals} removed` : ""} in shops/${shopId} (${key.project_id})`);
else console.log("dry run only: nothing was written. Add --apply to write the new and changed documents.");
process.exit(0);

// One-time cloud setup of the shop on the app's Firebase project (the one in Frontend/.env.local):
//   1) creates the shop + the owner's cloud login (email/password you type),
//   2) uploads the client's data copy (client-data/client-copy.db) into the shop's cloud space.
//   node scripts/setup-cloud.mjs <client-copy.db>
// Needs Frontend/.env.local and Frontend/serviceAccount.json of the SAME project. Refuses the old project (abodpos-1beee)
// and refuses to upload over a shop that already has sales in the cloud (so it can never overwrite newer data).
import fs from "node:fs";
import readline from "node:readline/promises";
import { spawnSync } from "node:child_process";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const SHOP = "nelly-shop";
const SHOP_NAME = "Nelly";
const DAYS = "365";
const dbFile = process.argv[2];
const fail = (m) => { console.error("\n❌ " + m); process.exit(1); };

if (!dbFile || !fs.existsSync(dbFile)) fail(`ملف بيانات العميل غير موجود: ${dbFile || "(لم يُحدد)"}\nشغّل ملف "0- سحب بيانات العميل" الأول.`);
if (!fs.existsSync(".env.local")) fail("ملف Frontend\\.env.local غير موجود.");
if (!fs.existsSync("serviceAccount.json")) fail("ملف Frontend\\serviceAccount.json غير موجود (Firebase Console > Project settings > Service accounts > Generate new private key).");

const env = Object.fromEntries(fs.readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => /^\w+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
const key = JSON.parse(fs.readFileSync("serviceAccount.json", "utf8"));
const appProject = env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
if (!appProject) fail("NEXT_PUBLIC_FIREBASE_PROJECT_ID فاضي في .env.local");
if (appProject === "abodpos-1beee" || key.project_id === "abodpos-1beee") fail("ده مشروع Firebase القديم بتاع التطبيق القديم (abodpos-1beee). الإعداد بيشتغل على مشروع التطبيق الجديد بس.");
if (key.project_id !== appProject) fail(`مفتاح الـ Service Account لمشروع "${key.project_id}" لكن .env.local لمشروع "${appProject}". لازم يكونوا نفس المشروع.`);

// security rules first: the app (sign-up, members, per-shop data) depends on them
const rules = spawnSync(process.execPath, ["scripts/deploy-rules.mjs"], { stdio: "inherit" });
if (rules.status !== 0) fail("فشل نشر قواعد Firestore.");

initializeApp({ credential: cert(key) });
const db = getFirestore();
const existingSales = (await db.collection(`shops/${SHOP}/nelly_sales`).limit(1).get()).size;
const shopDoc = await db.doc(`shops/${SHOP}`).get();

console.log(`\nمشروع Firebase: ${appProject}`);
const rl = readline.createInterface({ input: process.stdin });
const lines = rl[Symbol.asyncIterator]();
const ask = async (q) => { process.stdout.write(q); const { value } = await lines.next(); return value ?? ""; };

if (!shopDoc.exists) {
  const email = (await ask("إيميل صاحب المحل (هيدخل بيه على الويب والديسكتوب): ")).trim();
  const password = (await ask("كلمة المرور (6 حروف على الأقل): ")).trim();
  if (!email || password.length < 6) { rl.close(); fail("البريد أو كلمة المرور غير صالحين."); }
  rl.close();
  console.log("\n1/2 إنشاء المحل وحساب صاحب المحل...");
  const r = spawnSync(process.execPath, ["scripts/provision-shop.mjs", "create", SHOP, SHOP_NAME, email, password, DAYS],
    { stdio: "inherit", env: { ...process.env, GOOGLE_APPLICATION_CREDENTIALS: "serviceAccount.json" } });
  if (r.status !== 0) fail("فشل إنشاء المحل. لو الإيميل مستخدم قبل كده امسحه من Firebase Console > Authentication وجرب تاني.");
} else {
  rl.close();
  console.log("المحل موجود بالفعل على السحابة: مش هعمل حساب جديد.");
}

if (existingSales > 0) {
  console.log("\nالسحابة فيها مبيعات بالفعل، فمش هرفع نسخة العميل تاني (عشان ماتكتبش على بيانات أحدث).");
} else {
  console.log("\n2/2 رفع بيانات العميل للسحابة...");
  const r = spawnSync(process.execPath, ["scripts/seed-shop-from-db.mjs", dbFile, SHOP, "--apply"],
    { stdio: "inherit", env: { ...process.env, GOOGLE_APPLICATION_CREDENTIALS: "serviceAccount.json" } });
  if (r.status !== 0) fail("فشل رفع البيانات.");
}
console.log(`\n✅ السحابة جاهزة. افتح التطبيق وادخل بإيميل صاحب المحل.`);
process.exit(0);

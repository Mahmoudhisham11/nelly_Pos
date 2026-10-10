// Devora admin tool: create a shop, its login, and (de)activate its subscription. Runs on YOUR machine only.
//   node scripts/provision-shop.mjs create  <shopId> "<shop name>" <owner-email> <temp-password> <days>
//   node scripts/provision-shop.mjs renew   <shopId> <days>     (after you confirm the InstaPay transfer)
//   node scripts/provision-shop.mjs status  <shopId>
// Needs a service-account key: GOOGLE_APPLICATION_CREDENTIALS=C:\path\key.json  (never commit it).
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";

initializeApp({ credential: applicationDefault() });
const db = getFirestore();
const [cmd, shopId, ...rest] = process.argv.slice(2);
const DAY = 86400000;

async function setActive(id, days) {
  const ref = db.doc(`shops/${id}`);
  const cur = (await ref.get()).data()?.activeUntil?.toDate?.();
  const from = cur && cur.getTime() > Date.now() ? cur.getTime() : Date.now(); // renewing early adds on top of the remaining time
  const until = new Date(from + Number(days) * DAY);
  await ref.set({ activeUntil: Timestamp.fromDate(until) }, { merge: true });
  return until;
}

if (cmd === "create") {
  const [name, email, password, days] = rest;
  if (!shopId || !name || !email || !password || !days) throw new Error("usage: create <shopId> <name> <email> <password> <days>");
  const user = await getAuth().createUser({ email, password });
  await db.doc(`shops/${shopId}`).set({ name, plan: "pro", ownerUid: user.uid, ownerEmail: String(email).toLowerCase(), createdAt: FieldValue.serverTimestamp() }, { merge: true });
  await db.doc(`userShops/${user.uid}`).set({ shopId, role: "admin", active: true, email: String(email).toLowerCase(), name, branch: name });
  console.log("until", (await setActive(shopId, days)).toISOString(), "uid", user.uid);
} else if (cmd === "renew") {
  console.log("active until", (await setActive(shopId, rest[0])).toISOString());
} else if (cmd === "status") {
  const d = (await db.doc(`shops/${shopId}`).get()).data();
  console.log(d ? { name: d.name, activeUntil: d.activeUntil?.toDate?.().toISOString() } : "not found");
} else {
  console.log("commands: create | renew | status");
}

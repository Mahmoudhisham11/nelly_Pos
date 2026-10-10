// One-time: copy the OLD flat Firestore collections (nelly_*) into shops/{shopId}/... for the existing client.
//   node scripts/migrate-to-shop.mjs <shopId>            -> DRY RUN (counts only, writes nothing)
//   node scripts/migrate-to-shop.mjs <shopId> --apply    -> copies (never deletes the originals)
// Needs GOOGLE_APPLICATION_CREDENTIALS (service account of the SAME Firebase project).
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";

const [shopId, flag] = process.argv.slice(2);
if (!shopId) { console.error("usage: node scripts/migrate-to-shop.mjs <shopId> [--apply]"); process.exit(1); }
initializeApp({ credential: applicationDefault() });
const db = getFirestore();
const apply = flag === "--apply";

const cols = (await db.listCollections()).map((c) => c.id).filter((id) => id.startsWith("nelly_"));
for (const name of cols) {
  const snap = await db.collection(name).get();
  console.log(`${name}: ${snap.size} docs`);
  if (!apply) continue;
  let batch = db.batch(), n = 0;
  for (const d of snap.docs) {
    batch.set(db.doc(`shops/${shopId}/${name}/${d.id}`), d.data(), { merge: true });
    if (++n % 400 === 0) { await batch.commit(); batch = db.batch(); }
  }
  await batch.commit();
}
console.log(apply ? "copied. Originals left untouched." : "dry run only. Add --apply to copy.");

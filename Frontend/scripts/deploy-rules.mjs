// Publishes ../firestore.rules to the app's Firebase project (the project of Frontend/serviceAccount.json).
//   node scripts/deploy-rules.mjs
// Refuses the old single-shop project (abodpos-1beee): its apps still use the old flat collections.
import fs from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getSecurityRules } from "firebase-admin/security-rules";

const key = JSON.parse(fs.readFileSync("serviceAccount.json", "utf8"));
if (key.project_id === "abodpos-1beee") { console.error("refusing: this is the old project"); process.exit(1); }
initializeApp({ credential: cert(key) });
const source = fs.readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8");
const ruleset = await getSecurityRules().releaseFirestoreRulesetFromSource(source);
console.log(`Firestore rules published to ${key.project_id} (${ruleset.name})`);
process.exit(0);

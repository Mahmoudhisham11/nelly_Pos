// Builds a fresh Nelly SQLite file from a client dump (made by dump-client-firestore.mjs), using the app's own
// schema + /sync/apply-batch logic, so the result is exactly what the app itself would store.
//   node scripts/build-client-db.mjs <client-dump.json> <out.db>
// Uses Node's built-in sqlite, so it works even after better-sqlite3 was rebuilt for Electron.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { DatabaseSync } from "node:sqlite";
import { build } from "esbuild";

const [dumpFile, outArg] = process.argv.slice(2);
if (!dumpFile || !outArg) { console.error("usage: node scripts/build-client-db.mjs <client-dump.json> <out.db>"); process.exit(1); }
const parsed = JSON.parse(fs.readFileSync(dumpFile, "utf8"));
// Also accepts the old dump_firestore.mjs format: { collection: [{ id, ...fields }] }
const dump = parsed.collections ? parsed : {
  collections: Object.fromEntries(Object.entries(parsed).map(([c, list]) => [c, list.map(({ id, ...data }) => ({ id, data }))])),
};
const out = path.resolve(outArg);

// Bundle the bits of @nelly/core we need into a temp CommonJS module.
const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "nelly-core-")), "core.cjs");
await build({
  stdin: { contents: `export { runMigrations } from "@nelly/core"; export { applyItems } from "@nelly/core/src/api/sync";`, resolveDir: process.cwd() },
  bundle: true, platform: "node", target: "node22", format: "cjs", outfile: tmp, logLevel: "error",
  external: ["better-sqlite3"],
});
const { runMigrations, applyItems } = createRequire(import.meta.url)(tmp);

for (const f of [out, out + "-wal", out + "-shm"]) fs.rmSync(f, { force: true });
fs.mkdirSync(path.dirname(out), { recursive: true });
const raw = new DatabaseSync(out);
raw.exec("PRAGMA foreign_keys = ON");
let depth = 0;
const db = {
  exec: (sql) => void raw.exec(sql),
  run: (sql, params = []) => ({ changes: Number(raw.prepare(sql).run(...params).changes) }),
  get: (sql, params = []) => raw.prepare(sql).get(...params),
  all: (sql, params = []) => raw.prepare(sql).all(...params),
  transaction(fn) {
    if (depth > 0) return fn();
    depth++;
    raw.exec("BEGIN");
    try { const r = fn(); raw.exec("COMMIT"); return r; } catch (e) { raw.exec("ROLLBACK"); throw e; } finally { depth--; }
  },
};

runMigrations(db, new Date());
// Users first, then catalog, then the documents that reference them.
const order = Object.keys(dump.collections);
let failed = 0;
for (const name of order) {
  const items = dump.collections[name].map((d) => ({ collectionName: name, docId: d.id, action: "SET", data: { id: d.id, ...d.data } }));
  const r = db.transaction(() => applyItems(db, items));
  failed += r.failedCount;
  console.log(`${name}: ${r.appliedCount}/${items.length}${r.failedCount ? `  (failed ${r.failedCount}: ${r.failed[0]?.error})` : ""}`);
}
// The copy starts with an empty outbox: nothing here is "pending upload".
try { db.run(`DELETE FROM sync_queue`); } catch {}
raw.close();
fs.rmSync(path.dirname(tmp), { recursive: true, force: true });
console.log(`saved -> ${out}${failed ? `  (${failed} documents could not be stored)` : ""}`);

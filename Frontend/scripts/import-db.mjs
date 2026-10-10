// Imports an existing legacy database (nelly_desktop.db) into Nelly_project.
//   node scripts/import-db.mjs <source.db> [target.db]
// Default target = Frontend/data/nelly.db (web/local run). For the Electron app pass
// %APPDATA%\<app>\data\nelly.db. The source is only READ (WAL is folded into a consistent copy);
// an existing target is backed up first. The schema upgrade runs automatically on first start.
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const [src, dstArg] = process.argv.slice(2);
if (!src) { console.error("usage: node scripts/import-db.mjs <source.db> [target.db]"); process.exit(1); }
if (!fs.existsSync(src)) { console.error("source not found:", src); process.exit(1); }
const dst = path.resolve(dstArg || path.join(process.cwd(), "data", "nelly.db"));
fs.mkdirSync(path.dirname(dst), { recursive: true });
if (fs.existsSync(dst)) {
  const bak = `${dst}.bak-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  fs.copyFileSync(dst, bak);
  console.log("existing target backed up to", bak);
  for (const ext of ["-wal", "-shm"]) fs.rmSync(dst + ext, { force: true });
  fs.rmSync(dst);
}
const db = new Database(src, { readonly: true, fileMustExist: true });
await db.backup(dst);
db.close();
const check = new Database(dst, { readonly: true });
const tables = check.prepare("select name from sqlite_master where type='table' and name not like 'sqlite_%'").all();
const counts = Object.fromEntries(["products", "sales", "customers", "suppliers", "employees"].filter((t) => tables.some((x) => x.name === t)).map((t) => [t, check.prepare(`select count(*) c from "${t}"`).get().c]));
check.close();
console.log("imported ->", dst, counts);

// Copies the SQLite WASM runtime to public/sqlite so the web worker loads it as static files (no bundling).
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
const require = createRequire(import.meta.url);
const dist = path.dirname(require.resolve("@sqlite.org/sqlite-wasm/package.json")) + "/dist";
fs.rmSync("public/sqlite", { recursive: true, force: true });
fs.rmSync("public/sqlite3.wasm", { force: true });
fs.mkdirSync("public/sqlite", { recursive: true });
for (const f of fs.readdirSync(dist)) if (/\.(mjs|js|wasm)$/.test(f)) fs.copyFileSync(path.join(dist, f), path.join("public/sqlite", f));
console.log("public/sqlite ready");

// Builds the Windows installer (Setup.exe) from a clean staging folder that holds ONLY what the installed app runs:
// the bundled main process, preload, backend bundle, native SQLite and the static UI. (Packaging the workspace
// itself would drag in every web dependency and trips over the @devora/pos-core workspace link.)
//   node scripts/package-desktop.mjs            -> release/  (local test build)
//   node scripts/package-desktop.mjs --publish  -> also uploads the release to GitHub (needs GH_TOKEN), for auto-update
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const publish = process.argv.includes("--publish");
const root = process.cwd();
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const stage = path.join(root, "dist-app");

const need = ["electron/main.bundle.cjs", "electron/preload.js", "electron/backend.cjs", "electron/native/better-sqlite3", "out/index.html", "public/icon.ico"];
for (const f of need) if (!fs.existsSync(f)) { console.error(`missing ${f}: run the desktop build first`); process.exit(1); }

fs.rmSync(stage, { recursive: true, force: true });
fs.mkdirSync(path.join(stage, "electron"), { recursive: true });
for (const f of ["main.bundle.cjs", "preload.js", "backend.cjs"]) fs.copyFileSync(path.join("electron", f), path.join(stage, "electron", f));
fs.cpSync("electron/native", path.join(stage, "electron", "native"), { recursive: true });
fs.cpSync("out", path.join(stage, "out"), { recursive: true });
fs.mkdirSync(path.join(stage, "public"), { recursive: true });
fs.copyFileSync("public/icon.ico", path.join(stage, "public", "icon.ico"));

const build = { ...pkg.build, directories: { output: path.join(root, "release") }, files: ["**/*"] };
delete build.extraMetadata;
fs.writeFileSync(path.join(stage, "package.json"), JSON.stringify({
  name: "nelly-pos",
  productName: pkg.productName,
  version: pkg.version,
  description: "Nelly POS — Devora",
  author: pkg.author || "Devora",
  main: "electron/main.bundle.cjs",
  build,
}, null, 2));

const bin = path.join(root, "..", "node_modules", "electron-builder", "cli.js");
const r = spawnSync(process.execPath, [bin, "--win", "--publish", publish ? "always" : "never"], { cwd: stage, stdio: "inherit", env: process.env });
process.exit(r.status ?? 1);

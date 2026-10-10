// Gives the Electron app its OWN copy of better-sqlite3 built for Electron's Node ABI (electron/native/better-sqlite3),
// so the regular Node copy (web server mode, tests, scripts) is never touched and the two never conflict.
// Downloads the prebuilt binary (no compiler needed). Safe to run repeatedly.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";

const require = createRequire(import.meta.url);
const electronVersion = require("electron/package.json").version;
const srcDir = path.dirname(require.resolve("better-sqlite3/package.json"));
const dest = path.resolve("electron", "native", "better-sqlite3");
const marker = path.join(dest, ".electron-target");
const want = `${electronVersion}-${process.platform}-${process.arch}`;

if (fs.existsSync(marker) && fs.readFileSync(marker, "utf8") === want && fs.existsSync(path.join(dest, "build", "Release", "better_sqlite3.node"))) {
  console.log(`better-sqlite3 for Electron ${electronVersion} already prepared`);
  process.exit(0);
}

fs.rmSync(dest, { recursive: true, force: true });
fs.mkdirSync(dest, { recursive: true });
fs.copyFileSync(path.join(srcDir, "package.json"), path.join(dest, "package.json"));
fs.cpSync(path.join(srcDir, "lib"), path.join(dest, "lib"), { recursive: true });

console.log(`Downloading better-sqlite3 build for Electron ${electronVersion} (${process.platform}-${process.arch})...`);
const bin = require.resolve("prebuild-install/bin.js");
const r = spawnSync(process.execPath, [bin, "--runtime=electron", `--target=${electronVersion}`, `--platform=${process.platform}`, `--arch=${process.arch}`], { cwd: dest, stdio: "inherit" });
if (r.status !== 0 || !fs.existsSync(path.join(dest, "build", "Release", "better_sqlite3.node"))) {
  console.error("\nتعذر تنزيل ملف SQLite الخاص بـ Electron. تأكد من الاتصال بالإنترنت ثم أعد المحاولة.");
  process.exit(1);
}
fs.writeFileSync(marker, want);
console.log("ready.");

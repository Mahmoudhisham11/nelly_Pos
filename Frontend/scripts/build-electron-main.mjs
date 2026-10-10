// Bundles Electron's main process (electron/main.js + its helpers + electron-updater) into ONE file for the installer,
// so the packaged app ships no node_modules at all. The backend bundle and the native SQLite module stay separate files.
import { build } from "esbuild";

await build({
  entryPoints: ["electron/main.js"],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  outfile: "electron/main.bundle.cjs",
  external: ["electron", "./backend.cjs", "./native/*"],
  logLevel: "warning",
});
console.log("electron/main.bundle.cjs written");

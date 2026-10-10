// Bundles Backend/ (TypeScript) into one CommonJS file Electron's main process can require. better-sqlite3 stays external.
import { build } from "esbuild";

await build({
  stdin: {
    contents: `export { createBackend, configure, settings } from "@nelly/core"; export { openBetterSqlite } from "@nelly/core/src/db/betterSqlite";`,
    resolveDir: process.cwd(),
  },
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  outfile: "electron/backend.cjs",
  // Electron loads its own copy of better-sqlite3 (built for Electron's ABI): see scripts/prepare-electron.mjs
  plugins: [{ name: "native-sqlite", setup(b) { b.onResolve({ filter: /^better-sqlite3$/ }, () => ({ path: "./native/better-sqlite3", external: true })); } }],
});
console.log("electron/backend.cjs written");

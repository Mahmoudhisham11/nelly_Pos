// Web/PWA build (Vercel): the backend runs inside the browser (Web Worker + SQLite WASM + OPFS).
//   node scripts/build-web.mjs [build|dev|start]   (default: build)
import { spawnSync } from "node:child_process";
await import("./copy-wasm.mjs");
const mode = process.argv[2] || "build";
const r = spawnSync("npx", ["next", mode], { stdio: "inherit", shell: true, env: { ...process.env, NEXT_PUBLIC_NELLY_BACKEND: "browser" } });
process.exit(r.status ?? 1);

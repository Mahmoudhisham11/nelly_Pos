// Static export for Electron: the /api/rpc bridge needs a server, so it is moved aside for the duration of the build.
import { renameSync, existsSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";

const api = "app/api", parked = "app/_api_parked";
if (existsSync(api)) renameSync(api, parked);
try {
  const r = spawnSync("npx", ["next", "build"], { stdio: "inherit", shell: true, env: { ...process.env, NELLY_TARGET: "desktop" } });
  process.exitCode = r.status ?? 1;
  // With output:"export", Next writes the site into distDir (.next-desktop, kept apart from the web build's .next). Electron loads ./out.
  if (r.status === 0 && existsSync(".next-desktop")) { rmSync("out", { recursive: true, force: true }); renameSync(".next-desktop", "out"); }
} finally {
  if (existsSync(parked)) renameSync(parked, api);
}

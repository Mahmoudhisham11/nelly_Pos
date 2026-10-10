/**
 * One codebase, two builds:
 *  - web / local:  `next build` / `next dev`          (the /api/rpc bridge talks to the SQLite file)
 *  - desktop:      `npm run build:desktop`            (static export loaded by Electron, backend lives in Electron's main process)
 */
const desktop = process.env.NELLY_TARGET === "desktop";

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(desktop ? { output: "export", distDir: ".next-desktop" } : {}), // own build folder so the desktop build never overwrites a running web build (.next)
  trailingSlash: true,
  reactCompiler: true,
  turbopack: {},
  images: { unoptimized: true },
  transpilePackages: ["@nelly/core"],
  serverExternalPackages: ["better-sqlite3", "firebase-admin"],
};

export default nextConfig;

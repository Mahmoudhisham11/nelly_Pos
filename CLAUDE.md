# Project notes for Claude Code

- This repo is the **Nelly** app (makeup shops): `Frontend/` = Next.js UI + Electron shell. Web build on Vercel,
  desktop installer published as GitHub releases of this repo (auto-update).
- The backend is NOT here: it is `@devora/pos-core`, a brand-neutral POS backend in its own repo
  (https://github.com/Mahmoudhisham11/pos-core), installed by tag in `Frontend/package.json`
  (`github:Mahmoudhisham11/pos-core#vX.Y.Z`). Backend changes go to that repo, get a new tag, then the tag is bumped here.
- Nelly's backend settings live in `Frontend/core.config.json` and are passed to `configure()` (electron/main.js,
  lib/webBackend.worker.js, app/api/rpc/route.js, scripts/build-client-db.mjs). `COLLECTION_PREFIX: "nelly_"` must stay:
  it is the name of the live Firestore collections.
- Import only `@devora/pos-core` and `@devora/pos-core/node` (better-sqlite3); never `.../src/...`.
  Cloud collection names come from `GET /app-info` (lib/syncManager.js), never hard-coded here.
- Releases: bump `version` in Frontend/package.json, then `npm run release -w Frontend` (needs GH_TOKEN).
- Checks: `npm run lint`, `npm run build`.

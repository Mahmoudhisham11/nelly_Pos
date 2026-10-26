# Project notes for Claude Code

- `Backend/` is `@devora/pos-core`: a **brand-neutral** POS backend shared by several frontends (Nelly = makeup shops,
  more coming, e.g. clothing). Never hard-code an app/brand name in `Backend/`; anything app-specific goes in
  `settings` (`Backend/src/core/config.ts`) and each frontend sets it with `configure()`.
  Nelly's values live in `Frontend/core.config.json` (`COLLECTION_PREFIX: "nelly_"` must stay: it is the name of the
  live Firestore collections).
- Variants (size / colour ...): every variant is a full product row; variants of a model share `groupId`
  (`groupName`, `variantLabel`, `attributes`). Logic in `Backend/src/domain/variants.ts`, routes in
  `Backend/src/api/productGroups.ts`. Full spec: `docs/BACKEND_CORE.md`.
- Schema changes: add the column to the DDL **and** `TABLE_COLUMNS` in `db/schema.ts`, and a new numbered step in
  `db/migrations.ts` (existing databases are only upgraded by migrations). Writes to synced tables must go through
  `insertRow` / `updateRow` / `deleteRow` (they fill the sync outbox).
- Frontends import only `@devora/pos-core` and `@devora/pos-core/node` (better-sqlite3); never `.../src/...`.
  Payment methods, currency and default customer come from `settings` via `core/payments.ts`: never write
  "نقدي" / "آجل" / "EGP" in the core. Cloud collection names come from `GET /app-info`, never hard-coded in a frontend.
- Checks: `npm run typecheck` and `npm test` (vitest, `Backend/test/`).

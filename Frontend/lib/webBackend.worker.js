// Web Worker: runs the POS backend (@devora/pos-core) on SQLite WASM persisted in the browser's private file system (OPFS).
// The page talks to it through lib/webBackendClient.js. Only one tab may own the database at a time (Web Lock).
// One database per shop ("/shop-<shopId>.db"), like the desktop app: an account of another shop opens its own,
// separate database. "/nelly.db" is the database of the single-shop versions; the first cloud account that is a user
// inside it takes it over.
import { createBackend, configure, wrapWasmSqlite } from "@devora/pos-core";
import coreConfig from "../core.config.json";

const LEGACY = "/nelly.db";
const fileOf = (shopId) => `/shop-${shopId}.db`;
const validShopId = (id) => typeof id === "string" && /^[\w-]{1,128}$/.test(id);

let backend = null;
let sqlite3Api = null;
let rawDb = null;
let poolApi = null;
let starting = null;
let current = { file: null, shopId: null, stopScheduler: null };

function boundShopOf(db) {
  try {
    return db.selectValue(`SELECT value FROM app_meta WHERE key='shopId'`) || null;
  } catch {
    return null; // not migrated yet / no table
  }
}

function closeDb() {
  if (current.stopScheduler) { try { current.stopScheduler(); } catch {} }
  if (rawDb) { try { rawDb.close(); } catch {} }
  rawDb = null;
  backend = null;
  current = { file: null, shopId: null, stopScheduler: null };
}

function openDb(file) {
  let db;
  if (poolApi) {
    db = new poolApi.OpfsSAHPoolDb(file);
  } else {
    db = new sqlite3Api.oo1.DB(":memory:"); // no OPFS: temporary database
  }
  db.exec("PRAGMA foreign_keys = ON");
  rawDb = db;
  backend = createBackend(wrapWasmSqlite(db));
  current = { file, shopId: boundShopOf(db), stopScheduler: backend.startScheduler() };
}

async function boot({ secret, lastShop, projectId }) {
  configure(coreConfig); // Nelly's branding for the brand-neutral core (collection names, default brand...)
  if (secret) configure({ SECRET_KEY: secret });
  if (projectId) configure({ FIREBASE_PROJECT_ID: projectId });
  // The library is served as static files from /sqlite (see scripts/copy-wasm.mjs) instead of being bundled.
  const { default: sqlite3InitModule } = await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ "/sqlite/index.mjs");
  const sqlite3 = await sqlite3InitModule({ locateFile: (f) => `/sqlite/${f}` });
  sqlite3Api = sqlite3;
  let persistent = false;
  try {
    poolApi = await sqlite3.installOpfsSAHPoolVfs({ name: "nelly-opfs", clearOnInit: false, initialCapacity: 12 });
    persistent = true;
  } catch (e) {
    console.warn("OPFS unavailable, using a temporary in-memory database:", e);
  }
  const files = poolApi ? poolApi.getFileNames() : [];
  openDb(validShopId(lastShop) && files.includes(fileOf(lastShop)) ? fileOf(lastShop) : LEGACY);
  return { persistent, shopId: current.shopId };
}

function legacyHasUser(email) {
  if (!email || !poolApi || !poolApi.getFileNames().includes(LEGACY)) return false;
  const peek = (db) => {
    try { return !!db.selectValue(`SELECT 1 FROM users WHERE lower(email)=? LIMIT 1`, [String(email).toLowerCase()]); } catch { return false; }
  };
  if (current.file === LEGACY && rawDb) return peek(rawDb);
  const db = new poolApi.OpfsSAHPoolDb(LEGACY);
  try { return peek(db); } finally { db.close(); }
}

async function openShop({ shopId, email }) {
  if (!validShopId(shopId)) throw new Error("invalid shop");
  const target = fileOf(shopId);
  if (current.file !== target) {
    if (poolApi && !poolApi.getFileNames().includes(target)) {
      // take over the single-shop database when it is still unclaimed and this account is one of its users
      const legacyBound = current.file === LEGACY ? current.shopId : null;
      if (!legacyBound && legacyHasUser(email)) {
        closeDb();
        const bytes = poolApi.exportFile(LEGACY);
        await poolApi.reserveMinimumCapacity(poolApi.getFileCount() + 4);
        await poolApi.importDb(target, bytes);
        poolApi.unlink(LEGACY);
      }
      await poolApi.reserveMinimumCapacity(poolApi.getFileCount() + 4);
    }
    closeDb();
    openDb(target);
  }
  if (current.shopId && current.shopId !== shopId) throw new Error("database belongs to another shop");
  return { shopId };
}

async function acquireLockThenBoot(init) {
  if (!("locks" in navigator)) return boot(init);
  return new Promise((resolve, reject) => {
    navigator.locks
      .request("nelly-db", { ifAvailable: true }, (lock) => {
        if (!lock) {
          reject(new Error("TAB_LOCKED"));
          return undefined;
        }
        boot(init).then(resolve, reject);
        return new Promise(() => {}); // hold the lock for the lifetime of the worker
      })
      .catch(reject);
  });
}

function exportBytes() {
  rawDb.exec("PRAGMA wal_checkpoint(TRUNCATE)");
  return new Uint8Array(sqlite3Api.capi.sqlite3_js_db_export(rawDb));
}

// Requests are handled one at a time, so a database switch never happens in the middle of a request.
let queue = Promise.resolve();
self.onmessage = (ev) => {
  queue = queue.then(() => handle(ev)).catch(() => {});
};

async function handle(ev) {
  const { id, type } = ev.data;
  try {
    if (type === "init") {
      starting = starting || acquireLockThenBoot(ev.data);
      self.postMessage({ id, ok: true, result: await starting });
    } else if (type === "openShop") {
      await starting;
      self.postMessage({ id, ok: true, result: await openShop(ev.data) });
    } else if (type === "request") {
      if (!backend) throw new Error("backend not started");
      if (ev.data.request?.path === "/__export") {
        self.postMessage({ id, ok: true, result: exportBytes() });
        return;
      }
      self.postMessage({ id, ok: true, result: await backend.handle(ev.data.request) });
    }
  } catch (e) {
    self.postMessage({ id, ok: false, error: e?.message || String(e) });
  }
}

const { app, BrowserWindow, shell, ipcMain, Menu } = require("electron");
const path = require("path");
const fs = require("fs");
const { startStaticServer } = require("./staticServer");
const backups = require("./backup");
const openrouter = require("../lib/openrouter.cjs");

// The shop's data lives in %APPDATA%\Nelly (NELLY_USER_DATA overrides it, e.g. for a separate test profile).
app.setPath("userData", process.env.NELLY_USER_DATA ? path.resolve(process.env.NELLY_USER_DATA) : path.join(app.getPath("appData"), "Nelly"));

const isDev = process.env.NODE_ENV === "development";
let mainWindow = null;
let staticServerInstance = null;
let backend = null;
let dataDir = null;

process.on("uncaughtException", (err) => console.error("[Electron Uncaught Exception]", err));
process.on("unhandledRejection", (reason) => console.error("[Electron Unhandled Rejection]", reason));

/*
 * The Nelly backend (bundled from Backend/ by scripts/build-electron-backend.mjs) on real SQLite files in the profile.
 * ONE database per shop: <userData>/shops/<shopId>/nelly.db. A database belongs to exactly one shop (app_meta.shopId),
 * so logging in with another shop's account opens that shop's own database and never shows the previous shop's data.
 * <userData>/data/nelly.db is the database of the single-shop versions (and of a device that has no cloud login yet);
 * the first cloud account that is a user inside it takes it over as its shop's database.
 */
const core = () => require("./backend.cjs");
let current = { dir: null, shopId: null, driver: null, stopScheduler: null };
let backupTimer = null;

const userDataPath = (...p) => path.join(app.getPath("userData"), ...p);
const LEGACY_DIR = () => userDataPath("data");
const shopDir = (shopId) => userDataPath("shops", shopId);
const validShopId = (id) => typeof id === "string" && /^[\w-]{1,128}$/.test(id);

function readRegistry() {
  try { return JSON.parse(fs.readFileSync(userDataPath("accounts.json"), "utf8")); } catch (_) { return { lastShop: null, accounts: {} }; }
}
function writeRegistry(reg) {
  fs.writeFileSync(userDataPath("accounts.json"), JSON.stringify(reg, null, 2));
}

/** One install-wide token secret (kept from the single-shop versions when there is one). */
function loadSecret() {
  const crypto = require("crypto");
  const keyFile = userDataPath("secret.key");
  for (const f of [keyFile, path.join(LEGACY_DIR(), "secret.key")]) {
    try {
      const s = fs.readFileSync(f, "utf8").trim();
      if (s) { if (f !== keyFile) fs.writeFileSync(keyFile, s, { mode: 0o600 }); return s; }
    } catch (_) {}
  }
  const s = crypto.randomBytes(32).toString("hex");
  fs.writeFileSync(keyFile, s, { mode: 0o600 });
  return s;
}

/** Firebase project of this build (from Frontend/.env.local when running from source, or set by the renderer). */
function firebaseProjectFromEnv() {
  if (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) return process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  try {
    const m = fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8").match(/^\s*NEXT_PUBLIC_FIREBASE_PROJECT_ID\s*=\s*(\S+)/m);
    return m ? m[1] : "";
  } catch (_) { return ""; }
}

function closeDb() {
  if (current.stopScheduler) { try { current.stopScheduler(); } catch (_) {} }
  if (current.driver) { try { current.driver.exec("PRAGMA wal_checkpoint(TRUNCATE)"); current.driver.close(); } catch (_) {} }
  current = { dir: null, shopId: null, driver: null, stopScheduler: null };
  backend = null;
  dataDir = null;
}

function openDb(dir) {
  const { createBackend, openBetterSqlite } = core();
  fs.mkdirSync(dir, { recursive: true });
  backups.applyPendingRestore(dir); // a restore chosen in Settings takes effect here, before the DB is opened
  const driver = openBetterSqlite(path.join(dir, "nelly.db"));
  backend = createBackend(driver);
  dataDir = dir;
  let shopId = null;
  try { shopId = driver.get(`SELECT value FROM app_meta WHERE key='shopId'`)?.value || null; } catch (_) {}
  current = { dir, shopId, driver, stopScheduler: backend.startScheduler() };
  autoBackup();
}

// Daily safety copy of the open database: one at opening if today has none, then re-checked every 3 hours.
function autoBackup() {
  try { if (backend && dataDir && !backups.hasBackupToday(dataDir)) backups.create({ dataDir, db: backend.db, label: "auto" }); }
  catch (e) { console.error("[Backup] failed:", e); }
}

function startBackend() {
  const { configure } = core();
  fs.mkdirSync(app.getPath("userData"), { recursive: true });
  configure({ SECRET_KEY: loadSecret(), FIREBASE_PROJECT_ID: firebaseProjectFromEnv() });
  // First run of an install that was given the client's data copy: it becomes the starting (unclaimed) database.
  const seed = process.env.NELLY_SEED_DB;
  const legacyFile = path.join(LEGACY_DIR(), "nelly.db");
  if (seed && fs.existsSync(seed) && !fs.existsSync(legacyFile) && !readRegistry().lastShop) {
    fs.mkdirSync(LEGACY_DIR(), { recursive: true });
    fs.copyFileSync(seed, legacyFile);
  }
  const reg = readRegistry();
  const last = validShopId(reg.lastShop) && fs.existsSync(path.join(shopDir(reg.lastShop), "nelly.db")) ? shopDir(reg.lastShop) : LEGACY_DIR();
  openDb(last);
  backupTimer = setInterval(autoBackup, 3 * 3600 * 1000);
  backupTimer.unref();
}

/** Does this SQLite file have a user with that e-mail (read-only peek, used before taking over the legacy DB)? */
function dbHasUser(file, email) {
  if (!email || !fs.existsSync(file)) return false;
  try {
    const Database = require("./native/better-sqlite3");
    const db = new Database(file, { readonly: true, fileMustExist: true });
    try { return !!db.prepare(`SELECT 1 FROM users WHERE lower(email)=? LIMIT 1`).get(String(email).toLowerCase()); }
    finally { db.close(); }
  } catch (_) { return false; }
}

/** Opens (creating or taking over when needed) the database of `shopId`, and remembers it for the next start. */
function openShop({ shopId, email }) {
  if (!validShopId(shopId)) throw new Error("invalid shop");
  const reg = readRegistry();
  const target = shopDir(shopId);
  const targetFile = path.join(target, "nelly.db");
  if (!(current.dir === target)) {
    if (!fs.existsSync(targetFile)) {
      // take over the single-shop database when it is still unclaimed and this account is one of its users
      const legacyFile = path.join(LEGACY_DIR(), "nelly.db");
      const legacyOpen = current.dir === LEGACY_DIR();
      const legacyBound = legacyOpen ? current.shopId : null;
      if (fs.existsSync(legacyFile) && !legacyBound && dbHasUser(legacyFile, email)) {
        if (legacyOpen) closeDb();
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.renameSync(LEGACY_DIR(), target);
      }
    }
    closeDb();
    openDb(target);
  }
  if (current.shopId && current.shopId !== shopId) throw new Error("database belongs to another shop");
  reg.lastShop = shopId;
  if (email) reg.accounts = { ...(reg.accounts || {}), [String(email).toLowerCase()]: shopId };
  writeRegistry(reg);
  return { shopId };
}

function getStaticDir() {
  const candidates = [path.join(process.resourcesPath || "", "out"), path.join(__dirname, "..", "out")];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, "index.html"))) return dir;
  }
  return candidates[1];
}

async function createWindow() {
  if (!isDev) Menu.setApplicationMenu(null);

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    backgroundColor: "#0a0a0f",
    webPreferences: { preload: path.join(__dirname, "preload.js"), nodeIntegration: false, contextIsolation: true, sandbox: false },
    icon: path.join(__dirname, "../public/icon.ico"),
    title: "مخزن Nelly",
    show: false,
    autoHideMenuBar: !isDev,
  });

  if (isDev) mainWindow.webContents.openDevTools({ mode: "detach" });
  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  let targetUrl = "http://localhost:3000";
  if (!isDev) {
    try {
      const info = await startStaticServer(getStaticDir());
      staticServerInstance = info.server;
      targetUrl = info.url;
    } catch (err) {
      console.error("[Electron] Failed to start static server:", err);
    }
  }

  const loadApp = async (retries = 30) => {
    try {
      await mainWindow.loadURL(targetUrl);
    } catch (err) {
      if (retries > 0) setTimeout(() => loadApp(retries - 1), 500);
      else console.error("[Electron] Failed to load application URL:", err);
    }
  };
  loadApp();
}

app.whenReady().then(() => {
  startBackend();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

function cleanup() {
  if (staticServerInstance) {
    try { staticServerInstance.close(); } catch (_) {}
    staticServerInstance = null;
  }
}
app.on("before-quit", cleanup);
app.on("will-quit", cleanup);
app.on("window-all-closed", () => {
  cleanup();
  if (process.platform !== "darwin") app.quit();
});

ipcMain.handle("nelly:request", (_e, req) => {
  if (!backend) return { status: 503, body: { message: "قاعدة البيانات غير مفتوحة" } };
  return backend.handle(req);
});
ipcMain.handle("nelly:open-shop", (_e, arg) => openShop(arg || {}));
ipcMain.handle("nelly:shop-for-email", (_e, email) => readRegistry().accounts?.[String(email || "").toLowerCase()] || null);
ipcMain.handle("nelly:configure-cloud", (_e, projectId) => {
  // only fills a missing value (a build without .env.local); never switches an already configured project
  const { configure, settings } = core();
  if (!settings.FIREBASE_PROJECT_ID && typeof projectId === "string" && /^[\w-]{1,64}$/.test(projectId)) configure({ FIREBASE_PROJECT_ID: projectId });
  return true;
});
ipcMain.handle("nelly:backup-now", () => path.basename(backups.create({ dataDir, db: backend.db, label: "manual" })));
ipcMain.handle("nelly:backup-list", () => backups.list(dataDir));
ipcMain.handle("nelly:backup-restore", (_e, name) => {
  backups.stageRestore(dataDir, String(name));
  app.relaunch();
  app.exit(0);
});
ipcMain.handle("nelly:backup-open-folder", () => shell.openPath(path.join(dataDir, "backups")));
// Assistant (OpenRouter). The key never reaches the renderer: it comes from OPENROUTER_API_KEY, Frontend/.env.local
// (running from source) or <userData>/ai.env (installed copy). Format of both files: OPENROUTER_API_KEY=... / AI_MODEL=...
function aiConfig() {
  const cfg = { key: process.env.OPENROUTER_API_KEY || "", model: process.env.AI_MODEL || "" };
  for (const file of [path.join(__dirname, "..", ".env.local"), path.join(app.getPath("userData"), "ai.env")]) {
    let text = "";
    try { text = fs.readFileSync(file, "utf8"); } catch (_) { continue; }
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*(OPENROUTER_API_KEY|AI_MODEL)\s*=\s*(.*?)\s*$/);
      if (!m || !m[2]) continue;
      if (m[1] === "OPENROUTER_API_KEY" && !cfg.key) cfg.key = m[2];
      if (m[1] === "AI_MODEL" && !cfg.model) cfg.model = m[2];
    }
  }
  return cfg;
}
ipcMain.handle("nelly:ai-turn", async (_e, req) => {
  const { key, model } = aiConfig();
  if (!key) return { error: "المساعد غير مفعّل: ضيف OPENROUTER_API_KEY في ملف Frontend\\.env.local." };
  try {
    return await openrouter.openRouterTurn({ apiKey: key, model, system: req.system, tools: req.tools, messages: req.messages });
  } catch (e) {
    console.error("[AI] failed:", e?.status, e?.message);
    if (e?.status === 401) return { error: "مفتاح الـ AI غير صحيح (OPENROUTER_API_KEY)." };
    if (e?.status === 429) return { error: "الموديل المجاني مشغول حالياً، جرّب بعد دقيقة." };
    return { error: "تعذر الاتصال بالمساعد. تأكد من الإنترنت." };
  }
});
ipcMain.handle("app:version", () => app.getVersion());
ipcMain.handle("app:platform", () => process.platform);

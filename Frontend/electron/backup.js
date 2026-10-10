// Automatic + manual backups of the SQLite file (userData/backups). Restores are staged and applied at the next start,
// before the database is opened, so a running connection never gets its file swapped underneath it.
const fs = require("fs");
const path = require("path");

const KEEP = 14; // newest automatic backups kept
const pad = (n) => String(n).padStart(2, "0");
const stamp = (d = new Date()) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;

function create({ dataDir, db, label = "auto" }) {
  const dir = path.join(dataDir, "backups");
  fs.mkdirSync(dir, { recursive: true });
  // Fold the WAL into the main file so the copy is complete and consistent.
  try { db.exec("PRAGMA wal_checkpoint(TRUNCATE)"); } catch (_) {}
  const file = path.join(dir, `nelly-${label}-${stamp()}.db`);
  fs.copyFileSync(path.join(dataDir, "nelly.db"), file);
  prune(dir);
  return file;
}

function prune(dir) {
  const autos = fs.readdirSync(dir).filter((f) => /^nelly-auto-.*\.db$/.test(f)).sort();
  for (const f of autos.slice(0, Math.max(0, autos.length - KEEP))) fs.rmSync(path.join(dir, f), { force: true });
}

function list(dataDir) {
  const dir = path.join(dataDir, "backups");
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith(".db")).map((f) => {
    const st = fs.statSync(path.join(dir, f));
    return { name: f, size: st.size, mtime: st.mtimeMs };
  }).sort((a, b) => b.mtime - a.mtime);
}

/** Stage a restore: the chosen backup replaces nelly.db on the next start (the current DB is kept as a pre-restore backup). */
function stageRestore(dataDir, name) {
  if (!/^[\w.-]+\.db$/.test(name)) throw new Error("invalid backup name");
  const src = path.join(dataDir, "backups", name);
  if (!fs.existsSync(src)) throw new Error("backup not found");
  fs.copyFileSync(src, path.join(dataDir, "restore.pending"));
}

/** Call BEFORE opening the database. */
function applyPendingRestore(dataDir) {
  const pending = path.join(dataDir, "restore.pending");
  if (!fs.existsSync(pending)) return false;
  const dbFile = path.join(dataDir, "nelly.db");
  if (fs.existsSync(dbFile)) {
    const dir = path.join(dataDir, "backups");
    fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(dbFile, path.join(dir, `nelly-pre-restore-${stamp()}.db`));
  }
  for (const ext of ["-wal", "-shm"]) fs.rmSync(dbFile + ext, { force: true });
  fs.renameSync(pending, dbFile);
  return true;
}

function hasBackupToday(dataDir) {
  const today = stamp().slice(0, 8);
  return list(dataDir).some((b) => b.name.startsWith(`nelly-auto-${today}`));
}

module.exports = { create, list, stageRestore, applyPendingRestore, hasBackupToday };

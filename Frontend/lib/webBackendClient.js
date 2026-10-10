// Browser-side client for the in-browser backend worker (see webBackend.worker.js).
let worker = null;
let seq = 0;
const pending = new Map();
let ready = null;

function secret() {
  try {
    let s = localStorage.getItem("nelly:secret");
    if (!s) {
      s = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join("");
      localStorage.setItem("nelly:secret", s);
    }
    return s;
  } catch {
    return undefined;
  }
}

function call(message) {
  return new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    worker.postMessage({ id, ...message });
  });
}

function start() {
  if (ready) return ready;
  worker = new Worker(new URL("./webBackend.worker.js", import.meta.url), { type: "module" });
  worker.onmessage = (ev) => {
    const { id, ok, result, error } = ev.data;
    const p = pending.get(id);
    if (!p) return;
    pending.delete(id);
    ok ? p.resolve(result) : p.reject(new Error(error));
  };
  worker.onerror = (ev) => {
    const err = new Error(ev.message || "worker crashed");
    pending.forEach((p) => p.reject(err));
    pending.clear();
  };
  let lastShop = null;
  try { lastShop = JSON.parse(localStorage.getItem("nelly:shops") || "{}").lastShop || null; } catch {}
  ready = call({ type: "init", secret: secret(), lastShop, projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "" }).catch((e) => {
    ready = null;
    worker?.terminate();
    worker = null;
    throw e;
  });
  return ready;
}

export async function sendToWebBackend(request) {
  await start();
  return call({ type: "request", request });
}

/** Switches the in-browser backend to the database of `shopId` (see webBackend.worker.js). */
export async function openWebShop(shopId, email) {
  await start();
  return call({ type: "openShop", shopId, email });
}

/** The whole database as a .db file (same format as the desktop app's nelly.db). */
export async function exportWebDatabase() {
  await start();
  return call({ type: "request", request: { path: "/__export" } });
}

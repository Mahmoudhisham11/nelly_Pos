// transport.js — hands an API request to the POS backend (@devora/pos-core) and returns { status, body }.
//
//  1. Electron desktop app: the backend runs in the main process on a real SQLite file (window.nellyDesktop.request).
//  2. Browser PWA build (NEXT_PUBLIC_NELLY_BACKEND=browser): backend in a Web Worker on SQLite WASM + OPFS.
//  3. Browser (npm run dev / local run): the Next.js server holds the SQLite file and exposes it at /api/rpc.
//
// Every request/response is plain JSON, so any other host (a SQLite-WASM web worker, tests) only needs to implement send().

function transportError(message) {
  const err = new Error(message);
  err.isTransportError = true;
  return err;
}

export async function send(request) {
  if (typeof window !== "undefined" && window.nellyDesktop && typeof window.nellyDesktop.request === "function") {
    try {
      return await window.nellyDesktop.request(request);
    } catch (e) {
      throw transportError(e?.message || "desktop backend unavailable");
    }
  }

  if (process.env.NEXT_PUBLIC_NELLY_BACKEND === "browser" && typeof window !== "undefined") {
    // Web/PWA build: the backend runs in a Web Worker on SQLite WASM (data stays in this browser, synced via the cloud).
    try {
      const { sendToWebBackend } = await import("./webBackendClient");
      return await sendToWebBackend(request);
    } catch (e) {
      console.error("[Nelly] in-browser backend failed:", e);
      throw transportError(e?.message === "TAB_LOCKED" ? "التطبيق مفتوح في تبويب آخر" : e?.message || "browser backend unavailable");
    }
  }

  let res;
  try {
    res = await fetch("/api/rpc/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
  } catch (e) {
    throw transportError(e?.message || "failed to fetch");
  }
  if (!res.ok && res.status !== 200) {
    // The bridge itself failed (not a business error: those come back inside the 200 envelope).
    throw transportError(`bridge status ${res.status}`);
  }
  return res.json();
}

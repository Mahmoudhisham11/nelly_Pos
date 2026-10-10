// Nelly PWA service worker: lets the web app open and run with no internet.
//  - /sqlite/* and /_next/static/* (content-hashed, immutable): cache first
//  - page navigations: network first, fall back to the cached page, then to the cached shell
//  - API/cloud traffic (Firebase, Firestore) is never touched here
const CACHE = "nelly-pwa-v2";
const SHELL = ["/", "/login/", "/pos/", "/products/", "/shop/", "/customers/", "/suppliers/", "/employees/", "/expenses/", "/treasury/", "/returns/", "/reports/", "/settings/", "/manifest.json"];
const RUNTIME = ["/sqlite/index.mjs", "/sqlite/sqlite3.wasm", "/sqlite/sqlite3-opfs-async-proxy.js"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      await Promise.allSettled([...SHELL, ...RUNTIME].map((u) => cache.add(u)));
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

const isStatic = (p) => p.startsWith("/_next/static/") || p.startsWith("/sqlite/") || /\.(png|jpg|svg|ico|woff2?)$/.test(p);

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.includes("webpack-hmr")) return;

  if (isStatic(url.pathname)) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      }))
    );
    return;
  }

  if (req.mode === "navigate" || req.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      }).catch(async () => (await caches.match(req)) || (await caches.match(url.pathname.endsWith("/") ? url.pathname : url.pathname + "/")) || (await caches.match("/")))
    );
  }
});

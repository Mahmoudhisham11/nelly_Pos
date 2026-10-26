// /api/rpc — browser bridge to the POS backend (@devora/pos-core) running on the Next.js server with a real SQLite file.
// Used by `npm run dev` / `npm start` on a customer's machine. It is switched off on Vercel (no customer data there)
// unless NELLY_RPC=on. The desktop build does not include this route (see scripts/build-desktop.mjs).
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { createBackend, configure } from "@devora/pos-core";
import { openBetterSqlite } from "@devora/pos-core/node";
import coreConfig from "../../../core.config.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const enabled = () => process.env.NELLY_RPC === "on" || !process.env.VERCEL;

function backend() {
  const g = globalThis;
  if (!g.__nellyBackend) {
    const file = process.env.NELLY_DB_PATH || path.join(process.cwd(), "data", "nelly.db");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    // Per-install signing secret, persisted next to the database so logins survive restarts.
    const keyFile = path.join(path.dirname(file), "secret.key");
    let secret = process.env.SECRET_KEY || "";
    if (!secret) {
      try { secret = fs.readFileSync(keyFile, "utf8").trim(); } catch {}
      if (!secret) {
        secret = crypto.randomBytes(32).toString("hex");
        fs.writeFileSync(keyFile, secret, { mode: 0o600 });
      }
    }
    configure({ ...coreConfig, SECRET_KEY: secret }); // Nelly's branding for the brand-neutral core
    g.__nellyBackend = createBackend(openBetterSqlite(file));
    g.__nellyBackend.startScheduler(); // auto-close of stale shifts (also catches up at start-up)
  }
  return g.__nellyBackend;
}

export async function POST(request) {
  if (!enabled()) return Response.json({ detail: "Local backend is disabled on this host" }, { status: 503 });
  const req = await request.json();
  const headers = {};
  for (const [k, v] of Object.entries(req.headers || {})) headers[String(k).toLowerCase()] = String(v);
  const out = await backend().handle({
    method: String(req.method || "GET"),
    path: String(req.path || "/"),
    query: req.query || {},
    body: req.body ?? null,
    headers,
  });
  return Response.json(out);
}

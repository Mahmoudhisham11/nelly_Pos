// POST /api/ai — one model turn of the in-app assistant.
// The browser/desktop app runs the tool loop on the customer's local data; this endpoint only holds the API key,
// checks that the caller is a signed-in member of a shop with an active subscription, enforces a daily quota,
// and forwards ONE request to the model: OpenRouter when OPENROUTER_API_KEY is set (default model "openrouter/free"),
// otherwise Claude (ANTHROPIC_API_KEY). Tool definitions live here (lib/aiToolDefs.js), never in the client.
import fs from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import openrouter from "@/lib/openrouter.cjs";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { AI_TOOLS, AI_SYSTEM } from "@/lib/aiToolDefs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const USE_OPENROUTER = Boolean(process.env.OPENROUTER_API_KEY);
const MODEL = process.env.AI_MODEL || (USE_OPENROUTER ? openrouter.DEFAULT_MODEL : "claude-opus-5-5");
const DAILY_CALLS = Number(process.env.AI_DAILY_CALLS || 150);
const MAX_BYTES = 200_000;
const BLOCK_TYPES = new Set(["text", "tool_use", "tool_result", "thinking", "redacted_thinking"]);

const cors = (req) => {
  const allowed = (process.env.AI_ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  const origin = req.headers.get("origin") || "";
  // Same-origin web app needs no CORS. The desktop app (localhost static server / file) calls the hosted URL cross-origin.
  const ok = allowed.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  return ok ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Headers": "authorization, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", Vary: "Origin" } : {};
};
const json = (req, body, status = 200) => Response.json(body, { status, headers: cors(req) });

export function OPTIONS(req) {
  return new Response(null, { status: 204, headers: cors(req) });
}

function adminDb() {
  if (!getApps().length) {
    // Hosted: the key as one-line JSON in FIREBASE_SERVICE_ACCOUNT. Local run: the serviceAccount.json file next to the app.
    const file = process.env.FIREBASE_SERVICE_ACCOUNT_FILE || "serviceAccount.json";
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT || (fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "");
    if (raw) initializeApp({ credential: cert(JSON.parse(raw)) });
    else if (process.env.FIRESTORE_EMULATOR_HOST) initializeApp({ projectId: process.env.GCLOUD_PROJECT || "demo-nelly" }); // local tests against the emulators
    else throw new Error("FIREBASE_SERVICE_ACCOUNT is not set");
  }
  return getFirestore();
}

const cairoDay = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

/** Only plain user/assistant turns made of known block types: no way to smuggle in a system message. */
function validMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 60) return false;
  if (messages[0].role !== "user") return false;
  return messages.every((m) => {
    if (!m || (m.role !== "user" && m.role !== "assistant")) return false;
    if (typeof m.content === "string") return true;
    return Array.isArray(m.content) && m.content.every((b) => b && BLOCK_TYPES.has(b.type));
  }) && JSON.stringify(messages).length <= MAX_BYTES;
}

export async function POST(req) {
  try {
    if (!USE_OPENROUTER && !process.env.ANTHROPIC_API_KEY) return json(req, { error: "المساعد غير مفعّل: ضيف OPENROUTER_API_KEY في ملف .env.local." }, 503);

    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return json(req, { error: "سجّل دخول السحابة أولاً (زر المزامنة بالأعلى)." }, 401);
    const db = adminDb();
    let uid;
    try { uid = (await getAuth().verifyIdToken(token)).uid; } catch { return json(req, { error: "انتهت جلسة السحابة، سجّل الدخول مرة أخرى." }, 401); }

    const link = await db.doc(`userShops/${uid}`).get();
    const shopId = link.exists ? link.data().shopId : null;
    if (!shopId) return json(req, { error: "الحساب غير مرتبط بمحل." }, 403);
    const shop = (await db.doc(`shops/${shopId}`).get()).data() || {};
    const until = shop.activeUntil?.toDate?.();
    if (!until || until.getTime() <= Date.now()) return json(req, { error: "انتهى الاشتراك. المساعد متاح للمشتركين فقط." }, 402);

    const body = await req.json().catch(() => null);
    if (!body || !validMessages(body.messages)) return json(req, { error: "طلب غير صالح." }, 400);

    // Daily quota per shop (counts model calls; one question is usually 2-4 calls).
    const usageRef = db.doc(`shops/${shopId}/aiUsage/${cairoDay()}`);
    const allowed = await db.runTransaction(async (tx) => {
      const calls = (await tx.get(usageRef)).data()?.calls || 0;
      if (calls >= DAILY_CALLS) return false;
      tx.set(usageRef, { calls: calls + 1, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      return true;
    });
    if (!allowed) return json(req, { error: "وصلت للحد اليومي من أسئلة المساعد. يتجدد غدًا." }, 429);

    if (USE_OPENROUTER) {
      const resp = await openrouter.openRouterTurn({
        apiKey: process.env.OPENROUTER_API_KEY, model: MODEL, system: AI_SYSTEM(cairoDay()), tools: AI_TOOLS,
        messages: body.messages, referer: req.headers.get("origin") || undefined,
      });
      return json(req, resp);
    }
    const client = new Anthropic();
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: AI_SYSTEM(cairoDay()),
      tools: AI_TOOLS,
      output_config: { effort: process.env.AI_EFFORT || "low" },
      messages: body.messages,
    });
    return json(req, { content: resp.content, stop_reason: resp.stop_reason, usage: resp.usage });
  } catch (e) {
    console.error("[ai] failed:", e?.status, e?.message);
    const error = e?.status === 401 ? "مفتاح الـ AI غير صحيح (OPENROUTER_API_KEY)."
      : e?.status === 429 ? "الموديل المجاني مشغول حالياً، جرّب بعد دقيقة."
      : "تعذر الاتصال بالمساعد حالياً.";
    return json(req, { error }, 502);
  }
}

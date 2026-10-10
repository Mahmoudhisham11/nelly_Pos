// Drives one assistant question: model turn (server) -> run tools locally -> repeat, until the model answers.
import { auth } from "./firebase";
import { runTool } from "./aiTools";
import { AI_TOOLS, AI_SYSTEM } from "./aiToolDefs";

const cairoDay = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

const MAX_STEPS = 8;
// Web build: same origin. Desktop build (static files): set NEXT_PUBLIC_AI_URL to the hosted site, e.g. https://nelly.devora.app
const endpoint = () => `${process.env.NEXT_PUBLIC_AI_URL || ""}/api/ai`;

async function turn(messages) {
  const user = auth?.currentUser;
  if (!user) throw new Error("اربط الجهاز بحساب المحل السحابي أولاً (زر المزامنة بالأعلى).");
  // Desktop: Electron's main process holds the OpenRouter key and makes the call (no hosted server needed).
  const desktop = typeof window !== "undefined" ? window.nellyDesktop : null;
  if (desktop?.aiTurn && !process.env.NEXT_PUBLIC_AI_URL) {
    const data = await desktop.aiTurn({ system: AI_SYSTEM(cairoDay()), tools: AI_TOOLS, messages });
    if (!data || data.error) throw new Error(data?.error || "تعذر الاتصال بالمساعد.");
    return data;
  }
  const token = await user.getIdToken();
  let res;
  try {
    res = await fetch(endpoint(), { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ messages }) });
  } catch {
    throw new Error("المساعد يحتاج اتصالاً بالإنترنت.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "تعذر الاتصال بالمساعد.");
  return data;
}

/**
 * @param {Array} history  previous API messages (returned by the last call) so follow-up questions have context
 * @returns {{ answer: string, messages: Array }}
 */
export async function askAssistant(question, history = []) {
  const messages = [...history, { role: "user", content: question }];
  for (let step = 0; step < MAX_STEPS; step++) {
    const { content, stop_reason: stop } = await turn(messages);
    messages.push({ role: "assistant", content }); // echoed back unchanged (thinking blocks included)
    if (stop === "tool_use") {
      const results = [];
      for (const b of content.filter((c) => c.type === "tool_use")) {
        results.push({ type: "tool_result", tool_use_id: b.id, ...(await runTool(b.name, b.input)) });
      }
      messages.push({ role: "user", content: results }); // all results in ONE user message
      continue;
    }
    if (stop === "refusal") return { answer: "لا أستطيع المساعدة في هذا الطلب.", messages };
    const text = content.filter((c) => c.type === "text").map((c) => c.text).join("\n").trim();
    return { answer: text || "لم أصل لإجابة، جرّب صياغة السؤال بشكل مختلف.", messages };
  }
  return { answer: "السؤال محتاج خطوات كثيرة. جرّب تسأل بشكل أبسط أو بنطاق تاريخ أصغر.", messages };
}

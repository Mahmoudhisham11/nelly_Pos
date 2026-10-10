// OpenRouter adapter for the assistant. The app speaks the Anthropic message shape (text / tool_use / tool_result
// blocks, stop_reason "tool_use" | "end_turn"); this file translates one turn to OpenRouter's OpenAI-compatible
// chat API and back, so lib/aiClient.js and the tool loop stay unchanged.
// CommonJS on purpose: used by the Next server route (/api/ai) and by Electron's main process.

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "openrouter/free";

const textOf = (content) =>
  typeof content === "string" ? content : (content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");

/** Anthropic-shaped history -> OpenAI chat messages. */
function toOpenAiMessages(system, messages) {
  const out = [{ role: "system", content: system }];
  for (const m of messages) {
    if (m.role === "assistant") {
      const blocks = typeof m.content === "string" ? [{ type: "text", text: m.content }] : m.content || [];
      const calls = blocks.filter((b) => b.type === "tool_use").map((b) => ({
        id: b.id, type: "function", function: { name: b.name, arguments: JSON.stringify(b.input || {}) },
      }));
      out.push({ role: "assistant", content: textOf(blocks) || (calls.length ? null : ""), ...(calls.length ? { tool_calls: calls } : {}) });
      continue;
    }
    if (typeof m.content === "string") { out.push({ role: "user", content: m.content }); continue; }
    for (const b of m.content || []) {
      if (b.type === "tool_result") {
        const c = typeof b.content === "string" ? b.content : textOf(b.content) || JSON.stringify(b.content ?? "");
        out.push({ role: "tool", tool_call_id: b.tool_use_id, content: b.is_error ? `ERROR: ${c}` : c });
      }
    }
    const text = textOf(m.content);
    if (text) out.push({ role: "user", content: text });
  }
  return out;
}

const toOpenAiTools = (tools) =>
  tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.input_schema } }));

function parseArgs(raw) {
  if (raw && typeof raw === "object") return raw;
  try { return JSON.parse(raw || "{}") || {}; } catch { return {}; }
}

/**
 * One model turn.
 * @returns {Promise<{content: Array, stop_reason: string, usage?: object}>} Anthropic-shaped result
 */
async function openRouterTurn({ apiKey, model, system, tools, messages, referer, timeoutMs = 55000 }) {
  if (!apiKey) throw Object.assign(new Error("OPENROUTER_API_KEY is not set"), { code: "NO_KEY" });
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(OPENROUTER_URL, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": referer || "https://nelly.app",
        "X-Title": "Nelly POS",
      },
      body: JSON.stringify({
        model: model || DEFAULT_MODEL,
        max_tokens: 2048,
        temperature: 0.2,
        messages: toOpenAiMessages(system, messages),
        tools: toOpenAiTools(tools),
        tool_choice: "auto",
      }),
    });
  } finally {
    clearTimeout(timer);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    const msg = data?.error?.message || `OpenRouter HTTP ${res.status}`;
    throw Object.assign(new Error(msg), { status: res.status });
  }
  const msg = data.choices?.[0]?.message || {};
  const content = [];
  if (msg.content) content.push({ type: "text", text: String(msg.content) });
  for (const c of msg.tool_calls || []) {
    content.push({ type: "tool_use", id: c.id || `call_${content.length}`, name: c.function?.name, input: parseArgs(c.function?.arguments) });
  }
  const stop_reason = content.some((b) => b.type === "tool_use") ? "tool_use" : "end_turn";
  return { content, stop_reason, usage: data.usage };
}

module.exports = { openRouterTurn, toOpenAiMessages, DEFAULT_MODEL };

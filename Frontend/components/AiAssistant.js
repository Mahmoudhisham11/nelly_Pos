"use client";

import { useRef, useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { askAssistant } from "@/lib/aiClient";

const SUGGESTIONS = [
  "كام المخزون المتبقي من أحمر الشفاه؟",
  "إيه المنتجات اللي قربت تخلص؟",
  "مبيعات الأسبوع اللي فات وصافي الربح؟",
  "توقع المبيعات لـ 7 أيام جاية",
  "أكتر 5 منتجات مبيعا الشهر ده",
];

/** Floating assistant (owner/admin only): questions about products, invoices, customers, employees + sales forecasts. */
export default function AiAssistant() {
  const { user, isAdmin } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [chat, setChat] = useState([]); // { role: "user" | "ai" | "error", text }
  const [history, setHistory] = useState([]); // API messages, for follow-up questions
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chat, busy, open]);

  if (!user || !isAdmin || pathname?.startsWith("/login")) return null;

  const ask = async (text) => {
    const q = text.trim();
    if (!q || busy) return;
    setInput("");
    setChat((c) => [...c, { role: "user", text: q }]);
    setBusy(true);
    try {
      const { answer, messages } = await askAssistant(q, history);
      setChat((c) => [...c, { role: "ai", text: answer }]);
      setHistory(messages.length > 24 ? messages.slice(-24).slice(messages.slice(-24).findIndex((m) => m.role === "user" && typeof m.content === "string")) : messages);
    } catch (e) {
      setChat((c) => [...c, { role: "error", text: e?.message || "حدث خطأ" }]);
    } finally {
      setBusy(false);
    }
  };

  const bubble = (m) => ({
    alignSelf: m.role === "user" ? "flex-start" : "flex-end", maxWidth: "88%", whiteSpace: "pre-wrap", lineHeight: 1.7, fontSize: "0.9rem", padding: "8px 12px", borderRadius: 12,
    background: m.role === "user" ? "var(--rose-glow)" : m.role === "error" ? "var(--ruby-glow)" : "var(--bg-card-subtle)",
    border: "1px solid var(--border-card)", color: "var(--text-primary)",
  });

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="مساعد Nelly"
        style={{ position: "fixed", bottom: 20, left: 20, zIndex: 60, width: 54, height: 54, borderRadius: "50%", border: "none", cursor: "pointer", background: "var(--border-active)", color: "#fff", fontSize: 24, boxShadow: "var(--shadow-sm)" }}
      >
        {open ? "×" : "✨"}
      </button>
      {open && (
        <section dir="rtl" style={{ position: "fixed", bottom: 84, left: 20, zIndex: 60, width: "min(400px, calc(100vw - 40px))", height: "min(560px, calc(100vh - 120px))", display: "flex", flexDirection: "column", background: "var(--bg-surface)", border: "1px solid var(--border-card)", borderRadius: 16, boxShadow: "0 12px 40px rgba(30,19,34,0.2)", overflow: "hidden" }}>
          <header style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-card)", fontWeight: 700, color: "var(--text-primary)" }}>
            مساعد Nelly <span style={{ fontWeight: 400, fontSize: "0.75rem", color: "var(--text-muted)" }}>للقراءة والتحليل فقط</span>
          </header>
          <div style={{ flex: 1, overflow: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            {chat.length === 0 && (
              <>
                <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.85rem" }}>اسألني عن منتج أو فاتورة أو عميل أو موظف، أو اطلب توقع للمبيعات.</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {SUGGESTIONS.map((s) => (
                    <button key={s} type="button" onClick={() => ask(s)} style={{ fontSize: "0.78rem", padding: "6px 10px", borderRadius: 999, border: "1px solid var(--border-subtle)", background: "var(--bg-card)", color: "var(--text-secondary)", cursor: "pointer", fontFamily: "inherit" }}>{s}</button>
                  ))}
                </div>
              </>
            )}
            {chat.map((m, i) => <div key={i} style={bubble(m)}>{m.text}</div>)}
            {busy && <div style={{ ...bubble({ role: "ai" }), color: "var(--text-muted)" }}>جاري التحليل...</div>}
            <div ref={endRef} />
          </div>
          <form onSubmit={(e) => { e.preventDefault(); ask(input); }} style={{ display: "flex", gap: 8, padding: 10, borderTop: "1px solid var(--border-card)" }}>
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="اكتب سؤالك..." disabled={busy} style={{ flex: 1, padding: "9px 12px", borderRadius: 10, border: "1px solid var(--border-card)", background: "var(--bg-input)", color: "var(--text-primary)", fontFamily: "inherit" }} />
            <button type="submit" disabled={busy || !input.trim()} style={{ padding: "9px 14px", borderRadius: 10, border: "none", background: "var(--border-active)", color: "#fff", cursor: "pointer", fontFamily: "inherit" }}>إرسال</button>
          </form>
        </section>
      )}
    </>
  );
}

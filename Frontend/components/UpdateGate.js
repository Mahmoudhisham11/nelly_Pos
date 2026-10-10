"use client";

// Desktop app updates. A new version downloads in the background; then a banner offers "تحديث الآن".
// When Devora marks the running version as too old (appConfig/nelly.minVersion, set from the Devora Console), the app
// is locked behind a "لازم تحدّث" screen until the new version is installed. The shop's data is never touched.
import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

const parse = (v) => String(v || "0").split(".").map((n) => parseInt(n, 10) || 0);
export function isOlder(a, b) {
  const x = parse(a), y = parse(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) < (y[i] || 0);
  }
  return false;
}

export default function UpdateGate() {
  const updates = typeof window !== "undefined" ? window.nellyDesktop?.updates : null;
  const [st, setSt] = useState(null);
  const [config, setConfig] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!updates) return undefined;
    updates.state().then(setSt).catch(() => {});
    return updates.onChange((s) => setSt((p) => ({ ...p, ...s })));
  }, [updates]);

  useEffect(() => {
    if (!updates || !db) return undefined;
    return onSnapshot(doc(db, "appConfig", "nelly"), (snap) => setConfig(snap.exists() ? snap.data() : null), () => {});
  }, [updates]);

  if (!updates || !st?.packaged) return null;
  const current = st.current;
  const forced = !!config?.minVersion && isOlder(current, config.minVersion);
  const ready = st.status === "ready";
  const install = () => updates.install();

  if (forced) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 20000, background: "rgba(15,23,42,.88)", display: "grid", placeItems: "center", padding: 16 }}>
        <div style={{ background: "#fff", color: "#0f172a", borderRadius: 20, padding: 28, maxWidth: 460, textAlign: "center" }}>
          <div style={{ fontSize: 40 }}>⬆️</div>
          <h2 style={{ margin: "8px 0" }}>لازم تحدّث البرنامج عشان تكمل</h2>
          <p style={{ color: "#475569", lineHeight: 1.8 }}>
            النسخة اللي عندك ({current}) قديمة ومبقتش مدعومة. التحديث بيغيّر البرنامج بس، وبيانات المحل كلها بتفضل زي ما هي.
            {config?.message ? <><br />{config.message}</> : null}
          </p>
          {ready ? (
            <button type="button" className="btn-primary" onClick={install}>تحديث الآن (البرنامج هيفتح تاني)</button>
          ) : st.status === "error" ? (
            <>
              <p style={{ color: "#dc2626" }}>تعذر تنزيل التحديث. اتأكد من الإنترنت.</p>
              <button type="button" className="btn-secondary" onClick={() => updates.check()}>حاول تاني</button>
            </>
          ) : (
            <p style={{ fontWeight: 700 }}>جاري تنزيل التحديث{st.percent ? ` ${st.percent}%` : "..."}</p>
          )}
        </div>
      </div>
    );
  }

  if (ready && !dismissed) {
    return (
      <div style={{
        position: "fixed", top: 14, left: "50%", transform: "translateX(-50%)", zIndex: 9000, background: "#0f172a", color: "#fff",
        borderRadius: 14, padding: "10px 14px", display: "flex", gap: 10, alignItems: "center", boxShadow: "0 10px 30px rgba(0,0,0,.25)",
      }}>
        <span>✨ فيه تحديث جديد ({st.version}) جاهز</span>
        <button type="button" className="btn-primary" onClick={install}>تحديث الآن</button>
        <button type="button" className="btn-secondary" onClick={() => setDismissed(true)}>بعدين</button>
      </div>
    );
  }
  return null;
}

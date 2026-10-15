"use client";

import { useEffect, useState, useCallback, useSyncExternalStore } from "react";

const card = {
  background: "#ffffff",
  border: "1px solid #ebdbe5",
  borderRadius: 16,
  padding: "18px 20px",
  marginBottom: 20,
  boxShadow: "0 2px 8px rgba(30, 19, 34, 0.04)",
  boxSizing: "border-box",
  width: "100%",
};
const btn = {
  padding: "8px 16px",
  borderRadius: 10,
  border: "1px solid #fbcfe8",
  background: "#fdf2f8",
  color: "#db2777",
  cursor: "pointer",
  fontFamily: "inherit",
  fontWeight: 700,
  fontSize: "0.85rem",
  transition: "all 0.2s ease",
};

/** Database backups: automatic daily copies + restore in the desktop app, one-click export in the web/PWA build. */
export default function BackupCard() {
  // false while rendering on the server / hydrating, true afterwards (window is only read once mounted)
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  const desktop = mounted ? window.nellyDesktop?.backups || null : null;
  const web = process.env.NEXT_PUBLIC_NELLY_BACKEND === "browser";
  const [list, setList] = useState([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (desktop) setList(await desktop.list().catch(() => []));
  }, [desktop]);
  useEffect(() => {
    let alive = true;
    if (desktop) desktop.list().catch(() => []).then((l) => { if (alive) setList(l); });
    return () => { alive = false; };
  }, [desktop]);

  if (!mounted || (!desktop && !web)) return null;

  const run = async (fn, ok) => {
    setBusy(true); setMsg("");
    try { await fn(); setMsg(ok); await refresh(); } catch (e) { setMsg("تعذر التنفيذ: " + (e?.message || e)); } finally { setBusy(false); }
  };

  const exportWeb = () => run(async () => {
    const { exportWebDatabase } = await import("@/lib/webBackendClient");
    const bytes = await exportWebDatabase();
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/x-sqlite3" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `nelly-backup-${new Date().toISOString().slice(0, 10)}.db`;
    a.click();
    URL.revokeObjectURL(url);
  }, "تم تنزيل النسخة الاحتياطية.");

  const restore = async (name) => {
    if (!window.confirm(`استعادة النسخة ${name}؟ سيُعاد تشغيل التطبيق، وستُحفظ البيانات الحالية في نسخة منفصلة قبل الاستبدال.`)) return;
    await run(() => desktop.restore(name), "جاري إعادة التشغيل...");
  };

  return (
    <section style={card} dir="rtl">
      <h3 style={{ margin: "0 0 6px" }}>النسخ الاحتياطي</h3>
      <p style={{ margin: "0 0 12px", fontSize: "0.85rem", opacity: 0.75 }}>
        {desktop ? "يُحفظ التطبيق نسخة تلقائية يومياً (آخر 14 نسخة) على هذا الجهاز." : "بياناتك محفوظة في هذا المتصفح. نزّل نسخة احتياطية دورياً أو اربط الجهاز بالسحابة."}
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {desktop ? (
          <>
            <button style={btn} disabled={busy} onClick={() => run(() => desktop.now(), "تم إنشاء نسخة جديدة.")}>نسخة احتياطية الآن</button>
            <button style={btn} onClick={() => desktop.openFolder()}>فتح مجلد النسخ</button>
          </>
        ) : (
          <button style={btn} disabled={busy} onClick={exportWeb}>تنزيل نسخة احتياطية</button>
        )}
      </div>
      {msg && <p style={{ margin: "10px 0 0", fontSize: "0.85rem" }}>{msg}</p>}
      {desktop && list.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, margin: "12px 0 0", display: "grid", gap: 6, maxHeight: 220, overflow: "auto" }}>
          {list.map((b) => (
            <li key={b.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, fontSize: "0.8rem" }}>
              <span dir="ltr">{new Date(b.mtime).toLocaleString("ar-EG")} • {(b.size / 1048576).toFixed(1)} MB</span>
              <button style={btn} disabled={busy} onClick={() => restore(b.name)}>استعادة</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

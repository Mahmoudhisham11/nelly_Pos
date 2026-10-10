"use client";

// The shop's plan: a small badge while it is on the free month, and a full-screen notice once the free month or the
// subscription has ended (the app is locked until Devora renews it; logging out stays possible).
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { cloudSession } from "@/lib/cloudSession";

const DAY = 86400000;

export default function SubscriptionGate() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [cloud, setCloud] = useState(cloudSession.state);
  useEffect(() => cloudSession.subscribe(setCloud), []);
  // a clock in state (re-read every minute) so the notice appears by itself when the period ends
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  if (!user || pathname?.startsWith("/login") || cloud.status !== "ready" || !cloud.activeUntil) return null;
  const msLeft = new Date(cloud.activeUntil).getTime() - now;
  const daysLeft = Math.max(0, Math.ceil(msLeft / DAY));
  const isFree = cloud.plan === "free";

  if (msLeft > 0 && !cloud.suspended) {
    if (!isFree && daysLeft > 7) return null;
    return (
      <div style={{
        position: "fixed", bottom: 18, left: 86, zIndex: 900, padding: "8px 14px", borderRadius: 999,
        background: isFree ? "#7c3aed" : "#d97706", color: "#fff", fontSize: "0.8rem", fontWeight: 700,
        boxShadow: "0 6px 20px rgba(0,0,0,.18)",
      }}>
        {isFree ? `النسخة المجانية — باقي ${daysLeft} يوم` : `الاشتراك هيخلص بعد ${daysLeft} يوم`}
      </div>
    );
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 10000, background: "rgba(15,23,42,.82)", display: "grid", placeItems: "center", padding: 16,
    }}>
      <div style={{ background: "#fff", borderRadius: 20, padding: 28, maxWidth: 440, textAlign: "center", color: "#0f172a" }}>
        <div style={{ fontSize: 40 }}>⏳</div>
        <h2 style={{ margin: "8px 0", fontSize: "1.3rem" }}>
          {cloud.suspended ? "تم إيقاف المحل مؤقتاً" : isFree ? "انتهت الفترة المجانية (شهر)" : "انتهى اشتراك المحل"}
        </h2>
        <p style={{ color: "#475569", lineHeight: 1.8 }}>
          بيانات محل <b>{cloud.shopName}</b> محفوظة بالكامل ومش هتضيع. عشان تكمل استخدام البرنامج جدّد الاشتراك مع Devora،
          وأول ما يتجدد البرنامج هيفتح لوحده.
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 16 }}>
          <button type="button" className="btn-primary" onClick={() => cloudSession.refresh()}>تحقق من التجديد</button>
          <button type="button" className="btn-secondary" onClick={logout}>تسجيل الخروج</button>
        </div>
      </div>
    </div>
  );
}

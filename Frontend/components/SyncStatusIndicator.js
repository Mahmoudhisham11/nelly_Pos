"use client";

import React, { useState, useEffect, useRef } from "react";
import { syncManager } from "@/lib/syncManager";
import { cloudSession } from "@/lib/cloudSession";
import { RefreshCw, Cloud, CloudOff, AlertCircle } from "lucide-react";
import styles from "./SyncStatusIndicator.module.css";

export default function SyncStatusIndicator() {
  const [syncState, setSyncState] = useState({
    isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
    isSyncing: false,
    pendingCount: 0,
    lastSyncedAt: null,
  });
  const [isOpen, setIsOpen] = useState(false);
  const [cloud, setCloud] = useState(cloudSession.state);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [linkError, setLinkError] = useState("");
  const [linking, setLinking] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    // Start background sync listeners
    syncManager.start();

    // Subscribe to real-time sync engine updates
    const unsub = syncManager.subscribe((state) => {
      setSyncState(state);
    });
    const unsubCloud = cloudSession.subscribe(setCloud);

    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      unsub();
      unsubCloud();
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleTriggerSync = async (e) => {
    e.stopPropagation();
    try {
      await syncManager.triggerPush();
    } catch (err) {
      console.warn("Manual sync notice:", err?.message || err);
    }
  };

  const handleLink = async (e) => {
    e.preventDefault();
    setLinkError("");
    setLinking(true);
    try {
      await cloudSession.signIn(email, password);
      setPassword("");
    } catch (err) {
      setLinkError(err.message);
    } finally {
      setLinking(false);
    }
  };

  let badgeClass = styles.online;
  let label = "متصل وسحابي";
  let icon = <Cloud size={13} />;

  if (syncState.isSyncing) {
    badgeClass = styles.syncing;
    label = "جاري المزامنة...";
    icon = <RefreshCw size={13} className="spin-animation" />;
  } else if (cloud.status === "unconfigured") {
    badgeClass = styles.offline;
    label = "السحابة غير مُعدّة (محلي فقط)";
    icon = <CloudOff size={13} />;
  } else if (cloud.status !== "ready") {
    badgeClass = styles.offline;
    label = "غير مربوط بالسحابة";
    icon = <CloudOff size={13} />;
  } else if (!cloud.canWrite) {
    badgeClass = styles.offline;
    label = "الاشتراك منتهي (قراءة فقط)";
    icon = <AlertCircle size={13} />;
  } else if (!syncState.isOnline) {
    badgeClass = styles.offline;
    label = "أوفلاين (محلي)";
    icon = <CloudOff size={13} />;
  }

  return (
    <div className={styles.container} ref={containerRef}>
      <button
        className={`${styles.badge} ${badgeClass}`}
        onClick={() => setIsOpen(!isOpen)}
        title="انقر لعرض تفاصيل المزامنة"
        type="button"
      >
        <span className={styles.dot} />
        {icon}
        <span>{label}</span>
        {syncState.pendingCount > 0 && (
          <span className={styles.pendingCount}>
            {syncState.pendingCount} معلق
          </span>
        )}
      </button>

      {isOpen && (
        <div className={styles.dropdown}>
          <div className={styles.header}>
            <span>حالة المزامنة السحابية</span>
            <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Firebase ↔ SQLite</span>
          </div>

          <div className={styles.statRow}>
            <span>الاتصال:</span>
            <span className={styles.statVal}>
              {syncState.isOnline ? "🟢 متصل بالإنترنت" : "🔴 غير متصل (يعمل محلياً)"}
            </span>
          </div>

          <div className={styles.statRow}>
            <span>العمليات المعلقة:</span>
            <span className={styles.statVal}>{syncState.pendingCount}</span>
          </div>

          {syncState.lastSyncedAt && (
            <div className={styles.statRow}>
              <span>آخر مزامنة:</span>
              <span className={styles.statVal} style={{ fontSize: "0.75rem" }}>
                {new Date(syncState.lastSyncedAt).toLocaleTimeString("ar-EG")}
              </span>
            </div>
          )}

          {cloud.status === "ready" ? (
            <div className={styles.statRow}>
              <span>المحل:</span>
              <span className={styles.statVal}>
                {cloud.shopName}{" "}
                <button type="button" onClick={() => cloudSession.signOut()} style={{ fontSize: "0.7rem", marginInlineStart: 6 }}>فصل</button>
              </span>
            </div>
          ) : cloud.status === "unconfigured" ? (
            <p style={{ fontSize: "0.75rem", color: "#94a3b8", margin: "8px 0" }}>{cloud.error}</p>
          ) : (
            <form onSubmit={handleLink} style={{ display: "grid", gap: 6, margin: "8px 0" }}>
              <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>اربط الجهاز بحساب المحل السحابي لتفعيل المزامنة</span>
              <input type="email" required placeholder="البريد" value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" />
              <input type="password" required placeholder="كلمة المرور" value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" />
              <button type="submit" disabled={linking || !syncState.isOnline}>{linking ? "جاري الربط..." : "ربط بالسحابة"}</button>
              {(linkError || cloud.error) && <span style={{ color: "#f87171", fontSize: "0.75rem" }}>{linkError || cloud.error}</span>}
            </form>
          )}
          {cloud.status === "ready" && !cloud.canWrite && (
            <div style={{ color: "#f87171", fontSize: "0.75rem", margin: "6px 0" }}>
              انتهى الاشتراك: التطبيق يعمل محلياً والمزامنة للقراءة فقط. تواصل مع Devora للتجديد.
            </div>
          )}

          <button
            className={styles.syncBtn}
            onClick={handleTriggerSync}
            disabled={syncState.isSyncing || !syncState.isOnline || !syncState.canWrite}
          >
            <RefreshCw size={13} className={syncState.isSyncing ? "spin-animation" : ""} />
            {syncState.isSyncing ? "جاري المزامنة..." : "مزامنة الآن"}
          </button>
        </div>
      )}
    </div>
  );
}

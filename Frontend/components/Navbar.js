"use client";

import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { 
  Menu, 
  Clock, 
  PlusCircle
} from "lucide-react";
import SyncStatusIndicator from "./SyncStatusIndicator";
import styles from "./Navbar.module.css";

export default function Navbar({ onOpenAddModal, onOpenMobileSidebar, title, actions }) {
  const pathname = usePathname();
  const [timeStr, setTimeStr] = useState("");

  const pageTitles = {
    "/": "لوحة التحكم والإحصائيات الشاملة",
    "/pos": "نقطة البيع السريعة (الكاشير)",
    "/shop": "المحل وبضاعة المعرض",
    "/products": "المخزن الرئيسي",
    "/sales": "سجل فواتير المبيعات والمرتجعات",
    "/returns": "حركة الصنف وسجل المرتجعات",
    "/reports": "تقفيلة الأيام والورديات المؤرشفة",
    "/treasury": "الخزنة والسيولة ورأس مال المشروع",
    "/customers": "دليل العملاء والحسابات والديون",
    "/suppliers": "إدارة الموردين والحسابات المالية",
    "/expenses": "سجل المصاريف والنفقات التشغيلية",
    "/employees": "شؤون الموظفين والرواتب والحضور",
    "/settings": "إعدادات النظام وإدارة المستخدمين"
  };

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const dayNames = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
      const monthNames = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
      
      const dayName = dayNames[now.getDay()];
      const monthName = monthNames[now.getMonth()];
      const dayNum = now.getDate();
      let hours = now.getHours();
      const minutes = String(now.getMinutes()).padStart(2, "0");
      const ampm = hours >= 12 ? "م" : "ص";
      hours = hours % 12 || 12;

      setTimeStr(`${dayName} ${dayNum} ${monthName} - ${hours}:${minutes} ${ampm}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000 * 30);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="navbar-header glass-panel">
      {/* Right Side: Mobile Menu Button & Page Title */}
      <div className={styles.brandSection}>
        {onOpenMobileSidebar && (
          <button 
            onClick={onOpenMobileSidebar}
            className="navbar-mobile-toggle"
            title="فتح القائمة الجانبية"
          >
            <Menu size={22} />
          </button>
        )}

        <div>
          <h1 className={styles.title}>
            {title || pageTitles[pathname] || "Nelly"}
          </h1>
          <p className={styles.subtitle}>
            مستحضرات التجميل وجرد المخزون
          </p>
        </div>
      </div>

      {/* Left Side: Live Clock & Quick Add Button or Custom Actions */}
      <div className="navbar-user-actions" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <SyncStatusIndicator />
        {actions ? (
          actions
        ) : (
          <>
            {/* Live Clock */}
            {timeStr && (
              <div className={styles.clockBadge}>
                <Clock size={14} color="#db2777" />
                <span className="num-font" dir="ltr">{timeStr}</span>
              </div>
            )}

            {/* Quick Add Product Button */}
            {onOpenAddModal && (
              <button 
                onClick={onOpenAddModal}
                className={`btn-primary ${styles.quickAddBtn}`}
              >
                <PlusCircle size={17} />
                إضافة صنف جديد
              </button>
            )}
          </>
        )}
      </div>
    </header>
  );
}

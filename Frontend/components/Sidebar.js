"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { 
  LayoutDashboard, 
  ShoppingCart,
  Receipt,
  Users,
  Boxes, 
  Store,
  Truck, 
  Settings, 
  LogOut, 
  User, 
  X,
  ChevronLeft,
  RotateCcw,
  CalendarCheck,
  UserCheck,
  Landmark
} from "lucide-react";
import styles from "./Sidebar.module.css";

export default function Sidebar({ isMobileOpen, onCloseMobile }) {
  const pathname = usePathname();
  const { user, isAdmin, logout } = useAuth();

  const navLinks = [
    {
      label: "لوحة التحكم",
      href: "/",
      icon: LayoutDashboard,
      badge: null
    },
    {
      label: "نقطة البيع (الكاشير)",
      href: "/pos",
      icon: ShoppingCart,
      badge: "POS"
    },
    {
      label: "المحل",
      href: "/shop",
      icon: Store,
      badge: null
    },
    {
      label: "المخزن",
      href: "/products",
      icon: Boxes,
      badge: null
    },
    {
      label: "حركة الصنف",
      href: "/returns",
      icon: RotateCcw,
      badge: null
    },
    {
      label: "تقفيلة الأيام",
      href: "/reports",
      icon: CalendarCheck,
      badge: null
    },
    {
      label: "الخزنة ورأس المال",
      href: "/treasury",
      icon: Landmark,
      badge: "جديد"
    },
    {
      label: "سجل العملاء والآجل",
      href: "/customers",
      icon: Users,
      badge: null
    },
    {
      label: "الموردين والحسابات",
      href: "/suppliers",
      icon: Truck,
      badge: null
    },
    {
      label: "المصاريف والنفقات",
      href: "/expenses",
      icon: Receipt,
      badge: null
    },
    {
      label: "الموظفين والرواتب",
      href: "/employees",
      icon: UserCheck,
      badge: null
    },
    {
      label: "الإعدادات والمستخدمين",
      href: "/settings",
      icon: Settings,
      badge: null,
      adminOnly: true
    }
  ];

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isMobileOpen && (
        <div 
          className="sidebar-mobile-backdrop"
          onClick={onCloseMobile}
        />
      )}

      {/* Main Sidebar Element */}
      <aside className={`app-sidebar ${isMobileOpen ? "mobile-open" : ""}`}>
        {/* Brand Header */}
        <div className="sidebar-brand">
          <div className={styles.brandInfo}>
            <div className={styles.brandLogo}>
              N
            </div>
            <div>
              <h2 className={styles.brandTitle}>
                مخزن <span className="gradient-text-rose">Nelly</span>
              </h2>
              <span className={styles.brandSubtitle}>
                مستحضرات التجميل والميكاب
              </span>
            </div>
          </div>

          {/* Close button for Mobile Drawer */}
          <button 
            onClick={onCloseMobile}
            className="sidebar-mobile-close"
          >
            <X size={20} />
          </button>
        </div>

        {/* User Role Pill */}
        <div className={styles.roleWrapper}>
          <div className={`${styles.roleCard} ${isAdmin ? styles.roleAdmin : styles.roleUser}`}>
            <span className={styles.roleLabel}>الصلاحية:</span>
            <span className={isAdmin ? styles.roleValueAdmin : styles.roleValueUser}>
              {isAdmin ? "👑 مسؤول (Admin)" : "👤 مستخدم (User)"}
            </span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="sidebar-nav">
          <div className={styles.navSectionTitle}>
            القائمة الرئيسية
          </div>

          {navLinks.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => onCloseMobile && onCloseMobile()}
                className={`sidebar-link ${isActive ? "active" : ""}`}
              >
                <div className={styles.linkContent}>
                  <div className="sidebar-link-icon">
                    <Icon size={20} />
                  </div>
                  <span className={isActive ? styles.linkLabelActive : styles.linkLabel}>
                    {item.label}
                  </span>
                </div>

                <div className={styles.linkMeta}>
                  {item.badge && (
                    <span className={styles.navBadge}>
                      {item.badge}
                    </span>
                  )}
                  {isActive && <ChevronLeft size={16} color="#db2777" />}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* User Footer Profile & Logout */}
        <div className="sidebar-footer">
          {user && (
            <div className={styles.userCard}>
              <div className={styles.userInfo}>
                {user.photoURL ? (
                  <img 
                    src={user.photoURL} 
                    alt="User" 
                    className={styles.userAvatar}
                  />
                ) : (
                  <div className={`${styles.userAvatarPlaceholder} ${isAdmin ? styles.avatarAdmin : styles.avatarUser}`}>
                    <User size={18} />
                  </div>
                )}
                <div className={styles.userText}>
                  <div className={styles.userName}>
                    {user.displayName || (isAdmin ? "مسؤول المخزن" : "مستخدم")}
                  </div>
                  <div className={styles.userEmail}>
                    {user.email || "حساب نشط"}
                  </div>
                </div>
              </div>

              <button
                onClick={logout}
                title="تسجيل الخروج"
                className={styles.logoutBtn}
              >
                <LogOut size={16} />
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

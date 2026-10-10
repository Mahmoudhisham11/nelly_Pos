"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import StatCard from "@/components/StatCard";
import POSReceiptModal from "@/components/POSReceiptModal";
import { subscribeToProducts } from "@/lib/productsService";
import { subscribeToShopProducts } from "@/lib/shopService";
import { subscribeToMonthlyExpenses } from "@/lib/expensesService";
import { subscribeToSales, subscribeToReports } from "@/lib/salesService";
import { formatNumber, roundCurrency, getLocalDateString, getLocalMonthString } from "@/lib/utils";
import { 
  Boxes, 
  AlertTriangle, 
  CheckCircle2, 
  Receipt, 
  TrendingUp, 
  ChevronLeft,
  ShoppingBag,
  PieChart
} from "lucide-react";
import styles from "./dashboard.module.css";

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAdmin, loading: authLoading } = useAuth();
  
  // Real-time states
  const [warehouseProducts, setWarehouseProducts] = useState([]);
  const [shopProducts, setShopProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [reports, setReports] = useState([]);
  const [monthlyExpensesMap, setMonthlyExpensesMap] = useState({});
  const [loading, setLoading] = useState(true);

  const [viewingInvoice, setViewingInvoice] = useState(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Month & Day strings (Local timezone)
  const currentMonthStr = useMemo(() => getLocalMonthString(), []);
  const todayStr = useMemo(() => getLocalDateString(), []);

  // Redirect to login if user not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  // Real-time API subscriptions
  useEffect(() => {
    if (!user) return;
    
    let loadedCount = 0;
    const checkDone = () => {
      loadedCount++;
      if (loadedCount >= 2) setLoading(false);
    };

    // Instant unlock fallback (500ms max)
    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 500);

    const unsubWarehouse = subscribeToProducts((data) => {
      setWarehouseProducts(data || []);
      checkDone();
    });

    const unsubShop = subscribeToShopProducts((data) => {
      setShopProducts(data || []);
      checkDone();
    });

    const unsubSales = subscribeToSales((data) => {
      setSales(data || []);
      checkDone();
    });

    const unsubReports = subscribeToReports((data) => {
      setReports(data || []);
      checkDone();
    });

    const unsubExpenses = subscribeToMonthlyExpenses(currentMonthStr, (map) => {
      setMonthlyExpensesMap(map || {});
      checkDone();
    });

    return () => {
      clearTimeout(safetyTimer);
      unsubWarehouse();
      unsubShop();
      unsubSales();
      unsubReports();
      unsubExpenses();
    };
  }, [user, currentMonthStr]);

  // Calculations for Sales & Profits
  const activeSales = useMemo(() => sales.filter(s => 
    !s.deleted_at && 
    s.status !== "مرتجعة" && 
    s.status !== "cancelled" && 
    s.status !== "returned"
  ), [sales]);

  // Filter closed reports for current month
  const currentMonthReports = useMemo(() => {
    return reports.filter(r => {
      const rDate = r.closedAt || r.date || r.createdAt;
      if (!rDate) return false;
      return getLocalDateString(rDate).startsWith(currentMonthStr);
    });
  }, [reports, currentMonthStr]);

  // Filter closed reports for today
  const todayReports = useMemo(() => {
    return reports.filter(r => {
      const rDate = r.closedAt || r.date || r.createdAt;
      if (!rDate) return false;
      return getLocalDateString(rDate) === todayStr;
    });
  }, [reports, todayStr]);

  // Active open shift sales for today
  const todayActiveSales = useMemo(() => {
    return activeSales.filter(s => s.date && getLocalDateString(s.date) === todayStr);
  }, [activeSales, todayStr]);

  // Today's total sales revenue = today's active shift + today's closed shift reports
  const todaySalesRevenue = useMemo(() => {
    const fromActive = todayActiveSales.reduce((acc, curr) => acc + (Number(curr.total) || 0), 0);
    const fromReports = todayReports.reduce((acc, curr) => acc + (Number(curr.totalSales) || 0), 0);
    return roundCurrency(fromActive + fromReports);
  }, [todayActiveSales, todayReports]);

  // Current month gross sales profit
  const currentMonthGrossProfit = useMemo(() => {
    const fromReports = currentMonthReports.reduce((acc, curr) => acc + (Number(curr.totalProfit) || 0), 0);
    const fromActive = activeSales
      .filter(s => s.date && getLocalDateString(s.date).startsWith(currentMonthStr))
      .reduce((acc, curr) => acc + (Number(curr.totalProfit) || 0), 0);
    return roundCurrency(fromReports + fromActive);
  }, [currentMonthReports, activeSales, currentMonthStr]);

  // Combined inventory (Shop + Warehouse)
  const allProducts = useMemo(() => {
    return [...shopProducts, ...warehouseProducts];
  }, [shopProducts, warehouseProducts]);

  const totalStockItems = useMemo(() => {
    return allProducts.reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0);
  }, [allProducts]);

  const lowStockItems = useMemo(() => {
    return allProducts.filter(p => {
      const q = Number(p.quantity) || 0;
      const threshold = Number(p.minThreshold ?? p.min_threshold ?? 3); // same default as a new product (3)
      return q <= threshold;
    });
  }, [allProducts]);

  // Calculations for Current Month Expenses
  const currentMonthTotalExpenses = useMemo(() => {
    return roundCurrency(Object.values(monthlyExpensesMap).reduce((sum, e) => sum + (Number(e.amount) || 0), 0));
  }, [monthlyExpensesMap]);

  // Net Profit = Month Gross Profit - Current Month Expenses
  const currentMonthNetProfit = useMemo(() => {
    return roundCurrency(currentMonthGrossProfit - currentMonthTotalExpenses);
  }, [currentMonthGrossProfit, currentMonthTotalExpenses]);

  // Expenses breakdown by item for current month
  const categoryExpensesBreakdown = useMemo(() => {
    return Object.values(monthlyExpensesMap)
      .filter(r => (Number(r.amount) || 0) > 0)
      .map((r, idx) => {
        const name = r.itemName || r.item_name || `بند مصروف ${idx + 1}`;
        const id = r.id || r.itemId || r.local_id || `exp-${idx}`;
        return [name, Number(r.amount) || 0, id];
      })
      .sort((a, b) => b[1] - a[1]);
  }, [monthlyExpensesMap]);

  if (authLoading || (!user && loading)) {
    return (
      <div className={styles.loadingWrapper}>
        <div className={styles.loadingSpinner} />
        <p className={styles.loadingText}>
          جاري تحميل لوحة التحكم الشاملة...
        </p>
      </div>
    );
  }

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <Sidebar 
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      <div className="main-content">
        <Navbar 
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
        />

        <main className="page-wrapper">
          {/* 1. Hero Bento Banner */}
          <section className={styles.heroBanner}>
            <div className={styles.heroProfile}>
              <div className={styles.heroAvatar}>
                {user?.displayName ? user.displayName.charAt(0).toUpperCase() : "N"}
              </div>
              <div>
                <h2 className={styles.heroGreeting}>
                  مرحباً بك، {user?.displayName || "مدير النظام"} 👋
                </h2>
                <div className={styles.heroSubtitle}>
                  <span>لوحة المتابعة الشاملة لـ</span>
                  <strong className="gradient-text-rose">Nelly</strong>
                  <span className={styles.heroRoleTag}>
                    {isAdmin ? "👑 مسؤول النظام" : "👤 كاشير"}
                  </span>
                </div>
              </div>
            </div>

            <div className={styles.heroDateBadge}>
              <div className={styles.liveDot} />
              <span>الوردية نشطة ومفتوحة</span>
              <span>•</span>
              <span className="num-font" dir="ltr">{todayStr}</span>
            </div>
          </section>

          {/* 2. Bento KPI Grid (4 Main Clean Metrics) */}
          <section className={styles.bentoKPIGrid}>
            {/* Today Sales */}
            <StatCard 
              title="المبيعات"
              value={todaySalesRevenue}
              suffix="ج.م"
              icon={ShoppingBag}
              theme="rose"
            />

            {/* Total Net Profit / Month Revenue */}
            <StatCard 
              title="صافي الارباح"
              value={isAdmin ? currentMonthNetProfit : "🔒"}
              suffix={isAdmin ? "ج.م" : "خاص بالمسؤول"}
              icon={TrendingUp}
              theme={currentMonthNetProfit >= 0 ? "emerald" : "ruby"}
            />

            {/* Total Inventory Volume */}
            <StatCard 
              title="إجمالي بضاعة المحل"
              value={totalStockItems}
              suffix="قطعة"
              icon={Boxes}
              theme="purple"
            />

            {/* Low Stock Items Alert */}
            <StatCard 
              title="نواقص المحل والمخزن"
              value={lowStockItems.length}
              suffix="صنف"
              icon={AlertTriangle}
              theme={lowStockItems.length === 0 ? "emerald" : "gold"}
            />
          </section>

          {/* 3. Two-Column Content Grid: Activity Feed & Insights */}
          <div className={styles.contentGrid}>
            {/* Left Col: Recent Sales Invoices (Activity Feed) */}
            <section className={styles.feedPanel}>
              <div className={styles.feedHeader}>
                <div className={styles.feedTitleGroup}>
                  <Receipt size={20} color="#db2777" />
                  <h3 className={styles.feedTitle}>أحدث فواتير المبيعات</h3>
                  <span className={styles.feedCountBadge}>{activeSales.length}</span>
                </div>
                <Link href="/pos" className={styles.viewAllLink}>
                  عرض كل الفواتير <ChevronLeft size={14} />
                </Link>
              </div>

              {activeSales.length === 0 ? (
                <div className={styles.emptyStateBox}>
                  <ShoppingBag size={32} color="#db2777" style={{ margin: "0 auto 8px", opacity: 0.6 }} />
                  لا توجد فواتير مبيعات مسجلة حتى الآن. ابدأ البيع من الكاشير!
                </div>
              ) : (
                <div className={styles.activityList}>
                  {activeSales.slice(0, 6).map((inv, idx) => (
                    <div 
                      key={inv.id || inv.local_id || inv.invoiceNumber || `sale-${idx}`} 
                      className={styles.activityItem}
                      onClick={() => setViewingInvoice(inv)}
                      title="اضغط لمعاينة الفاتورة"
                    >
                      <div className={styles.activityLeft}>
                        <div className={styles.activityIconBox}>
                          <Receipt size={18} />
                        </div>
                        <div>
                          <div className={styles.activityInvNum}>
                            <span className="num-font" dir="ltr">{inv.invoiceNumber}</span>
                            {" • "}
                            <span>{inv.customer?.name || "عميل نقدي"}</span>
                          </div>
                          <div className={styles.activityMeta}>
                            <span>{inv.itemsCount || inv.items?.length || 1} قطع</span>
                            {" • "}
                            <span>{inv.date ? new Date(inv.date).toLocaleDateString("ar-EG") : "اليوم"}</span>
                            {" • "}
                            <span>{inv.paymentMethod || "نقدي"}</span>
                          </div>
                        </div>
                      </div>

                      <div className={styles.activityRight}>
                        <div className={styles.activityAmount}>
                          <span className="num-font" dir="ltr">{formatNumber(inv.total)}</span> ج.م
                        </div>
                        <span className={styles.activityStatusBadge}>✓ مكتملة</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Right Col: Low Stock Alerts & Monthly Expenses */}
            <div>
              {/* Low Stock Panel */}
              <section className={styles.urgentStockPanel}>
                <div className={styles.feedHeader}>
                  <div className={styles.feedTitleGroup}>
                    <AlertTriangle size={18} color="#ea580c" />
                    <h3 className={styles.feedTitle}>نواقص تحتاج شراء سريع</h3>
                    <span className="badge badge-low-stock">{lowStockItems.length}</span>
                  </div>
                  <Link href="/shop" className={styles.viewAllLink}>
                    بضاعة المحل <ChevronLeft size={14} />
                  </Link>
                </div>

                {lowStockItems.length === 0 ? (
                  <div className={styles.emptyStateBox} style={{ color: "#059669" }}>
                    <CheckCircle2 size={28} style={{ margin: "0 auto 6px" }} />
                    جميع أصناف المحل والمخزن بكميات آمنة!
                  </div>
                ) : (
                  <div className={styles.stockAlertList}>
                    {lowStockItems.slice(0, 4).map((item, idx) => (
                      <div key={item.id || item.local_id || item.barcode || `item-${idx}`} className={styles.stockAlertItem}>
                        <div>
                          <div className={styles.stockItemName}>{item.name}</div>
                          <div style={{ fontSize: "0.72rem", color: "#9a3412", marginTop: "2px" }}>
                            باركود: <span className="num-font" dir="ltr">{item.barcode || "—"}</span>
                          </div>
                        </div>
                        <span className={styles.stockItemQtyBadge}>
                          {Number(item.quantity) === 0 ? "نفد" : `متبقي ${item.quantity}`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Monthly Expenses Snapshot */}
              <section className={styles.expensesSnapshotPanel}>
                <div className={styles.feedHeader}>
                  <div className={styles.feedTitleGroup}>
                    <PieChart size={18} color="#db2777" />
                    <h3 className={styles.feedTitle}>توزيع مصاريف الشهر</h3>
                  </div>
                  <Link href="/expenses" className={styles.viewAllLink}>
                    المصاريف <ChevronLeft size={14} />
                  </Link>
                </div>

                {categoryExpensesBreakdown.length === 0 ? (
                  <div className={styles.emptyStateBox}>
                    لم يتم تسجيل أي مصاريف في هذا الشهر بعد.
                  </div>
                ) : (
                  <div className={styles.expenseBarList}>
                    {categoryExpensesBreakdown.slice(0, 4).map(([catName, catAmount, catKey], idx) => {
                      const percentage = currentMonthTotalExpenses > 0 ? Math.round((catAmount / currentMonthTotalExpenses) * 100) : 0;
                      return (
                        <div key={catKey || `exp-bar-${idx}`}>
                          <div className={styles.expenseRow}>
                            <span>{catName}</span>
                            <span style={{ color: "#db2777" }}>
                              {isAdmin ? (
                                <>
                                  <span className="num-font" dir="ltr">{formatNumber(catAmount)}</span> ج.م ({percentage}%)
                                </>
                              ) : "🔒"}
                            </span>
                          </div>
                          <div className={styles.expenseFillBg}>
                            <div className={styles.expenseFillBar} style={{ width: `${percentage}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          </div>

        </main>
      </div>

      {/* POS Receipt Preview Modal */}
      {viewingInvoice && (
        <POSReceiptModal 
          isOpen={!!viewingInvoice}
          onClose={() => setViewingInvoice(null)}
          invoice={viewingInvoice}
        />
      )}
    </div>
  );
}

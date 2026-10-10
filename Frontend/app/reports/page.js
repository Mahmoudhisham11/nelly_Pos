"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import StatCard from "@/components/StatCard";
import ReportDetailsModal from "@/components/reports/ReportDetailsModal";
import { subscribeToReports, deleteReport } from "@/lib/salesService";
import { formatNumber, roundCurrency, getLocalDateString } from "@/lib/utils";
import { 
  CalendarCheck, 
  Search, 
  Calendar, 
  DollarSign, 
  TrendingUp, 
  Banknote, 
  Receipt, 
  Eye, 
  X, 
  Sparkles, 
  Trash2, 
  Download 
} from "lucide-react";
import styles from "./reports.module.css";

export default function ReportsPage() {
  const router = useRouter();
  const { user, isAdmin, loading: authLoading } = useAuth();

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [dateQuery, setDateQuery] = useState(""); // YYYY-MM-DD
  const [searchQuery, setSearchQuery] = useState("");
  const [quickDateFilter, setQuickDateFilter] = useState("all"); // "all" | "today" | "yesterday" | "week" | "month"

  // Modal
  const [selectedReport, setSelectedReport] = useState(null);

  // Feedback
  const [toastMessage, setToastMessage] = useState("");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Auth protection
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  // Subscribe to Shift Reports
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToReports((data) => {
      setReports(data);
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 4500);
  };

  // Quick date filter handler
  const handleQuickFilter = (type) => {
    setQuickDateFilter(type);
    const now = new Date();

    if (type === "all") {
      setDateQuery("");
    } else if (type === "today") {
      const todayStr = getLocalDateString(now);
      setDateQuery(todayStr);
    } else if (type === "yesterday") {
      const yest = new Date(now);
      yest.setDate(yest.getDate() - 1);
      setDateQuery(getLocalDateString(yest));
    } else if (type === "week" || type === "month") {
      setDateQuery(""); // Handled in filter logic
    }
  };

  // Filtered reports
  const filteredReports = useMemo(() => {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return reports.filter((rep) => {
      const repDate = new Date(rep.closedAt || rep.date || rep.createdAt);
      const repDateStr = getLocalDateString(repDate);


      // Date match
      let dateMatches = true;
      if (quickDateFilter === "week") {
        dateMatches = repDate >= sevenDaysAgo;
      } else if (quickDateFilter === "month") {
        dateMatches = repDate >= firstDayOfMonth;
      } else if (dateQuery) {
        dateMatches = 
          repDateStr === dateQuery || 
          (rep.date && rep.date.startsWith(dateQuery)) || 
          (rep.closedAt && rep.closedAt.startsWith(dateQuery));
      }

      // Text search match
      const q = searchQuery.trim().toLowerCase();
      let textMatches = true;
      if (q) {
        textMatches = 
          (rep.reportNumber && rep.reportNumber.toLowerCase().includes(q)) ||
          (rep.closedBy?.name && rep.closedBy.name.toLowerCase().includes(q)) ||
          (rep.notes && rep.notes.toLowerCase().includes(q));
      }

      return dateMatches && textMatches;
    });
  }, [reports, dateQuery, searchQuery, quickDateFilter]);

  // Aggregate KPI stats
  const aggregateStats = useMemo(() => {
    let salesTotal = 0;
    let profitTotal = 0;
    let cashTotal = 0;
    let invCount = 0;

    filteredReports.forEach((rep) => {
      salesTotal += (rep.totalSales || 0);
      profitTotal += (rep.totalProfit || 0);
      cashTotal += (rep.paymentBreakdown?.["نقدي"] || 0);
      invCount += (rep.invoicesCount || (rep.invoices || []).length);
    });

    return {
      shiftsCount: filteredReports.length,
      invoicesCount: invCount,
      totalSales: roundCurrency(salesTotal),
      totalProfit: roundCurrency(profitTotal),
      totalCash: roundCurrency(cashTotal)
    };
  }, [filteredReports]);


  // Export to CSV
  const exportToCSV = () => {
    if (filteredReports.length === 0) {
      showToast("لا توجد بيانات ورديات لتصديرها.");
      return;
    }

    const headers = [
      "رقم التقفيلة",
      "تاريخ الإغلاق",
      "المسؤول (الكاشير)",
      "عدد الفواتير",
      "إجمالي المبيعات (ج.م)",
      "صافي الأرباح (ج.م)",
      "كاش",
      "فيزا",
      "تحويل",
      "آجل",
      "ملاحظات"
    ];

    const rows = filteredReports.map((rep) => [
      `"${rep.reportNumber || ''}"`,
      `"${new Date(rep.closedAt || rep.date).toLocaleString("ar-EG")}"`,
      `"${rep.closedBy?.name || 'كاشير المحل'}"`,
      rep.invoicesCount || (rep.invoices || []).length,
      rep.totalSales || 0,
      rep.totalProfit || 0,
      rep.paymentBreakdown?.["نقدي"] || 0,
      rep.paymentBreakdown?.["فيزا"] || 0,
      rep.paymentBreakdown?.["تحويل"] || 0,
      rep.paymentBreakdown?.["آجل"] || 0,
      `"${rep.notes || ''}"`
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `تقرير_تقفيلة_الأيام_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Admin delete report
  const handleDeleteReport = async (repId, e) => {
    e.stopPropagation();
    if (!isAdmin) {
      showToast("عفواً، حذف تقرير الوردية مقتصر على المدير فقط.");
      return;
    }

    const isConfirmed = window.confirm("هل أنت متأكد من رغبتك في حذف تقرير الوردية هذا نهائياً من السجلات؟");
    if (!isConfirmed) return;

    try {
      await deleteReport(repId);
      showToast("تم حذف تقرير الوردية بنجاح.");
      if (selectedReport?.id === repId) {
        setSelectedReport(null);
      }
    } catch (err) {
      console.error("Delete report error:", err);
      showToast("حدث خطأ أثناء حذف التقرير.");
    }
  };

  if (authLoading || (!user && loading)) {
    return (
      <div className={styles.loadingWrapper}>
        <p className={styles.loadingText}>جاري تحميل تقارير تقفيلة الأيام...</p>
      </div>
    );
  }

  return (
    <div className="app-layout">
      {toastMessage && (
        <div className="fixed-toast-notification">
          <Sparkles className="toast-icon" />
          <span>{toastMessage}</span>
        </div>
      )}

      <Sidebar 
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      <div className="main-content">
        <Navbar 
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          title="تقفيلة الأيام (الورديات)"
        />

        <main className="page-wrapper">
          {/* Page Header */}
          <div className={styles.pageHeader}>
            <div>
              <div className={styles.headerTitleGroup}>
                <div className={styles.headerIconBox}>
                  <CalendarCheck size={22} />
                </div>
                <div>
                  <div className={styles.headerTitleGroup}>
                    <h2 className={styles.headerMainTitle}>
                      سجل تقفيلة الأيام والورديات
                    </h2>
                    <span className={`badge badge-code ${styles.shiftsCountBadge}`}>
                      <span className="num-font" dir="ltr">{formatNumber(filteredReports.length)}</span> وردية مسجلة
                    </span>
                  </div>
                </div>
              </div>
              <p className={styles.headerSubtitle}>
                أرشيف شامل ومفصل لكافة الورديات المقفلة، مع استعراض الأرباح، الكاش المحصل، وكافة الفواتير والأصناف المباعة
              </p>
            </div>

            {/* Action buttons */}
            <div className={styles.headerActions}>
              <button 
                onClick={exportToCSV} 
                className={`btn-secondary ${styles.exportBtn}`} 
                title="تصدير كشف الورديات إلى ملف CSV" 
              >
                <Download size={16} color="#059669" />
                تصدير تقرير الورديات
              </button>
            </div>
          </div>

          {/* 4 KPI Summary Stat Cards */}
          <div className={styles.kpiGrid}>
            <StatCard 
              title="إجمالي المبيعات المؤرشفة"
              value={aggregateStats.totalSales}
              suffix="ج.م"
              subtitle="إجمالي قيمة فواتير الورديات المحددة"
              icon={DollarSign}
              theme="rose"
            />
            <StatCard 
              title="صافي أرباح الفترة"
              value={aggregateStats.totalProfit}
              suffix="ج.م"
              subtitle="الأرباح الصافية بعد خصم تكلفة البضاعة"
              icon={TrendingUp}
              theme="emerald"
            />
            <StatCard 
              title="إجمالي النقدية (الكاش)"
              value={aggregateStats.totalCash}
              suffix="ج.م"
              subtitle="المبالغ النقدية المحصلة في الدرج"
              icon={Banknote}
              theme="gold"
            />
            <StatCard 
              title="الورديات والفواتير"
              value={aggregateStats.shiftsCount}
              suffix="وردية"
              subtitle={`تتضمن ${formatNumber(aggregateStats.invoicesCount)} فاتورة مباعة`}
              icon={Receipt}
              theme="purple"
            />
          </div>

          {/* Filter & Search Toolbar */}
          <div className={`glass-panel ${styles.filterPanel}`}>
            <div className={styles.filterPanelContent}>
              {/* Search text */}
              <div className={styles.searchWrap}>
                <input 
                  type="text"
                  placeholder="ابحث برقم الوردية، اسم الكاشير، أو الملاحظات..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`form-input ${styles.searchInput}`}
                />
                <Search 
                  size={16} 
                  color="#db2777" 
                  className={styles.searchIcon}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className={styles.clearSearchBtn}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Specific Date Picker */}
              <div className={styles.datePickerWrap}>
                <Calendar size={16} color="#db2777" />
                <span className={styles.datePickerLabel}>تاريخ محدد:</span>
                <input 
                  type="date"
                  value={dateQuery}
                  onChange={(e) => {
                    setDateQuery(e.target.value);
                    setQuickDateFilter("custom");
                  }}
                  className={`form-input num-font ${styles.dateInput}`}
                />
                {dateQuery && (
                  <button
                    onClick={() => {
                      setDateQuery("");
                      setQuickDateFilter("all");
                    }}
                    className={styles.clearDateBtn}
                  >
                    مسح
                    <X size={14} />
                  </button>
                )}
              </div>

              {(searchQuery || dateQuery) && (
                <button
                  onClick={() => { setSearchQuery(""); setDateQuery(""); }}
                  className={`btn-secondary ${styles.resetFiltersBtn}`}
                >
                  إعادة ضبط
                </button>
              )}

              <button
                onClick={exportToCSV}
                disabled={filteredReports.length === 0}
                className={`btn-secondary ${styles.exportBtn}`}
                title="تصدير جدول تقارير الورديات لملف Excel / CSV"
              >
                <Download size={16} />
                <span>تصدير Excel</span>
              </button>
            </div>
          </div>

          {/* Shift Reports Table */}
          <div className={`table-container ${styles.tableSection}`}>
            {loading ? (
              <div className={styles.emptyPlaceholder}>
                <p className={styles.loadingText}>جاري تحميل تقارير تقفيلة الأيام...</p>
              </div>
            ) : filteredReports.length === 0 ? (
              <div className={styles.emptyPlaceholder}>
                <CalendarCheck size={48} color="#9333ea" className={styles.emptyIcon} />
                <h3 className={styles.emptyTitle}>
                  لا توجد تقارير ورديات مسجلة
                </h3>
                <p className={styles.emptySubtitle}>
                  {searchQuery || dateQuery 
                    ? "لا توجد تقارير تطابق معايير البحث أو التاريخ المحددة." 
                    : "عند تقفيل أي وردية من الكاشير (POS)، سيتم أرشفة بياناتها وتفاصيلها هنا."}
                </p>
              </div>
            ) : (
              <table className="custom-table">
                <thead>
                  <tr>
                    <th className={styles.thNowrap}>رقم التقفيلة</th>
                    <th className={styles.thNowrap}>تاريخ ووقت الإغلاق</th>
                    <th className={styles.thNowrap}>المسؤول (الكاشير)</th>
                    <th className={styles.thCenter}>الفواتير والأصناف</th>
                    <th className={styles.thCenter}>إجمالي المبيعات</th>
                    <th className={styles.thCenter}>صافي الربح</th>
                    <th className={styles.thNowrap}>تفصيل المقبوضات</th>
                    <th className={styles.thNowrap}>ملاحظات الوردية</th>
                    <th className={styles.thCenter}>الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReports.map((rep) => (
                    <tr 
                      key={rep.id}
                      onClick={() => setSelectedReport(rep)}
                      className={styles.tableRowClickable}
                    >
                      <td>
                        <span className={`num-font ${styles.reportNumberTag}`} dir="ltr">
                          {rep.reportNumber}
                        </span>
                      </td>
                      <td>
                        <div className={styles.closedDateText}>
                          {new Date(rep.closedAt || rep.date).toLocaleDateString("ar-EG")}
                        </div>
                        <div className={`num-font ${styles.closedTimeText}`} dir="ltr">
                          {new Date(rep.closedAt || rep.date).toLocaleTimeString("ar-EG", { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td className={styles.closedByText}>
                        {rep.closedBy?.name || "كاشير المحل"}
                      </td>
                      <td className={styles.thCenter}>
                        <span className={styles.invoicesCountBadge}>
                          <span className="num-font" dir="ltr">{rep.invoicesCount || (rep.invoices || []).length}</span> فاتورة 
                          {rep.totalItemsSold ? ` • ${rep.totalItemsSold} قطعة` : ""}
                        </span>
                      </td>
                      <td className={styles.thCenter}>
                        <span className={`num-font ${styles.totalSalesVal}`} dir="ltr">
                          {formatNumber(rep.totalSales)} ج.م
                        </span>
                      </td>
                      <td className={styles.thCenter}>
                        <span className={`num-font ${styles.totalProfitVal}`} dir="ltr">
                          +{formatNumber(rep.totalProfit)} ج.م
                        </span>
                      </td>
                      <td>
                        <div className={styles.breakdownContainer}>
                          {rep.paymentBreakdown?.["نقدي"] > 0 && (
                            <span className={styles.cashPill}>
                              كاش: <strong className="num-font" dir="ltr">{formatNumber(rep.paymentBreakdown["نقدي"])}</strong>
                            </span>
                          )}
                          {rep.paymentBreakdown?.["فيزا"] > 0 && (
                            <span className={styles.visaPill}>
                              فيزا: <strong className="num-font" dir="ltr">{formatNumber(rep.paymentBreakdown["فيزا"])}</strong>
                            </span>
                          )}
                          {rep.paymentBreakdown?.["تحويل"] > 0 && (
                            <span className={styles.transferPill}>
                              تحويل: <strong className="num-font" dir="ltr">{formatNumber(rep.paymentBreakdown["تحويل"])}</strong>
                            </span>
                          )}
                          {rep.paymentBreakdown?.["آجل"] > 0 && (
                            <span className={styles.duePill}>
                              آجل: <strong className="num-font" dir="ltr">{formatNumber(rep.paymentBreakdown["آجل"])}</strong>
                            </span>
                          )}
                        </div>
                      </td>
                      <td className={styles.notesCol}>
                        {rep.notes || "—"}
                      </td>
                      <td className={styles.thCenter}>
                        <div className={styles.actionsColWrap} onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setSelectedReport(rep)}
                            className={`btn-secondary ${styles.viewReportBtn}`}
                            title="عرض فواتير وأصناف الوردية بالتفصيل"
                          >
                            <Eye size={14} color="#9333ea" />
                            <span>عرض الوردية</span>
                          </button>

                          {isAdmin && (
                            <button
                              onClick={(e) => handleDeleteReport(rep.id, e)}
                              className={`btn-danger ${styles.deleteReportBtn}`}
                              title="حذف هذا التقرير نهائياً (مدير فقط)"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </main>
      </div>

      {/* Detailed Shift Report Modal */}
      <ReportDetailsModal
        selectedReport={selectedReport}
        onClose={() => setSelectedReport(null)}
      />

    </div>
  );
}

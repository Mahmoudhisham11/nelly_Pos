"use client";

import { invoiceDate } from "@/lib/invoiceTime";
import { useState, useRef, useEffect } from "react";
import { Receipt, Search, Eye, RotateCcw, X, Filter, ChevronDown, Check, Printer } from "lucide-react";
import { formatNumber } from "@/lib/utils";
import styles from "./POSShiftInvoices.module.css";

export default function POSShiftInvoices({
  show,
  onClose,
  invoiceSearchQuery,
  setInvoiceSearchQuery,
  paymentFilter,
  setPaymentFilter,
  loading,
  currentShiftSales = [],
  filteredShiftSales = [],
  onInspectInvoice,
  onPrintInvoice,
  onReturnFullInvoice
}) {
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const filterDropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(e.target)) {
        setIsFilterDropdownOpen(false);
      }
    }
    if (isFilterDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isFilterDropdownOpen]);

  if (!show) return null;

  const paymentOptions = [
    { key: "all", label: "جميع طرق الدفع" },
    { key: "نقدي", label: "نقدي (كاش)" },
    { key: "فيزا", label: "دفع إلكتروني (فيزا)" },
    { key: "تحويل", label: "تحويل بنكي / محفظة" },
    { key: "آجل", label: "مبيعات آجلة (حساب)" }
  ];

  const currentFilterLabel = paymentOptions.find(o => o.key === paymentFilter)?.label || "الكل";

  return (
    <div className="pos-invoices-view-container animate-fade-in">
      {/* Top Header of Shift Invoices Table */}
      <div className="pos-invoices-view-header">
        <div className={styles.headerBrand}>
          <div className={styles.headerIconWrapper}>
            <Receipt size={22} />
          </div>
          <div>
            <h2 className={styles.headerTitle}>
              فواتير ومبيعات الوردية المفتوحة
            </h2>
            <p className={styles.headerSubtitle}>
              إجمالي {currentShiftSales.length} فاتورة صادرة خلال الوردية الحالية
            </p>
          </div>
        </div>
      </div>

      {/* Search & Compact Filter Toolbar */}
      <div className={styles.toolbarContainer}>
        {/* Compact Search */}
        <div className={styles.compactSearchWrap}>
          <Search size={16} className={styles.searchIcon} />
          <input
            type="text"
            placeholder="ابحث برقم الفاتورة أو العميل..."
            value={invoiceSearchQuery}
            onChange={(e) => setInvoiceSearchQuery(e.target.value)}
            className={styles.compactSearchInput}
          />
          {invoiceSearchQuery && (
            <button
              onClick={() => setInvoiceSearchQuery("")}
              className={styles.clearSearchBtn}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filter Dropdown Button */}
        <div className={styles.filterDropdownWrapper} ref={filterDropdownRef}>
          <button
            type="button"
            onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
            className={`${styles.filterDropdownBtn} ${paymentFilter !== "all" ? styles.filterDropdownBtnActive : ""}`}
            title="تصفية حسب طريقة الدفع"
          >
            <Filter size={15} />
            <span className={styles.filterBtnText}>{currentFilterLabel}</span>
            <ChevronDown size={14} className={isFilterDropdownOpen ? styles.chevronRotated : ""} />
          </button>

          {isFilterDropdownOpen && (
            <div className={styles.dropdownMenu}>
              <div className={styles.dropdownMenuHeader}>طريقة الدفع</div>
              {paymentOptions.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => {
                    setPaymentFilter(opt.key);
                    setIsFilterDropdownOpen(false);
                  }}
                  className={`${styles.dropdownMenuItem} ${paymentFilter === opt.key ? styles.dropdownMenuItemActive : ""}`}
                >
                  <span>{opt.label}</span>
                  {paymentFilter === opt.key && <Check size={14} />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Data Table Container with safe horizontal scrolling */}
      <div className="pos-table-scroll-wrap">
        {loading ? (
          <div className={styles.loadingState}>
            <p>جاري تحميل فواتير الوردية...</p>
          </div>
        ) : filteredShiftSales.length === 0 ? (
          <div className={styles.emptyState}>
            <Receipt size={48} className={styles.emptyStateIcon} />
            <h3 className={styles.emptyStateTitle}>
              لا توجد فواتير مبيعات في هذه الوردية حالياً
            </h3>
            <p className={styles.emptyStateText}>
              {currentShiftSales.length === 0
                ? "الوردية جديدة وفارغة. اضغط على زر العودة للسلة لإجراء عمليات البيع."
                : "لا توجد فواتير تطابق نص البحث أو الفلتر المحدد."}
            </p>
          </div>
        ) : (
          <table className="pos-invoices-data-table">
            <thead>
              <tr>
                <th>رقم الفاتورة</th>
                <th>الوقت</th>
                <th>العميل</th>
                <th>الأصناف</th>
                <th>طريقة الدفع</th>
                <th>الإجمالي</th>
                <th>الربح</th>
                <th>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filteredShiftSales.map((inv) => (
                <tr 
                  key={inv.id}
                  onClick={() => onInspectInvoice(inv)}
                  className="pos-table-row-item"
                >
                  <td className={`font-mono font-bold ${styles.invoiceNumberCell}`}>
                    {inv.invoiceNumber}
                  </td>
                  <td className={styles.timeCell}>
                    {invoiceDate(inv).toLocaleTimeString("ar-EG", { hour: '2-digit', minute: '2-digit', timeZone: "Africa/Cairo" })}
                  </td>
                  <td>
                    <div className="font-bold text-xs text-[var(--text-primary)]">
                      {inv.customer?.name || "عميل نقدي"}
                    </div>
                    {inv.customer?.phone && (
                      <div className="font-mono text-[11px] text-[var(--text-muted)]">
                        {inv.customer.phone}
                      </div>
                    )}
                  </td>
                  <td>
                    <span className="pos-items-pill">
                      {inv.itemsCount || (inv.items || []).reduce((a, c) => a + (c.quantity || 1), 0)} قطعة
                    </span>
                  </td>
                  <td>
                    <span className={`pos-payment-tag tag-${inv.paymentMethod}`}>
                      {inv.paymentMethod || "نقدي"}
                    </span>
                  </td>
                  <td className="font-mono font-bold text-sm text-[var(--text-primary)]">
                    {formatNumber(inv.total)} ج.م
                  </td>
                  <td className="font-mono font-bold text-xs text-emerald-600">
                    +{formatNumber(inv.totalProfit)} ج.م
                  </td>
                  <td>
                    <div className={styles.actionCell} onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => onInspectInvoice(inv)}
                        className="btn-pos-row-action btn-action-inspect"
                        title="عرض الأصناف وتفاصيل الفاتورة"
                      >
                        <Eye size={14} />
                        <span>الأصناف</span>
                      </button>
                      {onPrintInvoice && (
                        <button
                          onClick={() => onPrintInvoice(inv)}
                          className="btn-pos-row-action btn-action-print"
                          title="طباعة الفاتورة الحرارية"
                          style={{
                            background: "#eff6ff",
                            color: "#2563eb",
                            borderColor: "#bfdbfe"
                          }}
                        >
                          <Printer size={14} />
                          <span>طباعة</span>
                        </button>
                      )}
                      <button
                        onClick={() => onReturnFullInvoice(inv)}
                        className="btn-pos-row-action btn-action-refund"
                        title="مرتجع كامل الفاتورة وإلغاؤها"
                      >
                        <RotateCcw size={14} />
                        <span>مرتجع</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

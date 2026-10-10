"use client";

import { useState, useMemo } from "react";
import { 
  CalendarCheck, 
  Printer, 
  X, 
  Receipt, 
  Boxes, 
  Banknote, 
  ChevronUp, 
  ChevronDown, 
  CreditCard, 
  Building 
} from "lucide-react";
import { formatNumber } from "@/lib/utils";
import styles from "./ReportDetailsModal.module.css";

export default function ReportDetailsModal({
  selectedReport,
  onClose
}) {
  const [modalActiveTab, setModalActiveTab] = useState("invoices"); // "invoices" | "items" | "payments"
  const [expandedInvoiceId, setExpandedInvoiceId] = useState(null);

  // Consolidated items sold in selected report
  const selectedReportConsolidatedItems = useMemo(() => {
    if (!selectedReport || !selectedReport.invoices) return [];
    const map = {};

    selectedReport.invoices.forEach((inv) => {
      (inv.items || []).forEach((it) => {
        const key = it.productId || it.barcode || it.name;
        if (!map[key]) {
          map[key] = {
            name: it.name,
            barcode: it.barcode || it.code || "—",
            sellingPrice: it.sellingPrice || 0,
            wholesalePrice: it.wholesalePrice || 0,
            quantity: 0,
            totalSales: 0,
            totalProfit: 0
          };
        }
        const qty = Number(it.quantity) || 1;
        const sub = it.subtotal || qty * it.sellingPrice;
        const profit = it.profit || (it.sellingPrice - (it.wholesalePrice || 0)) * qty;

        map[key].quantity += qty;
        map[key].totalSales += sub;
        map[key].totalProfit += profit;
      });
    });

    return Object.values(map).sort((a, b) => b.quantity - a.quantity);
  }, [selectedReport]);

  const handlePrintReport = () => {
    window.print();
  };

  if (!selectedReport) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal-content ${styles.modalContainer}`} onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div className={styles.headerBrand}>
            <div className={styles.headerIcon}>
              <CalendarCheck size={22} />
            </div>
            <div>
              <div className={styles.titleWrapper}>
                <h3 className={`modal-title font-mono font-bold ${styles.headerTitle}`}>
                  تقرير الوردية: {selectedReport.reportNumber}
                </h3>
                <span className={`badge badge-code ${styles.cashierBadge}`}>
                  {selectedReport.closedBy?.name || "كاشير المحل"}
                </span>
              </div>
              <p className={styles.headerSubtitle}>
                تاريخ ووقت الإغلاق: {new Date(selectedReport.closedAt || selectedReport.date).toLocaleString("ar-EG")}
              </p>
            </div>
          </div>

          <div className={styles.headerActions}>
            <button
              onClick={handlePrintReport}
              className={`btn-secondary ${styles.printBtn}`}
            >
              <Printer size={15} color="#9333ea" />
              <span>طباعة التقرير</span>
            </button>
            <button onClick={onClose} className="modal-close-btn" type="button">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className={styles.modalBody}>
          {/* Top KPI Cards in Modal */}
          <div className={styles.kpiGrid}>
            <div className={styles.kpiCardSales}>
              <span className={styles.kpiLabelSales}>إجمالي المبيعات</span>
              <div className={`num-font ${styles.kpiValueSales}`} dir="ltr">
                {formatNumber(selectedReport.totalSales)} ج.م
              </div>
            </div>

            <div className={styles.kpiCardProfit}>
              <span className={styles.kpiLabelProfit}>صافي الربح</span>
              <div className={`num-font ${styles.kpiValueProfit}`} dir="ltr">
                +{formatNumber(selectedReport.totalProfit)} ج.م
              </div>
            </div>

            <div className={styles.kpiCardCash}>
              <span className={styles.kpiLabelCash}>الكاش المستلم</span>
              <div className={`num-font ${styles.kpiValueCash}`} dir="ltr">
                {formatNumber(selectedReport.paymentBreakdown?.["نقدي"] || 0)} ج.م
              </div>
            </div>

            <div className={styles.kpiCardInvoices}>
              <span className={styles.kpiLabelInvoices}>عدد الفواتير</span>
              <div className={`num-font ${styles.kpiValueInvoices}`} dir="ltr">
                {selectedReport.invoicesCount || (selectedReport.invoices || []).length} فاتورة
              </div>
            </div>
          </div>

          {/* Notes Banner if available */}
          {selectedReport.notes && (
            <div className={styles.notesBanner}>
              <strong>ملاحظات الإغلاق:</strong> {selectedReport.notes}
            </div>
          )}

          {/* Modal Tabs Navigation */}
          <div className={styles.tabsNav}>
            <button
              onClick={() => setModalActiveTab("invoices")}
              className={`${styles.tabBtn} ${modalActiveTab === "invoices" ? styles.tabBtnActive : ""}`}
            >
              <Receipt size={16} />
              <span>فواتير الوردية ({(selectedReport.invoices || []).length})</span>
            </button>

            <button
              onClick={() => setModalActiveTab("items")}
              className={`${styles.tabBtn} ${modalActiveTab === "items" ? styles.tabBtnActive : ""}`}
            >
              <Boxes size={16} />
              <span>الأصناف المباعة بالوردية ({selectedReportConsolidatedItems.length})</span>
            </button>

            <button
              onClick={() => setModalActiveTab("payments")}
              className={`${styles.tabBtn} ${modalActiveTab === "payments" ? styles.tabBtnActive : ""}`}
            >
              <Banknote size={16} />
              <span>تفصيل الخزينة والدفع</span>
            </button>
          </div>

          {/* TAB 1: Invoices Accordion List */}
          {modalActiveTab === "invoices" && (
            <div className={styles.invoicesList}>
              {(selectedReport.invoices || []).map((inv, idx) => {
                const isExpanded = expandedInvoiceId === (inv.id || idx);
                const summaryBarClass = `${styles.invoiceSummaryBar} ${isExpanded ? styles.invoiceSummaryBarActive : ""}`;
                return (
                  <div
                    key={inv.id || idx}
                    className={isExpanded ? styles.invoiceCardExpanded : styles.invoiceCard}
                  >
                    {/* Invoice Summary Bar */}
                    <div
                      onClick={() => setExpandedInvoiceId(isExpanded ? null : (inv.id || idx))}
                      className={summaryBarClass}
                    >
                      <div className={styles.invLeftGroup}>
                        <span className={`num-font ${styles.invIndexBadge}`}>
                          {idx + 1}
                        </span>
                        <div>
                          <div className={styles.invNumberGroup}>
                            <span className={`num-font ${styles.invNumber}`} dir="ltr">
                              {inv.invoiceNumber}
                            </span>
                            <span className={styles.invPaymentMethod}>
                              {inv.paymentMethod || "نقدي"}
                            </span>
                          </div>
                          <div className={styles.invCustomer}>
                            العميل: {inv.customer?.name || "عميل نقدي"}
                          </div>
                        </div>
                      </div>

                      <div className={styles.invRightGroup}>
                        <span className={styles.invItemsCount}>
                          {(inv.items || []).length} صنف ({(inv.items || []).reduce((a, c) => a + (c.quantity || 1), 0)} قطعة)
                        </span>
                        <span className={`num-font ${styles.invTotal}`} dir="ltr">
                          {formatNumber(inv.total)} ج.م
                        </span>
                        <span className={styles.invChevron}>
                          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </span>
                      </div>
                    </div>

                    {/* Expanded Items Table */}
                    {isExpanded && (
                      <div className={styles.expandedContainer}>
                        <div className={styles.modalTableWrap}>
                          <table className={styles.customTableSmall}>
                            <thead>
                              <tr>
                                <th className={styles.thRight}>اسم الصنف</th>
                                <th className={styles.thCenter}>الباركود</th>
                                <th className={styles.thCenter}>الكمية</th>
                                <th className={styles.thLeft}>سعر البيع</th>
                                <th className={styles.thLeft}>سعر التكلفة</th>
                                <th className={styles.thLeft}>الإجمالي</th>
                                <th className={styles.thLeft}>الربح</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(inv.items || []).map((it, iIdx) => (
                                <tr key={iIdx}>
                                  <td className={styles.tdName}>{it.name}</td>
                                  <td className={styles.tdBarcode}>
                                    <span className={`num-font ${styles.barcodeBadge}`} dir="ltr">
                                      {it.barcode || "—"}
                                    </span>
                                  </td>
                                  <td className={styles.thCenter}>
                                    <span className={`num-font ${styles.qtyBadge}`}>
                                      {it.quantity}
                                    </span>
                                  </td>
                                  <td className={styles.tdPrice}>
                                    <span className="num-font" dir="ltr">
                                      {formatNumber(it.sellingPrice)} ج.م
                                    </span>
                                  </td>
                                  <td className={styles.tdPrice}>
                                    <span className="num-font" dir="ltr">
                                      {formatNumber(it.wholesalePrice)} ج.م
                                    </span>
                                  </td>
                                  <td className={styles.tdSubtotal}>
                                    <span className="num-font" dir="ltr">
                                      {formatNumber(it.subtotal || it.quantity * it.sellingPrice)} ج.م
                                    </span>
                                  </td>
                                  <td className={styles.tdProfit}>
                                    <span className="num-font" dir="ltr">
                                      +{formatNumber(it.profit || (it.sellingPrice - (it.wholesalePrice || 0)) * it.quantity)} ج.م
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 2: Consolidated Products Sold */}
          {modalActiveTab === "items" && (
            <div className={styles.modalTableWrap}>
              <table className={styles.consolidatedTable}>
                <thead>
                  <tr>
                    <th className={styles.thRight}>اسم الصنف</th>
                    <th className={styles.thCenter}>الباركود</th>
                    <th className={styles.thLeft}>سعر البيع</th>
                    <th className={styles.thCenter}>الكمية المباعة</th>
                    <th className={styles.thLeft}>إجمالي المبيعات</th>
                    <th className={styles.thLeft}>صافي الربح</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedReportConsolidatedItems.map((it, i) => (
                    <tr key={i}>
                      <td className={styles.consolidatedName}>{it.name}</td>
                      <td className={styles.thCenter}>
                        <span className={`num-font ${styles.barcodeBadge}`} dir="ltr">
                          {it.barcode}
                        </span>
                      </td>
                      <td className={styles.tdPrice}>
                        <span className="num-font" dir="ltr">
                          {formatNumber(it.sellingPrice)} ج.م
                        </span>
                      </td>
                      <td className={styles.thCenter}>
                        <span className={`num-font ${styles.qtyBadge}`}>
                          {it.quantity} قطعة
                        </span>
                      </td>
                      <td className={styles.consolidatedSales}>
                        <span className="num-font" dir="ltr">
                          {formatNumber(it.totalSales)} ج.م
                        </span>
                      </td>
                      <td className={styles.consolidatedProfit}>
                        <span className="num-font" dir="ltr">
                          +{formatNumber(it.totalProfit)} ج.م
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 3: Payment Breakdown */}
          {modalActiveTab === "payments" && (selectedReport.closingCashExpected > 0 || selectedReport.openingCash > 0) && (
            <div style={{ display: "grid", gap: 4, marginBottom: 12, padding: 12, borderRadius: 12, background: "var(--bg-card-subtle, #f8fafc)", fontSize: "0.9rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>رصيد بداية الوردية</span><span className="num-font">{formatNumber(selectedReport.openingCash || 0)} ج.م</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800 }}>
                <span>المفروض في الدرج</span><span className="num-font">{formatNumber(selectedReport.closingCashExpected || 0)} ج.م</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>الفعلي بعد العد</span><span className="num-font">{formatNumber(selectedReport.closingCashActual || 0)} ج.م</span>
              </div>
              {Math.abs((selectedReport.closingCashActual || 0) - (selectedReport.closingCashExpected || 0)) >= 0.01 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, color: (selectedReport.closingCashActual || 0) < (selectedReport.closingCashExpected || 0) ? "#dc2626" : "#d97706" }}>
                  <span>{(selectedReport.closingCashActual || 0) < (selectedReport.closingCashExpected || 0) ? "عجز" : "زيادة"}</span>
                  <span className="num-font">{formatNumber(Math.abs((selectedReport.closingCashActual || 0) - (selectedReport.closingCashExpected || 0)))} ج.م</span>
                </div>
              )}
            </div>
          )}
          {modalActiveTab === "payments" && (
            <div className={styles.paymentsGrid}>
              <div className={styles.paymentCardCash}>
                <div className={styles.paymentHeadCash}>
                  <Banknote size={20} />
                  <span>النقدية (كاش الدرج)</span>
                </div>
                <div className={`num-font ${styles.paymentValCash}`} dir="ltr">
                  {formatNumber(selectedReport.paymentBreakdown?.["نقدي"] || 0)} ج.م
                </div>
              </div>

              <div className={styles.paymentCardVisa}>
                <div className={styles.paymentHeadVisa}>
                  <CreditCard size={20} />
                  <span>مدفوعات الفيزا / البطاقات</span>
                </div>
                <div className={`num-font ${styles.paymentValVisa}`} dir="ltr">
                  {formatNumber(selectedReport.paymentBreakdown?.["فيزا"] || 0)} ج.م
                </div>
              </div>

              <div className={styles.paymentCardTransfer}>
                <div className={styles.paymentHeadTransfer}>
                  <Building size={20} />
                  <span>تحويلات بنكية / فودافون كاش</span>
                </div>
                <div className={`num-font ${styles.paymentValTransfer}`} dir="ltr">
                  {formatNumber(selectedReport.paymentBreakdown?.["تحويل"] || 0)} ج.م
                </div>
              </div>

              <div className={styles.paymentCardCredit}>
                <div className={styles.paymentHeadCredit}>
                  <Receipt size={20} />
                  <span>حسابات آجلة (ذمم عملاء)</span>
                </div>
                <div className={`num-font ${styles.paymentValCredit}`} dir="ltr">
                  {formatNumber(selectedReport.paymentBreakdown?.["آجل"] || 0)} ج.م
                </div>
              </div>
            </div>
          )}

          {/* Modal Footer */}
          <div className={`no-print ${styles.modalFooter}`}>
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
            >
              إغلاق
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

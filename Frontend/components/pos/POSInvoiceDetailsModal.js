"use client";

import { invoiceDate } from "@/lib/invoiceTime";
import { Receipt, X, ShoppingCart, RotateCcw, Printer } from "lucide-react";
import { formatNumber } from "@/lib/utils";
import styles from "./POSInvoiceDetailsModal.module.css";

export default function POSInvoiceDetailsModal({
  invoice,
  onClose,
  onReturnItem,
  onReturnFullInvoice,
  onPrintInvoice
}) {
  if (!invoice) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className={`modal-content invoice-details-modal ${styles.modalContainer}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className={styles.headerBrand}>
            <div className={styles.headerIcon}>
              <Receipt size={22} />
            </div>
            <div>
              <h3 className={`modal-title font-mono font-bold ${styles.headerTitle}`}>
                فاتورة: {invoice.invoiceNumber}
              </h3>
              <p className={styles.headerSubtitle}>
                {invoiceDate(invoice).toLocaleString("ar-EG", { timeZone: "Africa/Cairo" })}
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="modal-close-btn"
            title="إغلاق"
          >
            <X size={18} />
          </button>
        </div>

        <div className={`modal-body ${styles.modalBody}`}>
          {/* Meta Grid */}
          <div className={`invoice-meta-grid ${styles.metaGrid}`}>
            <div className="meta-box">
              <span className="meta-label">العميل</span>
              <span className="meta-val">{invoice.customer?.name || "عميل نقدي"}</span>
            </div>
            <div className="meta-box">
              <span className="meta-label">الكاشير</span>
              <span className="meta-val">{invoice.cashier?.name || "كاشير المحل"}</span>
            </div>
            <div className="meta-box">
              <span className="meta-label">طريقة الدفع</span>
              <span className="meta-val">{invoice.paymentMethod || "نقدي"}</span>
            </div>
            <div className="meta-box">
              <span className="meta-label">إجمالي الفاتورة</span>
              <span className={`meta-val font-mono font-bold text-[var(--rose-600)] ${styles.totalValue}`}>
                {formatNumber(invoice.total)} ج.م
              </span>
            </div>
          </div>

          {/* Items Table Header */}
          <h4 className={styles.sectionHeading}>
            <ShoppingCart size={16} color="var(--rose-600)" />
            الأصناف المباعة في هذه الفاتورة ({(invoice.items || []).length} صنف):
          </h4>

          {/* Items Table */}
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead className={styles.tableHead}>
                <tr>
                  <th className={styles.thItem}>الصنف</th>
                  <th className={styles.thCenter}>الباركود</th>
                  <th className={styles.thCenter}>الكمية</th>
                  <th className={styles.thCenter}>السعر</th>
                  <th className={styles.thCenter}>الإجمالي</th>
                  <th className={styles.thAction}>إجراء المرتجع</th>
                </tr>
              </thead>
              <tbody>
                {(invoice.items || []).map((itm, idx) => {
                  const displayName = itm.name || itm.productName || itm.product_name || "صنف بدون اسم";
                  const displayBarcode = itm.barcode || itm.code || "—";
                  const displayPrice = itm.sellingPrice ?? itm.selling_price ?? 0;
                  const displayTotal = itm.subtotal ?? (itm.quantity * displayPrice);

                  return (
                    <tr key={idx} className={styles.trItem}>
                      <td className={styles.tdName}>{displayName}</td>
                      <td className={styles.tdBarcode}>
                        {displayBarcode}
                      </td>
                      <td className={styles.tdQty}>
                        {itm.quantity}
                      </td>
                      <td className={styles.tdPrice}>
                        {formatNumber(displayPrice)} ج.م
                      </td>
                      <td className={styles.tdTotal}>
                        {formatNumber(displayTotal)} ج.م
                      </td>
                      <td className={styles.tdAction}>
                        <button
                          type="button"
                          onClick={() => onReturnItem(invoice, itm)}
                          className="btn-return-single-item"
                        >
                          <RotateCcw size={13} />
                          <span>مرتجع صنف</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pinned Modal Footer */}
        <div className={`modal-footer ${styles.footerWrapper}`}>
          <button
            type="button"
            onClick={() => onReturnFullInvoice(invoice)}
            className="btn-danger-return-full"
          >
            <RotateCcw size={15} />
            <span>مرتجع كامل الفاتورة وحذفها</span>
          </button>

          <div className={styles.footerActions}>
            <button
              type="button"
              onClick={() => onPrintInvoice(invoice)}
              className="btn-print-invoice"
            >
              <Printer size={15} />
              <span>طباعة الفاتورة</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn-close-modal"
            >
              إغلاق
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

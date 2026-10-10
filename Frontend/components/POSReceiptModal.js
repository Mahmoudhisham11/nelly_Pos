"use client";

import { invoiceDate } from "@/lib/invoiceTime";
import React, { useRef, useState } from "react";
import { formatNumber } from "@/lib/utils";
import { 
  Printer, 
  X, 
  CheckCircle2, 
  MessageCircle,
  ShoppingBag
} from "lucide-react";
import styles from "./POSReceiptModal.module.css";
import { printHtml } from "@/lib/printFrame";

// Thermal-receipt print rules of the original Nelly app (80mm roll, zero page margin, bordered items grid).
// The receipt is printed alone inside a frame (lib/printFrame.js), so these rules only ever apply to it.
const RECEIPT_PRINT_CSS = `
      html, body { margin: 0; padding: 0; background: #ffffff; direction: rtl; }
      #printable-receipt, .thermal-receipt { margin: 0 auto; width: 100%; max-width: 80mm; }

      @page {
        margin: 0 !important;
        size: auto;
      }
      @media print {
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
          width: 100% !important;
        }
        #printable-receipt,
        .thermal-receipt {
          margin: 0 auto !important;
          padding: 2mm 3mm !important;
          width: 100% !important;
          max-width: 80mm !important;
          box-shadow: none !important;
          border: none !important;
          background: #ffffff !important;
        }
        #printable-receipt *,
        .thermal-receipt * {
          color: #000000 !important;
          border-color: #000000 !important;
          box-sizing: border-box !important;
        }
        #printable-receipt table,
        .thermal-receipt table {
          width: 100% !important;
          table-layout: fixed !important;
          border-collapse: collapse !important;
          direction: rtl !important;
        }
        #printable-receipt table.receipt-grid-table,
        .thermal-receipt table.receipt-grid-table {
          border: 1px solid #000000 !important;
          border-collapse: collapse !important;
        }
        #printable-receipt table.receipt-grid-table th,
        .thermal-receipt table.receipt-grid-table th {
          border: 1px solid #000000 !important;
          background-color: #ebebeb !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color: #000000 !important;
          vertical-align: middle !important;
          padding: 2px 2px !important;
          font-size: 9.5px !important;
          line-height: 1.15 !important;
        }
        #printable-receipt table.receipt-grid-table td,
        .thermal-receipt table.receipt-grid-table td {
          border: 1px solid #000000 !important;
          color: #000000 !important;
          vertical-align: middle !important;
          padding: 2px 2px !important;
          font-size: 9.5px !important;
          line-height: 1.15 !important;
        }
        #printable-receipt table.receipt-grid-table th:nth-child(1),
        #printable-receipt table.receipt-grid-table td:nth-child(1),
        .thermal-receipt table.receipt-grid-table th:nth-child(1),
        .thermal-receipt table.receipt-grid-table td:nth-child(1) {
          width: 44% !important;
          text-align: right !important;
          padding-right: 3px !important;
        }
        #printable-receipt table.receipt-grid-table th:nth-child(2),
        #printable-receipt table.receipt-grid-table td:nth-child(2),
        .thermal-receipt table.receipt-grid-table th:nth-child(2),
        .thermal-receipt table.receipt-grid-table td:nth-child(2) {
          width: 15% !important;
          text-align: center !important;
        }
        #printable-receipt table.receipt-grid-table th:nth-child(3),
        #printable-receipt table.receipt-grid-table td:nth-child(3),
        .thermal-receipt table.receipt-grid-table th:nth-child(3),
        .thermal-receipt table.receipt-grid-table td:nth-child(3) {
          width: 20% !important;
          text-align: center !important;
        }
        #printable-receipt table.receipt-grid-table th:nth-child(4),
        #printable-receipt table.receipt-grid-table td:nth-child(4),
        .thermal-receipt table.receipt-grid-table th:nth-child(4),
        .thermal-receipt table.receipt-grid-table td:nth-child(4) {
          width: 21% !important;
          text-align: center !important;
        }
      }
    `;


export default function POSReceiptModal({ isOpen, onClose, invoice, onNewSale }) {
  const receiptRef = useRef(null);
  const [includePolicy, setIncludePolicy] = useState(true);


  // Prints the on-screen receipt itself (same layout, sizes and grid as the original Nelly receipt).
  const handlePrint = () => {
    if (!invoice) return;
    const node = receiptRef.current;
    if (!node) { window.print(); return; }
    printHtml({ title: `فاتورة #${invoice.invoiceNumber || ""}`, body: node.outerHTML, css: RECEIPT_PRINT_CSS, copyStyles: true });
  };

  const handleShareWhatsApp = () => {
    if (!invoice) return;

    let itemsText = "";
    (invoice.items || []).forEach((it, idx) => {
      itemsText += `\n${idx + 1}. ${it.name} × ${it.quantity} = ${formatNumber(it.subtotal || it.quantity * it.sellingPrice)} ج.م`;
    });

    const msg = 
`🌸 *فاتورة مشتريات - Nelly* 🌸
━━━━━━━━━━━━━━━━━━
📄 *رقم الفاتورة:* ${invoice.invoiceNumber || ""}
📅 *التاريخ:* ${invoiceDate(invoice).toLocaleString("ar-EG", { timeZone: "Africa/Cairo" })}
👤 *العميل:* ${invoice.customer?.name || "عميل نقدي"}
🛒 *الأصناف:*${itemsText}
━━━━━━━━━━━━━━━━━━
💵 *الإجمالي:* ${formatNumber(invoice.total)} ج.م
💳 *طريقة الدفع:* ${invoice.paymentMethod || "نقدي"}
━━━━━━━━━━━━━━━━━━
✨ شكراً لتعاملكم معنا ونسعد بزيارتكم ✨${includePolicy ? "\nℹ️ *البضاعة المباعة لا ترد ولكن تستبدل خلال 14 يوماً*" : ""}`;

    const phone = invoice.customer?.phone ? invoice.customer.phone.replace(/[^0-9]/g, "") : "";
    const cleanPhone = phone.startsWith("01") ? `20${phone.substring(1)}` : phone;
    const url = cleanPhone 
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;

    window.open(url, "_blank");
  };

  const items = invoice.items || [];
  const dateStr = (invoice.createdAt || invoice.date) ? invoiceDate(invoice).toLocaleString("ar-EG", { timeZone: "Africa/Cairo" }) : new Date().toLocaleString("ar-EG", { timeZone: "Africa/Cairo" });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className={`modal-content ${styles.modalContainer}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="modal-header no-print">
          <div className={styles.modalHeaderRow}>
            <div className={styles.iconSuccess}>
              <CheckCircle2 size={20} />
            </div>
            <div>
              <h3 className={`modal-title ${styles.headerTitle}`}>
                تمت عملية البيع بنجاح
              </h3>
              <span className={styles.headerSubtitle}>
                فاتورة #{invoice.invoiceNumber}
              </span>
            </div>
          </div>

          <button 
            type="button"
            onClick={onClose}
            className="modal-close-btn"
            title="إغلاق النافذة"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body with Printable Thermal Receipt */}
        <div className={`modal-body custom-scrollbar ${styles.modalBodyContent}`}>
          <div 
            ref={receiptRef}
            id="printable-receipt"
            className={`thermal-receipt ${styles.receiptContainer}`}
          >
            {/* 1. Header: Nelly Title & Invoice Number */}
            <div className={styles.receiptHeader}>
              <h1 className={styles.brandTitle}>
                Nelly
              </h1>
              <div className={styles.invoiceNumRow}>
                رقم الفاتورة: <span className={`num-font ${styles.boldInvoiceNum}`} dir="ltr">#{invoice.invoiceNumber}</span>
              </div>
            </div>

            {/* 2. Sequential Invoice Meta */}
            <div className={styles.metaSection}>
              <div className={styles.metaRow}>
                <span>التاريخ:</span>
                <span>{dateStr}</span>
              </div>
              <div className={styles.metaRow}>
                <span>العميل:</span>
                <span>{invoice.customer?.name || "عميل نقدي"}</span>
              </div>
              <div className={styles.metaRow}>
                <span>الكاشير:</span>
                <span>{invoice.cashier?.name || "كاشير المحل"}</span>
              </div>
              <div className={styles.metaRow}>
                <span>طريقة الدفع:</span>
                <span>{invoice.paymentMethod || "نقدي"}</span>
              </div>
            </div>

            {/* 3. Items Table - Structured Bordered Grid Table */}
            <div className={styles.tableSection}>
              <table className={`receipt-grid-table ${styles.receiptTable}`}>
                <thead>
                  <tr className={styles.receiptTableHeadRow}>
                    <th className={styles.thItemName}>
                      اسم الصنف
                    </th>
                    <th className={styles.thQty}>
                      الكمية
                    </th>
                    <th className={styles.thPrice}>
                      السعر
                    </th>
                    <th className={styles.thTotal}>
                      الإجمالي
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => {
                    const displayName = it.name || it.productName || it.product_name || "صنف بدون اسم";
                    const displayPrice = it.sellingPrice ?? it.selling_price ?? 0;
                    const displayTotal = it.subtotal ?? (it.quantity * displayPrice);
                    return (
                      <tr key={idx}>
                        <td className={styles.tdItemName}>
                          {displayName}
                        </td>
                        <td className={styles.tdQty}>
                          {it.quantity}
                        </td>
                        <td className={styles.tdPrice}>
                          {formatNumber(displayPrice)}
                        </td>
                        <td className={styles.tdTotal}>
                          {formatNumber(displayTotal)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* 4. Total Card (كارت الإجمالي) */}
            <div className={styles.totalCard}>
              <div className={styles.totalCardMain}>
                <span>الإجمالي:</span>
                <span className={`num-font ${styles.totalCardValue}`}>
                  {formatNumber(invoice.total)} ج.م
                </span>
              </div>

              {invoice.discount > 0 && (
                <div className={styles.discountRow}>
                  <span>الخصم المطبق:</span>
                  <span className="num-font">-{formatNumber(invoice.discount)} ج.م</span>
                </div>
              )}

              {invoice.receivedCash > 0 && (
                <div className={styles.subMetaRow}>
                  <span>المبلغ المدفوع:</span>
                  <span className="num-font">{formatNumber(invoice.receivedCash)} ج.م</span>
                </div>
              )}

              {invoice.changeAmount > 0 && (
                <div className={styles.subMetaRow}>
                  <span>الباقي للعميل:</span>
                  <span className="num-font">{formatNumber(invoice.changeAmount)} ج.م</span>
                </div>
              )}

              {invoice.remainingDue > 0 && (
                <div className={styles.subMetaRowBold}>
                  <span>المتبقي آجل:</span>
                  <span className="num-font">{formatNumber(invoice.remainingDue)} ج.م</span>
                </div>
              )}
            </div>

            {/* 5. Footer: Thank You Message & Optional Exchange Policy */}
            <div className={styles.receiptFooter}>
              <div>شكراً لتعاملكم معنا ونسعد بزيارتكم</div>
              {includePolicy && (
                <div className={styles.policyNotice}>
                  البضاعة المباعة لا ترد ولكن تستبدل خلال 14 يوماً مع وجود الفاتورة
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Pinned Action Buttons Footer in Modal (Print, WhatsApp, Policy Toggle, New Sale) */}
        <div className={`modal-footer no-print ${styles.pinnedFooter}`}>
          {/* Policy Toggle Option */}
          <label className={styles.policyToggleLabel}>
            <span className={styles.policyToggleText}>
              طباعة سياسة الاستبدال (14 يوم) بالفاتورة
            </span>
            <input 
              type="checkbox" 
              checked={includePolicy} 
              onChange={(e) => setIncludePolicy(e.target.checked)}
              className={styles.policyCheckbox}
            />
          </label>

          <div className={styles.actionButtonsGrid}>
            <button
              type="button"
              onClick={handlePrint}
              className={`btn-primary ${styles.printActionBtn}`}
            >
              <Printer size={16} />
              طباعة الفاتورة (Print)
            </button>

            <button
              type="button"
              onClick={handleShareWhatsApp}
              className={styles.whatsappBtn}
            >
              <MessageCircle size={16} />
              مشاركة WhatsApp
            </button>
          </div>

          {onNewSale && (
            <button
              type="button"
              onClick={() => { onClose(); onNewSale(); }}
              className={`btn-secondary ${styles.newSaleBtn}`}
            >
              <ShoppingBag size={15} />
              بدء فاتورة بيع جديدة
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import React, { useState, useMemo } from "react";
import { 
  X, 
  Search, 
  Truck, 
  RotateCcw, 
  ChevronDown, 
  ChevronUp, 
  Calendar, 
  Receipt, 
  CheckCircle2, 
  AlertTriangle, 
  Layers, 
  DollarSign, 
  Trash2 
} from "lucide-react";
import { formatNumber, formatDateTime, roundCurrency } from "@/lib/utils";
import styles from "./ShopInvoicesHistoryModal.module.css";

export default function ShopInvoicesHistoryModal({
  isOpen,
  onClose,
  invoices = [],
  suppliers = [],
  onReturnItem,
  onReturnFullInvoice
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSupplierFilter, setSelectedSupplierFilter] = useState("all");
  const [expandedInvoiceId, setExpandedInvoiceId] = useState(null);
  const [processingInvoiceId, setProcessingInvoiceId] = useState(null);

  // Return specific item prompt state
  const [pendingItemReturn, setPendingItemReturn] = useState(null); // { invoice, item, quantity }

  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const q = searchQuery.trim().toLowerCase();
      const numMatch = (inv.invoiceNumber || "").toLowerCase().includes(q);
      const suppMatch = (inv.supplier?.name || "").toLowerCase().includes(q);
      const notesMatch = (inv.notes || "").toLowerCase().includes(q);
      const matchesSearch = !q || numMatch || suppMatch || notesMatch;

      const matchesSupplier = selectedSupplierFilter === "all" || inv.supplier?.id === selectedSupplierFilter;

      return matchesSearch && matchesSupplier;
    });
  }, [invoices, searchQuery, selectedSupplierFilter]);

  if (!isOpen) return null;

  const toggleExpand = (id) => {
    setExpandedInvoiceId(prev => prev === id ? null : id);
  };

  // Handle Full Return of an Invoice
  const handleConfirmFullReturn = async (inv) => {
    if (!confirm(`هل أنت متأكد من إرجاع فاتورة الواردات (${inv.invoiceNumber}) بالكامل؟\nسيتم خصم كامل الكميات من المحل وخصم مبلغ (${formatNumber(inv.totalCost)} ج.م) من حساب المورد (${inv.supplier?.name}).`)) {
      return;
    }

    setProcessingInvoiceId(inv.id);
    try {
      // Items to return: remaining unreturned quantities
      const itemsToReturn = (inv.items || [])
        .map(i => {
          const retQty = Number(i.returnedQuantity) || 0;
          const remaining = Math.max(0, i.quantity - retQty);
          return remaining > 0 ? {
            productId: i.productId,
            barcode: i.barcode,
            name: i.name,
            quantity: remaining,
            wholesalePrice: i.wholesalePrice
          } : null;
        })
        .filter(Boolean);

      if (itemsToReturn.length === 0) {
        alert("كافة بنود هذه الفاتورة تم إرجاعها مسبقاً!");
        return;
      }

      await onReturnFullInvoice({
        invoiceId: inv.id,
        itemsToReturn,
        returnReason: `إرجاع كامل الفاتورة #${inv.invoiceNumber} للمورد`,
        deleteIfZero: true
      });
    } catch (err) {
      alert("فشل تنفيذ المرتجع: " + (err.message || "حدث خطأ غير متوقع"));
    } finally {
      setProcessingInvoiceId(null);
    }
  };

  // Open item return prompt
  const handleOpenItemReturnPrompt = (inv, item) => {
    const retQty = Number(item.returnedQuantity) || 0;
    const remainingQty = Math.max(0, item.quantity - retQty);
    if (remainingQty <= 0) {
      alert("تم إرجاع كمية هذا الصنف بالكامل مسبقاً.");
      return;
    }

    const input = prompt(`أدخل عدد القطع المراد إرجاعها للمورد من (${item.name})\nالكمية المتبقية المتاحة للإرجاع: ${remainingQty} قطعة:`, remainingQty.toString());
    if (!input) return;

    const qty = parseInt(input, 10);
    if (isNaN(qty) || qty <= 0 || qty > remainingQty) {
      alert(`يرجى إدخال كمية صحيحة بين 1 و ${remainingQty}.`);
      return;
    }

    executeSingleItemReturn(inv, item, qty);
  };

  const executeSingleItemReturn = async (inv, item, returnQty) => {
    const refundCost = roundCurrency(returnQty * (item.wholesalePrice || 0));
    if (!confirm(`تأكيد إرجاع (${returnQty}) قطعة من (${item.name})؟\nسيتم خصم (${formatNumber(refundCost)} ج.م) من حساب المورد (${inv.supplier?.name}) وخصم الكمية من المحل.`)) {
      return;
    }

    setProcessingInvoiceId(inv.id);
    try {
      await onReturnItem({
        invoiceId: inv.id,
        itemsToReturn: [{
          productId: item.productId,
          barcode: item.barcode,
          name: item.name,
          quantity: returnQty,
          wholesalePrice: item.wholesalePrice
        }],
        returnReason: `مرتجع جزئي (${returnQty} قطعة) من الصنف ${item.name}`,
        deleteIfZero: true
      });
    } catch (err) {
      alert("فشل تنفيذ المرتجع: " + (err.message || "حدث خطأ غير متوقع"));
    } finally {
      setProcessingInvoiceId(null);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modalContainer} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.headerTitleGroup}>
            <div className={styles.headerIconBox}>
              <Receipt size={20} />
            </div>
            <div>
              <h2 className={styles.modalTitle}>سجل فواتير واردات ومشتريات المحل</h2>
              <p className={styles.modalSubtitle}>متابعة كافة شحنات الواردات وإدارة المرتجعات للموردين</p>
            </div>
          </div>
          <button onClick={onClose} className={styles.closeBtn}>
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className={styles.modalBody}>
          {/* Filters Bar */}
          <div className={styles.filterBar}>
            <div className={styles.searchInputWrapper}>
              <Search size={16} className={styles.searchIcon} />
              <input
                type="text"
                placeholder="ابحث برقم الفاتورة، اسم المورد، أو الملاحظات..."
                className={styles.searchInput}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <select
              className={styles.filterSelect}
              value={selectedSupplierFilter}
              onChange={(e) => setSelectedSupplierFilter(e.target.value)}
            >
              <option value="all">جميع الموردين</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Invoices List */}
          {filteredInvoices.length === 0 ? (
            <div className={styles.emptyState}>
              <Receipt className={styles.emptyIcon} />
              <p style={{ fontWeight: 600, fontSize: "1rem", color: "#475569" }}>
                لا توجد فواتير واردات مسجلة تطابق البحث.
              </p>
            </div>
          ) : (
            <div className={styles.invoicesList}>
              {filteredInvoices.map((inv) => {
                const isExpanded = expandedInvoiceId === inv.id;
                const isProcessing = processingInvoiceId === inv.id;
                const isFullyReturned = inv.status === "مرتجعة بالكامل";

                return (
                  <div key={inv.id} className={styles.invoiceCard}>
                    {/* Card Header */}
                    <div className={styles.invoiceCardHeader} onClick={() => toggleExpand(inv.id)}>
                      <div className={styles.invoiceMetaGroup}>
                        <span className={styles.invoiceNumber}>
                          #{inv.invoiceNumber}
                        </span>

                        <span className={styles.supplierBadge}>
                          <Truck size={14} />
                          {inv.supplier?.name || "مورد"}
                        </span>

                        <span className="badge badge-info" style={{ fontSize: "0.75rem" }}>
                          {inv.paymentMethod || "آجل"}
                        </span>

                        <span className={isFullyReturned ? "badge badge-out-of-stock" : "badge badge-in-stock"}>
                          {inv.status || "مكتملة"}
                        </span>

                        <span className={styles.invoiceDate}>
                          <Calendar size={13} style={{ display: "inline", verticalAlign: "middle", marginLeft: "4px" }} />
                          {formatDateTime(inv.date || inv.createdAt)}
                        </span>
                      </div>

                      <div className={styles.invoiceActionsHeader}>
                        <span className={styles.invoiceTotalCost}>
                          <span className="num-font">{formatNumber(inv.totalCost)}</span> ج.م
                        </span>
                        {isExpanded ? <ChevronUp size={18} color="#64748b" /> : <ChevronDown size={18} color="#64748b" />}
                      </div>
                    </div>

                    {/* Card Body (Expanded) */}
                    {isExpanded && (
                      <div className={styles.invoiceCardBody}>
                        {inv.notes && (
                          <div style={{ background: "#f8fafc", padding: "0.5rem 0.75rem", borderRadius: "0.5rem", fontSize: "0.825rem", color: "#475569" }}>
                            <strong>ملاحظات: </strong> {inv.notes}
                          </div>
                        )}

                        <div className={styles.itemsTableWrapper}>
                          <table className={styles.itemsTable}>
                            <thead>
                              <tr>
                                <th>الصنف</th>
                                <th>الباركود</th>
                                <th>القسم</th>
                                <th>الكمية الواردة</th>
                                <th>المرتجع</th>
                                <th>سعر الجملة</th>
                                <th>الإجمالي</th>
                                <th>إجراء</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(inv.items || []).map((item, idx) => {
                                const retQty = Number(item.returnedQuantity) || 0;
                                const isItemFullyReturned = retQty >= item.quantity;

                                return (
                                  <tr key={idx} style={{ opacity: isItemFullyReturned ? 0.6 : 1, background: isItemFullyReturned ? "#f8fafc" : "transparent" }}>
                                    <td>
                                      <strong>{item.name}</strong>
                                    </td>
                                    <td>
                                      <span className="num-font" dir="ltr">{item.barcode || "—"}</span>
                                    </td>
                                    <td>{item.category || "عام"}</td>
                                    <td>
                                      <span className="num-font">{item.quantity}</span> قطعة
                                    </td>
                                    <td>
                                      {retQty > 0 ? (
                                        <span className="badge badge-out-of-stock" style={{ fontSize: "0.75rem" }}>
                                          تم إرجاع {retQty}
                                        </span>
                                      ) : "—"}
                                    </td>
                                    <td>
                                      <span className="num-font">{formatNumber(item.wholesalePrice)}</span> ج.م
                                    </td>
                                    <td>
                                      <span className="num-font" style={{ fontWeight: 700, color: "#0f172a" }}>
                                        {formatNumber(item.subtotalCost || (item.quantity * item.wholesalePrice))} ج.م
                                      </span>
                                    </td>
                                    <td>
                                      <button
                                        type="button"
                                        disabled={isItemFullyReturned || isProcessing}
                                        onClick={() => handleOpenItemReturnPrompt(inv, item)}
                                        className={styles.returnActionBtn}
                                        title="إرجاع كمية من هذا الصنف للمورد"
                                      >
                                        <RotateCcw size={12} />
                                        {isItemFullyReturned ? "مرتجع بالكامل" : "مرتجع صنف"}
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {/* Card Footer Actions */}
                        <div className={styles.cardFooterActions}>
                          <div style={{ fontSize: "0.85rem", color: "#64748b" }}>
                            المتبقي لحساب المورد من الفاتورة: <strong style={{ color: "#db2777" }}>{formatNumber(inv.remainingDue)} ج.م</strong>
                          </div>

                          <button
                            type="button"
                            disabled={isFullyReturned || isProcessing}
                            onClick={() => handleConfirmFullReturn(inv)}
                            className={styles.fullReturnBtn}
                          >
                            <RotateCcw size={14} />
                            {isProcessing ? "جاري تنفيذ المرتجع..." : (isFullyReturned ? "تم إرجاع الفاتورة بالكامل" : "مرتجع الفاتورة بالكامل للمورد")}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

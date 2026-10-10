"use client";

import { FolderClock, PauseCircle, Trash2, X } from "lucide-react";
import { formatNumber } from "@/lib/utils";
import styles from "./POSHeldInvoicesModal.module.css";

export default function POSHeldInvoicesModal({
  isOpen,
  onClose,
  heldInvoices = [],
  onRestore,
  onDelete
}) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className={`modal-content ${styles.modalContainer}`} 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className={styles.headerBrand}>
            <div className={styles.headerIcon}>
              <FolderClock size={20} />
            </div>
            <div>
              <h3 className={`modal-title font-bold ${styles.headerTitle}`}>
                الفواتير المعلقة ({heldInvoices.length})
              </h3>
              <p className={styles.headerSubtitle}>
                اضغط على أي فاتورة لاستعادتها فوراً إلى سلة البيع
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
          {heldInvoices.length === 0 ? (
            <div className={styles.emptyState}>
              <PauseCircle size={44} className={styles.emptyStateIcon} />
              <p className={styles.emptyStateTitle}>لا توجد فواتير معلقة حالياً</p>
              <span className={styles.emptyStateHint}>يمكنك تعليق أي سلة نشطة لخدمة زبون آخر مؤقتاً</span>
            </div>
          ) : (
            <div className={styles.invoicesList}>
              {heldInvoices.map((held) => (
                <div
                  key={held.id}
                  onClick={() => onRestore(held)}
                  className="held-invoice-card"
                >
                  <div className={styles.cardContent}>
                    <div>
                      <div className={styles.customerName}>
                        {held.customer?.name || "عميل نقدي"}
                      </div>
                      <div className={styles.invoiceMeta}>
                        {new Date(held.createdAt).toLocaleTimeString("ar-EG")} • {(held.cart || []).length} صنف ({(held.cart || []).reduce((a, c) => a + c.quantity, 0)} قطعة)
                      </div>
                    </div>

                    <div className={styles.cardActions}>
                      <span className={styles.totalPrice}>
                        {formatNumber(held.total)} ج.م
                      </span>
                      <button
                        type="button"
                        onClick={(e) => onDelete(held.id, e)}
                        className={styles.deleteBtn}
                        title="حذف الفاتورة المعلقة"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

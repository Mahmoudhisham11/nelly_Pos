"use client";

import { RotateCcw, X } from "lucide-react";
import { formatNumber } from "@/lib/utils";
import styles from "./POSReturnModal.module.css";

export default function POSReturnModal({
  itemToReturn,
  onClose,
  returnQuantity,
  setReturnQuantity,
  returnReason,
  setReturnReason,
  isReturning,
  onConfirmReturn
}) {
  if (!itemToReturn) return null;

  return (
    <div 
      className={`modal-overlay ${styles.modalOverlay}`} 
      onClick={onClose}
    >
      <div 
        className={`modal-content ${styles.modalContainer}`} 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className={styles.headerBrand}>
            <div className={styles.headerIcon}>
              <RotateCcw size={20} />
            </div>
            <div>
              <h3 className={`modal-title font-bold ${styles.headerTitle}`}>
                تأكيد مرتجع صنف للمحل
              </h3>
              <p className={styles.headerSubtitle}>
                إعادة الصنف لرصيد بضاعة المحل ورد المبلغ للزبون
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="modal-close-btn"
            title="إلغاء"
          >
            <X size={18} />
          </button>
        </div>

        <div className={`modal-body ${styles.modalBody}`}>
          <div className={styles.itemInfoCard}>
            <div className={styles.itemName}>الصنف: {itemToReturn.item.name}</div>
            <div className={styles.itemDetails}>
              الكمية المباعة أصلاً: <strong>{itemToReturn.item.quantity} قطعة</strong> بسعر ({formatNumber(itemToReturn.item.sellingPrice)} ج.م للقطعة)
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>
              الكمية المراد استرجاعها:
            </label>
            <div className={styles.qtyRow}>
              <input 
                type="number"
                min="1"
                max={itemToReturn.item.quantity}
                value={returnQuantity}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10) || 1;
                  setReturnQuantity(Math.min(itemToReturn.item.quantity, Math.max(1, val)));
                }}
                className={`pos-input-general font-mono font-bold text-center text-lg ${styles.qtyInput}`}
              />
              <span className={styles.qtyTotalHint}>
                من أصل {itemToReturn.item.quantity} قطعة
              </span>
            </div>
          </div>

          <div className={styles.refundBox}>
            <span className={styles.refundLabel}>
              المبلغ المسترد للعميل:
            </span>
            <div className={styles.refundValue}>
              {formatNumber(returnQuantity * itemToReturn.item.sellingPrice)} ج.م
            </div>
          </div>

          <div className={styles.reasonGroup}>
            <label className={styles.fieldLabel}>
              سبب المرتجع:
            </label>
            <input 
              type="text"
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              placeholder="مثلاً: الصنف به عيب، اختيار غير مناسب..."
              className="pos-input-general"
            />
          </div>
        </div>

        <div className="modal-footer">
          <button 
            type="button"
            onClick={onClose} 
            className="btn-cancel"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={onConfirmReturn}
            disabled={isReturning}
            className="btn-confirm-return"
          >
            {isReturning ? "جاري الإرجاع..." : "تأكيد المرتجع وإعادة الصنف للمحل"}
          </button>
        </div>
      </div>
    </div>
  );
}

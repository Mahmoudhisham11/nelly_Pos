"use client";

import { useState } from "react";
import confetti from "canvas-confetti";
import { 
  ArrowLeftRight, 
  X, 
  CheckCircle2 
} from "lucide-react";
import styles from "./TransferModal.module.css";

export default function TransferModal({ 
  isOpen, 
  onClose, 
  product, 
  onConfirmTransfer,
  direction = "warehouse_to_shop" // "warehouse_to_shop" | "shop_to_warehouse"
}) {
  const [transferQty, setTransferQty] = useState("1");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen || !product) return null;

  const sourceName = direction === "warehouse_to_shop" ? "المخزن الرئيسي" : "المحل التجاري";
  const targetName = direction === "warehouse_to_shop" ? "المحل التجاري" : "المخزن الرئيسي";
  const currentAvailableQty = Math.max(0, parseInt(product.quantity, 10) || 0);

  const numQty = parseInt(transferQty, 10) || 0;
  const remainingInSource = Math.max(0, currentAvailableQty - numQty);

  const handleQtyChange = (e) => {
    const val = e.target.value;
    if (val === "") {
      setTransferQty("");
      setErrorMsg("");
      return;
    }

    const parsed = parseInt(val, 10);
    if (isNaN(parsed)) {
      setTransferQty("");
      setErrorMsg("يرجى إدخال رقم صحيح.");
      return;
    }

    if (parsed > currentAvailableQty) {
      setTransferQty(currentAvailableQty.toString());
      setErrorMsg(`⚠️ تنبيه: لا يمكن تحويل أكثر من الكمية المتوفرة في ${sourceName} (${currentAvailableQty} قطعة). تم ضبط الكمية على الحد الأقصى.`);
      return;
    }

    if (parsed < 1) {
      setTransferQty("1");
      setErrorMsg("الحد الأدنى للتحويل هو قطعة واحدة.");
      return;
    }

    setTransferQty(parsed.toString());
    setErrorMsg("");
  };

  const handleQuickSelect = (amount) => {
    if (amount === "all") {
      setTransferQty(currentAvailableQty.toString());
    } else {
      setTransferQty(Math.min(currentAvailableQty, amount).toString());
    }
    setErrorMsg("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");

    if (currentAvailableQty <= 0) {
      setErrorMsg(`عذراً، هذا الصنف غير متوفر في ${sourceName} (الكمية 0). لا يمكن إجراء تحويل.`);
      return;
    }

    if (!numQty || numQty <= 0) {
      setErrorMsg("يرجى إدخال كمية تحويل صحيحة أكبر من صفر.");
      return;
    }

    if (numQty > currentAvailableQty) {
      setErrorMsg(`ممنوع نهائياً: الكمية المطلوبة (${numQty}) أكبر من الرصيد المتوفر في ${sourceName} (${currentAvailableQty}).`);
      return;
    }

    setIsSubmitting(true);
    try {
      await onConfirmTransfer(product, numQty);
      try {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.6 }
        });
      } catch (e) {}
      onClose();
    } catch (err) {
      setErrorMsg(err.message || "حدث خطأ أثناء تنفيذ التحويل.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className={`modal-content ${styles.modalContainer}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.headerBrand}>
            <div className={styles.headerIcon}>
              <ArrowLeftRight size={22} />
            </div>
            <div>
              <h3 className={styles.headerTitle}>
                {direction === "warehouse_to_shop" ? "تحويل بضاعة إلى المحل" : "إرجاع بضاعة إلى المخزن"}
              </h3>
              <span className={styles.headerSubtitle}>
                من {sourceName} ⬅️ إلى {targetName}
              </span>
            </div>
          </div>

          <button onClick={onClose} className={styles.closeBtn}>
            <X size={20} />
          </button>
        </div>

        {/* Product Details Card */}
        <div className={styles.productCard}>
          <div className={styles.productName}>
            {product.name}
          </div>
          <div className={styles.productMeta}>
            <span className={styles.barcodeLabel}>
              الباركود: <strong className={`num-font ${styles.barcodeValue}`} dir="ltr">{product.barcode || "—"}</strong>
            </span>
            <span className={styles.stockStatus}>
              المتوفر حالياً: <strong className="num-font" dir="ltr">{currentAvailableQty}</strong> قطعة
            </span>
          </div>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className={styles.errorAlert}>
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Transfer Quantity Input */}
          <div className={`form-group ${styles.qtyFormGroup}`}>
            <label className={`form-label ${styles.qtyLabel}`}>
              الكمية المراد تحويلها (بالقطعة) <span className={styles.requiredStar}>*</span>
            </label>
            <input 
              type="number"
              min="1"
              max={currentAvailableQty}
              dir="ltr"
              className={`form-input num-font ${styles.qtyInput}`}
              value={transferQty}
              onChange={handleQtyChange}
              required
              autoFocus
              disabled={currentAvailableQty === 0}
            />
          </div>

          {/* Quick Select Buttons */}
          <div className={styles.quickSelectRow}>
            {[1, 2, 5, 10, 20].filter(n => n <= currentAvailableQty).map((n) => {
              const isSelected = numQty === n;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => handleQuickSelect(n)}
                  className={isSelected ? styles.quickSelectBtnActive : styles.quickSelectBtn}
                >
                  +{n}
                </button>
              );
            })}
            {currentAvailableQty > 0 && (
              <button
                type="button"
                onClick={() => handleQuickSelect("all")}
                className={numQty === currentAvailableQty ? styles.quickSelectAllBtnActive : styles.quickSelectAllBtn}
              >
                الكل ({currentAvailableQty})
              </button>
            )}
          </div>

          {/* Live Balance Impact Preview */}
          <div className={styles.balancePreview}>
            <div className={styles.previewRow}>
              <span className={styles.previewLabel}>المتبقي في {sourceName}:</span>
              <strong className={`num-font ${remainingInSource === 0 ? styles.remainingValueZero : styles.remainingValueNormal}`} dir="ltr">
                {remainingInSource} قطعة
              </strong>
            </div>
            <div className={styles.previewRowMargin}>
              <span className={styles.previewLabel}>الكمية المضافة إلى {targetName}:</span>
              <strong className={`num-font ${styles.addedValue}`} dir="ltr">
                + {numQty} قطعة
              </strong>
            </div>
          </div>

          {/* Actions */}
          <div className={styles.actionRow}>
            <button type="button" onClick={onClose} className={`btn-secondary ${styles.cancelBtn}`}>
              إلغاء
            </button>
            <button 
              type="submit" 
              disabled={isSubmitting || currentAvailableQty === 0 || numQty <= 0 || numQty > currentAvailableQty} 
              className={`btn-primary ${styles.confirmBtn}`}
            >
              <CheckCircle2 size={16} />
              {isSubmitting ? "جاري التحويل..." : "تأكيد التحويل الآن"}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}

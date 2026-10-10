"use client";

import { useState, useEffect } from "react";
import { X, PlusCircle, DollarSign, CreditCard } from "lucide-react";
import { formatNumber } from "@/lib/utils";
import CustomSelect from "@/components/CustomSelect";
import styles from "./AddExpenseAmountModal.module.css";

const PAYMENT_METHODS = [
  { value: "نقدي", label: "نقدي (كاش)" },
  { value: "تحويل بنكي", label: "تحويل بنكي" },
  { value: "فودافون كاش", label: "محفظة فودافون كاش" },
  { value: "شيك", label: "شيك بنكي" }
];

export default function AddExpenseAmountModal({ 
  isOpen, 
  onClose, 
  item, 
  currentMonth, 
  monthLabel, 
  currentAmount = 0, 
  onAddAmount 
}) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [method, setMethod] = useState("نقدي");
  const [notes, setNotes] = useState("");
  const [dateError, setDateError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && item) {
      setAmount("");
      // Smart date initialization: If today is within currentMonth use today, else use first day of currentMonth
      const todayStr = new Date().toISOString().split("T")[0];
      if (currentMonth && todayStr.startsWith(currentMonth)) {
        setDate(todayStr);
      } else if (currentMonth) {
        setDate(`${currentMonth}-01`);
      } else {
        setDate(todayStr);
      }
      setMethod("نقدي");
      setNotes("");
      setDateError("");
    }
  }, [isOpen, item, currentMonth]);

  if (!isOpen || !item) return null;

  const addVal = parseFloat(amount) || 0;
  const simulatedNewTotal = currentAmount + addVal;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || addVal <= 0) {
      alert("يرجى إدخال مبلغ صحيح أكبر من صفر.");
      return;
    }

    if (currentMonth && date && !date.startsWith(currentMonth)) {
      setDateError(`تاريخ الصرف يجب أن يكون داخل شهر ${monthLabel} (${currentMonth})`);
      return;
    }

    setIsSubmitting(true);
    try {
      await onAddAmount(
        currentMonth, 
        item.id, 
        item.name, 
        addVal, 
        notes, 
        method, 
        date
      );
      onClose();
    } catch (err) {
      console.error("Error adding expense amount:", err);
      alert("حدث خطأ أثناء إضافة المبلغ.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isCurrentAmountActive = currentAmount > 0;

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
              <PlusCircle size={22} />
            </div>
            <div>
              <h3 className={styles.headerTitle}>
                إضافة وصرف مبلغ لبند المصروف
              </h3>
              <p className={styles.headerSubtitle}>
                البند: <strong className={styles.itemNameHighlight}>{item.name}</strong> • شهر: <strong className={styles.monthHighlight}>{monthLabel}</strong>
              </p>
            </div>
          </div>

          <button onClick={onClose} className={styles.closeBtn}>
            <X size={16} />
          </button>
        </div>

        {/* Current Month Status Ribbon */}
        <div className={`${styles.ribbon} ${isCurrentAmountActive ? styles.ribbonActive : styles.ribbonZero}`}>
          <span className={styles.ribbonLabel}>
            إجمالي المصروف الحالي في هذا الشهر:
          </span>
          <strong className={`${styles.ribbonValue} ${isCurrentAmountActive ? styles.ribbonValueActive : styles.ribbonValueZero}`}>
            <span className="num-font" dir="ltr">{formatNumber(currentAmount)}</span> ج.م
          </strong>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          {/* Amount to Add */}
          <div className="form-group">
            <label className="form-label">
              المبلغ المراد إضافته (ج.م) <span className={styles.requiredStar}>*</span>
            </label>
            <div className={styles.inputWrapper}>
              <input 
                type="number"
                step="any"
                min="0.01"
                className={`form-input num-font ${styles.amountInput}`}
                dir="ltr"
                placeholder="أدخل المبلغ..."
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                autoFocus
              />
              <DollarSign size={20} className={styles.dollarIcon} />
            </div>
          </div>

          {/* New Total Preview */}
          {addVal > 0 && (
            <div className={styles.previewBox}>
              <span className={styles.previewLabel}>الإجمالي الجديد بعد الإضافة:</span>
              <strong className={styles.previewValue}>
                <span className="num-font" dir="ltr">{formatNumber(simulatedNewTotal)}</span> ج.م
              </strong>
            </div>
          )}

          {/* Date & Payment Method */}
          <div className={styles.gridRow}>
            <div className="form-group">
              <label className="form-label">تاريخ الصرف</label>
              <input 
                type="date"
                className="form-input num-font"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  setDateError("");
                }}
                required
              />
              {dateError && (
                <span className={styles.dateError}>
                  {dateError}
                </span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">طريقة الدفع</label>
              <CustomSelect
                options={PAYMENT_METHODS}
                value={method}
                onChange={(val) => setMethod(val)}
                icon={CreditCard}
              />
            </div>
          </div>

          {/* Notes */}
          <div className="form-group">
            <label className="form-label">ملاحظات أو بيان الدفعة</label>
            <input 
              type="text"
              className="form-input"
              placeholder="مثال: دفعة أولى، فاتورة شهرية، إكرامية..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Action Buttons */}
          <div className={styles.actionRow}>
            <button 
              type="button" 
              onClick={onClose}
              className={`btn-secondary ${styles.cancelBtn}`}
            >
              إلغاء
            </button>
            <button 
              type="submit" 
              disabled={isSubmitting || !amount || addVal <= 0}
              className={`btn-primary ${styles.submitBtn}`}
            >
              {isSubmitting ? "جاري الحفظ..." : "تأكيد إضافة المبلغ"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

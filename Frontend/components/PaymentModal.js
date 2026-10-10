"use client";

import { useState, useEffect } from "react";
import { X, CreditCard, DollarSign, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { formatNumber, roundCurrency } from "@/lib/utils";
import styles from "./PaymentModal.module.css";

export default function PaymentModal({ isOpen, onClose, supplier, onMakePayment }) {
  const [operationType, setOperationType] = useState("payment"); // "payment" (سداد دفعة) or "charge" (إضافة مستحقات / بضاعة)
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("نقدي");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (supplier && isOpen) {
      setOperationType("payment");
      setAmount("");
      setPaymentMethod("نقدي");
      setNotes("");
    }
  }, [supplier, isOpen]);

  if (!isOpen || !supplier) return null;

  const currentBal = roundCurrency(Number(supplier.balance) || 0);
  const payAmount = Math.abs(parseFloat(amount) || 0);
  
  const simulatedNewBalance = operationType === "payment" 
    ? roundCurrency(currentBal - payAmount) 
    : roundCurrency(currentBal + payAmount);

  const handlePayFull = () => {
    if (currentBal > 0) {
      setOperationType("payment");
      setAmount(String(currentBal));
    } else if (currentBal < 0) {
      setOperationType("charge");
      setAmount(String(Math.abs(currentBal)));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || payAmount <= 0) {
      alert("يرجى إدخال مبلغ صحيح أكبر من صفر.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onMakePayment(supplier.id, currentBal, payAmount, notes, paymentMethod, operationType);
      onClose();
    } catch (err) {
      console.error("Payment error:", err);
      alert("حدث خطأ أثناء تسجيل العملية المالية.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isPayment = operationType === "payment";

  let balanceCardTheme = styles.balanceZero;
  let balanceValueTheme = styles.balanceValueZero;
  if (currentBal > 0) {
    balanceCardTheme = styles.balancePositive;
    balanceValueTheme = styles.balanceValuePositive;
  } else if (currentBal < 0) {
    balanceCardTheme = styles.balanceNegative;
    balanceValueTheme = styles.balanceValueNegative;
  }

  let simulatedValueTheme = styles.balanceValueZero;
  if (simulatedNewBalance > 0) {
    simulatedValueTheme = styles.balanceValuePositive;
  } else if (simulatedNewBalance < 0) {
    simulatedValueTheme = styles.balanceValueNegative;
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className={`modal-content ${styles.modalContainer}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.headerBrand}>
            <div className={`${styles.headerIcon} ${isPayment ? styles.iconPayment : styles.iconCharge}`}>
              <CreditCard size={22} />
            </div>
            <div>
              <h3 className={styles.headerTitle}>
                {isPayment ? "سداد دفعة حساب للمورد" : "إضافة مستحقات / فاتورة بضاعة"}
              </h3>
              <p className={styles.headerSubtitle}>
                المورد: <strong className={styles.supplierNameHighlight}>{supplier.name}</strong>
              </p>
            </div>
          </div>

          <button onClick={onClose} className={styles.closeBtn}>
            <X size={16} />
          </button>
        </div>

        {/* Current Balance Card */}
        <div className={`${styles.balanceCard} ${balanceCardTheme}`}>
          <div>
            <div className={styles.balanceLabel}>
              الرصيد المالي الحالي للمورد:
            </div>
            <div className={`${styles.balanceValue} ${balanceValueTheme}`}>
              <span className="num-font" dir="ltr">{formatNumber(Math.abs(currentBal))}</span> ج.م
              <span className={styles.balanceStatusHint}>
                {currentBal > 0 ? "(له مستحقات علينا)" : currentBal < 0 ? "(عليه مبالغ لنا)" : "(خالص تماماً)"}
              </span>
            </div>
          </div>

          {currentBal !== 0 && (
            <button
              type="button"
              onClick={handlePayFull}
              className={`btn-secondary ${styles.settleFullBtn}`}
            >
              تسوية كامل المبلغ
            </button>
          )}
        </div>

        {/* Operation Type Switcher */}
        <div className={styles.opSwitcher}>
          <button
            type="button"
            onClick={() => setOperationType("payment")}
            className={`${styles.opBtn} ${isPayment ? styles.opBtnPaymentActive : ""}`}
          >
            <ArrowDownLeft size={16} />
            سداد دفعة (يخصم من الدين)
          </button>

          <button
            type="button"
            onClick={() => setOperationType("charge")}
            className={`${styles.opBtn} {!isPayment ? styles.opBtnChargeActive : ""}`}
          >
            <ArrowUpRight size={16} />
            فاتورة جديدة (يزيد المستحق)
          </button>
        </div>

        {/* Payment Form */}
        <form onSubmit={handleSubmit}>
          {/* Payment Amount */}
          <div className="form-group">
            <label className="form-label">
              {isPayment ? "مبلغ الدفعة المسددة (ج.م)" : "مبلغ الفاتورة / المستحقات (ج.م)"} <span className={styles.requiredStar}>*</span>
            </label>
            <div className={styles.amountInputWrapper}>
              <input 
                type="number"
                step="any"
                min="0.01"
                className={`form-input num-font ${styles.amountInput}`}
                dir="ltr"
                placeholder="أدخل المبلغ (مثال: 5000)..."
                value={amount}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "" || parseFloat(val) >= 0) {
                    setAmount(val);
                  }
                }}
                required
                autoFocus
              />
              <DollarSign 
                size={20} 
                className={`${styles.dollarIcon} ${isPayment ? styles.iconColorPayment : styles.iconColorCharge}`} 
              />
            </div>
          </div>

          {/* New Balance Preview */}
          {amount && payAmount > 0 && (
            <div className={styles.simulatedBalanceBox}>
              <span className={styles.simulatedLabel}>الرصيد المتوقع بعد العملية:</span>
              <strong className={`${styles.simulatedValue} ${simulatedValueTheme}`}>
                <span className="num-font" dir="ltr">{formatNumber(Math.abs(simulatedNewBalance))}</span> ج.م
                <span className={styles.simulatedHint}>
                  {simulatedNewBalance > 0 ? "(له مستحقات)" : simulatedNewBalance < 0 ? "(عليه مبالغ)" : "(خالص تماماً)"}
                </span>
              </strong>
            </div>
          )}

          {/* Payment Method */}
          <div className="form-group">
            <label className="form-label">طريقة السداد / الدفع</label>
            <div className={styles.methodsGrid}>
              {["نقدي", "تحويل بنكي", "فودافون كاش", "شيك"].map((m) => {
                const isSelected = paymentMethod === m;
                const activeMethodClass = isPayment ? styles.methodBtnPaymentActive : styles.methodBtnChargeActive;

                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPaymentMethod(m)}
                    className={`${styles.methodBtn} ${isSelected ? activeMethodClass : ""}`}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          <div className="form-group">
            <label className="form-label">ملاحظات أو رقم الإيصال / الفاتورة</label>
            <input 
              type="text"
              className="form-input"
              placeholder={isPayment ? "مثال: دفعة كاش تحت حساب بضاعة..." : "مثال: فاتورة توريد شحنة رقم 102..."}
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
              disabled={isSubmitting || !amount || payAmount <= 0}
              className={`btn-primary ${styles.submitBtn} ${isPayment ? styles.submitBtnPayment : styles.submitBtnCharge}`}
            >
              {isSubmitting ? "جاري الحفظ..." : "تأكيد العملية وتحديث الحساب"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

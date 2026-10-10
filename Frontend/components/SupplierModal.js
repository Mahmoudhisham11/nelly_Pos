"use client";

import { useState, useEffect } from "react";
import { X, Truck, Phone, DollarSign } from "lucide-react";
import styles from "./SupplierModal.module.css";

export default function SupplierModal({ isOpen, onClose, onSave, supplierToEdit }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [balanceType, setBalanceType] = useState("payable"); // "payable" (له +), "receivable" (عليه -), "zero" (0)
  const [balanceAmount, setBalanceAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (supplierToEdit) {
      setName(supplierToEdit.name || "");
      setPhone(supplierToEdit.phone || "");
      const bal = Number(supplierToEdit.balance) || 0;
      if (bal > 0) {
        setBalanceType("payable");
        setBalanceAmount(String(bal));
      } else if (bal < 0) {
        setBalanceType("receivable");
        setBalanceAmount(String(Math.abs(bal)));
      } else {
        setBalanceType("zero");
        setBalanceAmount("0");
      }
      setNotes(supplierToEdit.notes || "");
    } else {
      setName("");
      setPhone("");
      setBalanceType("payable");
      setBalanceAmount("");
      setNotes("");
    }
  }, [supplierToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    let finalBalance = 0;
    if (balanceType === "payable") {
      finalBalance = Math.abs(parseFloat(balanceAmount) || 0);
    } else if (balanceType === "receivable") {
      finalBalance = -Math.abs(parseFloat(balanceAmount) || 0);
    } else {
      finalBalance = 0;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        phone: phone.trim(),
        notes: notes.trim()
      };

      if (!supplierToEdit) {
        payload.balance = finalBalance;
      }

      await onSave(payload, supplierToEdit?.id);
      onClose();
    } catch (err) {
      console.error("Error saving supplier:", err);
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
              <Truck size={22} />
            </div>
            <div>
              <h3 className={styles.headerTitle}>
                {supplierToEdit ? "تعديل بيانات المورد" : "إضافة مورد جديد"}
              </h3>
              <p className={styles.headerSubtitle}>
                تسجيل بيانات المورد والحساب والرصيد المالي
              </p>
            </div>
          </div>

          <button onClick={onClose} className={styles.closeBtn}>
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          {/* Supplier Name */}
          <div className="form-group">
            <label className="form-label">
              اسم المورد / الشركة <span className={styles.requiredStar}>*</span>
            </label>
            <input 
              type="text"
              className="form-input"
              placeholder="مثال: شركة الهنا لمستحضرات التجميل"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          {/* Phone (Optional) */}
          <div className="form-group">
            <label className="form-label">
              رقم الهاتف / الواتساب <span className={styles.optionalTag}>(اختياري)</span>
            </label>
            <div className={styles.inputWrapper}>
              <input 
                type="tel"
                className={`form-input num-font ${styles.phoneInput}`}
                dir="ltr"
                placeholder="01012345678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <Phone size={18} className={styles.inputIcon} />
            </div>
          </div>

          {/* Initial Balance Configuration (Only on Add or explicitly shown) */}
          {!supplierToEdit && (
            <div className={styles.balanceBox}>
              <label className={`form-label ${styles.balanceLabel}`}>
                الرصيد المالي الافتتاحي:
              </label>

              {/* Balance Type Selector */}
              <div className={styles.balanceGrid}>
                <button
                  type="button"
                  onClick={() => setBalanceType("payable")}
                  className={`${styles.typeBtn} ${balanceType === "payable" ? styles.typeBtnPayableActive : ""}`}
                >
                  له فلوس (+)
                </button>

                <button
                  type="button"
                  onClick={() => setBalanceType("receivable")}
                  className={`${styles.typeBtn} ${balanceType === "receivable" ? styles.typeBtnReceivableActive : ""}`}
                >
                  عليه فلوس (-)
                </button>

                <button
                  type="button"
                  onClick={() => { setBalanceType("zero"); setBalanceAmount("0"); }}
                  className={`${styles.typeBtn} ${balanceType === "zero" ? styles.typeBtnZeroActive : ""}`}
                >
                  حسابه خالص (0)
                </button>
              </div>

              {balanceType !== "zero" && (
                <div className={styles.inputWrapper}>
                  <input 
                    type="number"
                    step="any"
                    className={`form-input num-font ${styles.balanceAmountInput}`}
                    dir="ltr"
                    placeholder="أدخل المبلغ بالجنيه (ج.م)..."
                    value={balanceAmount}
                    onChange={(e) => setBalanceAmount(e.target.value)}
                    required
                  />
                  <DollarSign size={18} className={styles.inputIcon} />
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          <div className="form-group">
            <label className="form-label">ملاحظات إضافية</label>
            <textarea 
              className="form-textarea"
              rows="3"
              placeholder="مثال: مواعيد التوريد، عنوان المخزن، بيانات التحويل..."
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
              disabled={isSubmitting}
              className={`btn-primary ${styles.submitBtn}`}
            >
              {isSubmitting ? "جاري الحفظ..." : (supplierToEdit ? "حفظ التعديلات" : "إضافة المورد")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

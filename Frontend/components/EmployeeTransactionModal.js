"use client";

import { useState } from "react";
import { PlusCircle, MinusCircle, DollarSign, Award, X } from "lucide-react";
import { addEmployeeTransaction } from "@/lib/employeesService";
import styles from "./EmployeeTransactionModal.module.css";

export default function EmployeeTransactionModal({ isOpen, onClose, employee, onSaved }) {
  const [type, setType] = useState("bonus"); // bonus | penalty | advance | commission
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen || !employee) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError("يرجى إدخال مبلغ صحيح أكبر من الصفر");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await addEmployeeTransaction({
        employeeId: employee.id,
        employeeName: employee.name,
        type,
        amount: numAmount,
        notes: notes.trim(),
        date: date || new Date().toISOString().split("T")[0]
      });

      if (onSaved) onSaved();
      onClose();
    } catch (err) {
      console.error(err);
      setError(err.message || "حدث خطأ أثناء حفظ المعاملة");
    } finally {
      setLoading(false);
    }
  };

  const typesConfig = [
    { id: "bonus", label: "علاوة / مكافأة (+)", icon: Award, activeClass: styles.typeBtnBonusActive },
    { id: "penalty", label: "جزاء / خصم (-)", icon: MinusCircle, activeClass: styles.typeBtnPenaltyActive },
    { id: "advance", label: "سلفة / مسحوبات (-)", icon: DollarSign, activeClass: styles.typeBtnAdvanceActive },
    { id: "commission", label: "عمولة إضافية (+)", icon: PlusCircle, activeClass: styles.typeBtnCommissionActive }
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className={`modal-content ${styles.modalContainer}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={styles.modalHeader}>
          <div>
            <div className={styles.headerTitleWrapper}>
              <h3 className={styles.headerTitle}>
                تسجيل حركة مالية
              </h3>
              <span className={styles.employeeNameTag}>
                {employee.name}
              </span>
            </div>
            <p className={styles.headerSubtitle}>
              كود الموظف: <span className={`num-font ${styles.employeeCode}`}>{employee.code}</span>
            </p>
          </div>

          <button 
            type="button"
            onClick={onClose}
            className={styles.closeBtn}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Container */}
        <form onSubmit={handleSubmit} className={styles.form}>
          {/* Scrollable Body */}
          <div className={styles.modalBody}>
            {/* Error Alert */}
            {error && (
              <div className={styles.errorAlert}>
                {error}
              </div>
            )}

            {/* Type Selection */}
            <div>
              <label className={styles.fieldLabel}>
                نوع الحركة المالية
              </label>
              <div className={styles.typesGrid}>
                {typesConfig.map((t) => {
                  const Icon = t.icon;
                  const isSelected = type === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setType(t.id)}
                      className={`${styles.typeBtn} ${isSelected ? t.activeClass : ""}`}
                    >
                      <Icon size={16} />
                      <span>{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Amount */}
            <div>
              <label className={styles.fieldLabel}>
                المبلغ (ج.م) *
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className={`form-input num-font ${styles.amountInput}`}
              />
            </div>

            {/* Date */}
            <div>
              <label className={styles.fieldLabel}>
                التاريخ
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="form-input num-font"
              />
            </div>

            {/* Notes / Reason */}
            <div>
              <label className={styles.fieldLabel}>
                بيان / سبب الحركة
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="مثال: مكافأة مبيعات استثنائية، تأخير غير مبرر، سلفة راتب..."
                className={`form-input ${styles.notesTextarea}`}
              />
            </div>
          </div>

          {/* Fixed Footer */}
          <div className={styles.modalFooter}>
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
            >
              {loading ? "جاري الحفظ..." : "حفظ الحركة"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

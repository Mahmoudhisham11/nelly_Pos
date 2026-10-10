"use client";

import { useState, useEffect } from "react";
import { X, Receipt } from "lucide-react";
import styles from "./ExpenseItemModal.module.css";

export default function ExpenseItemModal({ isOpen, onClose, onSave, itemToEdit }) {
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (itemToEdit) {
      setName(itemToEdit.name || "");
      setNotes(itemToEdit.notes || "");
    } else {
      setName("");
      setNotes("");
    }
  }, [itemToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      await onSave({ name: name.trim(), notes: notes.trim() }, itemToEdit?.id);
      onClose();
    } catch (err) {
      console.error("Error saving expense item:", err);
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
              <Receipt size={22} />
            </div>
            <div>
              <h3 className={styles.headerTitle}>
                {itemToEdit ? "تعديل بند المصروف" : "إضافة بند مصروف جديد"}
              </h3>
              <p className={styles.headerSubtitle}>
                تثبيت بند المصروف ليظهر تلقائياً كل شهر بقيمة 0 ج.م
              </p>
            </div>
          </div>

          <button onClick={onClose} className={styles.closeBtn}>
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">
              اسم البند / القسم <span className={styles.requiredStar}>*</span>
            </label>
            <input 
              type="text"
              className="form-input"
              placeholder="مثال: إيجار المحل، رواتب، كهرباء، شحن، دعاية..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">وصف أو ملاحظات</label>
            <input 
              type="text"
              className="form-input"
              placeholder="مثال: موعد الاستحقاق يوم 5 في الشهر..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

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
              disabled={isSubmitting || !name.trim()}
              className={`btn-primary ${styles.submitBtn}`}
            >
              {isSubmitting ? "جاري الحفظ..." : (itemToEdit ? "حفظ التعديل" : "إضافة البند")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

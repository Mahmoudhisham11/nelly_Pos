"use client";

import { UserPlus, X } from "lucide-react";
import styles from "./POSNewCustomerModal.module.css";

export default function POSNewCustomerModal({
  isOpen,
  onClose,
  newCustomerName,
  setNewCustomerName,
  newCustomerPhone,
  setNewCustomerPhone,
  onSubmit
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
              <UserPlus size={20} />
            </div>
            <div>
              <h3 className={`modal-title font-bold ${styles.headerTitle}`}>
                إضافة عميل جديد
              </h3>
              <p className={styles.headerSubtitle}>
                تسجيل بيانات العميل وربطه بالسلة الحالية
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

        <form onSubmit={onSubmit} className={styles.form}>
          <div className={`modal-body ${styles.modalBody}`}>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>
                اسم العميل: <span className={styles.requiredStar}>*</span>
              </label>
              <input
                type="text"
                required
                value={newCustomerName}
                onChange={(e) => setNewCustomerName(e.target.value)}
                placeholder="مثلاً: سارة محمد..."
                className="pos-input-general"
                autoFocus
              />
            </div>

            <div className={styles.fieldGroupLast}>
              <label className={styles.fieldLabel}>
                رقم الهاتف:
              </label>
              <input
                type="tel"
                value={newCustomerPhone}
                onChange={(e) => setNewCustomerPhone(e.target.value)}
                placeholder="010XXXXXXXX"
                className={`pos-input-general font-mono ${styles.phoneInput}`}
                dir="ltr"
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
            <button type="submit" className={`btn-primary ${styles.submitBtn}`}>
              <UserPlus size={16} />
              <span>حفظ وتحديد العميل</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

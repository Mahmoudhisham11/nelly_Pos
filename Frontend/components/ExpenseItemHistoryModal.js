"use client";

import { useState } from "react";
import { X, History, ArrowDownLeft, Trash2, AlertCircle } from "lucide-react";
import { formatNumber } from "@/lib/utils";
import styles from "./ExpenseItemHistoryModal.module.css";

export default function ExpenseItemHistoryModal({ 
  isOpen, 
  onClose, 
  item, 
  monthlyRecord, 
  monthLabel,
  onDeleteTransaction 
}) {
  const [confirmTx, setConfirmTx] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen || !item) return null;

  const transactions = monthlyRecord?.transactions || [];
  const totalAmount = monthlyRecord?.amount || 0;

  const handleConfirmDelete = async () => {
    if (!confirmTx || !onDeleteTransaction) return;
    setIsDeleting(true);
    try {
      await onDeleteTransaction(monthlyRecord.month, item.id, confirmTx.id);
      setConfirmTx(null);
    } catch (err) {
      alert("حدث خطأ أثناء حذف العملية.");
    } finally {
      setIsDeleting(false);
    }
  };

  const isTotalActive = totalAmount > 0;

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
              <History size={22} />
            </div>
            <div>
              <h3 className={styles.headerTitle}>
                سجل حركات المصروف
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

        {/* Current Total Ribbon */}
        <div className={`${styles.totalRibbon} ${isTotalActive ? styles.totalRibbonActive : styles.totalRibbonZero}`}>
          <span className={styles.ribbonLabel}>
            إجمالي المصروف في هذا الشهر:
          </span>
          <strong className={`${styles.ribbonValue} ${isTotalActive ? styles.ribbonValueActive : styles.ribbonValueZero}`}>
            <span className="num-font" dir="ltr">{formatNumber(totalAmount)}</span> ج.م
          </strong>
        </div>

        {/* Confirmation Inline Alert */}
        {confirmTx && (
          <div className={styles.confirmBox}>
            <div className={styles.confirmTextWrapper}>
              <AlertCircle size={18} color="#dc2626" />
              <span>هل تريد حذف هذه الدفعة بمبلغ <span className="num-font" dir="ltr">{formatNumber(confirmTx.amount)}</span> ج.م وخصمها من الإجمالي؟</span>
            </div>
            <div className={styles.confirmBtnGroup}>
              <button
                onClick={() => setConfirmTx(null)}
                className={`btn-secondary ${styles.confirmCancelBtn}`}
              >
                إلغاء
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className={`btn-danger ${styles.confirmDeleteBtn}`}
              >
                {isDeleting ? "جاري الحذف..." : "نعم، احذف"}
              </button>
            </div>
          </div>
        )}

        {/* Transactions List */}
        <div className={styles.listScrollWrap}>
          {transactions.length === 0 ? (
            <div className={styles.emptyMsg}>
              لم يتم صرف أي مبالغ على هذا البند في شهر {monthLabel}.
            </div>
          ) : (
            <div className={styles.txList}>
              {[...transactions].reverse().map((tx, idx) => (
                <div
                  key={tx.id || idx}
                  className={styles.txCard}
                >
                  <div className={styles.txInfoGroup}>
                    <div className={styles.txIconBox}>
                      <ArrowDownLeft size={18} />
                    </div>
                    <div>
                      <div className={styles.txTitle}>
                        {tx.notes || "إضافة مصروف"}
                        {tx.method && <span className={styles.txMethodTag}>({tx.method})</span>}
                      </div>
                      <div className={styles.txDate}>
                        تاريخ الصرف: <span className="num-font" dir="ltr">{tx.date}</span>
                      </div>
                    </div>
                  </div>

                  <div className={styles.txRightSide}>
                    <div className={styles.txAmount}>
                      <span className="num-font" dir="ltr">{formatNumber(tx.amount)}</span> ج.م
                    </div>

                    {onDeleteTransaction && (
                      <button
                        onClick={() => setConfirmTx(tx)}
                        title="حذف هذه الدفعة"
                        className={styles.deleteTxBtn}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={styles.modalFooter}>
          <button 
            onClick={onClose}
            className={`btn-secondary ${styles.closeFooterBtn}`}
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}

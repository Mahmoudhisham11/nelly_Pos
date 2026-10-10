"use client";

import { useState } from "react";
import { X, History, FileText, ArrowDownLeft, ArrowUpRight, Trash2, AlertCircle, Edit3 } from "lucide-react";
import { formatNumber } from "@/lib/utils";
import styles from "./SupplierHistoryModal.module.css";

export default function SupplierHistoryModal({ isOpen, onClose, supplier, onDeleteTransaction }) {
  const [deletingTxId, setDeletingTxId] = useState(null);
  const [confirmTx, setConfirmTx] = useState(null);

  if (!isOpen || !supplier) return null;

  const transactions = supplier.transactions || [];
  const currentBal = Number(supplier.balance) || 0;

  const handleConfirmDelete = async () => {
    if (!confirmTx || !onDeleteTransaction) return;
    setDeletingTxId(confirmTx.id);
    try {
      await onDeleteTransaction(supplier.id, confirmTx.id);
      setConfirmTx(null);
    } catch (err) {
      alert("حدث خطأ أثناء حذف العملية.");
    } finally {
      setDeletingTxId(null);
    }
  };

  const getTxConfig = (tx) => {
    const type = tx.type || "حركة مالية";
    if (type === "سداد دفعة") {
      return {
        iconClass: styles.typePayable,
        amountClass: styles.amountPayable,
        icon: ArrowDownLeft,
        label: "سداد دفعة (يقلل المديونية)"
      };
    }
    if (type === "رصيد افتتاحي") {
      return {
        iconClass: styles.typeReceivable,
        amountClass: styles.amountReceivable,
        icon: FileText,
        label: "رصيد افتتاحي"
      };
    }
    if (type.includes("فاتورة") || type.includes("مستحقات")) {
      return {
        iconClass: styles.typeCharge,
        amountClass: styles.amountCharge,
        icon: ArrowUpRight,
        label: "إضافة مستحقات / فاتورة"
      };
    }
    return {
      iconClass: styles.typeEdit,
      amountClass: styles.amountEdit,
      icon: Edit3,
      label: "تعديل رصيد يدوي"
    };
  };

  let ribbonBgTheme = styles.balanceRibbonZero;
  let ribbonTextTheme = styles.ribbonValueZero;
  if (currentBal > 0) {
    ribbonBgTheme = styles.balanceRibbonPositive;
    ribbonTextTheme = styles.ribbonValuePositive;
  } else if (currentBal < 0) {
    ribbonBgTheme = styles.balanceRibbonNegative;
    ribbonTextTheme = styles.ribbonValueNegative;
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
            <div className={styles.headerIcon}>
              <History size={22} />
            </div>
            <div>
              <h3 className={styles.headerTitle}>
                كشف حساب وسجل حركات المورد
              </h3>
              <p className={styles.headerSubtitle}>
                {supplier.name} {supplier.phone && `(${supplier.phone})`}
              </p>
            </div>
          </div>

          <button onClick={onClose} className={styles.closeBtn}>
            <X size={16} />
          </button>
        </div>

        {/* Current Balance Ribbon */}
        <div className={`${styles.balanceRibbon} ${ribbonBgTheme}`}>
          <span className={styles.ribbonLabel}>
            الرصيد المالي الحالي المسجل:
          </span>
          <strong className={`${styles.ribbonValue} ${ribbonTextTheme}`}>
            <span className="num-font" dir="ltr">{formatNumber(Math.abs(currentBal))}</span> ج.م
            <span className={styles.ribbonHint}>
              {currentBal > 0 ? "(له مستحقات علينا)" : currentBal < 0 ? "(عليه مبالغ لنا)" : "(خالص تماماً)"}
            </span>
          </strong>
        </div>

        {/* Confirmation Inline Alert */}
        {confirmTx && (
          <div className={styles.confirmBox}>
            <div className={styles.confirmTextWrapper}>
              <AlertCircle size={18} color="#dc2626" />
              <span>هل تريد بالتأكيد حذف هذه الحركة بمبلغ <span className="num-font" dir="ltr">{formatNumber(confirmTx.amount)}</span> ج.م وتعديل الرصيد تلقائياً؟</span>
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
                disabled={deletingTxId === confirmTx.id}
                className={`btn-danger ${styles.confirmDeleteBtn}`}
              >
                {deletingTxId === confirmTx.id ? "جاري الحذف..." : "نعم، احذف"}
              </button>
            </div>
          </div>
        )}

        {/* Transactions Log List */}
        <div className={styles.listScrollWrap}>
          {transactions.length === 0 ? (
            <div className={styles.emptyMsg}>
              لا توجد عمليات سداد أو حركات مسجلة لهذا المورد بعد.
            </div>
          ) : (
            <div className={styles.txList}>
              {[...transactions].reverse().map((tx, idx) => {
                const cfg = getTxConfig(tx);
                const TxIcon = cfg.icon;
                const txNewBal = Number(tx.newBalance) || 0;

                return (
                  <div
                    key={tx.id || idx}
                    className={styles.txCard}
                  >
                    <div className={styles.txInfoGroup}>
                      <div className={`${styles.txIconBox} ${cfg.iconClass}`}>
                        <TxIcon size={18} />
                      </div>
                      <div>
                        <div className={styles.txTitle}>
                          {tx.type || "حركة مالية"}
                          {tx.method && <span className={styles.txMethodTag}>({tx.method})</span>}
                        </div>
                        <div className={styles.txMeta}>
                          {tx.date ? new Date(tx.date).toLocaleDateString("ar-EG", { hour: "2-digit", minute: "2-digit" }) : "—"}
                          {tx.notes && ` • ${tx.notes}`}
                        </div>
                      </div>
                    </div>

                    <div className={styles.txRightSide}>
                      <div className={styles.txAmountBox}>
                        <div className={`${styles.txAmount} ${cfg.amountClass}`}>
                          <span className="num-font" dir="ltr">{formatNumber(tx.amount)}</span> ج.م
                        </div>
                        <div className={styles.txNewBal}>
                          الرصيد بعد الحركة: <strong className="num-font" dir="ltr">{formatNumber(Math.abs(txNewBal))}</strong>
                          <span className={styles.txBalHint}>
                            {txNewBal > 0 ? "(له)" : txNewBal < 0 ? "(عليه)" : "(خالص)"}
                          </span>
                        </div>
                      </div>

                      {/* Delete Transaction Button */}
                      {onDeleteTransaction && (
                        <button
                          onClick={() => setConfirmTx(tx)}
                          title="حذف هذه العملية وتعديل الرصيد"
                          className={styles.deleteTxBtn}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
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

"use client";

import { useEffect, useState } from "react";
import { Lock, X, CalendarCheck, AlertCircle } from "lucide-react";
import { formatNumber } from "@/lib/utils";
import { api } from "@/lib/apiClient";

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
import styles from "./POSCloseShiftModal.module.css";

export default function POSCloseShiftModal({
  isOpen,
  onClose,
  shiftStats = { count: 0, sales: 0, profit: 0, cash: 0 },
  shiftNotes = "",
  setShiftNotes,
  isClosingShift,
  onConfirmCloseShift
}) {
  // The drawer: what it should hold (every cash movement of the shift, from the books) vs what is counted.
  const [drawer, setDrawer] = useState(null);
  const [openingCash, setOpeningCash] = useState("");
  const [countedCash, setCountedCash] = useState("");
  useEffect(() => {
    if (!isOpen) return;
    let alive = true;
    setOpeningCash("");
    setCountedCash("");
    api.get("/shifts/current-cash").then((d) => { if (alive) setDrawer(d); });
    return () => { alive = false; };
  }, [isOpen]);

  if (!isOpen) return null;

  const isShiftEmpty = shiftStats.count === 0;
  const k = drawer?.flow?.cash?.byKind || {};
  const expected = round2(num(openingCash) + num(drawer?.expectedCash));
  const hasCount = countedCash !== "";
  const diff = round2(num(countedCash) - expected);
  const lines = [
    ["مبيعات نقدية (والمقدم من الآجل)", k.sales, 1],
    ["تحصيل من العملاء", k.collections, 1],
    ["مرتجعات من المورد", k.purchaseRefunds, 1],
    ["إيداعات في الخزنة", k.treasuryIn, 1],
    ["مرتجعات رُدّت للعملاء", k.refunds, -1],
    ["مصروفات", k.expenses, -1],
    ["دفعات للموردين وفواتير مشتريات", num(k.supplierPayments) + num(k.purchasePayments), -1],
    ["سلف الموظفين", k.advances, -1],
    ["سحب من الخزنة", k.treasuryOut, -1],
  ].filter(([, v]) => num(v) > 0);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className={`modal-content ${styles.modalContainer}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className={styles.headerBrand}>
            <div className={styles.headerIcon}>
              <Lock size={20} />
            </div>
            <div>
              <h3 className={`modal-title font-bold ${styles.headerTitle}`}>
                تقفيل الوردية وأرشفة الحسابات
              </h3>
              <p className={styles.headerSubtitle}>
                نقل سجل مبيعات الوردية إلى تقفيلة الأيام (reports) وتصفير الكاشير
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
          <div className={`shift-summary-box ${styles.summaryBox}`}>
            <h4 className={styles.summaryTitle}>
              <CalendarCheck size={16} />
              ملخص الحسابات للوردية الحالية
            </h4>

            <div className={styles.statsGrid}>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>عدد الفواتير:</span>
                <div className={styles.statValue}>{shiftStats.count} فاتورة</div>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>إجمالي المبيعات:</span>
                <div className={`${styles.statValue} ${styles.salesValue}`}>{formatNumber(shiftStats.sales)} ج.م</div>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>صافي الأرباح:</span>
                <div className={`${styles.statValue} ${styles.profitValue}`}>+{formatNumber(shiftStats.profit)} ج.م</div>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>الكاش في الدرج:</span>
                <div className={`${styles.statValue} ${styles.cashValue}`}>{formatNumber(shiftStats.cash)} ج.م</div>
              </div>
            </div>
          </div>

          {/* Drawer reconciliation */}
          <div className={styles.summaryBox} style={{ marginTop: 12 }}>
            <h4 className={styles.summaryTitle}>💵 جرد الدرج</h4>
            <div style={{ display: "grid", gap: 4, fontSize: "0.85rem" }}>
              {lines.length === 0 && <span style={{ color: "#64748b" }}>لا توجد حركة نقدية في هذه الوردية.</span>}
              {lines.map(([label, v, sign]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>{label}</span>
                  <span className="num-font" style={{ color: sign > 0 ? "#059669" : "#dc2626" }}>{sign > 0 ? "+" : "-"}{formatNumber(v)}</span>
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
              <label style={{ fontSize: "0.8rem" }}>رصيد بداية الوردية (الفكة)
                <input type="number" min="0" step="0.5" dir="ltr" className="pos-input-general" value={openingCash}
                  onChange={(e) => setOpeningCash(e.target.value)} placeholder="0" disabled={isShiftEmpty} />
              </label>
              <label style={{ fontSize: "0.8rem" }}>المبلغ الفعلي في الدرج (بعد العد)
                <input type="number" min="0" step="0.5" dir="ltr" className="pos-input-general" value={countedCash}
                  onChange={(e) => setCountedCash(e.target.value)} placeholder="اختياري" disabled={isShiftEmpty} />
              </label>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontWeight: 800 }}>
              <span>المفروض يكون في الدرج:</span>
              <span className="num-font">{formatNumber(expected)} ج.م</span>
            </div>
            {hasCount && (
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontWeight: 800, color: diff === 0 ? "#059669" : diff < 0 ? "#dc2626" : "#d97706" }}>
                <span>{diff === 0 ? "الدرج مظبوط ✅" : diff < 0 ? "عجز في الدرج" : "زيادة في الدرج"}</span>
                {diff !== 0 && <span className="num-font">{formatNumber(Math.abs(diff))} ج.م</span>}
              </div>
            )}
          </div>

          {isShiftEmpty ? (
            <div className={styles.emptyAlert}>
              <AlertCircle size={18} color="#2563eb" className={styles.alertIcon} />
              <div className={styles.emptyAlertText}>
                <strong>الوردية فارغة حالياً (0 فاتورة):</strong> لا توجد مبيعات في هذه الوردية لأرشفتها. يمكنك البدء بإجراء عمليات البيع أولاً.
              </div>
            </div>
          ) : (
            <div className={`alert-shift-warning ${styles.warningAlert}`}>
              <AlertCircle size={18} color="#b45309" className={styles.alertIcon} />
              <div className={styles.warningAlertText}>
                <strong>تنبيه الإغلاق:</strong> سيتم ترحيل كافة فواتير ومبيعات هذه الوردية إلى سجل تقفيلة الأيام (reports)، وتصفير شاشة المبيعات للبدء بوردية جديدة.
              </div>
            </div>
          )}

          <div className={styles.notesFieldWrapper}>
            <label className={styles.notesLabel}>
              ملاحظات التقفيل (اختياري):
            </label>
            <textarea
              rows="2"
              value={shiftNotes}
              onChange={(e) => setShiftNotes(e.target.value)}
              placeholder="مثلاً: تم تسليم الكاش للمدير بالكامل..."
              className={`pos-input-general ${styles.notesTextarea}`}
              disabled={isShiftEmpty}
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
            onClick={() => onConfirmCloseShift({
              openingCash: num(openingCash),
              closingCashActual: hasCount ? num(countedCash) : null,
            })}
            disabled={isClosingShift || isShiftEmpty}
            className={`btn-confirm-close-shift ${isShiftEmpty ? styles.disabledBtn : ""}`}
          >
            {isClosingShift ? "جاري التقفيل والأرشفة..." : "تأكيد تقفيل الوردية والأرشفة 🔒"}
          </button>
        </div>
      </div>
    </div>
  );
}

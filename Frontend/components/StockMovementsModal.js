"use client";

import { useEffect, useState } from "react";
import { X, History, ArrowUpRight, ArrowDownLeft, AlertCircle } from "lucide-react";
import { api } from "@/lib/apiClient";
import { formatNumber } from "@/lib/utils";
import styles from "./StockMovementsModal.module.css";

const fmtDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("ar-EG", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
};

/** Every recorded change of one product's quantity (sales, returns, purchases, transfers, stock-takes...). */
export default function StockMovementsModal({ isOpen, onClose, product, location = "shop" }) {
  const productId = product?.id;
  const barcode = product?.barcode || "";
  const key = `${productId}|${barcode}|${location}`;
  const [loaded, setLoaded] = useState({ key: null, rows: [] });

  useEffect(() => {
    if (!isOpen || !productId) return;
    let active = true;
    api.get("/inventory/movements", { productId, barcode, location, limit: 5000 }).then((rows) => {
      if (active) setLoaded({ key, rows: Array.isArray(rows) ? rows : [] });
    });
    return () => { active = false; };
  }, [isOpen, productId, barcode, location, key]);

  const loading = loaded.key !== key;
  const movements = loading ? [] : loaded.rows;

  if (!isOpen || !product) return null;

  // Check: the quantity before the oldest recorded movement + every movement since must equal today's quantity.
  const oldest = movements[movements.length - 1];
  const startQty = oldest ? Number(oldest.quantityBefore || 0) : 0;
  const totalChange = movements.reduce((a, m) => a + Number(m.change || 0), 0);
  const expectedQty = Math.round((startQty + totalChange) * 1000) / 1000;
  const currentQty = Number(product.quantity || 0);
  const diff = Math.round((currentQty - expectedQty) * 1000) / 1000;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal-content ${styles.modalContainer}`} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div className={styles.headerBrand}>
            <div className={styles.headerIcon}>
              <History size={22} />
            </div>
            <div>
              <h3 className={styles.headerTitle}>سجل حركة الصنف</h3>
              <p className={styles.headerSubtitle}>
                <strong className={styles.itemName}>{product.name}</strong>
                {product.barcode ? <> • <span className="num-font" dir="ltr">{product.barcode}</span></> : null}
                {" • "}{location === "warehouse" ? "المخزن" : "المحل"}
              </p>
            </div>
          </div>
          <button onClick={onClose} className={styles.closeBtn} aria-label="إغلاق">
            <X size={16} />
          </button>
        </div>

        <div className={styles.summary}>
          <div>
            <span className={styles.summaryLabel}>الرصيد الحالي</span>
            <strong className="num-font">{formatNumber(currentQty)}</strong>
          </div>
          <div>
            <span className={styles.summaryLabel}>عدد الحركات</span>
            <strong className="num-font">{movements.length}</strong>
          </div>
          <div>
            <span className={styles.summaryLabel}>صافي الحركة</span>
            <strong className="num-font" dir="ltr">{totalChange > 0 ? "+" : ""}{formatNumber(totalChange)}</strong>
          </div>
        </div>

        {movements.length > 0 && Math.abs(diff) > 0.0005 && (
          <div className={styles.warning}>
            <AlertCircle size={16} />
            <span>
              الرصيد الحالي مختلف عن مجموع الحركات المسجلة بفرق <span className="num-font" dir="ltr">{diff > 0 ? "+" : ""}{formatNumber(diff)}</span>.
              ممكن يكون بسبب حركات لسه موصلتش من جهاز تاني.
            </span>
          </div>
        )}

        <div className={styles.listWrap}>
          {loading ? (
            <div className={styles.empty}>جاري التحميل...</div>
          ) : movements.length === 0 ? (
            <div className={styles.empty}>
              مفيش حركات مسجلة للصنف ده لسه. السجل بيبدأ من أول تعديل أو بيع بعد تحديث البرنامج.
            </div>
          ) : (
            <div className={styles.list}>
              {movements.map((m) => {
                const up = Number(m.change) > 0;
                return (
                  <div key={m.id} className={styles.row}>
                    <div className={`${styles.icon} ${up ? styles.iconUp : styles.iconDown}`}>
                      {up ? <ArrowUpRight size={16} /> : <ArrowDownLeft size={16} />}
                    </div>
                    <div className={styles.info}>
                      <div className={styles.title}>
                        {m.typeLabel || m.type}
                        {m.refNumber && m.refType !== "transfer" ? <span className={`num-font ${styles.ref}`} dir="ltr">#{m.refNumber}</span> : null}
                      </div>
                      <div className={styles.meta}>
                        {fmtDate(m.createdAt)}
                        {m.userName ? ` • ${m.userName}` : ""}
                        {m.reason ? ` • ${m.reason}` : ""}
                      </div>
                    </div>
                    <div className={styles.numbers}>
                      <strong className={`num-font ${up ? styles.up : styles.down}`} dir="ltr">
                        {up ? "+" : ""}{formatNumber(m.change)}
                      </strong>
                      <span className={`num-font ${styles.beforeAfter}`} dir="ltr">
                        {formatNumber(m.quantityBefore)} → {formatNumber(m.quantityAfter)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

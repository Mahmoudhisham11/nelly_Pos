"use client";

import React, { useState, useMemo } from "react";
import { formatNumber, roundCurrency } from "@/lib/utils";
import { X, Printer, FileText } from "lucide-react";
import styles from "./PrintInventoryModal.module.css";

export default function PrintInventoryModal({ 
  isOpen, 
  onClose, 
  products = [],
  title = "كشف جرد الأصناف ومطابقة المخزون",
  locationName = "مخزن نيللي لمستحضرات التجميل"
}) {
  const [includeValuation, setIncludeValuation] = useState(true);
  const [includeAuditColumn, setIncludeAuditColumn] = useState(true);
  const [filterCategory, setFilterCategory] = useState("all");
  const [sortBy, setSortBy] = useState("name_asc"); // "name_asc" | "qty_asc" | "qty_desc" | "category"

  // Categories list
  const categories = useMemo(() => {
    if (!products || !Array.isArray(products)) return ["all"];
    const set = new Set(products.map(p => p.category).filter(Boolean));
    return ["all", ...Array.from(set)];
  }, [products]);

  // Filtered and sorted products
  const processedProducts = useMemo(() => {
    if (!products || !Array.isArray(products)) return [];
    let list = products.filter(p => filterCategory === "all" || p.category === filterCategory);

    return list.sort((a, b) => {
      if (sortBy === "name_asc") return (a.name || "").localeCompare(b.name || "", "ar");
      if (sortBy === "qty_asc") return (Number(a.quantity) || 0) - (Number(b.quantity) || 0);
      if (sortBy === "qty_desc") return (Number(b.quantity) || 0) - (Number(a.quantity) || 0);
      if (sortBy === "category") return (a.category || "").localeCompare(b.category || "", "ar");
      return 0;
    });
  }, [products, filterCategory, sortBy]);

  // Report Serial Number (pure and stable)
  const reportSerial = useMemo(() => {
    const d = new Date();
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `INV-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${rand}`;
  }, [isOpen]);

  if (!isOpen) return null;

  // Calculations
  const totalItemsCount = processedProducts.length;
  const totalQuantityCount = processedProducts.reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0);
  const totalWholesaleValue = roundCurrency(
    processedProducts.reduce((acc, curr) => acc + ((Number(curr.quantity) || 0) * (Number(curr.wholesalePrice) || 0)), 0)
  );
  const lowStockCount = processedProducts.filter(p => (Number(p.quantity) || 0) <= (Number(p.minThreshold) || 5)).length;

  const currentDate = new Date();
  const dayNames = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  const monthNames = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
  const formattedDate = `${dayNames[currentDate.getDay()]} ${currentDate.getDate()} ${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
  
  let hours = currentDate.getHours();
  const minutes = String(currentDate.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "م" : "ص";
  hours = hours % 12 || 12;
  const formattedTime = `${hours}:${minutes} ${ampm}`;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className={`modal-content ${styles.modalContainer}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Control Bar (Hidden on Print) */}
        <div className={`no-print ${styles.topBar}`}>
          <div className={styles.brandGroup}>
            <div className={styles.iconBox}>
              <FileText size={22} />
            </div>
            <div>
              <h3 className={styles.modalTitle}>
                {title}
              </h3>
              <p className={styles.modalSub}>
                تقرير معتمد جاهز للطباعة المباشرة على ورق A4 أو الحفظ كملف PDF
              </p>
            </div>
          </div>

          <div className={styles.actionsGroup}>
            <button 
              onClick={handlePrint} 
              className={`btn-primary ${styles.printBtn}`}
            >
              <Printer size={18} />
              طباعة الكشف الآن (A4)
            </button>
            <button 
              onClick={onClose}
              className="modal-close-btn"
              type="button"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Print Options Toolbar (Hidden on Print) */}
        <div className={`no-print ${styles.optionsToolbar}`}>
          <div className={styles.checkboxOptions}>
            <label className={styles.checkLabel}>
              <input 
                type="checkbox" 
                checked={includeValuation} 
                onChange={(e) => setIncludeValuation(e.target.checked)} 
                className={styles.pinkCheckbox}
              />
              إظهار الأسعار والقيم المالية (للمسؤول والمحاسب)
            </label>

            <label className={styles.checkLabel}>
              <input 
                type="checkbox" 
                checked={includeAuditColumn} 
                onChange={(e) => setIncludeAuditColumn(e.target.checked)} 
                className={styles.pinkCheckbox}
              />
              إضافة خانة "الجرد الفعلي بالقلم ✍️"
            </label>
          </div>

          <div className={styles.selectsGroup}>
            {/* Category Filter */}
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className={`form-input ${styles.filterSelect}`}
            >
              <option value="all">جميع الأقسام ({products.length})</option>
              {categories.filter(c => c !== "all").map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            {/* Sort Filter */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className={`form-input ${styles.filterSelect}`}
            >
              <option value="name_asc">الترتيب: أبجدياً</option>
              <option value="qty_asc">الترتيب: النواقص أولاً</option>
              <option value="qty_desc">الترتيب: الأعلى كمية</option>
              <option value="category">الترتيب: حسب القسم</option>
            </select>
          </div>
        </div>

        {/* ===================================================================
            PRINTABLE ENTERPRISE INVENTORY SHEET (Official A4 Format)
           =================================================================== */}
        <div id="printable-inventory-document" className={styles.printableDocument}>
          {/* Document Header */}
          <div className={styles.docHeader}>
            <div>
              <div className={styles.brandNameHeader}>
                <span className={styles.brandPink}>
                  NELLY COSMETICS
                </span>
                <span className={styles.locationTitle}>
                  | {locationName}
                </span>
              </div>
              <h1 className={styles.docTitle}>
                {title}
              </h1>
              <div className={styles.docDateRow}>
                <span>تاريخ التقرير: <strong>{formattedDate}</strong></span>
                <span>توقيت الطباعة: <strong className="num-font">{formattedTime}</strong></span>
              </div>
            </div>

            {/* Official Serial & Meta Box */}
            <div className={styles.metaBox}>
              <div>رقم التقرير: <strong className={`num-font ${styles.serialPink}`} dir="ltr">{reportSerial}</strong></div>
              <div className={styles.metaRow}>نوع المستند: <strong>كشف جرد معتمد</strong></div>
              <div className={styles.metaRow}>حالة المخزون: <strong>مطابقة دورية</strong></div>
            </div>
          </div>

          {/* Executive KPI Statistics Grid */}
          <div className={`${styles.kpiGrid} ${includeValuation ? styles.kpiGrid4 : styles.kpiGrid3}`}>
            <div className={styles.kpiCardPink}>
              <div className={styles.kpiLabelPink}>إجمالي الأصناف</div>
              <div className={`num-font ${styles.kpiValPink}`} dir="ltr">
                {formatNumber(totalItemsCount)}
              </div>
            </div>

            <div className={styles.kpiCardGreen}>
              <div className={styles.kpiLabelGreen}>إجمالي عدد القطع</div>
              <div className={`num-font ${styles.kpiValGreen}`} dir="ltr">
                {formatNumber(totalQuantityCount)}
              </div>
            </div>

            {includeValuation && (
              <div className={styles.kpiCardPurple}>
                <div className={styles.kpiLabelPurple}>قيمة رأس المال (جملة)</div>
                <div className={styles.kpiValPurple}>
                  <span className="num-font" dir="ltr">{formatNumber(totalWholesaleValue)}</span> <span className={styles.currencyUnit}>ج.م</span>
                </div>
              </div>
            )}

            <div className={styles.kpiCardOrange}>
              <div className={styles.kpiLabelOrange}>أصناف منخفضة / حرجة</div>
              <div className={`num-font ${styles.kpiValOrange}`} dir="ltr">
                {formatNumber(lowStockCount)}
              </div>
            </div>
          </div>

          {/* Clean Enterprise Inventory Table */}
          <table className={styles.inventoryTable}>
            <thead>
              <tr className={styles.inventoryTheadRow}>
                <th className={styles.thIndex}>#</th>
                <th className={styles.thBarcode}>الباركود</th>
                <th className={styles.thName}>اسم الصنف / الماركة</th>
                <th className={styles.thCategory}>القسم</th>
                <th className={styles.thQty}>رصيد السيستم</th>
                {includeAuditColumn && (
                  <th className={styles.thAudit}>
                    الجرد الفعلي ✍️
                  </th>
                )}
                {includeValuation && (
                  <>
                    <th className={styles.thPrice}>سعر الجملة</th>
                    <th className={styles.thTotalVal}>إجمالي القيمة</th>
                  </>
                )}
                <th className={styles.thStatus}>الحالة</th>
              </tr>
            </thead>
            <tbody>
              {processedProducts.map((item, index) => {
                const qty = Number(item.quantity) || 0;
                const cost = Number(item.wholesalePrice) || 0;
                const lineVal = qty * cost;
                const minThresh = Number(item.minThreshold) || 5;
                const isOut = qty === 0;
                const isLow = qty > 0 && qty <= minThresh;

                return (
                  <tr 
                    key={item.id || index}
                    className={`${styles.tableRow} ${index % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd}`}
                  >
                    <td className={styles.tdIndex}>
                      <span className="num-font" dir="ltr">{index + 1}</span>
                    </td>
                    <td className={styles.tdBarcode}>
                      <span className={`num-font ${styles.barcodeCode}`} dir="ltr">
                        {item.barcode || item.code || "—"}
                      </span>
                    </td>
                    <td className={styles.tdName}>
                      {item.name}
                      {item.brand && <span className={styles.brandMuted}>({item.brand})</span>}
                    </td>
                    <td className={styles.tdCategory}>
                      {item.category || "عام"}
                    </td>
                    <td className={styles.tdQty}>
                      <strong className={`num-font ${styles.qtyValue} ${isOut ? styles.qtyOut : isLow ? styles.qtyLow : styles.qtyNormal}`} dir="ltr">
                        {formatNumber(qty)}
                      </strong>
                    </td>
                    {includeAuditColumn && (
                      <td className={styles.tdAudit}>
                        <span className={styles.auditLine}></span>
                      </td>
                    )}
                    {includeValuation && (
                      <>
                        <td className={styles.tdPrice}>
                          <span className={`num-font ${styles.priceWeight}`} dir="ltr">{formatNumber(cost)}</span>
                        </td>
                        <td className={styles.tdPrice}>
                          <strong className={`num-font ${styles.totalPriceWeight}`} dir="ltr">{formatNumber(lineVal)}</strong>
                        </td>
                      </>
                    )}
                    <td className={styles.tdStatus}>
                      {isOut ? (
                        <span className={styles.statusOut}>نفد ❌</span>
                      ) : isLow ? (
                        <span className={styles.statusLow}>قليل ⚠️</span>
                      ) : (
                        <span className={styles.statusNormal}>متوفر ✓</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Official Signatures & Approval Footer */}
          <div className={styles.signaturesFooter}>
            <div>
              <div className={styles.signatureRole}>إعداد / مسؤول الجرد:</div>
              <div className={styles.signatureLine}>التوقيع والتاريخ</div>
            </div>

            <div>
              <div className={styles.signatureRole}>مراجعة / مراقب المخزون:</div>
              <div className={styles.signatureLine}>التوقيع والتاريخ</div>
            </div>

            <div>
              <div className={styles.signatureRole}>اعتماد / المدير العام:</div>
              <div className={styles.signatureLine}>الختم والتوقيع الرسمي</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

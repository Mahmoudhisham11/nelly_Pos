"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import { searchSoldProductsInReports, returnProductFromDay } from "@/lib/salesService";
import { formatNumber } from "@/lib/utils";
import confetti from "canvas-confetti";
import {
  RotateCcw,
  Search,
  CheckCircle2,
  AlertCircle,
  X,
  Sparkles,
  PackageOpen,
  Boxes,
  ChevronDown,
  ChevronUp,
  Receipt,
  TrendingDown,
  Plus,
  Minus
} from "lucide-react";
import styles from "./returns.module.css";

export default function ReturnsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [mounted, setMounted] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState(null);
  const [searchError, setSearchError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  // Return action state per product key
  const [returnQuantities, setReturnQuantities] = useState({});
  const [selectedDays, setSelectedDays] = useState({}); // groupKey -> day key (closed report id, or "current" for the open shift)
  const [processingKey, setProcessingKey] = useState(null);
  const [expandedInvoices, setExpandedInvoices] = useState({});

  // Confirmation Modal state
  const [pendingReturn, setPendingReturn] = useState(null);

  // UI Toast
  const [toastMessage, setToastMessage] = useState("");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Hydration safety
  useEffect(() => {
    setMounted(true);
  }, []);

  // Auth protection
  useEffect(() => {
    if (mounted && !authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, mounted, router]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 5000);
  };

  const dayLabel = (day) => {
    if (day.isCurrentShift) return "الوردية الحالية (المفتوحة)";
    const d = day.date ? new Date(`${String(day.date).slice(0, 10)}T12:00:00`) : null;
    const text = d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString("ar-EG", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "يوم غير معروف";
    return `${text} — تقفيلة ${day.reportNumber || ""}`.trim();
  };
  const selectedDay = (prod) => (prod.days || []).find((d) => d.key === selectedDays[prod.groupKey]) || null;
  const maxQtyOf = (prod) => selectedDay(prod)?.quantity || 0;

  // Start a fresh result list: quantity 1 and, when the product was sold on a single day, that day already chosen
  const applyResults = (results) => {
    setSearchResults(results);
    const initialQtys = {};
    const initialDays = {};
    results.forEach((prod) => {
      initialQtys[prod.groupKey] = 1;
      if ((prod.days || []).length === 1) initialDays[prod.groupKey] = prod.days[0].key;
    });
    setReturnQuantities(initialQtys);
    setSelectedDays(initialDays);
  };

  // Perform search across nelly_reports and sync with live shop products
  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    const clean = searchQuery.trim();
    if (!clean) {
      setSearchError("يرجى إدخال كود، باركود أو اسم المنتج للبحث عنه.");
      return;
    }

    setSearching(true);
    setSearchError("");
    setHasSearched(true);

    try {
      const results = await searchSoldProductsInReports(clean);
      applyResults(results);

      if (results.length === 0) {
        setSearchError(`لم يتم العثور على أي مبيعات مسجلة في التقارير لهذا الصنف أو الباركود "${clean}".`);
      }
    } catch (err) {
      console.error("Search error in reports:", err);
      setSearchError("حدث خطأ أثناء البحث في تقارير المبيعات. يرجى إعادة المحاولة.");
    } finally {
      setSearching(false);
    }
  };

  // Refresh current search results after return
  const refreshCurrentSearch = async () => {
    const clean = searchQuery.trim();
    if (!clean) return;
    try {
      const results = await searchSoldProductsInReports(clean);
      applyResults(results);
    } catch (err) {
      console.error("Refresh error:", err);
    }
  };

  // Change quantity for a specific product card
  const handleQtyChange = (groupKey, maxQty, delta) => {
    setReturnQuantities(prev => {
      const current = prev[groupKey] || 1;
      let next = current + delta;
      if (next < 1) next = 1;
      if (next > maxQty) next = maxQty;
      return { ...prev, [groupKey]: next };
    });
  };

  const handleQtyInput = (groupKey, maxQty, value) => {
    let parsed = parseInt(value, 10);
    if (isNaN(parsed) || parsed < 1) parsed = 1;
    if (parsed > maxQty) parsed = maxQty;
    setReturnQuantities(prev => ({
      ...prev,
      [groupKey]: parsed
    }));
  };

  const handleDayChange = (prod, key) => {
    setSelectedDays((prev) => ({ ...prev, [prod.groupKey]: key }));
    setReturnQuantities((prev) => ({ ...prev, [prod.groupKey]: 1 }));
  };

  // Open confirmation modal
  const openConfirmModal = (prod) => {
    const day = selectedDay(prod);
    if (!day) return;
    const qty = Math.min(returnQuantities[prod.groupKey] || 1, day.quantity);
    setPendingReturn({
      product: prod,
      day,
      quantity: qty
    });
  };

  // Execute return: deduct from nelly_reports, add to nelly_shop_products
  const handleExecuteReturn = async () => {
    if (!pendingReturn) return;
    const { product, day, quantity } = pendingReturn;

    setProcessingKey(product.groupKey);
    try {
      const res = await returnProductFromDay({ product, day, quantity });

      if (res.success) {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });

        showToast(
          `✅ تم استرجاع (${quantity}) قطعة من (${product.name}) بنجاح! زادت كمية المحل إلى (${res.newShopStock} قطعة) وخُصمت من تقارير المبيعات.`
        );

        setPendingReturn(null);
        await refreshCurrentSearch();
      }
    } catch (err) {
      console.error("Execute return error:", err);
      showToast(err.message || "حدث خطأ أثناء تنفيذ عملية المرتجع.");
    } finally {
      setProcessingKey(null);
    }
  };

  const toggleExpandInvoices = (groupKey) => {
    setExpandedInvoices(prev => ({
      ...prev,
      [groupKey]: !prev[groupKey]
    }));
  };

  if (!mounted || authLoading || !user) {
    return (
      <div className={styles.loadingWrapper} suppressHydrationWarning>
        <p className={styles.loadingText}>جاري تحميل قسم حركة الصنف...</p>
      </div>
    );
  }

  return (
    <div className="app-layout">
      {toastMessage && (
        <div className="fixed-toast-notification">
          <Sparkles className="toast-icon" />
          <span>{toastMessage}</span>
        </div>
      )}

      <Sidebar
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      <div className="main-content">
        <Navbar
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          title="حركة الصنف"
        />

        <main className="page-wrapper">
          {/* Page Header */}
          <div className={styles.headerRow}>
            <div>
              <div className={styles.headerTitleWrapper}>
                <div className={styles.headerIconBox}>
                  <RotateCcw size={24} />
                </div>
                <div>
                  <h2 className={styles.headerTitle}>
                    حركة الصنف واسترجاع المنتجات المباعة
                  </h2>
                  <p className={styles.headerSubtitle}>
                    ابحث عن أي صنف بكوده أو اسمه، وحدد الكمية المُراد إرجاعها لتُخصم فوراً من تقارير المبيعات وتُضاف لرصيد المحل
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Search Box Panel */}
          <div className={`glass-panel ${styles.searchPanel}`}>
            <div className={styles.searchHeader}>
              <div className={styles.searchHeaderTitleRow}>
                <Search size={20} color="#db2777" />
                <h3 className={styles.searchHeaderTitle}>
                  البحث عن المنتج في المبيعات
                </h3>
              </div>
              <p className={styles.searchHeaderDesc}>
                اكتب اسم المنتج أو امسح الباركود / الكود للبحث في كافة مبيعات التقارير السابقة
              </p>
            </div>

            <form onSubmit={handleSearch} className={styles.searchForm}>
              <div className={styles.searchFieldWrap}>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="اكتب اسم المنتج أو امسح الباركود / كود الصنف..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSearchError("");
                  }}
                  className={`form-input num-font ${styles.searchInput}`}
                />
                <Search
                  size={22}
                  color="#db2777"
                  className={styles.searchFieldIcon}
                />
              </div>

              <button
                type="submit"
                disabled={searching}
                className={`btn-primary ${styles.searchSubmitBtn}`}
              >
                {searching ? (
                  <span>جاري البحث في التقارير...</span>
                ) : (
                  <>
                    <Search size={20} />
                    <span>بحث عن المنتج</span>
                  </>
                )}
              </button>
            </form>

            {/* Error Message */}
            {searchError && (
              <div className={styles.errorBox}>
                <AlertCircle size={20} className={styles.errorIcon} />
                <span>{searchError}</span>
              </div>
            )}
          </div>

          {/* Initial State / Prompt when not searched yet */}
          {!hasSearched && (
            <div className={styles.initialPromptBox}>
              <div className={styles.initialPromptIconBox}>
                <Search size={34} />
              </div>
              <h3 className={styles.initialPromptTitle}>
                ابحث عن المنتج للبدء بعملية الإرجاع
              </h3>
              <p className={styles.initialPromptDesc}>
                قم بمسح باركود المنتج أو كتابة اسمه أو كوده أعلاه لعرض الكمية المباعة المسجلة في تقارير المبيعات واسترجاع أي كمية مطلوبة لرصيد المحل فوراً.
              </p>
            </div>
          )}

          {/* Search Results Display */}
          {hasSearched && searchResults && searchResults.length > 0 && (
            <div>
              <div className={styles.resultsHeader}>
                <div className={styles.resultsHeaderTitleRow}>
                  <PackageOpen size={22} color="#db2777" />
                  <h3 className={styles.resultsHeaderTitle}>
                    نتائج البحث ({searchResults.length} منتج مطابق)
                  </h3>
                </div>
                <span className={styles.resultsHeaderHint}>
                  حدد الكمية المراد إرجاعها ثم اضغط على زر إرجاع الكمية
                </span>
              </div>

              <div className={styles.resultsList}>
                {searchResults.map((prod) => {
                  const maxQty = maxQtyOf(prod);
                  const currentSelectedQty = Math.min(returnQuantities[prod.groupKey] || 1, Math.max(maxQty, 1));
                  const isProcessingThis = processingKey === prod.groupKey;
                  const isExpanded = !!expandedInvoices[prod.groupKey];

                  return (
                    <div
                      key={prod.groupKey}
                      className={`glass-card ${styles.resultCard}`}
                    >
                      {/* Top Details & Badges */}
                      <div className={styles.resultCardTop}>
                        <div>
                          <div className={styles.productTitleRow}>
                            <h4 className={styles.productTitle}>
                              {prod.name}
                            </h4>
                            <span className={`badge ${styles.categoryBadge}`}>
                              {prod.category || "عام"}
                            </span>
                          </div>

                          <div className={styles.productMetaRow}>
                            {prod.barcode && (
                              <span className={styles.metaItem}>
                                🏷️ الباركود: <strong className={`num-font ${styles.metaBarcodeVal}`} dir="ltr">{prod.barcode}</strong>
                              </span>
                            )}
                            {prod.code && (
                              <span className={styles.metaItem}>
                                🔢 الكود: <strong className={`num-font ${styles.metaCodeVal}`} dir="ltr">{prod.code}</strong>
                              </span>
                            )}
                            {prod.sellingPrice > 0 && (
                              <span className={styles.metaItem}>
                                💰 سعر البيع: <strong className={`num-font ${styles.metaPriceVal}`} dir="ltr">{formatNumber(prod.sellingPrice)}</strong> ج.م
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Stock & Sold Counter Badges */}
                        <div className={styles.statsGroup}>
                          {/* Current Shop Stock */}
                          <div className={styles.shopStockCard}>
                            <Boxes size={22} color="#059669" />
                            <div>
                              <div className={styles.stockCardLabel}>
                                رصيد المحل الحالي
                              </div>
                              <div className={styles.stockCardVal}>
                                <span className="num-font" dir="ltr">{formatNumber(prod.currentShopStock)}</span> قطعة
                              </div>
                            </div>
                          </div>

                          {/* Total Sold (Reports + Active Shift) */}
                          <div className={styles.soldReportsCard}>
                            <TrendingDown size={22} color="#e11d48" />
                            <div>
                              <div className={styles.soldCardLabel}>
                                إجمالي الكمية المباعة
                              </div>
                              <div className={styles.soldCardVal}>
                                <span className="num-font" dir="ltr">{formatNumber(prod.totalSoldQuantity || prod.totalSoldQuantityInReports)}</span> قطعة
                              </div>
                              {prod.totalSoldQuantityInActiveShift > 0 && (
                                <div className="text-[10px] text-rose-600 font-bold mt-0.5">
                                  ({prod.totalSoldQuantityInReports} مؤرشفة + {prod.totalSoldQuantityInActiveShift} وردية حالية)
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Action Bar: Quantity to return & Confirm Button */}
                      <div className={styles.actionBar}>
                        {/* Sale day: the return comes out of that day's closing report */}
                        <div className={styles.qtyControlGroup}>
                          <span className={styles.qtyControlLabel}>
                            تاريخ البيع (التقفيلة):
                          </span>
                          <select
                            value={selectedDays[prod.groupKey] || ""}
                            onChange={(e) => handleDayChange(prod, e.target.value)}
                            disabled={isProcessingThis}
                            className="form-input"
                            style={{ minWidth: 260 }}
                          >
                            <option value="">اختر اليوم الذي اتباع فيه…</option>
                            {(prod.days || []).map((day) => (
                              <option key={day.key} value={day.key}>
                                {dayLabel(day)} — بيع {day.quantity} قطعة
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Quantity Controls */}
                        <div className={styles.qtyControlGroup}>
                          <span className={styles.qtyControlLabel}>
                            الكمية المراد إرجاعها:
                          </span>
                          <div className={styles.qtyControlBox}>
                            <button
                              type="button"
                              onClick={() => handleQtyChange(prod.groupKey, maxQty, -1)}
                              disabled={currentSelectedQty <= 1 || isProcessingThis}
                              className={`${styles.qtyBtn} ${currentSelectedQty <= 1 ? styles.btnDisabled : styles.btnActive}`}
                            >
                              <Minus size={16} />
                            </button>

                            <input
                              type="number"
                              min="1"
                              max={maxQty}
                              value={currentSelectedQty}
                              onChange={(e) => handleQtyInput(prod.groupKey, maxQty, e.target.value)}
                              disabled={isProcessingThis || maxQty <= 0}
                              className={`num-font ${styles.qtyInput}`}
                            />

                            <button
                              type="button"
                              onClick={() => handleQtyChange(prod.groupKey, maxQty, 1)}
                              disabled={currentSelectedQty >= maxQty || isProcessingThis}
                              className={`${styles.qtyBtn} ${currentSelectedQty >= maxQty ? styles.btnDisabled : styles.btnActive}`}
                            >
                              <Plus size={16} />
                            </button>
                          </div>
                          <span className={styles.maxQtyHint}>
                            {maxQty > 0 ? `(الحد الأقصى في هذا اليوم: ${maxQty} قطعة)` : "(اختر يوم البيع أولاً)"}
                          </span>
                        </div>

                        {/* Return Action Button */}
                        <button
                          type="button"
                          onClick={() => openConfirmModal(prod)}
                          disabled={isProcessingThis || maxQty <= 0}
                          className={`btn-primary ${styles.returnSubmitBtn}`}
                        >
                          <RotateCcw size={18} />
                          <span>إرجاع {currentSelectedQty} قطعة لرصيد المحل</span>
                        </button>
                      </div>

                      {/* Invoices Breakdown Toggle */}
                      {prod.invoices && prod.invoices.length > 0 && (
                        <div className={styles.invoicesSection}>
                          <button
                            type="button"
                            onClick={() => toggleExpandInvoices(prod.groupKey)}
                            className={styles.toggleInvoicesBtn}
                          >
                            <Receipt size={16} />
                            <span>
                              {isExpanded
                                ? "إخفاء تفاصيل فواتير المبيعات المسجل بها هذا الصنف"
                                : `عرض تفاصيل الفواتير المسجل بها هذا الصنف (عدد ${prod.invoices.length} فاتورة)`}
                            </span>
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>

                          {isExpanded && (
                            <div className={styles.invoicesTableWrapper}>
                              <table className={`custom-table ${styles.invoicesTable}`}>
                                <thead>
                                  <tr>
                                    <th>رقم الفاتورة</th>
                                    <th>المصدر / التقرير</th>
                                    <th>تاريخ العملية</th>
                                    <th>العميل</th>
                                    <th className={styles.thCenter}>الكمية المباعة</th>
                                    <th className={styles.thCenter}>سعر البيع</th>
                                    <th className={styles.thCenter}>الإجمالي</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {prod.invoices.map((invItem, idx) => (
                                    <tr key={idx}>
                                      <td>
                                        <span className={`num-font font-bold ${styles.invoiceNumTag}`} dir="ltr">
                                          {invItem.invoiceNumber}
                                        </span>
                                      </td>
                                      <td>
                                        <span className={`badge ${invItem.isCurrentShift ? styles.activeShiftBadge : styles.reportBadge}`}>
                                          {invItem.source || invItem.reportNumber || "تقرير وردية"}
                                        </span>
                                      </td>
                                      <td suppressHydrationWarning>
                                        {invItem.closedAt ? new Date(invItem.closedAt).toLocaleDateString("ar-EG") : "—"}
                                      </td>
                                      <td>{invItem.customerName || "عميل نقدي"}</td>
                                      <td className={styles.soldQtyCol}>
                                        <span className="num-font font-bold" dir="ltr">{invItem.soldQty}</span> قطعة
                                      </td>
                                      <td className={styles.thCenter}>
                                        <span className="num-font" dir="ltr">{formatNumber(invItem.sellingPrice)}</span> ج.م
                                      </td>
                                      <td className={styles.subtotalCol}>
                                        <span className="num-font" dir="ltr">{formatNumber(invItem.subtotal)}</span> ج.م
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Confirmation Modal */}
      {pendingReturn && (
        <div className={`modal-overlay ${styles.modalOverlay}`}>
          <div className={`modal-container ${styles.modalContainer}`}>
            <div className={styles.modalHeader}>
              <div className={styles.modalHeaderTitleGroup}>
                <div className={styles.modalHeaderIcon}>
                  <RotateCcw size={22} />
                </div>
                <h3 className={styles.modalTitle}>
                  تأكيد إرجاع الصنف
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPendingReturn(null)}
                className={styles.modalCloseBtn}
              >
                <X size={18} />
              </button>
            </div>

            <div className={styles.modalProductInfo}>
              <div className={styles.modalProductLabel}>
                الصنف المحدد للإرجاع:
              </div>
              <div className={styles.modalProductName}>
                {pendingReturn.product.name}
              </div>
              <div className={styles.modalQtyRow}>
                <span className={styles.modalQtyLabel}>يوم البيع:</span>
                <span className={styles.modalQtyVal}>{dayLabel(pendingReturn.day)}</span>
              </div>
              <div className={styles.modalQtyRow}>
                <span className={styles.modalQtyLabel}>الكمية المرتجعة:</span>
                <span className={styles.modalQtyVal}>
                  <span className="num-font" dir="ltr">{pendingReturn.quantity}</span> قطعة
                </span>
              </div>
            </div>

            <div className={styles.modalImpactList}>
              <div className={styles.modalImpactItem}>
                <CheckCircle2 size={16} />
                <span>سيتم زيادة رصيد المحل بمقدار ({pendingReturn.quantity}) قطعة فوراً.</span>
              </div>
              <div className={styles.modalImpactItem}>
                <CheckCircle2 size={16} />
                <span>سيتم خصمها من فواتير ذلك اليوم وتعديل مبيعات وأرباح تقفيلته، وسعر الإرجاع هو سعر البيع وقتها بعد حصة الخصم.</span>
              </div>
              <div className={styles.modalImpactItem}>
                <CheckCircle2 size={16} />
                <span>المبلغ المردود يتسجّل خروج كاش بتاريخ اليوم (وليس في تقفيلة اليوم القديم).</span>
              </div>
            </div>

            <div className={styles.modalActions}>
              <button
                type="button"
                onClick={() => setPendingReturn(null)}
                className={`btn-secondary ${styles.modalCancelBtn}`}
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleExecuteReturn}
                disabled={processingKey !== null}
                className={`btn-primary ${styles.modalConfirmBtn}`}
              >
                {processingKey !== null ? "جاري الإرجاع..." : "تأكيد واسترجاع"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

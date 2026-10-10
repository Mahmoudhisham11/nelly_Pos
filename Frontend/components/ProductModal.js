"use client";

import React, { useState, useEffect } from "react";
import confetti from "canvas-confetti";
import { formatNumber } from "@/lib/utils";
import CustomSelect from "@/components/CustomSelect";
import { 
  X, 
  Sparkles, 
  Package, 
  Save,
  Wand2
} from "lucide-react";
import styles from "./ProductModal.module.css";

export const CATEGORIES = [
  "ميكاب",
  "ستاليس",
  "Skin Care",
  "مستلزمات"
];

export default function ProductModal({ 
  isOpen, 
  onClose, 
  onSave, 
  productToEdit = null,
  hideSellingPrice = false,
  isShop = false,
  hideMinThreshold = false
}) {
  const shouldHideThreshold = isShop || hideMinThreshold;

  const [formData, setFormData] = useState({
    barcode: "",
    name: "",
    category: "ميكاب",
    quantity: "",
    wholesalePrice: "",
    sellingPrice: "",
    minThreshold: "",
    brand: "",
    description: ""
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (productToEdit) {
        setFormData({
          barcode: productToEdit.barcode || productToEdit.code || "",
          name: productToEdit.name || "",
          category: productToEdit.category || "ميكاب",
          quantity: productToEdit.quantity !== undefined ? productToEdit.quantity : "",
          wholesalePrice: productToEdit.wholesalePrice ?? productToEdit.costPrice ?? productToEdit.cost_price ?? productToEdit.wholesale_price ?? "",
          sellingPrice: productToEdit.sellingPrice ?? productToEdit.selling_price ?? "",
          minThreshold: productToEdit.minThreshold ?? productToEdit.min_threshold ?? 5,
          brand: productToEdit.brand || "",
          description: productToEdit.description || ""
        });
      } else {
        setFormData({
          barcode: "",
          name: "",
          category: "ميكاب",
          quantity: "",
          wholesalePrice: "",
          sellingPrice: "",
          minThreshold: "",
          brand: "",
          description: ""
        });
      }
      setErrors({});
    }
  }, [productToEdit, isOpen]);

  const generateAutoBarcode = () => {
    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    const newBarcode = `622${randomSuffix}`;
    setFormData(prev => ({
      ...prev,
      barcode: newBarcode
    }));
  };

  if (!isOpen) return null;

  const validate = () => {
    const errs = {};
    if (!formData.barcode.trim()) errs.barcode = "يرجى كتابة أو توليد باركود الصنف";
    if (!formData.name.trim()) errs.name = "يرجى كتابة اسم الصنف";
    
    const qtyNum = Number(formData.quantity);
    if (formData.quantity === "" || isNaN(qtyNum) || !Number.isInteger(qtyNum) || qtyNum < 0) {
      errs.quantity = "الكمية يجب أن تكون رقماً صحيحاً 0 أو أكثر بدون كسور";
    }

    const priceNum = Number(formData.wholesalePrice);
    if (formData.wholesalePrice === "" || isNaN(priceNum) || priceNum < 0) {
      errs.wholesalePrice = "يرجى إدخال سعر جملة صحيح أكبر من أو يساوي صفر";
    }

    const sellingNum = Number(formData.sellingPrice);
    if (formData.sellingPrice !== "" && (isNaN(sellingNum) || sellingNum < 0)) {
      errs.sellingPrice = "يرجى إدخال سعر بيع صحيح";
    }

    if (!shouldHideThreshold) {
      const threshNum = Number(formData.minThreshold);
      if (formData.minThreshold !== "" && (isNaN(threshNum) || !Number.isInteger(threshNum) || threshNum < 0)) {
        errs.minThreshold = "الحد الأدنى يجب أن يكون رقماً صحيحاً 0 أو أكثر";
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const wholesale = parseFloat(formData.wholesalePrice) || 0;
      const selling = formData.sellingPrice !== "" 
        ? parseFloat(formData.sellingPrice) 
        : (wholesale > 0 ? wholesale * 1.25 : 0);

      const dataToSave = {
        barcode: formData.barcode.trim(),
        name: formData.name.trim(),
        category: formData.category,
        quantity: parseInt(formData.quantity, 10) || 0,
        wholesalePrice: wholesale,
        costPrice: wholesale,
        cost_price: wholesale,
        wholesale_price: wholesale,
        sellingPrice: selling,
        selling_price: selling,
        brand: formData.brand ? formData.brand.trim() : "Nelly",
        description: formData.description ? formData.description.trim() : ""
      };

      if (!shouldHideThreshold) {
        dataToSave.minThreshold = parseInt(formData.minThreshold, 10) || 5;
      } else if (productToEdit?.minThreshold !== undefined) {
        dataToSave.minThreshold = productToEdit.minThreshold;
      }

      await onSave(dataToSave, productToEdit?.id);

      if (!productToEdit) {
        try {
          confetti({
            particleCount: 50,
            spread: 60,
            origin: { y: 0.7 }
          });
        } catch (e) {}
      }

      onClose();
    } catch (err) {
      console.error("Save error:", err);
      setErrors(prev => ({
        ...prev,
        submit: err.message || "حدث خطأ أثناء حفظ بيانات الصنف."
      }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const cost = Number(formData.wholesalePrice) || 0;
  const retail = Number(formData.sellingPrice) || (cost > 0 ? cost * 1.25 : 0);
  const profitPerUnit = retail - cost;
  const profitMarginPercent = cost > 0 ? Math.round((profitPerUnit / cost) * 100) : 0;
  const totalWholesaleValue = (Number(formData.quantity) || 0) * cost;
  const hasProfitDetails = !hideSellingPrice && cost > 0 && retail > 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className={`modal-content ${styles.modalContainer}`} 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <div className={styles.headerBrand}>
            <div className={styles.headerIcon}>
              <Package size={22} />
            </div>
            <div>
              <h2 className={`modal-title ${styles.headerTitle}`}>
                {productToEdit 
                  ? (isShop ? "تعديل بيانات الصنف بالمحل" : "تعديل بيانات الصنف") 
                  : (isShop ? "تسجيل صنف جديد بالمحل" : "تسجيل صنف جديد بالمخزن")}
              </h2>
              <p className={styles.headerSubtitle}>
                {isShop ? "بضاعة محل نيللي لمستحضرات التجميل والميكاب" : "مخزن نيللي لمستحضرات التجميل والميكاب"}
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="modal-close-btn"
            title="إغلاق النافذة"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Container */}
        <form onSubmit={handleSubmit} className={styles.form}>
          {/* Scrollable Body */}
          <div className={`modal-body ${styles.modalBody}`}>
            {errors.submit && (
              <div className={styles.submitError}>
                {errors.submit}
              </div>
            )}

            {/* Row 1: Barcode & Name */}
            <div className={styles.gridRow1}>
              <div className={`form-group ${styles.formGroupNoMargin}`}>
                <div className={styles.barcodeHeader}>
                  <label className={`form-label ${styles.noMargin}`}>
                    باركود الصنف <span className={styles.requiredRose}>*</span>
                  </label>
                  <button
                    type="button"
                    onClick={generateAutoBarcode}
                    className={styles.generateBarcodeBtn}
                    title="توليد باركود تلقائي"
                  >
                    <Wand2 size={12} />
                    توليد
                  </button>
                </div>
                <input 
                  type="text"
                  className={`form-input num-font ${styles.barcodeInput}`}
                  dir="ltr"
                  placeholder="622..."
                  value={formData.barcode}
                  onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                />
                {errors.barcode && <span className={styles.fieldError}>{errors.barcode}</span>}
              </div>

              <div className={`form-group ${styles.formGroupNoMargin}`}>
                <label className="form-label">
                  {isShop ? "اسم الصنف بالمحل" : "اسم الصنف بالمخزن"} <span className={styles.requiredRose}>*</span>
                </label>
                <input 
                  type="text"
                  className="form-input"
                  placeholder="مثال: أحمر شفاه مات نيللي - درجة روز 05"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
                {errors.name && <span className={styles.fieldError}>{errors.name}</span>}
              </div>
            </div>

            {/* Row 2: Category & Brand */}
            <div className={styles.gridRow2}>
              <div className={`form-group ${styles.formGroupNoMargin}`}>
                <label className="form-label">التصنيف / Category</label>
                <CustomSelect 
                  options={CATEGORIES}
                  value={formData.category}
                  onChange={(cat) => setFormData({ ...formData, category: cat })}
                />
              </div>

              <div className={`form-group ${styles.formGroupNoMargin}`}>
                <label className="form-label">الماركة / البراند</label>
                <input 
                  type="text"
                  className="form-input"
                  placeholder="Nelly Beauty"
                  value={formData.brand}
                  onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                />
              </div>
            </div>

            {/* Row 3: Quantity, Wholesale Price, and optional Selling Price */}
            <div className={hideSellingPrice ? styles.gridRow3Two : styles.gridRow3Full}>
              <div className={`form-group ${styles.formGroupNoMargin}`}>
                <label className="form-label">
                  {isShop ? "الكمية المتوفرة بالمحل" : "الكمية المتوفرة"} <span className={styles.requiredRose}>*</span>
                </label>
                <input 
                  type="number"
                  min="0"
                  dir="ltr"
                  className={`form-input num-font ${styles.priceInput}`}
                  placeholder="0"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                />
                {errors.quantity && <span className={styles.fieldError}>{errors.quantity}</span>}
              </div>

              <div className={`form-group ${styles.formGroupNoMargin}`}>
                <label className="form-label">
                  سعر التكلفة/الجملة <span className={styles.requiredRose}>*</span>
                </label>
                <div className={styles.inputWithCurrency}>
                  <input 
                    type="number"
                    min="0"
                    step="0.5"
                    dir="ltr"
                    className={`form-input num-font ${styles.priceInput}`}
                    placeholder="0.00"
                    value={formData.wholesalePrice}
                    onChange={(e) => setFormData({ ...formData, wholesalePrice: e.target.value })}
                  />
                  <span className={styles.currencyTag}>
                    ج.م
                  </span>
                </div>
                {errors.wholesalePrice && <span className={styles.fieldError}>{errors.wholesalePrice}</span>}
              </div>

              {!hideSellingPrice && (
                <div className={`form-group ${styles.formGroupNoMargin}`}>
                  <label className="form-label">
                    سعر البيع (قطاعي) <span className={styles.requiredGreen}>*</span>
                  </label>
                  <div className={styles.inputWithCurrency}>
                    <input 
                      type="number"
                      min="0"
                      step="0.5"
                      dir="ltr"
                      className={`form-input num-font ${styles.sellingPriceInput}`}
                      placeholder={cost > 0 ? (cost * 1.25).toFixed(1) : "0.00"}
                      value={formData.sellingPrice}
                      onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                    />
                    <span className={styles.currencyTagGreen}>
                      ج.م
                    </span>
                  </div>
                  {errors.sellingPrice && <span className={styles.fieldError}>{errors.sellingPrice}</span>}
                </div>
              )}
            </div>

            {/* Row 4: Min Threshold (Only if warehouse / not hidden) */}
            {!shouldHideThreshold && (
              <div className={`form-group ${styles.thresholdGroup}`}>
                <label className="form-label">حد التنبيه عند نقص المخزون (إعادة الطلب)</label>
                <input 
                  type="number"
                  min="1"
                  dir="ltr"
                  className="form-input num-font"
                  placeholder="5"
                  value={formData.minThreshold}
                  onChange={(e) => setFormData({ ...formData, minThreshold: e.target.value })}
                />
                {errors.minThreshold && <span className={styles.fieldError}>{errors.minThreshold}</span>}
              </div>
            )}

            {/* Real-time valuation & profit banner */}
            <div className={styles.valuationBanner}>
              <div className={`${styles.valuationTop} ${hasProfitDetails ? styles.valuationTopWithMargin : ""}`}>
                <div className={styles.valuationLabelWrapper}>
                  <Sparkles size={18} color="#db2777" />
                  <span className={styles.valuationLabel}>
                    {isShop ? "إجمالي قيمة بضاعة هذا الصنف بالمحل (بالجملة):" : "إجمالي قيمة المخزون لهذا الصنف (بالجملة):"}
                  </span>
                </div>
                <div className={styles.valuationValueWrapper}>
                  <span className={`num-font ${styles.valuationValue}`} dir="ltr">
                    {formatNumber(totalWholesaleValue)}
                  </span>
                  <span className={styles.valuationCurrency}>ج.م</span>
                </div>
              </div>

              {hasProfitDetails && (
                <div className={styles.valuationProfitRow}>
                  <span className={styles.profitText}>
                    ربح القطعة المتوقع: <strong className={profitPerUnit >= 0 ? styles.profitGreen : styles.profitRed}>{formatNumber(profitPerUnit)} ج.م</strong>
                  </span>
                  <span className={profitMarginPercent >= 0 ? styles.marginBadgePositive : styles.marginBadgeNegative}>
                    هامش الربح: %{profitMarginPercent}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Action Footer */}
          <div className={`modal-footer ${styles.modalFooter}`}>
            <button 
              type="button"
              onClick={onClose}
              className="btn-secondary"
              disabled={isSubmitting}
            >
              إلغاء
            </button>
            <button 
              type="submit"
              className={`btn-primary ${styles.submitBtn}`}
              disabled={isSubmitting}
            >
              <Save size={18} />
              {isSubmitting ? "جاري الحفظ..." : (productToEdit ? "حفظ التعديلات" : (isShop ? "إضافة الصنف للمحل" : "إضافة الصنف للمخزن"))}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

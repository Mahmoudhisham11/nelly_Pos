"use client";

import React, { useState, useMemo } from "react";
import { 
  X, 
  Plus, 
  Trash2, 
  ShoppingBag, 
  Search, 
  Truck, 
  DollarSign, 
  Save, 
  Barcode, 
  AlertCircle 
} from "lucide-react";
import { formatNumber, roundCurrency } from "@/lib/utils";
import { CATEGORIES } from "./ProductModal";
import styles from "./ShopPurchaseInvoiceModal.module.css";

export default function ShopPurchaseInvoiceModal({
  isOpen,
  onClose,
  suppliers = [],
  shopProducts = [],
  onSave
}) {
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("آجل");
  const [paidAmount, setPaidAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [searchBarcode, setSearchBarcode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Invoice Items
  const [items, setItems] = useState([
    {
      id: "item_init_1",
      productId: null,
      barcode: "",
      name: "",
      category: "ميكاب",
      brand: "Nelly",
      quantity: 1,
      wholesalePrice: "",
      sellingPrice: "",
      minThreshold: 3
    }
  ]);


  const selectedSupplier = useMemo(() => {
    return suppliers.find(s => s.id === selectedSupplierId) || null;
  }, [suppliers, selectedSupplierId]);

  // Calculations
  const totalCost = useMemo(() => {
    return roundCurrency(
      items.reduce((sum, item) => {
        const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
        const wholesale = Math.max(0, parseFloat(item.wholesalePrice) || 0);
        return sum + (qty * wholesale);
      }, 0)
    );
  }, [items]);

  const totalItemsCount = useMemo(() => {
    return items.reduce((sum, item) => sum + (Math.max(1, parseInt(item.quantity, 10) || 1)), 0);
  }, [items]);

  const parsedPaid = parseFloat(paidAmount) || 0;
  const remainingDue = paymentMethod === "آجل" 
    ? totalCost 
    : (paymentMethod === "نقدي" 
        ? (parsedPaid > 0 ? Math.max(0, totalCost - parsedPaid) : 0) 
        : Math.max(0, totalCost - parsedPaid));

  if (!isOpen) return null;

  // Add Item Row
  const handleAddItemRow = () => {
    setItems(prev => [
      ...prev,
      {
        id: `item_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        productId: null,
        barcode: "",
        name: "",
        category: "ميكاب",
        brand: "Nelly",
        quantity: 1,
        wholesalePrice: "",
        sellingPrice: "",
        minThreshold: 3
      }
    ]);
  };

  // Remove Item Row
  const handleRemoveItem = (id) => {
    if (items.length <= 1) {
      setItems([{
        id: `item_${Date.now()}_1`,
        productId: null,
        barcode: "",
        name: "",
        category: "ميكاب",
        brand: "Nelly",
        quantity: 1,
        wholesalePrice: "",
        sellingPrice: "",
        minThreshold: 3
      }]);
      return;
    }
    setItems(prev => prev.filter(i => i.id !== id));
  };

  // Update Item field
  const handleUpdateItem = (id, field, value) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        if (field === "wholesalePrice" && (!item.sellingPrice || item.sellingPrice === "")) {
          const num = parseFloat(value) || 0;
          if (num > 0) {
            updated.sellingPrice = roundCurrency(num * 1.25);
          }
        }
        return updated;
      }
      return item;
    }));
  };

  // Quick Barcode Scan/Search to auto-fill
  const handleBarcodeSearch = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const code = searchBarcode.trim().toLowerCase();
      if (!code) return;

      const found = shopProducts.find(p => (p.barcode || "").toLowerCase() === code || (p.name || "").toLowerCase().includes(code));
      if (found) {
        setItems(prev => [
          ...prev,
          {
            id: `item_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            productId: found.id,
            barcode: found.barcode || "",
            name: found.name,
            category: found.category || "ميكاب",
            brand: found.brand || "Nelly",
            quantity: 1,
            wholesalePrice: found.wholesalePrice || "",
            sellingPrice: found.sellingPrice || "",
            minThreshold: found.minThreshold || 3
          }
        ]);
        setSearchBarcode("");
      } else {
        // Add new item with scanned barcode
        setItems(prev => [
          ...prev,
          {
            id: `item_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            productId: null,
            barcode: searchBarcode.trim(),
            name: "",
            category: "ميكاب",
            brand: "Nelly",
            quantity: 1,
            wholesalePrice: "",
            sellingPrice: "",
            minThreshold: 3
          }
        ]);
        setSearchBarcode("");
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");

    const isNoSupplier = !selectedSupplierId || selectedSupplierId === "none" || selectedSupplierId === "";
    const supplierObj = isNoSupplier
      ? { id: null, name: "شراء بدون مورد" }
      : (selectedSupplier || { id: selectedSupplierId, name: "مورد" });

    // Validate items
    const invalidItem = items.find(i => !i.name.trim() || !i.wholesalePrice || parseFloat(i.wholesalePrice) <= 0);
    if (invalidItem) {
      setErrorMsg("يرجى التأكد من إدخال اسم الصنف وسعر تكلفة الجملة بشكل صحيح لجميع البنود.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave({
        supplier: supplierObj,
        supplierId: supplierObj.id,
        supplierName: supplierObj.name,
        totalAmount: totalCost,
        total_amount: totalCost,
        totalCost: totalCost,
        remaining: isNoSupplier ? 0 : remainingDue,
        items,
        paymentMethod: isNoSupplier ? "نقدي" : paymentMethod,
        paidAmount: isNoSupplier ? totalCost : parsedPaid,
        notes
      });
      onClose();
    } catch (err) {
      console.error("Save purchase invoice error:", err);
      setErrorMsg(err.message || "حدث خطأ أثناء حفظ فاتورة الواردات.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modalContainer} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.headerTitleGroup}>
            <div className={styles.headerIconBox}>
              <ShoppingBag size={20} />
            </div>
            <div>
              <h2 className={styles.modalTitle}>فاتورة واردات ومشتريات للمحل</h2>
              <p className={styles.modalSubtitle}>إضافة بضاعة للمحل وإثبات الفاتورة بحساب المورد تلقائياً</p>
            </div>
          </div>
          <button onClick={onClose} className={styles.closeBtn}>
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className={styles.modalBody}>
          {errorMsg && (
            <div className="badge badge-out-of-stock" style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.75rem" }}>
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Supplier Section */}
          <div className={styles.supplierSection}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>
                <Truck size={16} color="#db2777" />
                المورد المسؤول (اختياري)
              </span>
              {selectedSupplier ? (
                <span className={selectedSupplier.balance > 0 ? styles.supplierBalanceBadge : styles.supplierDebtBadge}>
                  {selectedSupplier.balance > 0 ? `مستحق له: ${formatNumber(selectedSupplier.balance)} ج.م` : `حسابه مسدد`}
                </span>
              ) : (
                <span className="badge badge-secondary" style={{ fontSize: "0.8rem", padding: "0.2rem 0.6rem" }}>
                  شراء بدون مورد (لن يضاف على أي حساب مورد)
                </span>
              )}
            </div>

            <div className={styles.supplierSelectGrid}>
              <select
                className={styles.input}
                value={selectedSupplierId}
                onChange={(e) => setSelectedSupplierId(e.target.value)}
              >
                <option value="">بدون مورد (شراء بدون مورد)</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.phone ? `(${s.phone})` : ""} - الرصيد الحالي: {formatNumber(s.balance)} ج.م
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Items Section */}
          <div className={styles.itemsSection}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>
                <Barcode size={16} color="#db2777" />
                أصناف الفاتورة الواردة ({items.length} صنف / {totalItemsCount} قطعة)
              </span>
              <button 
                type="button" 
                onClick={handleAddItemRow} 
                className="btn-secondary"
                style={{ fontSize: "0.8rem", padding: "0.4rem 0.75rem" }}
              >
                <Plus size={14} /> إضافة بند جديد
              </button>
            </div>

            {/* Quick Barcode Scan */}
            <div className={styles.quickAddRow}>
              <div className={styles.searchInputWrapper}>
                <Search size={16} className={styles.searchIcon} />
                <input
                  type="text"
                  placeholder="امسح بالباركود أو اكتب اسم الصنف لإضافته سريعاً..."
                  className={styles.searchInput}
                  value={searchBarcode}
                  onChange={(e) => setSearchBarcode(e.target.value)}
                  onKeyDown={handleBarcodeSearch}
                />
              </div>
            </div>

            {/* Items Table */}
            <div className={styles.itemsTableWrapper}>
              <table className={styles.itemsTable}>
                <thead>
                  <tr>
                    <th style={{ width: "24%" }}>اسم الصنف</th>
                    <th style={{ width: "16%" }}>الباركود</th>
                    <th style={{ width: "14%" }}>القسم</th>
                    <th style={{ width: "10%" }}>الكمية</th>
                    <th style={{ width: "12%" }}>سعر الجملة</th>
                    <th style={{ width: "12%" }}>سعر البيع</th>
                    <th style={{ width: "12%" }}>الإجمالي</th>
                    <th style={{ width: "5%" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const lineSubtotal = roundCurrency((parseInt(item.quantity, 10) || 1) * (parseFloat(item.wholesalePrice) || 0));
                    return (
                      <tr key={item.id}>
                        <td>
                          <input
                            type="text"
                            placeholder="اسم الصنف..."
                            className={styles.tableInput}
                            value={item.name}
                            onChange={(e) => handleUpdateItem(item.id, "name", e.target.value)}
                            required
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            placeholder="الباركود..."
                            className={styles.tableInput}
                            value={item.barcode}
                            onChange={(e) => handleUpdateItem(item.id, "barcode", e.target.value)}
                            dir="ltr"
                          />
                        </td>
                        <td>
                          <select
                            className={styles.tableInput}
                            value={item.category}
                            onChange={(e) => handleUpdateItem(item.id, "category", e.target.value)}
                          >
                            {CATEGORIES.map(c => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            type="number"
                            min="1"
                            className={styles.tableInput}
                            value={item.quantity}
                            onChange={(e) => handleUpdateItem(item.id, "quantity", e.target.value)}
                            required
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            placeholder="0.00"
                            className={styles.tableInput}
                            value={item.wholesalePrice}
                            onChange={(e) => handleUpdateItem(item.id, "wholesalePrice", e.target.value)}
                            required
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            placeholder="0.00"
                            className={styles.tableInput}
                            value={item.sellingPrice}
                            onChange={(e) => handleUpdateItem(item.id, "sellingPrice", e.target.value)}
                          />
                        </td>
                        <td>
                          <span className="num-font" style={{ fontWeight: 700, color: "#0f172a" }}>
                            {formatNumber(lineSubtotal)} ج.م
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id)}
                            className={styles.deleteItemBtn}
                            title="حذف البند"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Payment & Summary */}
          <div className={styles.summaryGrid}>
            <div className={styles.costCard}>
              <span className={styles.costLabel}>إجمالي تكلفة الفاتورة:</span>
              <span className={styles.costVal}>
                <span className="num-font">{formatNumber(totalCost)}</span> ج.م
              </span>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>طريقة السداد للمورد</label>
              <select
                className={styles.input}
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                <option value="آجل">آجل / على الحساب (يضاف لمستحقات المورد)</option>
                <option value="نقدي">سداد نقدي فوري (من الخزينة)</option>
                <option value="فيزا">سداد إلكتروني (فيزا / بنكي)</option>
                <option value="محفظة إلكترونية">فودافون كاش / محفظة</option>
              </select>
            </div>

            {paymentMethod !== "آجل" && (
              <div className={styles.formGroup}>
                <label className={styles.label}>المبلغ المسدد حالياً للمورد</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max={totalCost}
                  placeholder={totalCost.toString()}
                  className={styles.input}
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                />
              </div>
            )}

            <div className={styles.formGroup}>
              <label className={styles.label}>ملاحظات الفاتورة (اختياري)</label>
              <input
                type="text"
                placeholder="أرقام شحنة، اسم مندوب، ملاحظات خاصة..."
                className={styles.input}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          {/* Footer */}
          <div className={styles.modalFooter}>
            <button
              type="button"
              onClick={onClose}
              className={styles.cancelBtn}
              disabled={isSubmitting}
            >
              إلغاء
            </button>
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={isSubmitting}
            >
              <Save size={18} />
              {isSubmitting ? "جاري حفظ الفاتورة..." : "حفظ الفاتورة وإضافة البضاعة للمحل"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

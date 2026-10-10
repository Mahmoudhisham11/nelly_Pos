"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import ProductModal, { CATEGORIES } from "@/components/ProductModal";
import BarcodeModal from "@/components/BarcodeModal";
import PrintInventoryModal from "@/components/PrintInventoryModal";
import PermissionDeniedModal from "@/components/PermissionDeniedModal";
import TransferModal from "@/components/TransferModal";
import CustomSelect from "@/components/CustomSelect";
import { 
  subscribeToProducts, 
  addProduct, 
  updateProduct, 
  deleteProduct 
} from "@/lib/productsService";
import { transferFromWarehouseToShop } from "@/lib/shopService";
import { formatNumber } from "@/lib/utils";
import { 
  Plus, 
  Search, 
  Download, 
  Trash2, 
  Edit3, 
  Barcode, 
  Boxes, 
  PackagePlus,
  RotateCcw,
  Lock,
  Printer,
  Layers,
  DollarSign,
  Store
} from "lucide-react";
import styles from "./products.module.css";

export default function ProductsPage() {
  const router = useRouter();
  const { user, isAdmin, loading: authLoading } = useAuth();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [sortBy, setSortBy] = useState("newest");

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [barcodeProduct, setBarcodeProduct] = useState(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState(null);
  const [productToTransfer, setProductToTransfer] = useState(null);
  const [permissionDeniedAction, setPermissionDeniedAction] = useState(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3000);
  };

  // Authentication check
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  // Firestore real-time listener
  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeToProducts((data) => {
      setProducts(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  // Options for custom dropdowns
  const categoryOptions = useMemo(() => [
    { value: "all", label: "جميع الأقسام" },
    ...CATEGORIES.map(c => ({ value: c, label: c }))
  ], []);

  const statusOptions = [
    { value: "all", label: "كل الحالات" },
    { value: "in-stock", label: "متوفر بالمخزن" },
    { value: "low-stock", label: "مخزون منخفض" },
    { value: "out-of-stock", label: "منتهي من المخزن" }
  ];

  const sortOptions = [
    { value: "newest", label: "الترتيب: الأحدث أولاً" },
    { value: "name", label: "الترتيب: اسم الصنف (أ-ي)" },
    { value: "barcode", label: "الترتيب: الباركود" },
    { value: "qty-desc", label: "الكمية: من الأعلى للأقل" },
    { value: "qty-asc", label: "الكمية: من الأقل للأعلى" },
    ...(isAdmin ? [
      { value: "price-desc", label: "سعر الجملة: الأعلى أولاً" },
      { value: "price-asc", label: "سعر الجملة: الأقل أولاً" }
    ] : [])
  ];

  // Filtered and Sorted Products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const q = searchQuery.toLowerCase().trim();
      const barcodeStr = (p.barcode || p.code || "").toLowerCase();
      const nameStr = (p.name || "").toLowerCase();
      const brandStr = (p.brand || "").toLowerCase();

      const matchesSearch = 
        !q || 
        barcodeStr.includes(q) ||
        nameStr.includes(q) ||
        brandStr.includes(q);

      const matchesCat = selectedCategory === "all" || p.category === selectedCategory;

      const qty = Number(p.quantity) || 0;
      const minThresh = Number(p.minThreshold) || 5;
      let matchesStatus = true;
      if (selectedStatus === "in-stock") matchesStatus = qty > minThresh;
      if (selectedStatus === "low-stock") matchesStatus = qty > 0 && qty <= minThresh;
      if (selectedStatus === "out-of-stock") matchesStatus = qty === 0;

      return matchesSearch && matchesCat && matchesStatus;
    }).sort((a, b) => {
      if (sortBy === "name") return (a.name || "").localeCompare(b.name || "", "ar");
      if (sortBy === "barcode") return (a.barcode || a.code || "").localeCompare(b.barcode || b.code || "");
      if (sortBy === "qty-desc") return (b.quantity || 0) - (a.quantity || 0);
      if (sortBy === "qty-asc") return (a.quantity || 0) - (b.quantity || 0);
      if (sortBy === "price-desc") return (b.wholesalePrice || 0) - (a.wholesalePrice || 0);
      if (sortBy === "price-asc") return (a.wholesalePrice || 0) - (b.wholesalePrice || 0);
      return 0;
    });
  }, [products, searchQuery, selectedCategory, selectedStatus, sortBy]);

  // Calculate filtered totals
  const totalFilteredCount = filteredProducts.length;
  const totalFilteredQty = filteredProducts.reduce((sum, p) => sum + (Number(p.quantity) || 0), 0);
  const totalFilteredWholesale = filteredProducts.reduce(
    (sum, p) => sum + (Number(p.quantity) || 0) * (Number(p.wholesalePrice) || 0),
    0
  );

  const resetFilters = () => {
    setSearchQuery("");
    setSelectedCategory("all");
    setSelectedStatus("all");
    setSortBy("newest");
  };

  // Protected Actions
  const handleOpenAddModal = () => {
    if (!isAdmin) {
      setPermissionDeniedAction("إضافة صنف جديد للمخزن");
      return;
    }
    setEditingProduct(null);
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (product) => {
    if (!isAdmin) {
      setPermissionDeniedAction("تعديل بيانات وكمية الصنف");
      return;
    }
    setEditingProduct(product);
    setIsAddModalOpen(true);
  };

  const handleOpenDeleteModal = (product) => {
    if (!isAdmin) {
      setPermissionDeniedAction("حذف الصنف من المخزن");
      return;
    }
    setProductToDelete(product);
  };

  const handleSaveProduct = async (productData, id) => {
    if (!isAdmin) return;
    if (id) {
      await updateProduct(id, productData);
    } else {
      await addProduct(productData);
    }
  };

  const handleConfirmTransfer = async (product, quantity) => {
    try {
      await transferFromWarehouseToShop(product, quantity, user);
      showToast(`تم تحويل ${quantity} قطعة من "${product.name}" إلى المحل بنجاح 🏪`);
    } catch (err) {
      alert(err.message || "حدث خطأ أثناء تحويل البضاعة.");
    }
  };

  const confirmDelete = async () => {
    if (!isAdmin || !productToDelete) return;
    try {
      await deleteProduct(productToDelete.id);
      showToast(`تم حذف الصنف "${productToDelete.name}" بنجاح.`);
    } catch (err) {
      console.warn("Delete error:", err);
      showToast(err.message || "حدث خطأ أثناء الحذف.");
    } finally {
      setProductToDelete(null);
    }
  };

  // Export to CSV
  const exportToCSV = () => {
    if (filteredProducts.length === 0) return;
    const headers = isAdmin 
      ? ["الباركود", "اسم الصنف", "القسم", "الكمية بالمخزن", "سعر الجملة (ج.م)", "إجمالي قيمة الجملة (ج.م)"]
      : ["الباركود", "اسم الصنف", "القسم", "الكمية بالمخزن", "حالة المخزون"];

    const rows = filteredProducts.map((p, idx) => {
      const barcodeVal = p.barcode || p.code || `622100100${idx + 1}`;
      if (isAdmin) {
        return [
          `"${barcodeVal}"`,
          `"${p.name || ''}"`,
          `"${p.category || ''}"`,
          p.quantity || 0,
          p.wholesalePrice || 0,
          (Number(p.quantity) || 0) * (Number(p.wholesalePrice) || 0)
        ];
      } else {
        const qty = Number(p.quantity) || 0;
        const status = qty === 0 ? "نفد" : qty <= (p.minThreshold || 5) ? "منخفض" : "متوفر";
        return [
          `"${barcodeVal}"`,
          `"${p.name || ''}"`,
          `"${p.category || ''}"`,
          qty,
          `"${status}"`
        ];
      }
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `تقرير_مخزن_نيللي_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (authLoading || (!user && loading)) {
    return (
      <div className={styles.loadingWrapper}>
        <p className={styles.loadingText}>جاري تحميل سجل بضاعة المخزن...</p>
      </div>
    );
  }

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <Sidebar 
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      <div className="main-content">
        <Navbar 
          onOpenAddModal={handleOpenAddModal}
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
        />

        <main className="page-wrapper">
          {/* Page Header */}
          <div className={styles.headerRow}>
            <div>
              <div className={styles.headerTitleWrapper}>
                <h2 className={styles.headerTitle}>المخزن</h2>
                <span className={`badge badge-code ${styles.productsBadge}`}>
                  <span className="num-font" dir="ltr">{formatNumber(products.length)}</span> صنف مسجل
                </span>
              </div>
              <p className={styles.headerSubtitle}>
                إدارة وجرد بضاعة المخزن الرئيسي، وتعديل الأصناف، والتحويل إلى المحل
              </p>
            </div>

            {/* Action buttons */}
            <div className={styles.headerActions}>
              <button 
                onClick={() => setIsPrintModalOpen(true)} 
                className={`btn-secondary ${styles.whiteBtn}`} 
                title="معاينة وطباعة كشف جرد المخزن"
              >
                <Printer size={16} color="#db2777" />
                طباعة كشف الجرد
              </button>
              <button 
                onClick={exportToCSV} 
                className={`btn-secondary ${styles.whiteBtn}`} 
                title="تصدير إلى ملف إكسل CSV"
              >
                <Download size={16} color="#059669" />
                تصدير CSV
              </button>
              <button 
                onClick={handleOpenAddModal} 
                className="btn-primary"
              >
                <PackagePlus size={18} />
                إضافة صنف جديد
              </button>
            </div>
          </div>

          {/* Filter & Search Toolbar */}
          <div className={`glass-panel ${styles.toolbarPanel}`}>
            <div className={styles.toolbarGrid}>
              {/* Search Input for Barcode or Name */}
              <div className={styles.searchWrap}>
                <input 
                  type="text"
                  className={`form-input ${styles.searchInput}`}
                  placeholder="ابحث بباركود الصنف (Barcode)، اسم الصنف، أو الماركة..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <Search 
                  size={18} 
                  color="#db2777" 
                  className={styles.searchIcon}
                />
              </div>

              {/* Custom Category Filter */}
              <div>
                <CustomSelect 
                  options={categoryOptions}
                  value={selectedCategory}
                  onChange={(cat) => setSelectedCategory(cat)}
                />
              </div>

              {/* Custom Stock Status Filter */}
              <div>
                <CustomSelect 
                  options={statusOptions}
                  value={selectedStatus}
                  onChange={(stat) => setSelectedStatus(stat)}
                />
              </div>

              {/* Custom Sort Filter */}
              <div>
                <CustomSelect 
                  options={sortOptions}
                  value={sortBy}
                  onChange={(sb) => setSortBy(sb)}
                />
              </div>

              {/* Reset Filters */}
              {(searchQuery || selectedCategory !== "all" || selectedStatus !== "all" || sortBy !== "newest") && (
                <button 
                  onClick={resetFilters} 
                  className={`btn-secondary ${styles.resetFiltersBtn}`}
                  title="إعادة ضبط الفلاتر"
                >
                  <RotateCcw size={16} />
                </button>
              )}
            </div>

            {/* 3 Rich Stat Cards for Summary Data */}
            <div className={styles.summaryStatsGrid}>
              {/* Card 1: معروض */}
              <div className={styles.summaryCardCount}>
                <div>
                  <span className={styles.statLabel}>الأصناف المعروضة</span>
                  <div className={styles.statValueRow}>
                    <span className={`num-font ${styles.statValCount}`} dir="ltr">
                      {formatNumber(totalFilteredCount)}
                    </span>
                    <span className={styles.statUnitText}>صنف</span>
                  </div>
                </div>
                <div className={styles.statIconBoxCount}>
                  <Boxes size={20} />
                </div>
              </div>

              {/* Card 2: إجمالي القطع */}
              <div className={styles.summaryCardQty}>
                <div>
                  <span className={styles.statLabel}>إجمالي عدد القطع بالمخزن</span>
                  <div className={styles.statValueRow}>
                    <span className={`num-font ${styles.statValQty}`} dir="ltr">
                      {formatNumber(totalFilteredQty)}
                    </span>
                    <span className={styles.statUnitQty}>قطعة</span>
                  </div>
                </div>
                <div className={styles.statIconBoxQty}>
                  <Layers size={20} />
                </div>
              </div>

              {/* Card 3: القيمة بسعر الجملة */}
              <div className={styles.summaryCardWholesale}>
                <div>
                  <span className={styles.statLabel}>القيمة بسعر الجملة</span>
                  {isAdmin ? (
                    <div className={styles.statValueRow}>
                      <span className={`num-font ${styles.statValWholesale}`} dir="ltr">
                        {formatNumber(totalFilteredWholesale)}
                      </span>
                      <span className={styles.statUnitWholesale}>ج.م</span>
                    </div>
                  ) : (
                    <div className={styles.adminOnlyTag}>
                      <Lock size={13} /> خاص بالمسؤول
                    </div>
                  )}
                </div>
                <div className={styles.statIconBoxWholesale}>
                  <DollarSign size={20} />
                </div>
              </div>
            </div>
          </div>

          {/* Screen Products Table */}
          <div className="table-container">
            {filteredProducts.length === 0 ? (
              <div className={styles.emptyContainer}>
                <Boxes size={48} color="#db2777" className={styles.emptyIcon} />
                <h3 className={styles.emptyTitle}>لم يتم العثور على أي صنف</h3>
                <p className={styles.emptyDesc}>
                  {searchQuery ? `لا يوجد صنف يطابق الباركود أو الاسم "${searchQuery}"` : "قم بتسجيل صنف جديد بالمخزن"}
                </p>
                <button 
                  onClick={handleOpenAddModal}
                  className="btn-primary"
                >
                  <Plus size={16} />
                  إضافة صنف جديد
                </button>
              </div>
            ) : (
              <table className="custom-table">
                <thead>
                  <tr>
                    <th className={styles.thBarcode}>الباركود</th>
                    <th className={styles.thNowrap}>اسم الصنف والماركة</th>
                    <th className={styles.thNowrap}>القسم</th>
                    <th className={styles.thCenter}>الكمية بالمخزن</th>
                    <th className={styles.thNowrap}>سعر الجملة</th>
                    <th className={styles.thNowrap}>إجمالي قيمة الصنف</th>
                    <th className={styles.thNowrap}>حالة المخزون</th>
                    <th className={styles.thCenter}>الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((p, idx) => {
                    const qty = Number(p.quantity) || 0;
                    const wholesale = Number(p.wholesalePrice) || 0;
                    const totalVal = qty * wholesale;
                    const minThresh = Number(p.minThreshold) || 5;
                    const isLow = qty <= minThresh && qty > 0;
                    const isOut = qty === 0;
                    const barcodeVal = p.barcode || p.code || `622100100${idx + 1}`;

                    return (
                      <tr key={p.id}>
                        {/* Product Barcode - Prominent and High-Contrast */}
                        <td>
                          <span 
                            className={`num-font ${styles.barcodeTag}`} 
                            dir="ltr"
                          >
                            {barcodeVal}
                          </span>
                        </td>

                        {/* Product Name & Brand */}
                        <td>
                          <div className={styles.productNameText}>
                            {p.name}
                          </div>
                          {p.brand && (
                            <div className={styles.productBrandText}>
                              {p.brand}
                            </div>
                          )}
                        </td>

                        {/* Category */}
                        <td>
                          <span className="badge badge-category">
                            {p.category || "عام"}
                          </span>
                        </td>

                        {/* Quantity Display Only */}
                        <td className={styles.thCenter}>
                          <div className={styles.quantityDisplayWrap}>
                            <span 
                              className={`num-font ${isOut ? styles.qtyValueOut : isLow ? styles.qtyValueLow : styles.qtyValueNormal}`} 
                              dir="ltr"
                            >
                              {formatNumber(qty)}
                            </span>
                            <span className={styles.qtyUnitText}>قطعة</span>
                          </div>
                        </td>

                        {/* Wholesale Price (Protected for Admin Only) */}
                        <td>
                          {isAdmin ? (
                            <strong className={styles.wholesaleText}>
                              <span className="num-font" dir="ltr">{formatNumber(wholesale)}</span> ج.م
                            </strong>
                          ) : (
                            <span className={styles.adminProtectedBadge}>
                              <Lock size={12} />
                              خاص بالمسؤول
                            </span>
                          )}
                        </td>

                        {/* Total Value (Protected for Admin Only) */}
                        <td>
                          {isAdmin ? (
                            <strong className={styles.totalValueText}>
                              <span className="num-font" dir="ltr">{formatNumber(totalVal)}</span> ج.م
                            </strong>
                          ) : (
                            <span className={styles.adminProtectedBadge}>
                              <Lock size={12} />
                              خاص بالمسؤول
                            </span>
                          )}
                        </td>

                        {/* Stock Status Badge */}
                        <td>
                          {isOut ? (
                            <span className="badge badge-out-of-stock">نفد تماماً</span>
                          ) : isLow ? (
                            <span className="badge badge-low-stock">مخزون قليل (<span className="num-font" dir="ltr">{formatNumber(qty)}</span>)</span>
                          ) : (
                            <span className="badge badge-in-stock">متوفر (<span className="num-font" dir="ltr">{formatNumber(qty)}</span>)</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className={styles.thCenter}>
                          <div className={styles.actionsGroup}>
                            <button 
                              onClick={() => setProductToTransfer(p)}
                              className={`btn-secondary ${styles.transferBtn}`}
                              title="تحويل كمية من الصنف إلى المحل"
                            >
                              <Store size={15} color="#16a34a" />
                              تحويل للمحل
                            </button>
                            <button 
                              onClick={() => setBarcodeProduct(p)}
                              className={`btn-secondary ${styles.barcodeBtn}`}
                              title="طباعة باركود"
                            >
                              <Barcode size={15} color="#db2777" />
                              باركود
                            </button>
                            <button 
                              onClick={() => handleOpenEditModal(p)}
                              className={`btn-primary ${styles.editBtn}`}
                              title="تعديل بيانات وكمية الصنف"
                            >
                              <Edit3 size={15} />
                              تعديل
                            </button>
                            <button 
                              onClick={() => handleOpenDeleteModal(p)}
                              className={`btn-danger ${styles.deleteBtn}`}
                              title="حذف الصنف"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </main>

        {/* Toast Alert */}
        {toastMessage && (
          <div className={styles.toastWrap}>
            <Store size={18} color="#4ade80" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Transfer Modal */}
        <TransferModal 
          isOpen={!!productToTransfer}
          onClose={() => setProductToTransfer(null)}
          product={productToTransfer}
          onConfirmTransfer={handleConfirmTransfer}
          direction="warehouse_to_shop"
        />

        {/* Modals */}
        <ProductModal 
          isOpen={isAddModalOpen}
          onClose={() => { setIsAddModalOpen(false); setEditingProduct(null); }}
          onSave={handleSaveProduct}
          productToEdit={editingProduct}
          hideSellingPrice={true}
        />

        <BarcodeModal 
          isOpen={!!barcodeProduct}
          onClose={() => setBarcodeProduct(null)}
          product={barcodeProduct}
        />

        {/* Permission Denied Popup */}
        <PermissionDeniedModal 
          isOpen={!!permissionDeniedAction}
          onClose={() => setPermissionDeniedAction(null)}
          actionName={permissionDeniedAction}
        />

        {/* Delete Confirmation Modal (Admin only) */}
        {productToDelete && (
          <div className="modal-overlay" onClick={() => setProductToDelete(null)}>
            <div 
              className={`modal-content ${styles.modalCard}`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.deleteModalIcon}>
                <Trash2 size={26} />
              </div>

              <h3 className={styles.deleteModalTitle}>تأكيد حذف الصنف من المخزن</h3>
              <p className={styles.deleteModalDesc}>
                هل أنت متأكد من حذف الصنف <strong className={styles.deleteModalHighlight}>"{productToDelete.name}"</strong> (باركود: {productToDelete.barcode})؟ لن تتمكن من التراجع عن هذا الإجراء.
              </p>

              <div className={styles.deleteModalActions}>
                <button 
                  onClick={() => setProductToDelete(null)}
                  className={`btn-secondary ${styles.cancelModalBtn}`}
                >
                  إلغاء
                </button>
                <button 
                  onClick={confirmDelete}
                  className={`btn-danger ${styles.confirmDeleteBtn}`}
                >
                  نعم، احذف الصنف
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Print Inventory Modal */}
        <PrintInventoryModal 
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          products={filteredProducts}
        />
      </div>
    </div>
  );
}

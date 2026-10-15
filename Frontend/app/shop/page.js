"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import ProductModal, { CATEGORIES } from "@/components/ProductModal";
import { searchProducts } from "@/lib/productSearch";
import BarcodeModal from "@/components/BarcodeModal";
import PrintInventoryModal from "@/components/PrintInventoryModal";
import TransferModal from "@/components/TransferModal";
import PermissionDeniedModal from "@/components/PermissionDeniedModal";
import CustomSelect from "@/components/CustomSelect";
import ShopPurchaseInvoiceModal from "@/components/ShopPurchaseInvoiceModal";
import ShopInvoicesHistoryModal from "@/components/ShopInvoicesHistoryModal";
import {
  subscribeToShopProducts,
  addShopProduct,
  updateShopProduct,
  deleteShopProduct,
  transferFromShopToWarehouse
} from "@/lib/shopService";
import { subscribeToSuppliers } from "@/lib/suppliersService";
import {
  subscribeToShopPurchases,
  createShopPurchaseInvoice,
  returnShopPurchaseItems
} from "@/lib/shopPurchasesService";
import { formatNumber, roundCurrency } from "@/lib/utils";
import {
  Store,
  Search,
  Download,
  Printer,
  Trash2,
  Edit3,
  Barcode,
  RotateCcw,
  ShoppingBag,
  Receipt,
  Filter,
  ChevronDown,
  Layers,
  DollarSign,
  Boxes,
  Plus,
  X
} from "lucide-react";
import styles from "./shop.module.css";

export default function ShopPage() {
  const router = useRouter();
  const { user, isAdmin, loading: authLoading } = useAuth();

  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [shopPurchases, setShopPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const filterDropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  // Close filter dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(e.target)) {
        setIsFilterDropdownOpen(false);
      }
    }
    if (isFilterDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isFilterDropdownOpen]);

  // Modals state
  const [isPurchaseInvoiceModalOpen, setIsPurchaseInvoiceModalOpen] = useState(false);
  const [isInvoicesHistoryModalOpen, setIsInvoicesHistoryModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [barcodeProduct, setBarcodeProduct] = useState(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [productToReturn, setProductToReturn] = useState(null);
  const [productToDelete, setProductToDelete] = useState(null);
  const [permissionDeniedAction, setPermissionDeniedAction] = useState(null);
  const [activeShopCardIndex, setActiveShopCardIndex] = useState(0);
  const shopSwiperRef = useRef(null);

  const handleShopCardsScroll = () => {
    if (!shopSwiperRef.current) return;
    const el = shopSwiperRef.current;
    const scrollLeft = Math.abs(el.scrollLeft);
    const cardWidth = el.scrollWidth / 4;
    const index = Math.round(scrollLeft / cardWidth);
    setActiveShopCardIndex(Math.min(3, Math.max(0, index)));
  };

  const scrollToShopCard = (index) => {
    if (!shopSwiperRef.current) return;
    const el = shopSwiperRef.current;
    const cards = el.children;
    if (cards[index]) {
      cards[index].scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      setActiveShopCardIndex(index);
    }
  };
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3000);
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    const unsubProducts = subscribeToShopProducts((data) => {
      setProducts(data);
      setLoading(false);
    });

    const unsubSuppliers = subscribeToSuppliers((data) => {
      setSuppliers(data);
    });

    const unsubPurchases = subscribeToShopPurchases((data) => {
      setShopPurchases(data);
    });

    return () => {
      unsubProducts();
      unsubSuppliers();
      unsubPurchases();
    };
  }, [user]);

  // Categories list for select
  const categoryOptions = useMemo(() => {
    // the fixed sections plus any other section that products already use (e.g. "أخرى")
    const extra = [...new Set(products.map((p) => p.category).filter((c) => c && !CATEGORIES.includes(c)))];
    return [
      { value: "all", label: "جميع الأقسام" },
      ...[...CATEGORIES, ...extra].map(c => ({ value: c, label: c }))
    ];
  }, [products]);

  const statusOptions = [
    { value: "all", label: "كل الحالات" },
    { value: "in_stock", label: "متوفر بالمحل" },
    { value: "low_stock", label: "مخزون قليل ⚠️" },
    { value: "out_of_stock", label: "نفد من المحل ❌" }
  ];

  const sortOptions = [
    { value: "newest", label: "الترتيب: الأحدث أولاً" },
    { value: "oldest", label: "الترتيب: الأقدم أولاً" },
    { value: "qty_high", label: "الكمية: من الأعلى للأقل" },
    { value: "qty_low", label: "الكمية: من الأقل للأعلى" },
    { value: "price_high", label: "سعر البيع: من الأعلى للأقل" },
    { value: "price_low", label: "سعر البيع: من الأقل للأعلى" }
  ];

  // Filtering & Sorting
  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim();
    // searching: best match first (exact barcode/code, ...) unless another sort was chosen on purpose
    const byRelevance = !!q && sortBy === "newest";
    const searched = q ? searchProducts(products, q, { limit: Infinity, includeCategory: false }) : products;
    const list = searched.filter((p) => {
      const matchesCat = selectedCategory === "all" || p.category === selectedCategory;

      const qty = Number(p.quantity) || 0;
      const minThresh = Number(p.minThreshold) || 3;
      let matchesStatus = true;
      if (selectedStatus === "in_stock") matchesStatus = qty > minThresh;
      else if (selectedStatus === "low_stock") matchesStatus = qty <= minThresh && qty > 0;
      else if (selectedStatus === "out_of_stock") matchesStatus = qty <= 0;

      return matchesCat && matchesStatus;
    });
    if (byRelevance) return list;
    return list.sort((a, b) => {
      if (sortBy === "newest" || sortBy === "oldest") {
        const getTime = (item) => {
          const d = item.created_at || item.createdAt;
          if (!d) return 0;
          if (typeof d === "number") return d;
          if (d.seconds) return d.seconds * 1000;
          const parsed = new Date(d).getTime();
          return isNaN(parsed) ? 0 : parsed;
        };
        const diff = getTime(b) - getTime(a);
        return sortBy === "newest" ? diff : -diff;
      }
      if (sortBy === "qty_high") return (Number(b.quantity) || 0) - (Number(a.quantity) || 0);
      if (sortBy === "qty_low") return (Number(a.quantity) || 0) - (Number(b.quantity) || 0);
      if (sortBy === "price_high") return (Number(b.sellingPrice) || 0) - (Number(a.sellingPrice) || 0);
      if (sortBy === "price_low") return (Number(a.sellingPrice) || 0) - (Number(b.sellingPrice) || 0);
      return 0;
    });
  }, [products, searchQuery, selectedCategory, selectedStatus, sortBy]);

  // Totals
  const totalFilteredCount = filteredProducts.length;
  const totalFilteredQty = filteredProducts.reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0);
  const totalRetailVal = roundCurrency(
    filteredProducts.reduce((acc, curr) => acc + ((Number(curr.quantity) || 0) * (Number(curr.sellingPrice) || 0)), 0)
  );
  const totalWholesaleVal = roundCurrency(
    filteredProducts.reduce((acc, curr) => acc + ((Number(curr.quantity) || 0) * (Number(curr.wholesalePrice) || 0)), 0)
  );

  const resetFilters = () => {
    setSearchQuery("");
    setSelectedCategory("all");
    setSelectedStatus("all");
    setSortBy("newest");
  };

  // Actions
  const handleOpenEditModal = (product) => {
    if (!isAdmin) {
      setPermissionDeniedAction("تعديل بيانات الصنف بالمحل");
      return;
    }
    setEditingProduct(product);
    setIsAddModalOpen(true);
  };

  // Save Product (Single Item Add or Edit)
  const handleSaveProduct = async (productData, id) => {
    if (id) {
      await updateShopProduct(id, productData);
      showToast("تم تحديث بيانات الصنف بالمحل بنجاح.");
    } else {
      await addShopProduct(productData);
      showToast("تمت إضافة الصنف الجديد بالمحل بنجاح.");
    }
  };

  // Save Shop Purchase Invoice (Multi-Item + Supplier)
  const handleSavePurchaseInvoice = async (invoicePayload) => {
    const res = await createShopPurchaseInvoice({
      ...invoicePayload,
      user
    });
    showToast(`تم حفظ فاتورة الواردات #${res.invoiceNumber} وإضافة البضاعة للمحل بنجاح.`);
  };

  // Return items from Shop Purchase Invoice to Supplier
  const handleReturnPurchaseItem = async (returnPayload) => {
    const res = await returnShopPurchaseItems({
      ...returnPayload,
      user
    });
    showToast(`تم إرجاع البضاعة للمورد بنجاح (إشعار #${res.returnNumber}) وخصم ${formatNumber(res.refundedCost)} ج.م من حسابه.`);
  };

  // Return full Shop Purchase Invoice to Supplier
  const handleReturnFullPurchaseInvoice = async (returnPayload) => {
    const res = await returnShopPurchaseItems({
      ...returnPayload,
      user
    });
    showToast(`تم إرجاع الفاتورة بالكامل للمورد بنجاح (إشعار #${res.returnNumber}) وخصم ${formatNumber(res.refundedCost)} ج.م من حسابه.`);
  };

  const handleConfirmReturnToWarehouse = async (product, quantity) => {
    try {
      await transferFromShopToWarehouse(product, quantity, user);
      showToast(`تم إرجاع ${quantity} قطعة من "${product.name}" إلى المخزن بنجاح 📦`);
    } catch (err) {
      alert(err.message || "حدث خطأ أثناء إرجاع البضاعة للمخزن.");
    }
  };

  const handleConfirmDelete = async () => {
    if (!productToDelete) return;
    try {
      await deleteShopProduct(productToDelete.id);
      showToast("تم حذف الصنف من المحل.");
      setProductToDelete(null);
    } catch (err) {
      alert("حدث خطأ أثناء الحذف.");
    }
  };

  // Export CSV
  const exportToCSV = () => {
    if (filteredProducts.length === 0) return;
    const headers = ["الباركود", "اسم الصنف", "القسم", "الكمية بالمحل", "سعر البيع (قطاعي)", "سعر الجملة"];
    const rows = filteredProducts.map((p) => [
      `"${p.barcode || ''}"`,
      `"${p.name || ''}"`,
      `"${p.category || ''}"`,
      p.quantity || 0,
      p.sellingPrice || 0,
      p.wholesalePrice || 0
    ]);
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `بضاعة_المحل_Nelly_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <Sidebar
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      <div className="main-content">
        <Navbar
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
        />

        <main className="page-wrapper">
          {/* Toast Notification */}
          {toastMessage && (
            <div className={styles.toastWrapper}>
              <Store size={18} color="#f472b6" />
              <span>{toastMessage}</span>
            </div>
          )}

          {/* Page Header */}
          <div className={styles.pageHeader}>
            <div>
              <div className={styles.headerTitleGroup}>
                <div className={styles.headerIconBox}>
                  <Store size={22} />
                </div>
                <h2 className={styles.headerMainTitle}>المحل</h2>
                <span className={`badge badge-code ${styles.productCountBadge}`}>
                  <span className="num-font" dir="ltr">{formatNumber(products.length)}</span> صنف معروض
                </span>
              </div>
              <p className={styles.headerSubtitle}>
                جرد ومتابعة بضاعة المعرض والمحل التجاري، واستقبال البضاعة المحولة من المخزن
              </p>
            </div>

            {/* Action buttons */}
            <div className={styles.headerActions}>
              <button
                onClick={() => setIsInvoicesHistoryModalOpen(true)}
                className={`btn-secondary ${styles.whiteBtn}`}
                title="سجل فواتير الواردات وشحنات الموردين والمرتجعات"
              >
                <Receipt size={16} color="#7c3aed" />
                سجل الواردات والمرتجعات
                {shopPurchases.length > 0 && (
                  <span className="badge badge-info" style={{ marginRight: "4px", fontSize: "0.75rem", padding: "0.15rem 0.45rem" }}>
                    {shopPurchases.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setIsPrintModalOpen(true)}
                className={`btn-secondary ${styles.whiteBtn}`}
                title="معاينة وطباعة كشف جرد بضاعة المحل"
              >
                <Printer size={16} color="#db2777" />
                طباعة الكشف
              </button>

              <button onClick={exportToCSV} className={`btn-secondary ${styles.whiteBtn}`} title="تصدير إلى ملف إكسل CSV">
                <Download size={16} color="#059669" />
                تصدير CSV
              </button>

              <button
                onClick={() => {
                  if (!isAdmin) {
                    setPermissionDeniedAction("إضافة صنف جديد للمحل");
                    return;
                  }
                  setEditingProduct(null);
                  setIsAddModalOpen(true);
                }}
                className={`btn-secondary ${styles.whiteBtn}`}
                title="تسجيل وإضافة صنف جديد بالمحل مباشرة"
              >
                <Plus size={16} color="#db2777" />
                إضافة صنف جديد
              </button>

              <button
                onClick={() => {
                  if (!isAdmin) {
                    setPermissionDeniedAction("إصدار فاتورة واردات للمحل");
                    return;
                  }
                  setIsPurchaseInvoiceModalOpen(true);
                }}
                className="btn-primary"
              >
                <ShoppingBag size={18} />
                فاتورة واردات جديدة
              </button>
            </div>
          </div>

          {/* Filter & Search Toolbar */}
          <div className={`glass-panel ${styles.filterPanel}`}>
            <div className={styles.shopToolbarRow}>
              {/* Compact Search Input */}
              <div
                className={styles.compactSearchWrap}
                onClick={() => searchInputRef.current?.focus()}
              >
                <Search size={17} color="#db2777" className={styles.searchIcon} />
                <input
                  ref={searchInputRef}
                  type="text"
                  className={styles.compactSearchInput}
                  placeholder="ابحث بالباركود، اسم الصنف، أو الماركة..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSearchQuery("");
                      searchInputRef.current?.focus();
                    }}
                    className={styles.clearSearchBtn}
                    title="مسح البحث"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Filter Dropdown Button & Popover */}
              <div className={styles.filterDropdownWrapper} ref={filterDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
                  className={`${styles.filterDropdownBtn} ${(selectedCategory !== "all" || selectedStatus !== "all" || sortBy !== "newest") ? styles.filterDropdownBtnActive : ""}`}
                  title="خيارات الفلترة والتصنيف والترتيب"
                >
                  <Filter size={15} />
                  <span className={styles.filterBtnText}>فلترة وترتيب</span>
                  {(selectedCategory !== "all" || selectedStatus !== "all" || sortBy !== "newest") && (
                    <span className={styles.filterActiveDot} />
                  )}
                  <ChevronDown size={14} className={isFilterDropdownOpen ? styles.chevronRotated : ""} />
                </button>

                {isFilterDropdownOpen && (
                  <div className={styles.filterPopoverMenu}>
                    <div className={styles.popoverSection}>
                      <label className={styles.popoverLabel}>القسم / التصنيف:</label>
                      <CustomSelect
                        options={categoryOptions}
                        value={selectedCategory}
                        onChange={(cat) => setSelectedCategory(cat)}
                      />
                    </div>

                    <div className={styles.popoverSection}>
                      <label className={styles.popoverLabel}>حالة المخزون:</label>
                      <CustomSelect
                        options={statusOptions}
                        value={selectedStatus}
                        onChange={(stat) => setSelectedStatus(stat)}
                      />
                    </div>

                    <div className={styles.popoverSection}>
                      <label className={styles.popoverLabel}>الترتيب حسب:</label>
                      <CustomSelect
                        options={sortOptions}
                        value={sortBy}
                        onChange={(sb) => setSortBy(sb)}
                      />
                    </div>

                    {(selectedCategory !== "all" || selectedStatus !== "all" || sortBy !== "newest") && (
                      <button
                        type="button"
                        onClick={() => {
                          resetFilters();
                          setIsFilterDropdownOpen(false);
                        }}
                        className={styles.popoverResetBtn}
                      >
                        <RotateCcw size={14} />
                        <span>إعادة ضبط جميع الفلاتر</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* 4 Rich Stat Cards for Shop Summary Data (Mobile Swiper) */}
            <div
              className={styles.statCardsGrid}
              ref={shopSwiperRef}
              onScroll={handleShopCardsScroll}
            >
              {/* Card 1: معروض */}
              <div className={styles.statCardRose}>
                <div>
                  <span className={styles.statLabel}>أصناف المحل المعروضة</span>
                  <div className={styles.statValueGroup}>
                    <span className={`num-font ${styles.statNumberDark}`} dir="ltr">
                      {formatNumber(totalFilteredCount)}
                    </span>
                    <span className={styles.statUnitDark}>صنف</span>
                  </div>
                </div>
                <div className={styles.statIconBoxRose}>
                  <Store size={20} />
                </div>
              </div>

              {/* Card 2: إجمالي القطع */}
              <div className={styles.statCardOrange}>
                <div>
                  <span className={styles.statLabel}>إجمالي قطع المحل</span>
                  <div className={styles.statValueGroup}>
                    <span className={`num-font ${styles.statNumberOrange}`} dir="ltr">
                      {formatNumber(totalFilteredQty)}
                    </span>
                    <span className={styles.statUnitOrange}>قطعة</span>
                  </div>
                </div>
                <div className={styles.statIconBoxOrange}>
                  <Layers size={20} />
                </div>
              </div>

              {/* Card 3: إجمالي سعر الجملة (التكلفة) */}
              <div className={styles.statCardPurple}>
                <div>
                  <span className={styles.statLabel}>إجمالي سعر الجملة (التكلفة)</span>
                  <div className={styles.statValueGroup}>
                    <span className={`num-font ${styles.statNumberPurple}`} dir="ltr">
                      {isAdmin ? formatNumber(totalWholesaleVal) : "🔒"}
                    </span>
                    <span className={styles.statUnitPurple}>{isAdmin ? "ج.م" : ""}</span>
                  </div>
                </div>
                <div className={styles.statIconBoxPurple}>
                  <Boxes size={20} />
                </div>
              </div>

              {/* Card 4: إجمالي القيمة بسعر البيع (قطاعي) */}
              <div className={styles.statCardGreen}>
                <div>
                  <span className={styles.statLabel}>إجمالي القيمة (سعر البيع)</span>
                  <div className={styles.statValueGroup}>
                    <span className={`num-font ${styles.statNumberGreen}`} dir="ltr">
                      {formatNumber(totalRetailVal)}
                    </span>
                    <span className={styles.statUnitGreen}>ج.م</span>
                  </div>
                </div>
                <div className={styles.statIconBoxGreen}>
                  <DollarSign size={20} />
                </div>
              </div>
            </div>

            {/* Mobile Swiper Pagination Dots for Shop Cards */}
            <div className={styles.shopSwiperDots}>
              {[0, 1, 2, 3].map((idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => scrollToShopCard(idx)}
                  className={`${styles.shopSwiperDot} ${
                    activeShopCardIndex === idx ? styles.shopSwiperDotActive : ""
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Shop Products Table */}
          <div className="table-container">
            {filteredProducts.length === 0 ? (
              <div className={styles.emptyPlaceholder}>
                <Store size={48} color="#db2777" className={styles.emptyIcon} />
                <h3 className={styles.emptyTitle}>لا توجد بضاعة مسجلة بالمحل حالياً</h3>
                <p className={styles.emptySubtitle}>
                  يمكنك تحويل بضاعة من المخزن إلى المحل أو تسجيل فاتورة واردات جديدة للمحل
                </p>
              </div>
            ) : (
              <table className="custom-table">
                <thead>
                  <tr>
                    <th className={styles.thBarcode}>الباركود</th>
                    <th className={styles.thNowrap}>اسم الصنف والماركة</th>
                    <th className={styles.thNowrap}>القسم</th>
                    <th className={styles.thCenter}>الكمية بالمحل</th>
                    <th className={styles.thNowrap}>سعر البيع (قطاعي)</th>
                    <th className={styles.thNowrap}>سعر التكلفة</th>
                    <th className={styles.thNowrap}>حالة التوفر</th>
                    <th className={styles.thCenter}>الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((p) => {
                    const qty = Number(p.quantity) || 0;
                    const wholesale = Number(p.wholesalePrice) || 0;
                    const retailPrice = Number(p.sellingPrice) || 0;
                    const minThresh = Number(p.minThreshold) || 3;
                    const isLow = qty <= minThresh && qty > 0;
                    const isOut = qty === 0;

                    return (
                      <tr key={p.id}>
                        {/* Barcode */}
                        <td>
                          <span
                            className={`num-font ${styles.barcodeTag}`}
                            dir="ltr"
                          >
                            {p.barcode || "—"}
                          </span>
                        </td>

                        {/* Name & Brand */}
                        <td>
                          <div className={styles.productNameText}>
                            {p.name}
                          </div>
                          {p.brand && (
                            <div className={styles.brandText}>
                              {p.brand}
                            </div>
                          )}
                        </td>

                        {/* Category */}
                        <td>
                          <span className={`badge ${styles.categoryBadge}`}>
                            {p.category || "أخرى"}
                          </span>
                        </td>

                        {/* Quantity in Shop */}
                        <td className={styles.thCenter}>
                          <span className={`num-font ${styles.qtyValue} ${isOut ? styles.qtyOut : isLow ? styles.qtyLow : styles.qtyNormal}`} dir="ltr">
                            {formatNumber(qty)}
                          </span>
                        </td>

                        {/* Selling Price */}
                        <td>
                          <strong className={styles.sellingPriceVal}>
                            <span className="num-font" dir="ltr">{formatNumber(retailPrice)}</span> ج.م
                          </strong>
                        </td>

                        {/* Wholesale Price */}
                        <td>
                          {isAdmin ? (
                            <span className={styles.wholesalePriceVal}>
                              <span className="num-font" dir="ltr">{formatNumber(wholesale)}</span> ج.م
                            </span>
                          ) : (
                            <span className={styles.lockPriceTag}>🔒 خاص بالمسؤول</span>
                          )}
                        </td>

                        {/* Stock Status */}
                        <td>
                          {isOut ? (
                            <span className="badge badge-out-of-stock">نفد من المحل</span>
                          ) : isLow ? (
                            <span className="badge badge-low-stock">مخزون قليل</span>
                          ) : (
                            <span className="badge badge-in-stock">متوفر بالمحل</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className={styles.thCenter}>
                          <div className={styles.actionsGroup}>
                            {/* Return to Warehouse button */}
                            <button
                              onClick={() => setProductToReturn(p)}
                              className={`btn-secondary ${styles.returnWarehouseBtn}`}
                              title="إرجاع كمية من الصنف إلى المخزن"
                            >
                              <Boxes size={14} color="#9333ea" />
                              إرجاع للمخزن
                            </button>

                            {/* Barcode Print */}
                            <button
                              onClick={() => setBarcodeProduct(p)}
                              className={`btn-secondary ${styles.barcodeBtn}`}
                              title="طباعة باركود"
                            >
                              <Barcode size={15} color="#db2777" />
                            </button>

                            {/* Edit */}
                            <button
                              onClick={() => handleOpenEditModal(p)}
                              className={`btn-primary ${styles.editBtn}`}
                              title="تعديل بيانات الصنف بالمحل"
                            >
                              <Edit3 size={15} />
                            </button>

                            {/* Delete */}
                            <button
                              onClick={() => setProductToDelete(p)}
                              className={`btn-danger ${styles.deleteBtn}`}
                              title="حذف الصنف من المحل"
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
      </div>

      {/* Shop Purchase Invoice Modal */}
      <ShopPurchaseInvoiceModal
        isOpen={isPurchaseInvoiceModalOpen}
        onClose={() => setIsPurchaseInvoiceModalOpen(false)}
        suppliers={suppliers}
        shopProducts={products}
        onSave={handleSavePurchaseInvoice}
      />

      {/* Shop Invoices History & Returns Modal */}
      <ShopInvoicesHistoryModal
        isOpen={isInvoicesHistoryModalOpen}
        onClose={() => setIsInvoicesHistoryModalOpen(false)}
        invoices={shopPurchases}
        suppliers={suppliers}
        onReturnItem={handleReturnPurchaseItem}
        onReturnFullInvoice={handleReturnFullPurchaseInvoice}
      />

      {/* Return to Warehouse Transfer Modal */}
      <TransferModal
        isOpen={!!productToReturn}
        onClose={() => setProductToReturn(null)}
        product={productToReturn}
        onConfirmTransfer={handleConfirmReturnToWarehouse}
        direction="shop_to_warehouse"
      />

      {/* Product Modal for Shop (Single Item) */}
      <ProductModal
        isOpen={isAddModalOpen}
        onClose={() => { setIsAddModalOpen(false); setEditingProduct(null); }}
        onSave={handleSaveProduct}
        productToEdit={editingProduct}
        isShop={true}
      />

      {/* Print Inventory Modal for Shop */}
      <PrintInventoryModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        products={products}
        title="كشف جرد بضاعة المحل"
        locationName="محل Nelly"
      />

      {/* Barcode Print Modal */}
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

      {/* Delete Confirmation Modal */}
      {productToDelete && (
        <div className="modal-overlay" onClick={() => setProductToDelete(null)}>
          <div
            className={`modal-content ${styles.deleteModalContainer}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.deleteIconBox}>
              <Trash2 size={26} />
            </div>

            <h3 className={styles.deleteModalTitle}>تأكيد حذف الصنف من المحل</h3>
            <p className={styles.deleteModalText}>
              هل أنت متأكد من حذف الصنف <strong className={styles.deleteTargetName}>&quot;{productToDelete.name}&quot;</strong> من سجل بضاعة المحل؟
            </p>

            <div className={styles.deleteActionsRow}>
              <button onClick={() => setProductToDelete(null)} className={`btn-secondary ${styles.cancelModalBtn}`}>إلغاء</button>
              <button onClick={handleConfirmDelete} className={`btn-danger ${styles.confirmDeleteBtn}`}>نعم، احذف الصنف</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import StatCard from "@/components/StatCard";
import SupplierModal from "@/components/SupplierModal";
import PaymentModal from "@/components/PaymentModal";
import SupplierHistoryModal from "@/components/SupplierHistoryModal";
import PermissionDeniedModal from "@/components/PermissionDeniedModal";
import { 
  subscribeToSuppliers, 
  addSupplier, 
  updateSupplier, 
  deleteSupplier, 
  makeSupplierPayment,
  deleteSupplierTransaction 
} from "@/lib/suppliersService";
import { formatNumber } from "@/lib/utils";
import CustomSelect from "@/components/CustomSelect";
import { 
  Truck, 
  Plus, 
  Search, 
  Phone, 
  DollarSign, 
  CreditCard, 
  History, 
  Edit3, 
  Trash2, 
  RotateCcw,
  Sparkles,
  ArrowDownLeft,
  ArrowUpRight,
  Lock,
  Filter
} from "lucide-react";
import styles from "./suppliers.module.css";

export default function SuppliersPage() {
  const router = useRouter();
  const { user, isAdmin, loading: authLoading } = useAuth();

  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState("all"); // "all", "payable", "receivable", "zero"
  
  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [paymentSupplier, setPaymentSupplier] = useState(null);
  const [historySupplier, setHistorySupplier] = useState(null);
  const [supplierToDelete, setSupplierToDelete] = useState(null);
  const [permissionDeniedAction, setPermissionDeniedAction] = useState(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  // Firestore real-time listener
  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeToSuppliers((data) => {
      setSuppliers(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3500);
  };

  // Filtered suppliers
  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((s) => {
      const q = searchQuery.toLowerCase().trim();
      const name = (s.name || "").toLowerCase();
      const phone = (s.phone || "").toLowerCase();
      const matchesSearch = !q || name.includes(q) || phone.includes(q);

      const bal = Number(s.balance) || 0;
      let matchesStatus = true;
      if (selectedStatusFilter === "payable") matchesStatus = bal > 0;
      if (selectedStatusFilter === "receivable") matchesStatus = bal < 0;
      if (selectedStatusFilter === "zero") matchesStatus = bal === 0;

      return matchesSearch && matchesStatus;
    });
  }, [suppliers, searchQuery, selectedStatusFilter]);

  // KPIs
  const totalSuppliersCount = suppliers.length;
  const totalPayable = suppliers.filter(s => s.balance > 0).reduce((sum, s) => sum + (Number(s.balance) || 0), 0);
  const totalReceivable = suppliers.filter(s => s.balance < 0).reduce((sum, s) => sum + Math.abs(Number(s.balance) || 0), 0);
  const netBalance = totalPayable - totalReceivable;

  // Actions
  const handleOpenAdd = () => {
    if (!isAdmin) {
      setPermissionDeniedAction("إضافة مورد جديد");
      return;
    }
    setEditingSupplier(null);
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (sup) => {
    if (!isAdmin) {
      setPermissionDeniedAction("تعديل بيانات المورد");
      return;
    }
    setEditingSupplier(sup);
    setIsAddModalOpen(true);
  };

  const handleOpenPayment = (sup) => {
    if (!isAdmin) {
      setPermissionDeniedAction("سداد وتسوية حساب المورد");
      return;
    }
    setPaymentSupplier(sup);
  };

  const handleOpenDelete = (sup) => {
    if (!isAdmin) {
      setPermissionDeniedAction("حذف المورد من النظام");
      return;
    }
    setSupplierToDelete(sup);
  };

  const handleSaveSupplier = async (supplierData, id) => {
    if (id) {
      await updateSupplier(id, supplierData);
      showToast("تم تحديث بيانات المورد بنجاح.");
    } else {
      await addSupplier(supplierData);
      showToast("تمت إضافة المورد الجديد بنجاح.");
    }
  };

  const handleMakePayment = async (supplierId, currentBal, payAmount, notes, method, operationType = "payment") => {
    await makeSupplierPayment(supplierId, currentBal, payAmount, notes, method, operationType);
    const actionLabel = operationType === "charge" ? "إضافة المستحقات / الفاتورة" : "عملية السداد";
    showToast(`تم تسجيل ${actionLabel} بمبلغ ${formatNumber(payAmount)} ج.م وتحديث الحساب.`);
  };

  const handleDeleteTransaction = async (supplierId, txId) => {
    try {
      await deleteSupplierTransaction(supplierId, txId);
    } catch (err) {
      showToast(err.message);
      return;
    }
    showToast("تم حذف الحركة المالية وتعديل رصيد المورد بنجاح.");
    if (historySupplier && historySupplier.id === supplierId) {
      setHistorySupplier(prev => ({
        ...prev,
        transactions: (prev.transactions || []).filter(t => t.id !== txId)
      }));
    }
  };

  const handleConfirmDelete = async () => {
    if (!supplierToDelete) return;
    try {
      await deleteSupplier(supplierToDelete.id);
      showToast(`تم حذف المورد "${supplierToDelete.name}" بنجاح.`);
    } catch (err) {
      console.warn("Delete supplier error:", err);
      showToast(err.message || "حدث خطأ أثناء حذف المورد.");
    } finally {
      setSupplierToDelete(null);
    }
  };

  if (authLoading || (!user && loading)) {
    return (
      <div className={styles.loadingWrapper}>
        <p className={styles.loadingText}>جاري تحميل حسابات الموردين...</p>
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

      {/* Main Content Area */}
      <div className="main-content">
        <Navbar 
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
        />

        <main className="page-wrapper">
          {/* Toast Notification */}
          {toastMessage && (
            <div className={styles.toastWrapper}>
              <Sparkles size={18} color="#f472b6" />
              <span>{toastMessage}</span>
            </div>
          )}

          {/* Page Header */}
          <div className={styles.pageHeader}>
            <div>
              <div className={styles.headerTitleGroup}>
                <div className={styles.headerIconBox}>
                  <Truck size={22} />
                </div>
                <h2 className={styles.headerMainTitle}>
                  إدارة الموردين والحسابات المالية
                </h2>
              </div>
              <p className={styles.headerSubtitle}>
                متابعة أرصدة الموردين، تسجيل المدفوعات والسداد الفوري، وكشوفات الحسابات
              </p>
            </div>

            <button
              onClick={handleOpenAdd}
              className={`btn-primary ${styles.addBtn}`}
            >
              <Plus size={18} />
              إضافة مورد جديد
            </button>
          </div>

          {/* KPI Cards (Swiper on Mobile, Grid on Desktop) */}
          <section className="mobile-cards-swiper">
            <div className="mobile-swiper-card">
              <StatCard 
                title="إجمالي عدد الموردين"
                value={totalSuppliersCount}
                suffix="مورد"
                subtitle="الموردين والشركات المسجلة"
                icon={Truck}
                theme="rose"
                trendText="نشط بالنظام"
              />
            </div>

            <div className="mobile-swiper-card">
              <StatCard 
                title="مستحقات الموردين (له فلوس)"
                value={isAdmin ? totalPayable : "🔒"}
                suffix={isAdmin ? "ج.م" : "خاص بالمسؤول"}
                subtitle="مبالغ مطلوب سدادها للموردين"
                icon={ArrowDownLeft}
                theme="ruby"
                trendText="مستحق للسداد"
              />
            </div>

            <div className="mobile-swiper-card">
              <StatCard 
                title="مستحقات على الموردين (عليه)"
                value={isAdmin ? totalReceivable : "🔒"}
                suffix={isAdmin ? "ج.م" : "خاص بالمسؤول"}
                subtitle="مبالغ مستحقة للمخزن عند الموردين"
                icon={ArrowUpRight}
                theme="purple"
                trendText="مستحق التحصيل"
              />
            </div>

            <div className="mobile-swiper-card">
              <StatCard 
                title="صافي الحسابات المعلقة"
                value={isAdmin ? Math.abs(netBalance) : "🔒"}
                suffix={isAdmin ? (netBalance >= 0 ? "ج.م (له)" : "ج.م (عليه)") : "Admin Only"}
                subtitle="الرصيد الصافي الإجمالي"
                icon={DollarSign}
                theme="gold"
                trendText="الصافي"
              />
            </div>
          </section>

          {/* Mobile Swipe Hint */}
          <div className="swiper-mobile-hint">
            <span>👈 اسحب لمشاهدة باقي إحصائيات الموردين 👉</span>
          </div>

          {/* Search & Filter Toolbar */}
          <div className={`glass-panel ${styles.filterPanel}`}>
            <div className={styles.filterPanelContent}>
              {/* Search Bar */}
              <div className={styles.searchWrap}>
                <input 
                  type="text"
                  className={`form-input ${styles.searchInput}`}
                  placeholder="ابحث باسم المورد أو رقم الهاتف..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <Search size={18} color="#db2777" className={styles.searchIcon} />
              </div>

              {/* CustomSelect Status Filter */}
              <div className={styles.filterActions}>
                <div className={styles.selectWrap}>
                  <CustomSelect
                    options={[
                      { value: "all", label: `جميع الموردين (${totalSuppliersCount})` },
                      { value: "payable", label: `له مستحقات (${suppliers.filter(s => s.balance > 0).length})` },
                      { value: "receivable", label: `عليه مبالغ (${suppliers.filter(s => s.balance < 0).length})` },
                      { value: "zero", label: `حسابه خالص (${suppliers.filter(s => s.balance === 0).length})` }
                    ]}
                    value={selectedStatusFilter}
                    onChange={(val) => setSelectedStatusFilter(val)}
                    icon={Filter}
                  />
                </div>

                {(searchQuery || selectedStatusFilter !== "all") && (
                  <button 
                    onClick={() => { setSearchQuery(""); setSelectedStatusFilter("all"); }}
                    className={`btn-secondary ${styles.resetFilterBtn}`}
                    title="إعادة ضبط الفلترة"
                  >
                    <RotateCcw size={15} />
                    إعادة ضبط
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Suppliers Table */}
          <div className="table-container">
            {filteredSuppliers.length === 0 ? (
              <div className={styles.emptyPlaceholder}>
                <Truck size={48} color="#db2777" className={styles.emptyIcon} />
                <h3 className={styles.emptyTitle}>
                  {searchQuery ? `لا يوجد مورد يطابق "${searchQuery}"` : "لم يتم تسجيل أي موردين بعد"}
                </h3>
                <p className={styles.emptySubtitle}>
                  ابدأ بإضافة بيانات الموردين لتسجيل حساباتهم وفواتيرهم
                </p>
                <button onClick={handleOpenAdd} className="btn-primary">
                  <Plus size={16} />
                  إضافة مورد جديد
                </button>
              </div>
            ) : (
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>اسم المورد / الشركة</th>
                    <th>رقم الهاتف</th>
                    <th>الرصيد المالي الحالي</th>
                    <th>حالة الحساب</th>
                    <th>ملاحظات</th>
                    <th className={styles.thCenter}>سداد دفعة</th>
                    <th className={styles.thCenter}>الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSuppliers.map((sup) => {
                    const bal = Number(sup.balance) || 0;
                    const isPayable = bal > 0;
                    const isReceivable = bal < 0;

                    const iconBgClass = isPayable ? styles.badgePayableBg : isReceivable ? styles.badgeReceivableBg : styles.badgeZeroBg;
                    const balanceClass = isPayable ? styles.balancePayable : isReceivable ? styles.balanceReceivable : styles.balanceZero;

                    return (
                      <tr key={sup.id}>
                        {/* Name */}
                        <td>
                          <div className={styles.nameColWrapper}>
                            <div className={`${styles.supplierIconBadge} ${iconBgClass}`}>
                              <Truck size={18} />
                            </div>
                            <span className={styles.supplierNameText}>
                              {sup.name}
                            </span>
                          </div>
                        </td>

                        {/* Phone */}
                        <td>
                          {sup.phone ? (
                            <a 
                              href={`tel:${sup.phone}`} 
                              className={styles.phoneLink}
                            >
                              <Phone size={14} />
                              <span className="num-font" dir="ltr">{sup.phone}</span>
                            </a>
                          ) : (
                            <span className={styles.emptyDash}>—</span>
                          )}
                        </td>

                        {/* Balance */}
                        <td>
                          {isAdmin ? (
                            <div className={`${styles.balanceVal} ${balanceClass}`}>
                              <span className="num-font" dir="ltr">{formatNumber(Math.abs(bal))}</span> ج.م
                            </div>
                          ) : (
                            <span className={styles.adminLockTag}>
                              <Lock size={12} />
                              خاص بالمسؤول
                            </span>
                          )}
                        </td>

                        {/* Status badge */}
                        <td>
                          {isPayable ? (
                            <span className={`badge ${styles.badgePayable}`}>
                              له مستحقات (+)
                            </span>
                          ) : isReceivable ? (
                            <span className={`badge ${styles.badgeReceivable}`}>
                              عليه مبالغ (-)
                            </span>
                          ) : (
                            <span className="badge badge-in-stock">
                              حسابه خالص (0)
                            </span>
                          )}
                        </td>

                        {/* Notes */}
                        <td>
                          <span className={styles.notesText}>
                            {sup.notes || "—"}
                          </span>
                        </td>

                        {/* Quick Payment Button */}
                        <td className={styles.thCenter}>
                          <button
                            onClick={() => handleOpenPayment(sup)}
                            className={`btn-primary ${styles.quickPayBtn}`}
                          >
                            <CreditCard size={14} />
                            سداد دفعة
                          </button>
                        </td>

                        {/* Actions */}
                        <td className={styles.thCenter}>
                          <div className={styles.actionsGroup}>
                            <button
                              onClick={() => setHistorySupplier(sup)}
                              className={`btn-secondary ${styles.historyBtn}`}
                              title="عرض كشف حساب وسجل المدفوعات"
                            >
                              <History size={15} color="#9333ea" />
                              كشف حساب
                            </button>

                            <button
                              onClick={() => handleOpenEdit(sup)}
                              className={`btn-secondary ${styles.editBtn}`}
                              title="تعديل بيانات المورد"
                            >
                              <Edit3 size={15} color="#db2777" />
                              تعديل
                            </button>

                            <button
                              onClick={() => handleOpenDelete(sup)}
                              className={`btn-danger ${styles.deleteBtn}`}
                              title="حذف المورد"
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

      {/* Modals */}
      <SupplierModal 
        isOpen={isAddModalOpen}
        onClose={() => { setIsAddModalOpen(false); setEditingSupplier(null); }}
        onSave={handleSaveSupplier}
        supplierToEdit={editingSupplier}
      />

      <PaymentModal 
        isOpen={!!paymentSupplier}
        onClose={() => setPaymentSupplier(null)}
        supplier={paymentSupplier}
        onMakePayment={handleMakePayment}
      />

      <SupplierHistoryModal 
        isOpen={!!historySupplier}
        onClose={() => setHistorySupplier(null)}
        supplier={historySupplier}
        onDeleteTransaction={handleDeleteTransaction}
      />

      <PermissionDeniedModal 
        isOpen={!!permissionDeniedAction}
        onClose={() => setPermissionDeniedAction(null)}
        actionName={permissionDeniedAction}
      />

      {/* Delete Supplier Confirmation Modal */}
      {supplierToDelete && (
        <div className="modal-overlay" onClick={() => setSupplierToDelete(null)}>
          <div 
            className={`modal-content ${styles.deleteModalContainer}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.deleteIconBox}>
              <Trash2 size={26} />
            </div>

            <h3 className={styles.deleteModalTitle}>
              تأكيد حذف المورد
            </h3>
            <p className={styles.deleteModalText}>
              هل أنت متأكد من حذف المورد <strong className={styles.deleteTargetName}>&quot;{supplierToDelete.name}&quot;</strong> من النظام؟
            </p>

            <div className={styles.deleteActionsRow}>
              <button 
                onClick={() => setSupplierToDelete(null)}
                className={`btn-secondary ${styles.cancelModalBtn}`}
              >
                إلغاء
              </button>
              <button 
                onClick={handleConfirmDelete}
                className={`btn-danger ${styles.confirmDeleteBtn}`}
              >
                نعم، احذف المورد
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

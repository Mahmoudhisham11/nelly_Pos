"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import StatCard from "@/components/StatCard";
import ExpenseItemModal from "@/components/ExpenseItemModal";
import AddExpenseAmountModal from "@/components/AddExpenseAmountModal";
import ExpenseItemHistoryModal from "@/components/ExpenseItemHistoryModal";
import PermissionDeniedModal from "@/components/PermissionDeniedModal";
import CustomSelect from "@/components/CustomSelect";
import { 
  subscribeToExpenseItems, 
  addExpenseItem, 
  updateExpenseItem, 
  deleteExpenseItem,
  subscribeToMonthlyExpenses,
  addAmountToExpenseItem,
  deleteMonthlyTransaction
} from "@/lib/expensesService";
import { formatNumber, roundCurrency } from "@/lib/utils";
import { 
  Receipt, 
  Plus, 
  Search, 
  Calendar, 
  TrendingDown, 
  PieChart, 
  Trash2, 
  Edit3, 
  RotateCcw, 
  Sparkles, 
  ChevronRight, 
  ChevronLeft, 
  History, 
  PlusCircle, 
  Layers,
  Lock
} from "lucide-react";
import styles from "./expenses.module.css";

export default function ExpensesPage() {
  const router = useRouter();
  const { user, isAdmin, loading: authLoading } = useAuth();

  const [expenseItems, setExpenseItems] = useState([]);
  const [monthlyExpensesMap, setMonthlyExpensesMap] = useState({});
  const [loadingItems, setLoadingItems] = useState(true);

  // Month navigation: format "YYYY-MM"
  const currentActualMonth = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  }, []);

  const [selectedMonth, setSelectedMonth] = useState(currentActualMonth);
  const [searchQuery, setSearchQuery] = useState("");

  const [selectedYear, selectedMonthNum] = useMemo(() => {
    if (!selectedMonth || !selectedMonth.includes("-")) {
      const now = new Date();
      return [String(now.getFullYear()), String(now.getMonth() + 1).padStart(2, "0")];
    }
    const [y, m] = selectedMonth.split("-");
    return [y, m];
  }, [selectedMonth]);

  // Year options: past 6 years up to next 4 years
  const yearOptions = useMemo(() => {
    const nowY = new Date().getFullYear();
    const list = [];
    for (let y = nowY - 6; y <= nowY + 4; y++) {
      list.push({ value: String(y), label: `سنة ${y}` });
    }
    return list.reverse();
  }, []);

  const monthOptions = [
    { value: "01", label: "01 - يناير" },
    { value: "02", label: "02 - فبراير" },
    { value: "03", label: "03 - مارس" },
    { value: "04", label: "04 - أبريل" },
    { value: "05", label: "05 - مايو" },
    { value: "06", label: "06 - يونيو" },
    { value: "07", label: "07 - يوليو" },
    { value: "08", label: "08 - أغسطس" },
    { value: "09", label: "09 - سبتمبر" },
    { value: "10", label: "10 - أكتوبر" },
    { value: "11", label: "11 - نوفمبر" },
    { value: "12", label: "12 - ديسمبر" }
  ];

  // Modals state
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  const [addingAmountItem, setAddingAmountItem] = useState(null);
  const [historyItem, setHistoryItem] = useState(null);
  const [itemToDelete, setItemToDelete] = useState(null);

  const [permissionDeniedAction, setPermissionDeniedAction] = useState(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  // Subscribe to Master Expense Items
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToExpenseItems((items) => {
      setExpenseItems(items);
      setLoadingItems(false);
    });
    return () => unsub();
  }, [user]);

  // Subscribe to Monthly Expenses for the selected month
  useEffect(() => {
    if (!user || !selectedMonth) return;
    const unsub = subscribeToMonthlyExpenses(selectedMonth, (map) => {
      setMonthlyExpensesMap(map);
    });
    return () => unsub();
  }, [user, selectedMonth]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3500);
  };

  // Month Label in Arabic
  const formatMonthLabel = (mStr) => {
    if (!mStr || mStr === "all") return "جميع الشهور";
    const [y, m] = mStr.split("-");
    const monthNames = [
      "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
      "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
    ];
    const monthIndex = parseInt(m, 10) - 1;
    return `${monthNames[monthIndex] || m} ${y}`;
  };

  // Month navigation helpers
  const handlePrevMonth = () => {
    const [y, m] = selectedMonth.split("-").map(Number);
    const prevDate = new Date(y, m - 2, 1);
    const newY = prevDate.getFullYear();
    const newM = String(prevDate.getMonth() + 1).padStart(2, "0");
    setSelectedMonth(`${newY}-${newM}`);
  };

  const handleNextMonth = () => {
    const [y, m] = selectedMonth.split("-").map(Number);
    const nextDate = new Date(y, m, 1);
    const newY = nextDate.getFullYear();
    const newM = String(nextDate.getMonth() + 1).padStart(2, "0");
    setSelectedMonth(`${newY}-${newM}`);
  };

  // Filtered Expense Items
  const filteredItems = useMemo(() => {
    return expenseItems.filter((item) => {
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      const name = (item.name || "").toLowerCase();
      const notes = (item.notes || "").toLowerCase();
      return name.includes(q) || notes.includes(q);
    });
  }, [expenseItems, searchQuery]);

  // Statistics for selected month
  const totalMonthExpenses = useMemo(() => {
    return roundCurrency(Object.values(monthlyExpensesMap).reduce((sum, rec) => sum + (Number(rec.amount) || 0), 0));
  }, [monthlyExpensesMap]);

  const activeSpentItemsCount = useMemo(() => {
    return Object.values(monthlyExpensesMap).filter(rec => (Number(rec.amount) || 0) > 0).length;
  }, [monthlyExpensesMap]);

  const highestSpentItem = useMemo(() => {
    const list = Object.values(monthlyExpensesMap).filter(rec => (Number(rec.amount) || 0) > 0);
    if (list.length === 0) return null;
    return list.sort((a, b) => b.amount - a.amount)[0];
  }, [monthlyExpensesMap]);

  // Handlers
  const handleOpenAddItem = () => {
    if (!isAdmin) {
      setPermissionDeniedAction("إضافة بند مصروف جديد");
      return;
    }
    setEditingItem(null);
    setIsItemModalOpen(true);
  };

  const handleOpenEditItem = (item) => {
    if (!isAdmin) {
      setPermissionDeniedAction("تعديل بند المصروف");
      return;
    }
    setEditingItem(item);
    setIsItemModalOpen(true);
  };

  const handleOpenAddAmount = (item) => {
    if (!isAdmin) {
      setPermissionDeniedAction("إضافة وصرف مبلغ للبند");
      return;
    }
    setAddingAmountItem(item);
  };

  const handleOpenDelete = (item) => {
    if (!isAdmin) {
      setPermissionDeniedAction("حذف بند المصروف من النظام");
      return;
    }
    setItemToDelete(item);
  };

  const handleSaveItem = async (data, id) => {
    if (id) {
      await updateExpenseItem(id, data);
      showToast("تم تعديل بند المصروف بنجاح.");
    } else {
      await addExpenseItem(data.name, data.notes);
      showToast("تمت إضافة بند المصروف الجديد بنجاح.");
    }
  };

  const handleAddAmount = async (month, itemId, itemName, addAmount, notes, method, date) => {
    await addAmountToExpenseItem(month, itemId, itemName, addAmount, notes, method, date);
    showToast(`تمت إضافة ${formatNumber(addAmount)} ج.م إلى "${itemName}" لشهر ${formatMonthLabel(month)}.`);
  };

  const handleDeleteTransaction = async (month, itemId, txId) => {
    try {
      await deleteMonthlyTransaction(month, itemId, txId);
      showToast("تم حذف الدفعة وتعديل إجمالي المصروف لهذا الشهر.");
    } catch (err) {
      console.warn("Delete transaction error:", err);
      showToast(err.message || "حدث خطأ أثناء حذف الدفعة.");
    }
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      await deleteExpenseItem(itemToDelete.id);
      showToast(`تم حذف البند "${itemToDelete.name}" بنجاح.`);
    } catch (err) {
      console.warn("Delete expense item error:", err);
      showToast(err.message || "حدث خطأ أثناء حذف بند المصروف.");
    } finally {
      setItemToDelete(null);
    }
  };

  if (authLoading || (!user && loadingItems)) {
    return (
      <div className={styles.loadingWrapper}>
        <p className={styles.loadingText}>جاري تحميل سجل بنود المصاريف...</p>
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
                  <Receipt size={22} />
                </div>
                <h2 className={styles.headerMainTitle}>
                  سجل بنود المصاريف الشهرية
                </h2>
              </div>
              <p className={styles.headerSubtitle}>
                تتصفر بنود المصاريف تلقائياً (0 ج.م) مع بداية كل شهر جديد، مع إمكانية الزيادة والأرشفة
              </p>
            </div>

            <button
              onClick={handleOpenAddItem}
              className={`btn-primary ${styles.addItemBtn}`}
            >
              <Plus size={18} />
              + إضافة بند مصروف جديد
            </button>
          </div>

          {/* Month Selector & History Navigator */}
          <section className={`glass-panel ${styles.monthNavPanel}`}>
            <div className={styles.monthNavContent}>
              {/* Active Month Title */}
              <div className={styles.activeMonthTitleWrap}>
                <Calendar size={22} color="#db2777" />
                <div>
                  <span className={styles.monthSubtitle}>
                    أنت تتصفح مصاريف شهر:
                  </span>
                  <strong className={styles.monthTitleStrong}>
                    {formatMonthLabel(selectedMonth)}
                  </strong>
                </div>
              </div>

              {/* Month & Year Selectors with CustomSelect */}
              <div className={styles.monthNavActions}>
                {/* Year Select */}
                <div className={styles.yearSelectWrap}>
                  <CustomSelect
                    options={yearOptions}
                    value={selectedYear}
                    onChange={(val) => setSelectedMonth(`${val}-${selectedMonthNum}`)}
                    icon={Calendar}
                  />
                </div>

                {/* Month Select */}
                <div className={styles.monthSelectWrap}>
                  <CustomSelect
                    options={monthOptions}
                    value={selectedMonthNum}
                    onChange={(val) => setSelectedMonth(`${selectedYear}-${val}`)}
                    icon={Calendar}
                  />
                </div>

                {/* Prev Month Button */}
                <button
                  onClick={handlePrevMonth}
                  className={`btn-secondary ${styles.navStepBtn}`}
                  title="الشهر السابق"
                >
                  <ChevronRight size={16} />
                  السابق
                </button>

                {/* Return to Current Month Button */}
                {selectedMonth !== currentActualMonth && (
                  <button
                    onClick={() => setSelectedMonth(currentActualMonth)}
                    className={`btn-primary ${styles.currentMonthBtn}`}
                    title="الرجوع للشهر الحالي"
                  >
                    الشهر الحالي
                  </button>
                )}

                {/* Next Month Button */}
                <button
                  onClick={handleNextMonth}
                  className={`btn-secondary ${styles.navStepBtn}`}
                  title="الشهر التالي"
                >
                  التالي
                  <ChevronLeft size={16} />
                </button>
              </div>
            </div>
          </section>

          {/* Month KPI Cards (Swiper on Mobile, Grid on Desktop) */}
          <section className="mobile-cards-swiper">
            <div className="mobile-swiper-card">
              <StatCard 
                title={`إجمالي مصاريف (${formatMonthLabel(selectedMonth)})`}
                value={isAdmin ? totalMonthExpenses : "🔒"}
                suffix={isAdmin ? "ج.م" : "خاص بالمسؤول"}
                subtitle="إجمالي ما تم صرفه في هذا الشهر"
                icon={TrendingDown}
                theme="ruby"
                trendText="مصاريف الشهر"
              />
            </div>

            <div className="mobile-swiper-card">
              <StatCard 
                title="أعلى بند تم الصرف عليه"
                value={isAdmin && highestSpentItem ? highestSpentItem.itemName : (isAdmin ? "لم يُصرف بعد" : "🔒")}
                suffix={isAdmin && highestSpentItem ? `${formatNumber(highestSpentItem.amount)} ج.م` : ""}
                subtitle="أكبر مصروف في هذا الشهر"
                icon={PieChart}
                theme="purple"
                trendText="أعلى بند"
              />
            </div>

            <div className="mobile-swiper-card">
              <StatCard 
                title="إجمالي البنود المسجلة"
                value={expenseItems.length}
                suffix="بند"
                subtitle="بنود مصاريف ثابتة بالنظام"
                icon={Receipt}
                theme="rose"
                trendText="البنود"
              />
            </div>

            <div className="mobile-swiper-card">
              <StatCard 
                title="بنود تم الصرف عليها"
                value={`${activeSpentItemsCount} من ${expenseItems.length}`}
                suffix="بند"
                subtitle="باقي البنود بقيمة 0 ج.م"
                icon={Layers}
                theme="gold"
                trendText="حالة الصرف"
              />
            </div>
          </section>

          {/* Mobile Swipe Hint */}
          <div className="swiper-mobile-hint">
            <span>👈 اسحب لمشاهدة باقي الإحصائيات 👉</span>
          </div>

          {/* Search Bar */}
          <div className={`glass-panel ${styles.searchPanel}`}>
            <div className={styles.searchPanelContent}>
              <div className={styles.searchWrap}>
                <input 
                  type="text"
                  className={`form-input ${styles.searchInput}`}
                  placeholder="ابحث باسم بند المصروف..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <Search size={18} color="#db2777" className={styles.searchIcon} />
              </div>

              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery("")}
                  className={`btn-secondary ${styles.resetSearchBtn}`}
                >
                  <RotateCcw size={15} />
                  مسح البحث
                </button>
              )}
            </div>
          </div>

          {/* Master Expense Items Table */}
          <div className="table-container">
            {filteredItems.length === 0 ? (
              <div className={styles.emptyPlaceholder}>
                <Receipt size={48} color="#db2777" className={styles.emptyIcon} />
                <h3 className={styles.emptyTitle}>
                  {searchQuery ? `لا يوجد بند يطابق "${searchQuery}"` : "لم يتم تسجيل أي بنود مصاريف بعد"}
                </h3>
                <p className={styles.emptySubtitle}>
                  أضف بنودك الثابتة (مثل: إيجار، رواتب، كهرباء، شحن) وستتجدد كل شهر بقيمة 0 ج.م تلقائياً
                </p>
                <button onClick={handleOpenAddItem} className="btn-primary">
                  <Plus size={16} />
                  + إضافة أول بند مصروف
                </button>
              </div>
            ) : (
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>اسم بند المصروف</th>
                    <th>المصروف في ({formatMonthLabel(selectedMonth)})</th>
                    <th>حالة الصرف للشهر</th>
                    <th>وصف / ملاحظات البند</th>
                    <th className={styles.thCenter}>إضافة / زيادة مبلغ</th>
                    <th className={styles.thCenter}>الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => {
                    const monthlyRecord = monthlyExpensesMap[item.id];
                    const spentAmount = monthlyRecord ? Number(monthlyRecord.amount) || 0 : 0;
                    const txCount = monthlyRecord?.transactions?.length || 0;

                    return (
                      <tr key={item.id}>
                        {/* Item Name */}
                        <td>
                          <div className={styles.nameColWrapper}>
                            <div className={`${styles.itemIconBadge} ${spentAmount > 0 ? styles.badgeSpentBg : styles.badgeZeroBg}`}>
                              <Receipt size={17} />
                            </div>
                            <div>
                              <span className={styles.itemNameText}>
                                {item.name}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Amount in Selected Month */}
                        <td>
                          {isAdmin ? (
                            <div className={`${styles.spentAmountVal} ${spentAmount > 0 ? styles.spentAmountSpent : styles.spentAmountZero}`}>
                              <span className="num-font" dir="ltr">{formatNumber(spentAmount)}</span> ج.م
                            </div>
                          ) : (
                            <span className={styles.adminLockTag}>
                              <Lock size={12} />
                              خاص بالمسؤول
                            </span>
                          )}
                        </td>

                        {/* Status Badge */}
                        <td>
                          {spentAmount > 0 ? (
                            <span className={`badge ${styles.badgeSpent}`}>
                              تم صرف {txCount} {txCount === 1 ? "دفعة" : "دفعات"}
                            </span>
                          ) : (
                            <span className="badge badge-in-stock">
                              0 ج.م (لم يُصرف بعد)
                            </span>
                          )}
                        </td>

                        {/* Notes */}
                        <td>
                          <span className={styles.notesText}>
                            {item.notes || "—"}
                          </span>
                        </td>

                        {/* Add Amount Action */}
                        <td className={styles.thCenter}>
                          <button
                            onClick={() => handleOpenAddAmount(item)}
                            className={`btn-primary ${styles.addAmountBtn}`}
                          >
                            <PlusCircle size={15} />
                            + زيادة مبلغ
                          </button>
                        </td>

                        {/* Actions */}
                        <td className={styles.thCenter}>
                          <div className={styles.actionsGroup}>
                            <button
                              onClick={() => setHistoryItem(item)}
                              className={`btn-secondary ${styles.historyBtn}`}
                              title="عرض سجل دفعات هذا البند للشهر المحدد"
                            >
                              <History size={14} color="#9333ea" />
                              السجل ({txCount})
                            </button>

                            <button
                              onClick={() => handleOpenEditItem(item)}
                              className={`btn-secondary ${styles.editBtn}`}
                              title="تعديل اسم البند"
                            >
                              <Edit3 size={14} color="#db2777" />
                            </button>

                            <button
                              onClick={() => handleOpenDelete(item)}
                              className={`btn-danger ${styles.deleteBtn}`}
                              title="حذف هذا البند نهائياً"
                            >
                              <Trash2 size={14} />
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
      <ExpenseItemModal 
        isOpen={isItemModalOpen}
        onClose={() => { setIsItemModalOpen(false); setEditingItem(null); }}
        onSave={handleSaveItem}
        itemToEdit={editingItem}
      />

      <AddExpenseAmountModal 
        isOpen={!!addingAmountItem}
        onClose={() => setAddingAmountItem(null)}
        item={addingAmountItem}
        currentMonth={selectedMonth}
        monthLabel={formatMonthLabel(selectedMonth)}
        currentAmount={addingAmountItem ? Number(monthlyExpensesMap[addingAmountItem.id]?.amount || 0) : 0}
        onAddAmount={handleAddAmount}
      />

      <ExpenseItemHistoryModal 
        isOpen={!!historyItem}
        onClose={() => setHistoryItem(null)}
        item={historyItem}
        monthlyRecord={historyItem ? monthlyExpensesMap[historyItem.id] : null}
        monthLabel={formatMonthLabel(selectedMonth)}
        onDeleteTransaction={handleDeleteTransaction}
      />

      <PermissionDeniedModal 
        isOpen={!!permissionDeniedAction}
        onClose={() => setPermissionDeniedAction(null)}
        actionName={permissionDeniedAction}
      />

      {/* Delete Item Confirmation Modal */}
      {itemToDelete && (
        <div className="modal-overlay" onClick={() => setItemToDelete(null)}>
          <div 
            className={`modal-content ${styles.deleteModalContainer}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.deleteIconBox}>
              <Trash2 size={26} />
            </div>

            <h3 className={styles.deleteModalTitle}>
              تأكيد حذف بند المصروف
            </h3>
            <p className={styles.deleteModalText}>
              هل أنت متأكد من حذف البند <strong className={styles.deleteTargetName}>"{itemToDelete.name}"</strong> نهائياً من قائمة المصاريف؟
            </p>

            <div className={styles.deleteActionsRow}>
              <button 
                onClick={() => setItemToDelete(null)}
                className={`btn-secondary ${styles.cancelModalBtn}`}
              >
                إلغاء
              </button>
              <button 
                onClick={handleConfirmDelete}
                className={`btn-danger ${styles.confirmDeleteBtn}`}
              >
                نعم، احذف البند
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

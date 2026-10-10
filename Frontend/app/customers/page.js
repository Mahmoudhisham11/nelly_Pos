"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import { 
  subscribeToCustomers, 
  addCustomer, 
  updateCustomer, 
  recordCustomerPayment, 
  deleteCustomer 
} from "@/lib/customersService";
import { formatNumber } from "@/lib/utils";
import confetti from "canvas-confetti";
import { 
  Users, 
  UserPlus, 
  Search, 
  CreditCard, 
  FileText, 
  Edit3, 
  Trash2, 
  X, 
  Save, 
  Sparkles, 
  CheckCircle2
} from "lucide-react";
import styles from "./customers.module.css";

export default function CustomersPage() {
  const router = useRouter();
  const { user, authLoading } = useAuth();

  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");

  // Modals state
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [customerForPayment, setCustomerForPayment] = useState(null);
  const [customerForStatement, setCustomerForStatement] = useState(null);
  const [customerToDelete, setCustomerToDelete] = useState(null);

  // Form states
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    address: "",
    type: "قطاعي",
    balance: "0",
    notes: ""
  });

  // Payment form state
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("نقدي");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeToCustomers((data) => {
      setCustomers(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3000);
  };

  const handleOpenAddModal = () => {
    setEditingCustomer(null);
    setFormData({
      name: "",
      phone: "",
      address: "",
      type: "قطاعي",
      balance: "0",
      notes: ""
    });
    setIsAddEditModalOpen(true);
  };

  const handleOpenEditModal = (cust) => {
    setEditingCustomer(cust);
    setFormData({
      name: cust.name || "",
      phone: cust.phone || "",
      address: cust.address || "",
      type: cust.type || "قطاعي",
      balance: cust.balance || "0",
      notes: cust.notes || ""
    });
    setIsAddEditModalOpen(true);
  };

  // Save Customer Add / Edit
  const handleSaveCustomer = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setIsSubmitting(true);
    try {
      if (editingCustomer) {
        await updateCustomer(editingCustomer.id, {
          name: formData.name.trim(),
          phone: formData.phone.trim(),
          address: formData.address.trim(),
          type: formData.type,
          notes: formData.notes.trim()
        });
        showToast("تم تحديث بيانات العميل بنجاح.");
      } else {
        await addCustomer({
          name: formData.name.trim(),
          phone: formData.phone.trim(),
          address: formData.address.trim(),
          type: formData.type,
          balance: parseFloat(formData.balance) || 0,
          notes: formData.notes.trim()
        });
        showToast("تمت إضافة العميل الجديد بنجاح.");
        try {
          confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
        } catch (e) {}
      }
      setIsAddEditModalOpen(false);
    } catch (err) {
      alert(err.message || "حدث خطأ أثناء حفظ بيانات العميل.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Payment Settlement
  const handleSavePayment = async (e) => {
    e.preventDefault();
    if (!customerForPayment) return;

    const amt = parseFloat(paymentAmount);
    if (!amt || amt <= 0) {
      alert("يرجى إدخال مبلغ سداد صحيح أكبر من صفر.");
      return;
    }

    setIsSubmitting(true);
    try {
      await recordCustomerPayment(
        customerForPayment.id,
        customerForPayment.balance,
        amt,
        paymentNotes,
        paymentMethod
      );
      showToast(`تم تسجيل سداد مبلغ ${formatNumber(amt)} ج.م للعميل "${customerForPayment.name}".`);
      setCustomerForPayment(null);
      setPaymentAmount("");
      setPaymentNotes("");
    } catch (err) {
      alert(err.message || "حدث خطأ أثناء تسجيل الدفعة.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete customer
  const handleConfirmDelete = async () => {
    if (!customerToDelete) return;
    try {
      await deleteCustomer(customerToDelete.id);
      showToast("تم حذف العميل من النظام.");
      setCustomerToDelete(null);
    } catch (err) {
      alert("حدث خطأ أثناء حذف العميل.");
    }
  };

  // Filters
  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      const q = searchQuery.toLowerCase().trim();
      const name = (c.name || "").toLowerCase();
      const phone = (c.phone || "").toLowerCase();
      const matchesSearch = !q || name.includes(q) || phone.includes(q);

      let matchesType = true;
      if (filterType === "debt") {
        matchesType = (c.balance || 0) > 0;
      } else if (filterType !== "all") {
        matchesType = c.type === filterType;
      }

      return matchesSearch && matchesType;
    });
  }, [customers, searchQuery, filterType]);

  const totalDebt = useMemo(() => {
    return customers.reduce((acc, curr) => acc + (curr.balance > 0 ? curr.balance : 0), 0);
  }, [customers]);

  const totalPurchases = useMemo(() => {
    return customers.reduce((acc, curr) => acc + (curr.totalPurchases || 0), 0);
  }, [customers]);

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
              <Sparkles size={18} color="#f472b6" />
              <span>{toastMessage}</span>
            </div>
          )}

          {/* Header */}
          <div className={styles.headerRow}>
            <div>
              <div className={styles.headerTitleWrapper}>
                <div className={styles.headerIconBox}>
                  <Users size={22} />
                </div>
                <h2 className={styles.headerTitle}>دليل العملاء والحسابات الآجلة</h2>
              </div>
              <p className={styles.headerSubtitle}>
                سجل بيانات العملاء، إدارة المديونيات الآجلة، كشوف الحسابات، وتسجيل سدادات الدفعات
              </p>
            </div>

            <button onClick={handleOpenAddModal} className={`btn-primary ${styles.addCustomerBtn}`}>
              <UserPlus size={18} />
              إضافة عميل جديد
            </button>
          </div>

          {/* Stats KPI Cards */}
          <div className={styles.kpiGrid}>
            <div className={`glass-card ${styles.cardPink}`}>
              <div className={styles.cardLabel}>إجمالي العملاء المسجلين</div>
              <div className={`num-font ${styles.cardValueMain}`} dir="ltr">
                {formatNumber(customers.length)}
              </div>
            </div>

            <div className={`glass-card ${styles.cardRed}`}>
              <div className={styles.cardLabel}>إجمالي ديون العملاء (مستحقات للمتجر)</div>
              <div className={styles.valWithUnitRow}>
                <span className={`num-font ${styles.cardValueDebt}`} dir="ltr">
                  {formatNumber(totalDebt)}
                </span>
                <span className={styles.cardUnitRed}>ج.م</span>
              </div>
            </div>

            <div className={`glass-card ${styles.cardGreen}`}>
              <div className={styles.cardLabel}>إجمالي مبيعات العملاء</div>
              <div className={styles.valWithUnitRow}>
                <span className={`num-font ${styles.cardValueGreen}`} dir="ltr">
                  {formatNumber(totalPurchases)}
                </span>
                <span className={styles.cardUnitGreen}>ج.م</span>
              </div>
            </div>
          </div>

          {/* Filters Bar */}
          <div className={`glass-panel ${styles.filterPanel}`}>
            <div className={styles.filterInner}>
              <div className={styles.searchWrap}>
                <input 
                  type="text"
                  className={`form-input ${styles.searchInput}`}
                  placeholder="بحث باسم العميل أو رقم الهاتف..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <Search size={18} color="#db2777" className={styles.searchIcon} />
              </div>

              {/* Filter Type Buttons */}
              <div className={styles.filterBtnGroup}>
                {[
                  { id: "all", label: "جميع العملاء" },
                  { id: "debt", label: "عليهم مديونيات ⏳" },
                  { id: "VIP", label: "عملاء VIP 👑" },
                  { id: "جملة", label: "عملاء جملة" }
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setFilterType(t.id)}
                    className={`${filterType === t.id ? "btn-primary" : "btn-secondary"} ${styles.filterBtn}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Customers Table */}
          <div className={`glass-panel ${styles.tablePanel}`}>
            <div className="table-container">
              {loading ? (
                <div className={styles.loadingOrEmptyBox}>
                  <p className={styles.emptyDesc}>جاري تحميل دليل العملاء...</p>
                </div>
              ) : filteredCustomers.length === 0 ? (
                <div className={styles.loadingOrEmptyBox}>
                  <Users size={42} color="#db2777" className={styles.emptyIcon} />
                  <h3 className={styles.emptyTitle}>لم يتم العثور على أي عميل</h3>
                  <p className={styles.emptyDesc}>قم بإضافة عميل جديد</p>
                </div>
              ) : (
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>اسم العميل</th>
                      <th>رقم الهاتف</th>
                      <th>العنوان</th>
                      <th>التصنيف</th>
                      <th>رصيد الحساب (المديونية)</th>
                      <th className={styles.thCenter}>سداد دفعة</th>
                      <th className={styles.thCenter}>كشف الحساب</th>
                      <th className={styles.thCenter}>الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCustomers.map((cust) => {
                      const balance = Number(cust.balance) || 0;
                      const hasDebt = balance > 0;

                      return (
                        <tr key={cust.id}>
                          {/* Name */}
                          <td>
                            <div className={styles.customerAvatarWrapper}>
                              <div className={styles.customerAvatar}>
                                {cust.name ? cust.name[0].toUpperCase() : "C"}
                              </div>
                              <div className={styles.customerNameText}>
                                {cust.name}
                              </div>
                            </div>
                          </td>

                          {/* Phone */}
                          <td>
                            {cust.phone ? (
                              <span className={`num-font ${styles.phoneText}`} dir="ltr">
                                {cust.phone}
                              </span>
                            ) : (
                              <span className={styles.emptyDash}>—</span>
                            )}
                          </td>

                          {/* Address */}
                          <td>
                            <span className={styles.addressText}>
                              {cust.address || "—"}
                            </span>
                          </td>

                          {/* Type */}
                          <td>
                            <span className={`badge ${cust.type === "VIP" ? styles.badgeVip : styles.badgeRegular}`}>
                              {cust.type || "قطاعي"}
                            </span>
                          </td>

                          {/* Balance / Debt */}
                          <td>
                            {hasDebt ? (
                              <div className={styles.debtValBox}>
                                <span className="num-font" dir="ltr">{formatNumber(balance)}</span> ج.م
                                <span className={styles.debtSubLabel}>مستحق على العميل</span>
                              </div>
                            ) : balance < 0 ? (
                              <div className={styles.creditValBox}>
                                <span className="num-font" dir="ltr">{formatNumber(Math.abs(balance))}</span> ج.م
                                <span className={styles.creditSubLabel}>رصيد دائن</span>
                              </div>
                            ) : (
                              <span className={styles.clearedText}>
                                ✓ الحساب خالص
                              </span>
                            )}
                          </td>

                          {/* Payment Action */}
                          <td className={styles.thCenter}>
                            <button
                              onClick={() => {
                                setCustomerForPayment(cust);
                                setPaymentAmount(hasDebt ? balance.toString() : "");
                              }}
                              className={`btn-primary ${styles.actionBtnSmall}`}
                            >
                              <CreditCard size={14} />
                              سداد دفعة
                            </button>
                          </td>

                          {/* Statement Action */}
                          <td className={styles.thCenter}>
                            <button
                              onClick={() => setCustomerForStatement(cust)}
                              className={`btn-secondary ${styles.actionBtnSmall}`}
                            >
                              <FileText size={14} />
                              كشف الحساب
                            </button>
                          </td>

                          {/* Edit & Delete */}
                          <td className={styles.thCenter}>
                            <div className={styles.rowActionsGroup}>
                              <button
                                onClick={() => handleOpenEditModal(cust)}
                                className={`btn-secondary ${styles.iconBtnSmall}`}
                                title="تعديل العميل"
                              >
                                <Edit3 size={14} />
                              </button>

                              <button
                                onClick={() => setCustomerToDelete(cust)}
                                className={`btn-danger ${styles.iconBtnSmall}`}
                                title="حذف العميل"
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
          </div>
        </main>
      </div>

      {/* Add / Edit Customer Modal */}
      {isAddEditModalOpen && (
        <div className="modal-overlay" onClick={() => setIsAddEditModalOpen(false)}>
          <div 
            className={`modal-content ${styles.modalCardAddEdit}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>
                {editingCustomer ? "تعديل بيانات العميل" : "إضافة عميل جديد"}
              </h3>
              <button onClick={() => setIsAddEditModalOpen(false)} className={styles.modalCloseBtn}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer}>
              <div className="form-group">
                <label className="form-label">اسم العميل <span className={styles.requiredStar}>*</span></label>
                <input 
                  type="text"
                  className="form-input"
                  placeholder="مثال: منار خالد"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">رقم الهاتف / الواتساب</label>
                <input 
                  type="text"
                  dir="ltr"
                  className="form-input num-font"
                  placeholder="010..."
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">العنوان / المنطقة</label>
                <input 
                  type="text"
                  className="form-input"
                  placeholder="مثال: مدينة نصر - القاهرة"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>

              <div className={styles.formGridTwo}>
                <div className="form-group">
                  <label className="form-label">تصنيف العميل</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="form-input"
                  >
                    <option value="قطاعي">قطاعي (عادي)</option>
                    <option value="VIP">عميل مميز (VIP)</option>
                    <option value="جملة">تاجر جملة</option>
                  </select>
                </div>

                {!editingCustomer && (
                  <div className="form-group">
                    <label className="form-label">رصيد مديونية سابق</label>
                    <input 
                      type="number"
                      step="0.5"
                      dir="ltr"
                      className="form-input num-font"
                      placeholder="0.00"
                      value={formData.balance}
                      onChange={(e) => setFormData({ ...formData, balance: e.target.value })}
                    />
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">ملاحظات إضافية</label>
                <input 
                  type="text"
                  className="form-input"
                  placeholder="ملاحظات تفضيلية أو أوقات التسليم..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>

              <div className={styles.formFooterActions}>
                <button type="button" onClick={() => setIsAddEditModalOpen(false)} className="btn-secondary">إلغاء</button>
                <button type="submit" disabled={isSubmitting} className="btn-primary">
                  <Save size={16} />
                  {isSubmitting ? "جاري الحفظ..." : "حفظ العميل"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer Payment Modal */}
      {customerForPayment && (
        <div className="modal-overlay" onClick={() => setCustomerForPayment(null)}>
          <div 
            className={`modal-content ${styles.modalCardPayment}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.paymentModalHeader}>
              <div>
                <h3 className={styles.modalTitle}>تسجيل سداد دفعة حساب</h3>
                <span className={styles.paymentModalSubTitle}>العميل: {customerForPayment.name}</span>
              </div>
              <button onClick={() => setCustomerForPayment(null)} className={styles.modalCloseBtn}>
                <X size={18} />
              </button>
            </div>

            <div className={styles.paymentDebtBanner}>
              <span className={styles.paymentDebtLabel}>المديونية الحالية:</span>
              <strong className={styles.paymentDebtVal}>
                <span className="num-font" dir="ltr">{formatNumber(customerForPayment.balance)}</span> ج.م
              </strong>
            </div>

            <form onSubmit={handleSavePayment}>
              <div className="form-group">
                <label className="form-label">المبلغ المسدد (ج.م) <span className={styles.requiredStar}>*</span></label>
                <input 
                  type="number"
                  step="0.5"
                  min="0.5"
                  dir="ltr"
                  className={`form-input num-font ${styles.paymentAmountInput}`}
                  placeholder="0.00"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">طريقة السداد</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="form-input"
                >
                  <option value="نقدي">نقدي (كاش)</option>
                  <option value="فودافون كاش / إنستاباي">فودافون كاش / إنستاباي</option>
                  <option value="فيزا / بطاقة">فيزا / بطاقة بنكية</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">ملاحظات السداد</label>
                <input 
                  type="text"
                  className="form-input"
                  placeholder="سداد دفعة حساب..."
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                />
              </div>

              <div className={styles.formFooterActions}>
                <button type="button" onClick={() => setCustomerForPayment(null)} className="btn-secondary">إلغاء</button>
                <button type="submit" disabled={isSubmitting} className="btn-primary">
                  <CheckCircle2 size={16} />
                  {isSubmitting ? "جاري الحفظ..." : "تأكيد السداد"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer Statement Modal */}
      {customerForStatement && (
        <div className="modal-overlay" onClick={() => setCustomerForStatement(null)}>
          <div 
            className={`modal-content ${styles.modalCardStatement}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.paymentModalHeader}>
              <div>
                <h3 className={styles.modalTitle}>كشف حساب العميل</h3>
                <span className={styles.paymentModalSubTitle}>{customerForStatement.name}</span>
              </div>
              <button onClick={() => setCustomerForStatement(null)} className={styles.modalCloseBtn}>
                <X size={18} />
              </button>
            </div>

            <div className={styles.statementHeaderStats}>
              <div>
                <span className={styles.statItemLabel}>الرصيد الحالي:</span>
                <strong className={customerForStatement.balance > 0 ? styles.statementDebtVal : styles.statementGreenVal}>
                  <span className="num-font" dir="ltr">{formatNumber(customerForStatement.balance)}</span> ج.م
                </strong>
              </div>
              <div>
                <span className={styles.statItemLabel}>إجمالي المشتريات:</span>
                <strong className={styles.statementPurchasesVal}>
                  <span className="num-font" dir="ltr">{formatNumber(customerForStatement.totalPurchases || 0)}</span> ج.م
                </strong>
              </div>
            </div>

            {/* Transactions History */}
            <div className={styles.transactionsHistoryBox}>
              {(!customerForStatement.transactions || customerForStatement.transactions.length === 0) ? (
                <p className={styles.transactionsEmptyText}>
                  لا توجد حركات مالية مسجلة بعد لهذا العميل
                </p>
              ) : (
                <div className={styles.transactionsList}>
                  {customerForStatement.transactions.map((tx, idx) => (
                    <div key={idx} className={tx.type?.includes("سداد") ? styles.txItemPayment : styles.txItemCharge}>
                      <div>
                        <div className={styles.txTypeTitle}>{tx.type || "حركة مالية"}</div>
                        <div className={styles.txNotesText}>{tx.notes || ""}</div>
                        <span className={styles.txDateText}>
                          {tx.date ? new Date(tx.date).toLocaleDateString("ar-EG") : ""}
                        </span>
                      </div>
                      <div className={styles.txLeftCol}>
                        <div className={tx.type?.includes("سداد") ? styles.txAmountGreen : styles.txAmountRed}>
                          <span className="num-font" dir="ltr">{formatNumber(tx.amount)}</span> ج.م
                        </div>
                        <span className={styles.txBalanceSub}>الرصيد: {formatNumber(tx.newBalance)} ج.م</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {customerToDelete && (
        <div className="modal-overlay" onClick={() => setCustomerToDelete(null)}>
          <div 
            className={`modal-content ${styles.modalCardDelete}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.deleteIconBox}>
              <Trash2 size={24} />
            </div>

            <h3 className={styles.deleteModalTitle}>
              تأكيد حذف حساب العميل
            </h3>
            <p className={styles.deleteModalDesc}>
              هل أنت متأكد من حذف العميل <strong>"{customerToDelete.name}"</strong> نهائياً من النظام؟
            </p>

            <div className={styles.deleteModalActions}>
              <button onClick={() => setCustomerToDelete(null)} className={`btn-secondary ${styles.deleteModalBtn}`}>إلغاء</button>
              <button onClick={handleConfirmDelete} className={`btn-danger ${styles.deleteModalBtn}`}>نعم، احذف العميل</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

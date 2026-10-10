"use client";

import { useState, useEffect } from "react";
import { 
  X, 
  PlusCircle, 
  MinusCircle, 
  ArrowRightLeft, 
  DollarSign, 
  CreditCard,
  Wallet,
  Landmark,
  FileText
} from "lucide-react";
import { formatNumber, roundCurrency } from "@/lib/utils";
import CustomSelect from "@/components/CustomSelect";
import styles from "./TreasuryTransactionModal.module.css";

const VAULT_OPTIONS = [
  { value: "نقدي", label: "💵 خزينة النقدية (الكاش بالدرج)" },
  { value: "فيزا", label: "💳 خزينة الفيزا والبنك" },
  { value: "محفظة إلكترونية", label: "📱 خزينة المحافظ (فودافون كاش / إنستاباي)" }
];

const TRANSACTION_TYPES = [
  { value: "إيداع", label: "سند قبض / إيداع نقدية", icon: PlusCircle },
  { value: "سحب", label: "سند صرف / مسحوبات", icon: MinusCircle },
  { value: "تحويل", label: "تحويل داخلي بين الخزن", icon: ArrowRightLeft }
];

export default function TreasuryTransactionModal({
  isOpen,
  onClose,
  initialType = "إيداع",
  currentUser,
  onSave
}) {
  const [type, setType] = useState(initialType);
  const [amount, setAmount] = useState("");
  const [fromMethod, setFromMethod] = useState("نقدي");
  const [toMethod, setToMethod] = useState("فيزا");
  const [category, setCategory] = useState("إيداع رأس مال");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (isOpen) {
      setType(initialType);
      setAmount("");
      setFromMethod("نقدي");
      setToMethod("فيزا");
      setCategory(
        initialType === "إيداع" 
          ? "إيداع رأس مال" 
          : initialType === "سحب" 
            ? "مسحوبات شخصية" 
            : "تحويل بنكي / إيداع محفظة"
      );
      setNotes("");
      setErrorMsg("");
      const now = new Date();
      const localDateStr = now.toISOString().split("T")[0];
      setDate(localDateStr);
    }
  }, [isOpen, initialType]);

  // Adjust default category when type changes
  const handleTypeChange = (newType) => {
    setType(newType);
    setErrorMsg("");
    if (newType === "إيداع") {
      setCategory("إيداع رأس مال");
      setFromMethod("نقدي");
    } else if (newType === "سحب") {
      setCategory("مسحوبات شخصية");
      setFromMethod("نقدي");
    } else if (newType === "تحويل") {
      setCategory("تحويل بين الخزن");
      setFromMethod("نقدي");
      setToMethod("فيزا");
    }
  };

  if (!isOpen) return null;

  const parsedAmount = roundCurrency(parseFloat(amount) || 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || parsedAmount <= 0) {
      setErrorMsg("يرجى إدخال مبلغ صحيح أكبر من صفر.");
      return;
    }

    if (type === "تحويل" && fromMethod === toMethod) {
      setErrorMsg("لا يمكن التحويل لنفس الخزينة! يرجى اختيار خزينة مختلفة للتحويل إليها.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg("");

    try {
      await onSave({
        type,
        amount: parsedAmount,
        fromMethod,
        toMethod: type === "تحويل" ? toMethod : null,
        category,
        notes,
        date: date ? new Date(date).toISOString() : new Date().toISOString(),
        createdBy: currentUser ? {
          uid: currentUser.uid,
          name: currentUser.displayName || currentUser.email || "المسؤول",
          email: currentUser.email
        } : null
      });
      onClose();
    } catch (err) {
      console.error("Treasury transaction submit error:", err);
      setErrorMsg(err.message || "حدث خطأ أثناء حفظ الحركة المالية.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className={`modal-content ${styles.modalContainer}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className={styles.modalHeader}>
          <div className={styles.headerBrand}>
            <div className={`${styles.headerIcon} ${styles[`typeIcon_${type}`]}`}>
              {type === "إيداع" && <PlusCircle size={22} />}
              {type === "سحب" && <MinusCircle size={22} />}
              {type === "تحويل" && <ArrowRightLeft size={22} />}
            </div>
            <div>
              <h3 className={styles.headerTitle}>
                {type === "إيداع" && "تسجيل سند قبض / إيداع نقدية في الخزنة"}
                {type === "سحب" && "تسجيل سند صرف / مسحوبات من الخزنة"}
                {type === "تحويل" && "تسجيل تحويل داخلي بين الخزن"}
              </h3>
              <p className={styles.headerSubtitle}>
                إدارة السيولة النقدية وتوثيق كافة التدفقات المالية بدقة
              </p>
            </div>
          </div>

          <button onClick={onClose} className={styles.closeBtn} title="إغلاق">
            <X size={16} />
          </button>
        </div>

        {/* Type Selector Tabs */}
        <div className={styles.typeTabs}>
          {TRANSACTION_TYPES.map((t) => {
            const Icon = t.icon;
            const isActive = type === t.value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => handleTypeChange(t.value)}
                className={`${styles.typeTabBtn} ${isActive ? styles.typeTabActive : ""}`}
              >
                <Icon size={16} />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className={styles.formContent}>
          {errorMsg && (
            <div className={styles.errorAlert}>
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Amount Field */}
          <div className="form-group">
            <label className="form-label">
              المبلغ (ج.م) <span className={styles.requiredStar}>*</span>
            </label>
            <div className={styles.inputWrapper}>
              <input 
                type="number"
                step="any"
                min="0.01"
                className={`form-input num-font ${styles.amountInput}`}
                dir="ltr"
                placeholder="أدخل المبلغ..."
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setErrorMsg("");
                }}
                required
                autoFocus
              />
              <DollarSign size={20} className={styles.dollarIcon} />
            </div>
          </div>

          {/* Live Amount Preview */}
          {parsedAmount > 0 && (
            <div className={styles.previewBox}>
              <span className={styles.previewLabel}>المبلغ المراد توثيقه:</span>
              <strong className={styles.previewValue}>
                <span className="num-font" dir="ltr">{formatNumber(parsedAmount)}</span> ج.م
              </strong>
            </div>
          )}

          {/* Vault Selection */}
          {type !== "تحويل" ? (
            <div className="form-group">
              <label className="form-label">
                {type === "إيداع" ? "إيداع في خزينة:" : "صرف من خزينة:"}
              </label>
              <CustomSelect
                options={VAULT_OPTIONS}
                value={fromMethod}
                onChange={(val) => setFromMethod(val)}
                icon={Landmark}
              />
            </div>
          ) : (
            <div className={styles.gridRow}>
              <div className="form-group">
                <label className="form-label">من خزينة (المصدر):</label>
                <CustomSelect
                  options={VAULT_OPTIONS}
                  value={fromMethod}
                  onChange={(val) => setFromMethod(val)}
                  icon={Wallet}
                />
              </div>

              <div className="form-group">
                <label className="form-label">إلى خزينة (المستلم):</label>
                <CustomSelect
                  options={VAULT_OPTIONS}
                  value={toMethod}
                  onChange={(val) => setToMethod(val)}
                  icon={CreditCard}
                />
              </div>
            </div>
          )}

          {/* Category & Date */}
          <div className={styles.gridRow}>
            <div className="form-group">
              <label className="form-label">تصنيف الحركة:</label>
              <select
                className="form-input"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {type === "إيداع" && (
                  <>
                    <option value="إيداع رأس مال">إيداع رأس مال إضافي</option>
                    <option value="إيراد مباشر">إيراد مالي مباشر</option>
                    <option value="تسوية رصيد">تسوية رصيد نقدية</option>
                    <option value="استرداد مبالغ">استرداد مبالغ / تأمين</option>
                    <option value="أخرى">أخرى</option>
                  </>
                )}
                {type === "سحب" && (
                  <>
                    <option value="مسحوبات شخصية">مسحوبات شخصية / أرباح المالك</option>
                    <option value="مصروف نثري مباشر">مصروف نثري مباشر</option>
                    <option value="تسوية عجز">تسوية عجز نقدية</option>
                    <option value="سداد التزام">سداد التزام خارجي</option>
                    <option value="أخرى">أخرى</option>
                  </>
                )}
                {type === "تحويل" && (
                  <>
                    <option value="تحويل بين الخزن">تحويل داخلي بين الخزن</option>
                    <option value="إيداع كاش في البنك">إيداع كاش الدرج في الحساب البنكي</option>
                    <option value="شحن محفظة إلكترونية">شحن رصيد محفظة إلكترونية</option>
                    <option value="سحب كاش من البنك">سحب كاش من البنك لدرج المحل</option>
                  </>
                )}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">تاريخ الحركة:</label>
              <input 
                type="date"
                className="form-input num-font"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Notes */}
          <div className="form-group">
            <label className="form-label">البيان / ملاحظات توضيحية:</label>
            <input 
              type="text"
              className="form-input"
              placeholder="مثال: إيداع دفعة نقدية لزيادة سيولة المحل، سحب أرباح شهرية..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Action Buttons */}
          <div className={styles.actionRow}>
            <button 
              type="button" 
              onClick={onClose}
              className={`btn-secondary ${styles.cancelBtn}`}
            >
              إلغاء
            </button>
            <button 
              type="submit" 
              disabled={isSubmitting || !amount || parsedAmount <= 0}
              className={`btn-primary ${styles.submitBtn}`}
            >
              {isSubmitting ? "جاري الحفظ..." : "تأكيد وحفظ الحركة المالية"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { X, UserPlus } from "lucide-react";
import { addEmployee, updateEmployee } from "@/lib/employeesService";
import styles from "./EmployeeModal.module.css";

export default function EmployeeModal({ isOpen, onClose, employee, onSaved }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("بائع ومسؤول مبيعات");
  const [baseSalary, setBaseSalary] = useState("");
  const [commissionRate, setCommissionRate] = useState("1"); // 1%
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (employee) {
      setName(employee.name || "");
      setCode(employee.code || "");
      setPhone(employee.phone || "");
      setRole(employee.role || "بائع ومسؤول مبيعات");
      setBaseSalary(employee.baseSalary !== undefined ? String(employee.baseSalary) : "");
      setCommissionRate(employee.commissionRate !== undefined ? String(employee.commissionRate * 100) : "1");
      setNotes(employee.notes || "");
    } else {
      setName("");
      setCode("");
      setPhone("");
      setRole("بائع ومسؤول مبيعات");
      setBaseSalary("");
      setCommissionRate("1");
      setNotes("");
    }
    setError("");
  }, [employee, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("يرجى كتابة اسم الموظف");
      return;
    }
    if (!code.trim()) {
      setError("يرجى كتابة كود الموظف (مثال: EMP-01 أو 101)");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const payload = {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        phone: phone.trim(),
        role: role.trim(),
        baseSalary: parseFloat(baseSalary) || 0,
        commissionRate: (parseFloat(commissionRate) || 0) / 100,
        notes: notes.trim()
      };

      if (employee) {
        await updateEmployee(employee.id, payload);
      } else {
        await addEmployee(payload);
      }

      if (onSaved) onSaved();
      onClose();
    } catch (err) {
      console.error(err);
      setError(err.message || "حدث خطأ أثناء حفظ بيانات الموظف");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className={`modal-content ${styles.modalContainer}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.headerBrand}>
            <div className={styles.headerIcon}>
              <UserPlus size={22} />
            </div>
            <div>
              <h3 className={styles.headerTitle}>
                {employee ? "تعديل بيانات الموظف" : "تسجيل موظف جديد"}
              </h3>
              <p className={styles.headerSubtitle}>
                البيانات الأساسية وكود البصمة والراتب والعمولة
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className={styles.closeBtn}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Container */}
        <form onSubmit={handleSubmit} className={styles.form}>
          {/* Scrollable Body */}
          <div className={styles.modalBody}>
            {/* Error Alert */}
            {error && (
              <div className={styles.errorAlert}>
                {error}
              </div>
            )}

            {/* Name & Code */}
            <div className={styles.gridRow}>
              <div>
                <label className={styles.fieldLabel}>
                  اسم الموظف *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: أحمد محمود"
                  className="form-input"
                />
              </div>

              <div>
                <label className={styles.fieldLabel}>
                  كود الموظف (للبصمة) *
                </label>
                <input
                  type="text"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="مثال: 101 أو EMP-01"
                  className={`form-input num-font ${styles.codeInput}`}
                />
              </div>
            </div>

            {/* Role & Phone */}
            <div className={styles.gridRow}>
              <div>
                <label className={styles.fieldLabel}>
                  المسمى الوظيفي
                </label>
                <input
                  type="text"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="مثال: كاشير ومسؤول مبيعات"
                  className="form-input"
                />
              </div>

              <div>
                <label className={styles.fieldLabel}>
                  رقم الهاتف
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="010XXXXXXXX"
                  className="form-input num-font"
                />
              </div>
            </div>

            {/* Salary & Commission */}
            <div className={styles.gridRow}>
              <div>
                <label className={styles.fieldLabel}>
                  الراتب الأساسي الشهري (ج.م) *
                </label>
                <input
                  type="number"
                  step="50"
                  min="0"
                  value={baseSalary}
                  onChange={(e) => setBaseSalary(e.target.value)}
                  placeholder="0.00"
                  className={`form-input num-font ${styles.salaryInput}`}
                />
              </div>

              <div>
                <label className={styles.fieldLabel}>
                  نسبة العمولة على المبيعات (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={commissionRate}
                  onChange={(e) => setCommissionRate(e.target.value)}
                  placeholder="1"
                  className={`form-input num-font ${styles.commissionInput}`}
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className={styles.fieldLabel}>
                ملاحظات إضافية
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="أي ملاحظات تخص شروط العمل أو مواعيد الشيفت..."
                className={`form-input ${styles.notesTextarea}`}
              />
            </div>
          </div>

          {/* Fixed Footer */}
          <div className={styles.modalFooter}>
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
            >
              {loading ? "جاري الحفظ..." : employee ? "حفظ التعديلات" : "إضافة الموظف"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

"use client";

import { useRef } from "react";
import { X, Printer, Calendar, Clock, DollarSign, FileText } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import styles from "./EmployeePayslipModal.module.css";

export default function EmployeePayslipModal({ isOpen, onClose, employee, monthSummary }) {
  const printRef = useRef(null);

  if (!isOpen || !employee || !monthSummary) return null;

  const handlePrint = () => {
    window.print();
  };

  const {
    baseSalary = 0,
    hourlyRate = 0,
    earnedSalary = 0,
    totalBonus = 0,
    totalCommission = 0,
    totalPenalty = 0,
    totalAdvance = 0,
    netSalary = 0,
    totalMinutes = 0,
    attendanceDays = 0,
    transactions = []
  } = monthSummary;

  const hoursWorked = Math.floor(totalMinutes / 60);
  const minutesWorked = totalMinutes % 60;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className={`modal-content ${styles.modalContainer}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header (No print) */}
        <div className={styles.modalHeader}>
          <div className={styles.headerBrand}>
            <div className={styles.headerIcon}>
              <FileText size={22} />
            </div>
            <div>
              <h3 className={styles.headerTitle}>
                مفردات مرتب ومستحقات الموظف
              </h3>
              <p className={styles.headerSubtitle}>
                كشف حساب شهري مفصل لشهر {monthSummary.monthLabel || ""} (محسوب بساعات العمل والعمولة)
              </p>
            </div>
          </div>

          <div className={styles.headerActions}>
            <button
              onClick={handlePrint}
              className={`btn-secondary ${styles.printBtn}`}
            >
              <Printer size={16} color="#db2777" />
              <span>طباعة الكشف</span>
            </button>
            <button 
              type="button"
              onClick={onClose}
              className={styles.closeBtn}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable Printable Area */}
        <div 
          ref={printRef} 
          className={styles.printableArea}
        >
          {/* Header of Payslip */}
          <div className={styles.payslipHeader}>
            <div>
              <h2 className={styles.brandName}>Nelly Store</h2>
              <p className={styles.brandDesc}>
                كشف حساب ومفردات الراتب الشهري
              </p>
            </div>
            <div className={styles.metaInfo}>
              <p className={styles.metaLine}>تاريخ الإصدار: {new Date().toLocaleDateString("ar-EG")}</p>
              <p className={styles.metaPeriod}>الفترة: <span className={`num-font ${styles.periodHighlight}`}>{monthSummary.monthLabel}</span></p>
            </div>
          </div>

          {/* Employee Basic Info Card */}
          <div className={styles.employeeInfoCard}>
            <div>
              <span className={styles.infoLabel}>اسم الموظف</span>
              <span className={styles.infoValueName}>{employee.name}</span>
            </div>
            <div>
              <span className={styles.infoLabel}>كود الموظف</span>
              <span className={`num-font ${styles.infoValueCode}`}>{employee.code}</span>
            </div>
            <div>
              <span className={styles.infoLabel}>الوظيفة</span>
              <span className={styles.infoValueGeneral}>{employee.role || "بائع ومسؤول مبيعات"}</span>
            </div>
            <div>
              <span className={styles.infoLabel}>رقم الهاتف</span>
              <span className={`num-font ${styles.infoValueGeneral}`}>{employee.phone || "---"}</span>
            </div>
          </div>

          {/* Attendance Stats & Work Shift */}
          <div className={styles.statsGrid}>
            <div className={styles.statBox}>
              <Calendar size={22} color="#6366f1" />
              <div>
                <p className={styles.statBoxTitle}>أيام الحضور الفعلية</p>
                <p className={`num-font ${styles.statBoxValue}`}>
                  {attendanceDays} يوم عمل
                </p>
              </div>
            </div>

            <div className={styles.statBox}>
              <Clock size={22} color="#0891b2" />
              <div>
                <p className={styles.statBoxTitle}>إجمالي ساعات العمل</p>
                <p className={`num-font ${styles.statBoxValue}`}>
                  {hoursWorked} ساعة و {minutesWorked} دقيقة
                </p>
              </div>
            </div>

            <div className={styles.statBox}>
              <DollarSign size={22} color="#db2777" />
              <div>
                <p className={styles.statBoxTitle}>معدل أجر الساعة (10س/يوم)</p>
                <p className={`num-font ${styles.statBoxValueRose}`}>
                  {formatCurrency(hourlyRate)} / س
                </p>
              </div>
            </div>
          </div>

          {/* Financial Breakdown Table */}
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead className={styles.thead}>
                <tr>
                  <th className={styles.thItem}>البند المالي</th>
                  <th className={styles.thCenter}>البيان / الحساب</th>
                  <th className={styles.thLeft}>المبلغ المستحق</th>
                </tr>
              </thead>
              <tbody>
                {/* Contract Base Salary */}
                <tr className={styles.trBase}>
                  <td className={styles.tdMuted}>الراتب التعاقدي الشهري (المعياري)</td>
                  <td className={styles.tdMutedCenter}>30 يوم × 10 ساعات = 300س</td>
                  <td className={`num-font ${styles.tdMutedLeft}`}>
                    {formatCurrency(baseSalary)}
                  </td>
                </tr>

                {/* Earned Salary from worked hours */}
                <tr className={styles.trEarned}>
                  <td className={styles.tdEarned}>
                    <div>
                      <span className={styles.titleBold}>أجر ساعات العمل الفعلية المستحق</span>
                      <span className={styles.subDetail}>
                        ({hoursWorked}س و {minutesWorked}د × {formatCurrency(hourlyRate)}/ساعة)
                      </span>
                    </div>
                  </td>
                  <td className={styles.tdCenterSub}>أساسي فعلي (+)</td>
                  <td className={`num-font ${styles.tdValueGreen}`}>
                    +{formatCurrency(earnedSalary)}
                  </td>
                </tr>

                {/* Sales Commission */}
                <tr className={totalCommission > 0 ? styles.trCommission : styles.trCommissionZero}>
                  <td className={styles.tdEarned}>
                    <div>
                      <span className={styles.titleBold}>إجمالي عمولات المبيعات (المحققة من الفواتير)</span>
                      <span className={styles.subDetail}>تضاف لصافي المرتب مع كل فاتورة بيع</span>
                    </div>
                  </td>
                  <td className={styles.tdCenterSub}>عمولة مبيعات (+)</td>
                  <td className={`num-font ${styles.tdValueBlue}`}>
                    +{formatCurrency(totalCommission)}
                  </td>
                </tr>

                {/* Bonuses */}
                {totalBonus > 0 && (
                  <tr className={styles.trBonus}>
                    <td className={styles.tdEarned}>إجمالي العلاوات والمكافآت</td>
                    <td className={styles.tdCenterSub}>إضافة (+)</td>
                    <td className={`num-font ${styles.tdValueGreen}`}>
                      +{formatCurrency(totalBonus)}
                    </td>
                  </tr>
                )}

                {/* Penalties */}
                {totalPenalty > 0 && (
                  <tr className={styles.trPenalty}>
                    <td className={styles.tdEarned}>إجمالي الجزاءات والخصومات</td>
                    <td className={styles.tdCenterSub}>خصم (-)</td>
                    <td className={`num-font ${styles.tdValueGeneric}`}>
                      -{formatCurrency(totalPenalty)}
                    </td>
                  </tr>
                )}

                {/* Advances */}
                {totalAdvance > 0 && (
                  <tr className={styles.trAdvance}>
                    <td className={styles.tdEarned}>إجمالي المسحوبات والسلف</td>
                    <td className={styles.tdCenterSub}>خصم (-)</td>
                    <td className={`num-font ${styles.tdValueGeneric}`}>
                      -{formatCurrency(totalAdvance)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Net Salary Highlight */}
          <div className={styles.netSalaryCard}>
            <div>
              <p className={styles.netSalaryTitle}>
                الصافي النهائي المستحق للصرف
              </p>
              <p className={styles.netSalaryFormula}>
                أجر الساعات الفعلية + عمولات المبيعات + العلاوات - الجزاءات - المسحوبات
              </p>
            </div>
            <div className={`num-font ${styles.netSalaryAmount}`}>
              {formatCurrency(netSalary)}
            </div>
          </div>

          {/* Details of Transactions if any */}
          {transactions.length > 0 && (
            <div className={styles.txLogWrapper}>
              <h4 className={styles.txLogTitle}>سجل الحركات المالية للشهر</h4>
              <div className={styles.txLogList}>
                {transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className={styles.txLogRow}
                  >
                    <div className={styles.txLogLeft}>
                      <span className={`num-font ${styles.txLogDate}`}>{tx.date}</span>
                      <span className={styles.txLogNote}>{tx.notes || tx.type}</span>
                    </div>
                    <span
                      className={`num-font ${tx.type === "bonus" || tx.type === "commission" ? styles.txLogAmountPositive : styles.txLogAmountNegative}`}
                    >
                      {tx.type === "bonus" || tx.type === "commission" ? "+" : "-"}
                      {formatCurrency(tx.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Fixed Footer */}
        <div className={styles.modalFooter}>
          <button
            onClick={onClose}
            className="btn-secondary"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import {
  Users,
  UserPlus,
  Clock,
  DollarSign,
  Award,
  Calendar,
  Search,
  ArrowRightLeft,
  CheckCircle2,
  AlertCircle,
  FileText,
  Edit3,
  Trash2,
  Barcode,
  LogIn,
  LogOut
} from "lucide-react";
import {
  subscribeToEmployees,
  subscribeToAttendance,
  subscribeToTodayAttendance,
  subscribeToEmployeeTransactions,
  punchEmployeeAttendance,
  punchEmployeeById,
  manualCompleteAttendance,
  deleteEmployee,
  deleteEmployeeTransaction
} from "@/lib/employeesService";
import EmployeeModal from "@/components/EmployeeModal";
import EmployeeTransactionModal from "@/components/EmployeeTransactionModal";
import EmployeePayslipModal from "@/components/EmployeePayslipModal";
import EmployeeBarcodeModal from "@/components/EmployeeBarcodeModal";
import { formatCurrency, formatDateTime, formatNumber, roundCurrency, getLocalDateString, getLocalMonthString } from "@/lib/utils";
import styles from "./employees.module.css";

export default function EmployeesPage() {
  const router = useRouter();
  const { user, authLoading } = useAuth();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // State
  const [employees, setEmployees] = useState([]);
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [todayAttendance, setTodayAttendance] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Active Tab: 'directory' | 'attendance' | 'payroll' | 'transactions'
  const [activeTab, setActiveTab] = useState("directory");

  // Punch in/out state
  const [punchCode, setPunchCode] = useState("");
  const [punchFeedback, setPunchFeedback] = useState(null);
  const [punching, setPunching] = useState(false);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(getLocalMonthString());

  // Modals state
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);

  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [transactionTargetEmployee, setTransactionTargetEmployee] = useState(null);

  const [isPayslipModalOpen, setIsPayslipModalOpen] = useState(false);
  const [payslipEmployee, setPayslipEmployee] = useState(null);
  const [payslipData, setPayslipData] = useState(null);

  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);
  const [barcodeEmployee, setBarcodeEmployee] = useState(null);

  // Auth protection
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  // Subscriptions
  useEffect(() => {
    if (!user) return;
    setLoading(true);

    const unsubEmployees = subscribeToEmployees((list) => {
      setEmployees(list);
      setLoading(false);
    });

    const unsubAttendance = subscribeToAttendance((list) => {
      setAttendanceLogs(list);
    });

    const unsubToday = subscribeToTodayAttendance((list) => {
      setTodayAttendance(list);
    });

    const unsubTx = subscribeToEmployeeTransactions((list) => {
      setTransactions(list);
    });

    return () => {
      unsubEmployees();
      unsubAttendance();
      unsubToday();
      unsubTx();
    };
  }, [user]);

  // Quick Attendance Punch Handler
  const handleQuickPunch = async (e) => {
    e.preventDefault();
    if (!punchCode.trim() || punching) return;

    setPunching(true);
    setPunchFeedback(null);

    try {
      const result = await punchEmployeeAttendance(punchCode);
      const empName = result.employeeName || result.employee?.name || punchCode;
      setPunchFeedback({
        type: "success",
        action: result.action,
        employeeName: empName,
        message: result.message || (result.action === "check_in" 
          ? `تم تسجيل حضور الموظف "${empName}" بنجاح`
          : `تم تسجيل انصراف الموظف "${empName}" بنجاح - مدة الوردية: ${result.durationText || ""}`)
      });
      setPunchCode("");
      setTimeout(() => {
        setPunchFeedback((prev) => (prev?.employeeName === empName ? null : prev));
      }, 5000);
    } catch (err) {
      setPunchFeedback({
        type: "error",
        message: err.message || "فشل تسجيل الحضور / الانصراف"
      });
    } finally {
      setPunching(false);
    }
  };

  // Direct 1-Click Punch In / Out Handler
  const handleDirectPunch = async (employee) => {
    if (punching || !employee) return;
    setPunching(true);
    setPunchFeedback(null);
    try {
      const result = await punchEmployeeById(employee.id);
      const empName = result.employeeName || employee.name;
      setPunchFeedback({
        type: "success",
        action: result.action,
        employeeName: empName,
        message: result.message || (result.action === "check_in" 
          ? `تم تسجيل حضور الموظف "${empName}" بنجاح` 
          : `تم تسجيل انصراف الموظف "${empName}" بنجاح - مدة الوردية: ${result.durationText || ""}`)
      });
      setTimeout(() => {
        setPunchFeedback((prev) => (prev?.employeeName === empName ? null : prev));
      }, 5000);
    } catch (err) {
      setPunchFeedback({
        type: "error",
        message: err.message || "فشل تسجيل الحضور / الانصراف"
      });
    } finally {
      setPunching(false);
    }
  };

  // Manual Check-out for in-progress shift
  const handleManualCheckOut = async (attId) => {
    if (!confirm("هل تريد تسجيل انصراف هذا الموظف وإنهاء ورديته الآن؟")) return;
    try {
      await manualCompleteAttendance(attId);
    } catch (err) {
      alert("فشل إنهاء الوردية: " + err.message);
    }
  };

  // Delete employee
  const handleDeleteEmployee = async (emp) => {
    if (confirm(`هل أنت متأكد من حذف الموظف "${emp.name}" نهائياً من النظام؟`)) {
      try {
        await deleteEmployee(emp.id);
      } catch (err) {
        alert("فشل حذف الموظف: " + err.message);
      }
    }
  };

  // Delete transaction
  const handleDeleteTransaction = async (txId) => {
    if (confirm("هل أنت متأكد من إلغاء هذه الحركة المالية؟")) {
      try {
        await deleteEmployeeTransaction(txId);
      } catch (err) {
        alert("فشل حذف الحركة: " + err.message);
      }
    }
  };

  // Open Payslip for an Employee
  const handleOpenPayslip = (emp) => {
    const summary = getMonthlySummaryForEmployee(emp.id, selectedMonth);
    setPayslipEmployee(emp);
    setPayslipData({
      ...summary,
      monthLabel: selectedMonth
    });
    setIsPayslipModalOpen(true);
  };

  // Helper: Get Monthly Summary for an Employee
  const getMonthlySummaryForEmployee = (employeeId, yyyyMm) => {
    const emp = employees.find((e) => e.id === employeeId);
    const baseSalary = Number(emp?.baseSalary || emp?.salary || 0);

    const empTxs = transactions.filter((tx) => {
      if (tx.employeeId !== employeeId) return false;
      const txDateStr = tx.date || (tx.createdAt ? getLocalDateString(tx.createdAt) : "");
      return tx.month === yyyyMm || tx.monthStr === yyyyMm || txDateStr.startsWith(yyyyMm);
    });

    let totalBonus = 0;
    let totalCommission = 0;
    let totalPenalty = 0;
    let totalAdvance = 0;

    empTxs.forEach((tx) => {
      const amt = Number(tx.amount || 0);
      if (tx.type === "bonus") totalBonus += amt;
      else if (tx.type === "commission") totalCommission += amt;
      else if (tx.type === "penalty") totalPenalty += amt;
      else if (tx.type === "advance") totalAdvance += amt;
    });

    const empAttendance = attendanceLogs.filter((att) => {
      if (att.employeeId !== employeeId) return false;
      const attDateStr = att.date || (att.checkIn ? getLocalDateString(att.checkIn) : "");
      return attDateStr.startsWith(yyyyMm);
    });

    const attendanceDays = new Set(empAttendance.map((a) => a.date)).size;
    const totalMinutes = empAttendance.reduce((sum, a) => sum + (Number(a.durationMinutes) || 0), 0);
    const hoursWorked = Math.floor(totalMinutes / 60);
    const minutesWorked = totalMinutes % 60;
    const totalHoursWorked = totalMinutes / 60;

    // Standard work shift: 10 hours/day * 30 days = 300 hours/month
    const hourlyRate = baseSalary > 0 ? (baseSalary / 300) : 0;
    // Earned base wage based on actual hours clocked in (if hours clocked, else fallback to baseSalary)
    const earnedSalary = totalMinutes > 0 ? roundCurrency(totalHoursWorked * hourlyRate) : baseSalary;

    // Net Salary = Earned/Base Salary + Sales Commission + Bonuses - Penalties - Advances
    const netSalary = roundCurrency(earnedSalary + totalBonus + totalCommission - totalPenalty - totalAdvance);

    return {
      baseSalary,
      hourlyRate,
      earnedSalary,
      totalBonus,
      totalCommission,
      totalPenalty,
      totalAdvance,
      netSalary,
      attendanceDays,
      totalMinutes,
      hoursWorked,
      minutesWorked,
      transactions: empTxs
    };
  };

  // Currently on Shift
  const activeStaffIds = useMemo(() => {
    return new Set(
      todayAttendance
        .filter((a) => a.status === "in_progress")
        .map((a) => a.employeeId)
    );
  }, [todayAttendance]);

  // KPIs
  const stats = useMemo(() => {
    const totalEmployeesCount = employees.length;
    const workingNowCount = activeStaffIds.size;
    
    let totalBasePayroll = 0;
    let totalEarnedPayroll = 0;
    let totalNetEstimatedPayroll = 0;

    employees.forEach(emp => {
      const s = getMonthlySummaryForEmployee(emp.id, selectedMonth);
      totalBasePayroll += s.baseSalary;
      totalEarnedPayroll += s.earnedSalary;
      totalNetEstimatedPayroll += s.netSalary;
    });

    const totalMonthlyBonuses = transactions
      .filter((t) => (t.date || "").startsWith(selectedMonth) && (t.type === "bonus" || t.type === "commission"))
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const totalMonthlyDeductions = transactions
      .filter((t) => (t.date || "").startsWith(selectedMonth) && (t.type === "penalty" || t.type === "advance"))
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    return {
      totalEmployeesCount,
      workingNowCount,
      totalBasePayroll,
      totalEarnedPayroll,
      totalMonthlyBonuses,
      totalMonthlyDeductions,
      netEstimatedPayroll: totalNetEstimatedPayroll
    };
  }, [employees, activeStaffIds, transactions, selectedMonth, attendanceLogs]);

  // Filtered lists
  const filteredEmployees = useMemo(() => {
    if (!searchTerm.trim()) return employees;
    const q = searchTerm.toLowerCase();
    return employees.filter(
      (e) =>
        e.name?.toLowerCase().includes(q) ||
        e.code?.toLowerCase().includes(q) ||
        e.phone?.includes(q) ||
        e.role?.toLowerCase().includes(q)
    );
  }, [employees, searchTerm]);

  if (authLoading || (!user && loading)) {
    return (
      <div className={styles.loadingWrapper}>
        <p className={styles.loadingText}>جاري تحميل بيانات الموظفين...</p>
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

      {/* Main Content */}
      <div className="main-content">
        <Navbar 
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
        />

        <main className="page-wrapper">
          {/* Page Header */}
          <div className={styles.headerRow}>
            <div>
              <div className={styles.headerTitleWrapper}>
                <div className={styles.headerIconBox}>
                  <Users size={22} />
                </div>
                <h2 className={styles.headerTitle}>
                  إدارة الموظفين والرواتب
                </h2>
              </div>
              <p className={styles.headerSubtitle}>
                تسجيل الحضور السريع بالكود، الرواتب والعمولات، الجزاءات ومسير الرواتب الشهري
              </p>
            </div>

            <button
              onClick={() => {
                setEditingEmployee(null);
                setIsEmployeeModalOpen(true);
              }}
              className={`btn-primary ${styles.addEmployeeBtn}`}
            >
              <UserPlus size={18} />
              إضافة موظف جديد
            </button>
          </div>

          {/* Quick Punch Bar & Working Live Staff */}
          <div className={styles.topActionGrid}>
            {/* Punch In/Out Card */}
            <div className={`glass-card ${styles.punchCard}`}>
              <div className={styles.punchHeaderRow}>
                <div className={styles.punchTitleGroup}>
                  <Clock size={20} color="#db2777" />
                  <span className={styles.punchCardTitle}>
                    تسجيل الحضور والانصراف السريع
                  </span>
                </div>
                <span className={styles.todayDateTag}>
                  اليوم: {new Date().toLocaleDateString("ar-EG")}
                </span>
              </div>

              <form onSubmit={handleQuickPunch} className={styles.punchForm}>
                <input
                  type="text"
                  value={punchCode}
                  onChange={(e) => setPunchCode(e.target.value)}
                  placeholder="اكتب كود الموظف واضغط Enter..."
                  disabled={punching}
                  className={`form-input num-font ${styles.punchInput}`}
                />
                <button
                  type="submit"
                  disabled={punching || !punchCode.trim()}
                  className={`btn-primary ${styles.punchSubmitBtn}`}
                >
                  <ArrowRightLeft size={16} />
                  <span>{punching ? "جاري..." : "تسجيل بصمة"}</span>
                </button>
              </form>

              {punchFeedback && (
                <div className={punchFeedback.type === "success" ? styles.punchFeedbackSuccess : styles.punchFeedbackError}>
                  {punchFeedback.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                  <span>{punchFeedback.message}</span>
                </div>
              )}
            </div>

            {/* Live Staff on Shift Card */}
            <div className={`glass-card ${styles.liveStaffCard}`}>
              <div>
                <div className={styles.liveHeaderRow}>
                  <div className={styles.liveTitleGroup}>
                    <span className={styles.liveDot} />
                    <span className={styles.liveTitle}>
                      الموظفون على رأس العمل الآن
                    </span>
                  </div>
                  <span className={styles.liveBadge}>
                    {activeStaffIds.size} متواجد
                  </span>
                </div>

                {activeStaffIds.size === 0 ? (
                  <p className={styles.noStaffText}>
                    لا يوجد موظفون مسجلين بالشيفت حالياً
                  </p>
                ) : (
                  <div className={styles.staffList}>
                    {todayAttendance
                      .filter((a) => a.status === "in_progress")
                      .map((att) => (
                        <div
                          key={att.id}
                          className={styles.staffItemRow}
                        >
                          <span className={styles.staffNameText}>{att.employeeName}</span>
                          <span className={`num-font ${styles.staffCheckInText}`}>
                            حضور: {formatDateTime(att.checkIn, true)}
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              <div className={styles.liveFooterRow}>
                <span>إجمالي فريق العمل: {employees.length}</span>
                <span
                  onClick={() => setActiveTab("attendance")}
                  className={styles.viewAttendanceLink}
                >
                  عرض سجل الحضور &larr;
                </span>
              </div>
            </div>
          </div>

          {/* KPI Stats Cards */}
          <div className={styles.kpiGrid}>
            <div className={`glass-card ${styles.cardPink}`}>
              <div className={styles.kpiLabel}>عدد الموظفين</div>
              <div className={`num-font ${styles.kpiValMain}`}>
                {formatNumber(stats.totalEmployeesCount)}
              </div>
            </div>

            <div className={`glass-card ${styles.cardGreen}`}>
              <div className={styles.kpiLabel}>أجور الساعات المستحقة (الفعلي)</div>
              <div className={styles.valWithUnitRow}>
                <span className={`num-font ${styles.kpiValGreen}`}>
                  {formatNumber(stats.totalEarnedPayroll)}
                </span>
                <span className={styles.kpiUnitGreen}>ج.م</span>
              </div>
            </div>

            <div className={`glass-card ${styles.cardBlue}`}>
              <div className={styles.kpiLabel}>إضافات الشهر (علاوات وعمولات)</div>
              <div className={styles.valWithUnitRow}>
                <span className={`num-font ${styles.kpiValBlue}`}>
                  +{formatNumber(stats.totalMonthlyBonuses)}
                </span>
                <span className={styles.kpiUnitBlue}>ج.م</span>
              </div>
            </div>

            <div className={`glass-card ${styles.cardRed}`}>
              <div className={styles.kpiLabel}>خصومات ومسحوبات الشهر</div>
              <div className={styles.valWithUnitRow}>
                <span className={`num-font ${styles.kpiValRed}`}>
                  -{formatNumber(stats.totalMonthlyDeductions)}
                </span>
                <span className={styles.kpiUnitRed}>ج.م</span>
              </div>
            </div>
          </div>

          {/* Navigation Tabs Bar */}
          <div className={`glass-panel ${styles.tabsPanel}`}>
            <div className={styles.tabsContainer}>
              {/* Tabs */}
              <div className={styles.tabsGroup}>
                {[
                  { id: "directory", label: `دليل الموظفين (${employees.length})`, icon: Users },
                  { id: "attendance", label: "سجل الحضور والانصراف", icon: Clock },
                  { id: "payroll", label: "مسير الرواتب الشهري", icon: DollarSign },
                  { id: "transactions", label: `سجل المعاملات المالية (${transactions.length})`, icon: FileText }
                ].map((t) => {
                  const Icon = t.icon;
                  const isActive = activeTab === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setActiveTab(t.id)}
                      className={isActive ? styles.tabBtnActive : styles.tabBtnInactive}
                    >
                      <Icon size={16} />
                      <span>{t.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Filters / Search */}
              <div className={styles.tabFiltersGroup}>
                {(activeTab === "payroll" || activeTab === "transactions" || activeTab === "attendance") && (
                  <div className={styles.monthSelectWrap}>
                    <Calendar size={16} color="#db2777" />
                    <input
                      type="month"
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className={`num-font ${styles.monthInput}`}
                    />
                  </div>
                )}

                {activeTab === "directory" && (
                  <div className={styles.searchDirectoryWrap}>
                    <input
                      type="text"
                      className={`form-input ${styles.searchInput}`}
                      placeholder="بحث باسم أو كود الموظف..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <Search size={16} color="#db2777" className={styles.searchIcon} />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* TAB 1: EMPLOYEE DIRECTORY */}
          {activeTab === "directory" && (
            <div>
              {filteredEmployees.length === 0 ? (
                <div className={`glass-card ${styles.emptyDirectoryCard}`}>
                  <Users size={42} color="#9ca3af" className={styles.emptyDirectoryIcon} />
                  <h4 className={styles.emptyDirectoryTitle}>لا يوجد موظفون مسجلون</h4>
                  <p className={styles.emptyDirectorySub}>اضغط على زر "إضافة موظف جديد" للبدء</p>
                </div>
              ) : (
                <div className={styles.employeeGrid}>
                  {filteredEmployees.map((emp) => {
                    const isWorking = activeStaffIds.has(emp.id);
                    return (
                      <div
                        key={emp.id}
                        className={`glass-card ${isWorking ? styles.employeeCardWorking : styles.employeeCardIdle}`}
                      >
                        <div>
                          {/* Header */}
                          <div className={styles.empCardHeader}>
                            <div>
                              <div className={styles.empNameGroup}>
                                <h3 className={styles.empNameTitle}>
                                  {emp.name}
                                </h3>
                                {isWorking ? (
                                  <span className={styles.badgeOnShift}>
                                    ● في الشيفت
                                  </span>
                                ) : (
                                  <span className={styles.badgeOffShift}>
                                    غير متواجد
                                  </span>
                                )}
                              </div>
                              <span className={`num-font ${styles.empCodeText}`}>
                                كود: {emp.code}
                              </span>
                            </div>

                            <div className={styles.empActionsGroup}>
                              <button
                                onClick={() => {
                                  setBarcodeEmployee(emp);
                                  setIsBarcodeModalOpen(true);
                                }}
                                className={styles.barcodeSmallBtn}
                                title="طباعة باركود وبطاقة الموظف"
                              >
                                <Barcode size={15} />
                                <span>باركود</span>
                              </button>
                              <button
                                onClick={() => {
                                  setEditingEmployee(emp);
                                  setIsEmployeeModalOpen(true);
                                }}
                                className={styles.iconBtnGray}
                                title="تعديل"
                              >
                                <Edit3 size={17} />
                              </button>
                              <button
                                onClick={() => handleDeleteEmployee(emp)}
                                className={styles.iconBtnRed}
                                title="حذف"
                              >
                                <Trash2 size={17} />
                              </button>
                            </div>
                          </div>

                          {/* Grid info */}
                          <div className={styles.empInfoGrid}>
                            <div>
                              <span className={styles.empInfoLabel}>الوظيفة</span>
                              <strong className={styles.empInfoValue}>{emp.role || "موظف مبيعات"}</strong>
                            </div>
                            <div>
                              <span className={styles.empInfoLabel}>الراتب الأساسي</span>
                              <strong className={`num-font ${styles.empInfoValue}`}>{formatCurrency(emp.baseSalary || emp.salary)}</strong>
                            </div>
                            <div>
                              <span className={styles.empInfoLabel}>نسبة العمولة</span>
                              <strong className={`num-font ${styles.commissionValue}`}>{((emp.commissionRate || 0.01) * 100).toFixed(1)}%</strong>
                            </div>
                            <div>
                              <span className={styles.empInfoLabel}>الهاتف</span>
                              <strong className={`num-font ${styles.empInfoValue}`}>{emp.phone || "---"}</strong>
                            </div>
                          </div>

                          {/* Live Month Net Salary Pill */}
                          {(() => {
                            const empSummary = getMonthlySummaryForEmployee(emp.id, selectedMonth);
                            return (
                              <div className={styles.summaryBox}>
                                <div className={styles.summaryRow}>
                                  <span className={styles.summaryRowLabel}>ساعات العمل ({selectedMonth}):</span>
                                  <strong className={`num-font ${styles.summaryValCyan}`}>
                                    {empSummary.hoursWorked}س و {empSummary.minutesWorked}د ({formatCurrency(empSummary.earnedSalary)})
                                  </strong>
                                </div>
                                <div className={styles.summaryRow}>
                                  <span className={styles.summaryRowLabel}>عمولات المبيعات:</span>
                                  <strong className={`num-font ${styles.summaryValBlue}`}>
                                    +{formatCurrency(empSummary.totalCommission)}
                                  </strong>
                                </div>
                                <div className={styles.summaryNetRow}>
                                  <span className={styles.summaryNetLabel}>
                                    الصافي المستحق:
                                  </span>
                                  <span className={`num-font ${styles.summaryNetVal}`}>
                                    {formatCurrency(empSummary.netSalary)}
                                  </span>
                                </div>
                              </div>
                            );
                          })()}
                        </div>

                        {/* Action buttons */}
                        <div className={styles.empCardFooter}>
                          <button
                            type="button"
                            disabled={punching}
                            onClick={() => handleDirectPunch(emp)}
                            className={isWorking ? styles.punchDirectOutBtn : styles.punchDirectInBtn}
                            title={isWorking ? "تسجيل انصراف الموظف فوراً" : "تسجيل حضور الموظف فوراً"}
                          >
                            {isWorking ? <LogOut size={15} /> : <LogIn size={15} />}
                            <span>{isWorking ? "انصراف الآن" : "تسجيل حضور"}</span>
                          </button>

                          <button
                            onClick={() => {
                              setTransactionTargetEmployee(emp);
                              setIsTransactionModalOpen(true);
                            }}
                            className={`btn-secondary ${styles.cardFooterBtn}`}
                          >
                            <Award size={15} color="#d97706" />
                            <span>حركة مالية</span>
                          </button>

                          <button
                            onClick={() => handleOpenPayslip(emp)}
                            className={`btn-secondary ${styles.payslipBtn}`}
                          >
                            <FileText size={15} />
                            <span>كشف الحساب</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: ATTENDANCE LOGS */}
          {activeTab === "attendance" && (
            <div className={`glass-panel ${styles.tabSectionPanel}`}>
              <div className={styles.sectionHeaderRow}>
                <h3 className={styles.sectionTitle}>
                  سجل الحضور والانصراف لشهر {selectedMonth}
                </h3>
                <span className={`num-font ${styles.sectionSubCount}`}>
                  {attendanceLogs.filter((a) => (a.date || "").startsWith(selectedMonth)).length} حركة حضور
                </span>
              </div>

              <div className={styles.tableScrollWrap}>
                <table className={`data-table ${styles.fullDataTable}`}>
                  <thead>
                    <tr>
                      <th>التاريخ</th>
                      <th>الموظف</th>
                      <th>كود الموظف</th>
                      <th>وقت الحضور</th>
                      <th>وقت الانصراف</th>
                      <th>مدة العمل</th>
                      <th>الحالة</th>
                      <th className={styles.thCenter}>إجراء</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceLogs
                      .filter((a) => (a.date || "").startsWith(selectedMonth))
                      .map((log) => {
                        const hours = Math.floor((log.durationMinutes || 0) / 60);
                        const mins = (log.durationMinutes || 0) % 60;
                        return (
                          <tr key={log.id}>
                            <td className={`num-font ${styles.dateCol}`}>
                              <span className={styles.dateBadge}>
                                {log.date}
                              </span>
                            </td>
                            <td className={styles.empNameBold}>{log.employeeName}</td>
                            <td>
                              <div className={styles.codeCellGroup}>
                                <span className={`num-font ${styles.empCodePink}`}>{log.employeeCode}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const matchingEmp = employees.find(e => e.id === log.employeeId || e.code === log.employeeCode);
                                    setBarcodeEmployee(matchingEmp || { name: log.employeeName, code: log.employeeCode });
                                    setIsBarcodeModalOpen(true);
                                  }}
                                  className={styles.barcodeIconBtn}
                                  title="طباعة باركود هذا الموظف"
                                >
                                  <Barcode size={15} />
                                </button>
                              </div>
                            </td>
                            <td>
                              <span className={`num-font ${styles.checkInTime}`}>
                                {formatDateTime(log.checkIn, true)}
                              </span>
                            </td>
                            <td>
                              <span className={`num-font ${log.checkOut ? styles.checkOutTime : styles.durationText}`}>
                                {log.checkOut ? formatDateTime(log.checkOut, true) : "---"}
                              </span>
                            </td>
                            <td>
                              <span className={`num-font ${styles.durationText}`}>
                                {log.status === "completed" ? `${hours} س و ${mins} د` : "جاري العمل..."}
                              </span>
                            </td>
                            <td>
                              {log.status === "completed" ? (
                                <span className={styles.badgeCompleted}>
                                  ✓ مكتمل
                                </span>
                              ) : (
                                <span className={styles.badgeWorking}>
                                  ● على رأس العمل
                                </span>
                              )}
                            </td>
                            <td className={styles.thCenter}>
                              {log.status !== "completed" && (
                                <button
                                  type="button"
                                  onClick={() => handleManualCheckOut(log.id)}
                                  className={styles.manualCheckoutBtn}
                                  title="تسجيل انصراف الموظف وإنهاء الوردية يدوياً"
                                >
                                  <LogOut size={13} />
                                  <span>انصراف</span>
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    {attendanceLogs.filter((a) => (a.date || "").startsWith(selectedMonth)).length === 0 && (
                      <tr>
                        <td colSpan={8} className={styles.emptyTableTd}>
                          لا توجد سجلات حضور مسجلة لهذا الشهر
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: MONTHLY PAYROLL LEDGER */}
          {activeTab === "payroll" && (
            <div className={`glass-panel ${styles.tabSectionPanel}`}>
              <div className={styles.payrollHeaderWrap}>
                <h3 className={styles.sectionTitle}>
                  مسير الرواتب والمستحقات لشهر {selectedMonth}
                </h3>
                <p className={styles.payrollSubDesc}>
                  الصافي المستحق = أجر الساعات الفعلية (10س/يوم) + عمولات المبيعات + العلاوات - الجزاءات - المسحوبات
                </p>
              </div>

              <div className={styles.tableScrollWrap}>
                <table className={`data-table ${styles.fullDataTable}`}>
                  <thead>
                    <tr>
                      <th>الموظف</th>
                      <th className={styles.thCenter}>ساعات العمل</th>
                      <th className={styles.thLeft}>الأساسي التعاقدي</th>
                      <th className={styles.thEarnedHours}>أجر الساعات (+)</th>
                      <th className={styles.thCommission}>العمولات (+)</th>
                      <th className={styles.thBonus}>العلاوات (+)</th>
                      <th className={styles.thPenalty}>الجزاءات (-)</th>
                      <th className={styles.thAdvance}>المسحوبات (-)</th>
                      <th className={styles.thNet}>الصافي المستحق</th>
                      <th className={styles.thCenter}>كشف الحساب</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((emp) => {
                      const summary = getMonthlySummaryForEmployee(emp.id, selectedMonth);
                      return (
                        <tr key={emp.id}>
                          <td>
                            <strong className={styles.empNameStrong}>{emp.name}</strong>
                            <span className={`num-font ${styles.empCodeSub}`}>كود: {emp.code}</span>
                          </td>
                          <td className={styles.thCenter}>
                            <span className={`num-font ${styles.hoursWorkedPill}`}>
                              {summary.hoursWorked}س و {summary.minutesWorked}د
                            </span>
                          </td>
                          <td className={`num-font ${styles.thLeftMuted}`}>
                            {formatCurrency(summary.baseSalary)}
                          </td>
                          <td className={`num-font ${styles.earnedSalaryVal}`}>
                            +{formatCurrency(summary.earnedSalary)}
                          </td>
                          <td className={`num-font ${styles.thCommission}`}>
                            <span className={styles.commissionVal}>
                              +{formatCurrency(summary.totalCommission)}
                            </span>
                          </td>
                          <td className={`num-font ${styles.bonusVal}`}>
                            +{formatCurrency(summary.totalBonus)}
                          </td>
                          <td className={`num-font ${styles.penaltyVal}`}>
                            -{formatCurrency(summary.totalPenalty)}
                          </td>
                          <td className={`num-font ${styles.advanceVal}`}>
                            -{formatCurrency(summary.totalAdvance)}
                          </td>
                          <td className={styles.thNet}>
                            <span className={`num-font ${styles.netSalaryVal}`}>
                              {formatCurrency(summary.netSalary)}
                            </span>
                          </td>
                          <td className={styles.thCenter}>
                            <button
                              onClick={() => handleOpenPayslip(emp)}
                              className={`btn-secondary ${styles.payslipIconBtn}`}
                              title="عرض كشف الحساب"
                            >
                              <FileText size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: TRANSACTIONS AUDIT */}
          {activeTab === "transactions" && (
            <div className={`glass-panel ${styles.tabSectionPanel}`}>
              <div className={styles.sectionHeaderRow}>
                <h3 className={styles.sectionTitle}>
                  سجل الحركات المالية (العلاوات، الجزاءات، المسحوبات والعمولات)
                </h3>
                <span className={`num-font ${styles.sectionSubCount}`}>
                  {transactions.filter((t) => (t.date || "").startsWith(selectedMonth)).length} حركة
                </span>
              </div>

              <div className={styles.tableScrollWrap}>
                <table className={`data-table ${styles.fullDataTable}`}>
                  <thead>
                    <tr>
                      <th>التاريخ</th>
                      <th>الموظف</th>
                      <th>نوع الحركة</th>
                      <th>البيان / الملاحظات</th>
                      <th className={styles.thLeft}>المبلغ</th>
                      <th className={styles.thCenter}>إجراء</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions
                      .filter((t) => (t.date || "").startsWith(selectedMonth))
                      .map((tx) => {
                        const isBonus = tx.type === "bonus";
                        const isCommission = tx.type === "commission";
                        const isPenalty = tx.type === "penalty";
                        const isAdvance = tx.type === "advance";

                        const badgeClass = isBonus 
                          ? styles.txBadgeBonus 
                          : isCommission 
                          ? styles.txBadgeCommission 
                          : isPenalty 
                          ? styles.txBadgePenalty 
                          : isAdvance 
                          ? styles.txBadgeAdvance 
                          : styles.txBadgeGeneric;

                        const label = isBonus 
                          ? "علاوة / مكافأة" 
                          : isCommission 
                          ? "عمولة مبيعات" 
                          : isPenalty 
                          ? "جزاء / خصم" 
                          : isAdvance 
                          ? "سلفة / مسحوبات" 
                          : tx.type;

                        const amountClass = isBonus 
                          ? styles.txAmountGreen 
                          : isCommission 
                          ? styles.txAmountBlue 
                          : isPenalty 
                          ? styles.txAmountRed 
                          : isAdvance 
                          ? styles.txAmountAmber 
                          : styles.txAmountGeneric;

                        return (
                          <tr key={tx.id}>
                            <td className={`num-font ${styles.dateCol}`}>
                              <span className={styles.dateBadge}>
                                {tx.date}
                              </span>
                            </td>
                            <td className={styles.empNameBold}>{tx.employeeName}</td>
                            <td>
                              <span className={badgeClass}>
                                {label}
                              </span>
                            </td>
                            <td className={styles.txNotes}>{tx.notes || "---"}</td>
                            <td className={`num-font ${amountClass} ${styles.thLeft}`}>
                              {isBonus || isCommission ? "+" : "-"}
                              {formatCurrency(tx.amount)}
                            </td>
                            <td className={styles.thCenter}>
                              <button
                                onClick={() => handleDeleteTransaction(tx.id)}
                                className={styles.iconBtnRed}
                                title="حذف الحركة"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    {transactions.filter((t) => (t.date || "").startsWith(selectedMonth)).length === 0 && (
                      <tr>
                        <td colSpan={6} className={styles.emptyTableTd}>
                          لا توجد حركات مالية مسجلة لهذا الشهر
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>

        {/* Modals placed outside page-wrapper so print media queries do not hide them */}
        <EmployeeModal
          isOpen={isEmployeeModalOpen}
          onClose={() => setIsEmployeeModalOpen(false)}
          employee={editingEmployee}
          onSaved={() => {}}
        />

        <EmployeeTransactionModal
          isOpen={isTransactionModalOpen}
          onClose={() => {
            setIsTransactionModalOpen(false);
            setTransactionTargetEmployee(null);
          }}
          employee={transactionTargetEmployee}
          onSaved={() => {}}
        />

        <EmployeePayslipModal
          isOpen={isPayslipModalOpen}
          onClose={() => {
            setIsPayslipModalOpen(false);
            setPayslipEmployee(null);
            setPayslipData(null);
          }}
          employee={payslipEmployee}
          monthSummary={payslipData}
        />

        <EmployeeBarcodeModal
          isOpen={isBarcodeModalOpen}
          onClose={() => {
            setIsBarcodeModalOpen(false);
            setBarcodeEmployee(null);
          }}
          employee={barcodeEmployee}
        />
      </div>
    </div>
  );
}

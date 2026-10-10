// employeesService.js — Employees, Attendance & Payroll Service Layer Connected to FastAPI & SQLite
import { api } from "./apiClient";
import { roundCurrency, getLocalDateString, getLocalMonthString } from "./utils";

function normalizeEmployee(e) {
  if (!e) return e;
  return {
    ...e,
    id: e.id,
    local_id: e.id,
    name: e.name,
    code: e.code || "",
    phone: e.phone || "",
    role: e.role || "موظف مبيعات",
    baseSalary: roundCurrency(Number(e.baseSalary !== undefined ? e.baseSalary : (e.base_salary || 0))),
    commissionRate: e.commissionRate !== undefined ? Number(e.commissionRate) : (e.commission_rate !== undefined ? Number(e.commission_rate) : 0.01),
    status: e.status || "active",
    notes: e.notes || "",
    hireDate: e.hireDate || e.joinDate || e.createdAt?.slice(0, 10),
    joinDate: e.joinDate || e.hireDate || e.createdAt?.slice(0, 10),
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  };
}

function normalizeAttendance(a) {
  if (!a) return a;
  return {
    ...a,
    id: a.id,
    local_id: a.id,
    employeeId: a.employeeId || a.employee_id,
    employeeName: a.employeeName || a.employee_name,
    employeeCode: a.employeeCode || a.employee_code || "",
    date: a.date || a.createdAt?.slice(0, 10),
    checkIn: a.checkIn || a.check_in,
    checkOut: a.checkOut || a.check_out,
    durationMinutes: Number(a.durationMinutes !== undefined ? a.durationMinutes : (a.duration_minutes || 0)),
    status: a.status || "attended",
    notes: a.notes || "",
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  };
}

function normalizeEmployeeTx(t) {
  if (!t) return t;
  let createdByUser = t.createdByUser || t.createdBy;
  if (typeof createdByUser === "string") {
    try { createdByUser = JSON.parse(createdByUser); } catch (_) { createdByUser = {}; }
  }

  return {
    ...t,
    id: t.id,
    local_id: t.id,
    employeeId: t.employeeId || t.employee_id,
    employeeName: t.employeeName || t.employee_name,
    type: t.type || "advance",
    amount: roundCurrency(Number(t.amount || 0)),
    date: t.date || t.createdAt?.slice(0, 10),
    month: t.month || t.monthStr || t.createdAt?.slice(0, 7),
    monthStr: t.monthStr || t.month || t.createdAt?.slice(0, 7),
    invoiceNumber: t.invoiceNumber || "",
    notes: t.notes || "",
    createdByUser,
    createdAt: t.createdAt,
  };
}

// 1. Directory
export function subscribeToEmployees(onData, onError) {
  return api.subscribe(
    async () => {
      const list = await api.get("/employees");
      return Array.isArray(list) ? list.map(normalizeEmployee) : [];
    },
    onData,
    onError
  );
}

export async function addEmployee(employeeData) {
  const code = (employeeData.code ? String(employeeData.code).trim() : "").toUpperCase();
  const name = employeeData.name ? employeeData.name.trim() : "";

  if (!name) throw new Error("اسم الموظف مطلوب.");
  if (!code) throw new Error("كود الموظف مطلوب للتعرف عليه وتسجيل البصمة.");

  const payload = {
    name,
    code,
    phone: employeeData.phone ? employeeData.phone.trim() : "",
    role: employeeData.role ? employeeData.role.trim() : "بائع",
    baseSalary: Math.max(0, roundCurrency(parseFloat(employeeData.baseSalary) || 0)),
    commissionRate: employeeData.commissionRate !== undefined ? Math.max(0, parseFloat(employeeData.commissionRate) || 0) : 0.01,
    status: employeeData.status || "active",
    notes: employeeData.notes ? employeeData.notes.trim() : "",
    hireDate: employeeData.hireDate || new Date().toISOString().split("T")[0],
  };

  const res = await api.post("/employees", payload);
  return normalizeEmployee(res);
}

export async function updateEmployee(id, updates) {
  const res = await api.put(`/employees/${id}`, updates);
  return normalizeEmployee(res);
}

export async function deleteEmployee(id) {
  return api.delete(`/employees/${id}`);
}

// 2. Attendance
export function subscribeToAttendance(onData, onError) {
  return api.subscribe(
    async () => {
      const list = await api.get("/employees/attendance?limit=500");
      return Array.isArray(list) ? list.map(normalizeAttendance) : [];
    },
    onData,
    onError
  );
}

export function subscribeToTodayAttendance(onData, onError) {
  const todayStr = getLocalDateString();
  return api.subscribe(
    async () => {
      const list = await api.get("/employees/attendance?limit=500");
      if (!Array.isArray(list)) return [];
      const filtered = list.filter((d) => {
        const recDate = d.date || (d.checkIn ? getLocalDateString(d.checkIn) : "");
        return recDate === todayStr || d.status === "in_progress";
      });
      return filtered.map(normalizeAttendance);
    },
    onData,
    onError
  );
}

export async function punchEmployeeAttendance(inputCode, notes = "") {
  const code = String(inputCode || "").trim().toUpperCase();
  if (!code) throw new Error("يرجى إدخال أو مسح كود الموظف.");

  const empList = await api.get("/employees");
  const employee = Array.isArray(empList) 
    ? empList.find((e) => (e.code || "").trim().toUpperCase() === code || e.id === code) 
    : null;
  if (!employee) {
    throw new Error(`كود الموظف "${code}" غير مسجل في النظام.`);
  }

  return executePunchForEmployee(employee, notes);
}

export async function punchEmployeeById(employeeId, notes = "") {
  if (!employeeId) throw new Error("معرف الموظف مطلوب.");
  const empList = await api.get("/employees");
  const employee = Array.isArray(empList) ? empList.find((e) => e.id === employeeId) : null;
  if (!employee) {
    throw new Error("الموظف غير مسجل في النظام.");
  }

  return executePunchForEmployee(employee, notes);
}

async function executePunchForEmployee(employee, notes = "") {
  if (employee.status === "inactive") {
    throw new Error(`الموظف "${employee.name}" حسابه معطل حالياً.`);
  }

  const now = new Date();
  const todayStr = getLocalDateString(now);
  const nowIso = now.toISOString();

  // Check active in_progress session
  const attList = await api.get(`/employees/attendance?employee_id=${employee.id}&limit=50`);
  const activeAtt = Array.isArray(attList) ? attList.find((d) => d.status === "in_progress") : null;

  if (activeAtt) {
    // Check out
    const checkInTime = new Date(activeAtt.checkIn);
    const diffMs = Math.max(0, now.getTime() - checkInTime.getTime());
    const durationMinutes = Math.max(1, Math.round(diffMs / (1000 * 60)));
    const durationHours = (durationMinutes / 60).toFixed(2);
    const durationText = `${Math.floor(durationMinutes / 60)} ساعة و ${durationMinutes % 60} دقيقة`;

    await api.put(`/employees/attendance/${activeAtt.id}`, {
      checkOut: nowIso,
      durationMinutes,
      status: "completed",
      notes: notes ? `${activeAtt.notes || ""} | ${notes}` : activeAtt.notes || "",
    });

    return {
      action: "check_out",
      employee,
      employeeName: employee.name,
      checkIn: activeAtt.checkIn,
      checkOut: nowIso,
      durationMinutes,
      durationHours,
      durationText,
      message: `تم تسجيل انصراف الموظف "${employee.name}" بنجاح. مدة الوردية: ${durationText}.`
    };
  } else {
    // Check in
    const res = await api.post("/employees/attendance", {
      employeeId: employee.id,
      employeeCode: employee.code || "",
      employeeName: employee.name,
      date: todayStr,
      checkIn: nowIso,
      checkOut: null,
      durationMinutes: 0,
      status: "in_progress",
      notes: notes.trim() || "تسجيل حضور إلكتروني",
    });

    return {
      action: "check_in",
      id: res.id,
      employee,
      employeeName: employee.name,
      checkIn: nowIso,
      message: `تم تسجيل حضور الموظف "${employee.name}" بنجاح في تمام الساعة ${now.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}.`
    };
  }
}

export async function manualCompleteAttendance(id, checkOutTime = null, notes = "") {
  const now = new Date();
  const outTime = checkOutTime || now.toISOString();
  
  return api.put(`/employees/attendance/${id}`, {
    checkOut: outTime,
    status: "completed",
    notes: notes ? `إنهاء يدوي من الإدارة | ${notes}` : "إنهاء يدوي من الإدارة"
  });
}

// 3. Transactions & Payroll
export function subscribeToEmployeeTransactions(onData, onError) {
  return api.subscribe(
    async () => {
      const list = await api.get("/employees/transactions?limit=1000");
      return Array.isArray(list) ? list.map(normalizeEmployeeTx) : [];
    },
    onData,
    onError
  );
}

export async function addEmployeeTransaction({
  employeeId,
  employeeName,
  type,
  amount,
  date = null,
  month = null,
  invoiceNumber = null,
  notes = "",
  createdByUser = null
}) {
  const amt = roundCurrency(parseFloat(amount) || 0);
  if (amt <= 0) throw new Error("المبلغ يجب أن يكون أكبر من صفر.");
  if (!employeeId) throw new Error("يرجى اختيار الموظف.");

  const txDate = date || new Date().toISOString();
  const txMonth = month || getLocalMonthString(txDate);

  const payload = {
    employeeId,
    employeeName: employeeName || "موظف",
    type,
    amount: amt,
    date: txDate,
    month: txMonth,
    monthStr: txMonth,
    invoiceNumber: invoiceNumber || null,
    notes: notes ? notes.trim() : "",
    createdByUser: createdByUser ? {
      uid: createdByUser.uid || null,
      name: createdByUser.displayName || createdByUser.email || "المشرف"
    } : null,
  };

  const res = await api.post("/employees/transactions", payload);
  return normalizeEmployeeTx(res);
}

export async function deleteEmployeeTransaction(id) {
  return api.delete(`/employees/transactions/${id}`);
}

export async function recordSaleCommission(employee, invoiceNumber, saleTotal, commissionRate = 0.01) {
  if (!employee || !employee.id) return null;

  const total = roundCurrency(parseFloat(saleTotal) || 0);
  if (total <= 0) return null;

  const rate = employee.commissionRate !== undefined ? Number(employee.commissionRate) : commissionRate;
  const commissionAmount = roundCurrency(total * rate);

  if (commissionAmount <= 0) return null;

  try {
    return await addEmployeeTransaction({
      employeeId: employee.id,
      employeeName: employee.name || "موظف مبيعات",
      type: "commission",
      amount: commissionAmount,
      invoiceNumber,
      notes: `عمولة مبيعات بنسبة ${(rate * 100).toFixed(1)}% من الفاتورة #${invoiceNumber}`
    });
  } catch (err) {
    console.error("recordSaleCommission error:", err);
    return null;
  }
}

export async function reverseSaleCommission(employee, invoiceNumber, returnNumber, returnedTotal, commissionRate = 0.01) {
  if (!employee || !employee.id) return null;

  const total = roundCurrency(parseFloat(returnedTotal) || 0);
  if (total <= 0) return null;

  const rate = employee.commissionRate !== undefined ? Number(employee.commissionRate) : commissionRate;
  const reversalAmount = roundCurrency(total * rate);

  if (reversalAmount <= 0) return null;

  try {
    return await addEmployeeTransaction({
      employeeId: employee.id,
      employeeName: employee.name || "موظف مبيعات",
      type: "penalty",
      amount: reversalAmount,
      invoiceNumber,
      notes: `خصم عكس عمولة مبيعات بسبب مرتجع #${returnNumber || ""} من الفاتورة #${invoiceNumber || ""}`
    });
  } catch (err) {
    console.error("reverseSaleCommission error:", err);
    return null;
  }
}

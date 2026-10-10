// expensesService.js — Expense Items & Monthly Expenses Service Layer Connected to FastAPI & SQLite
import { api } from "./apiClient";
import { roundCurrency, getLocalMonthString } from "./utils";

// ==========================================
// 1. Master Expense Line Items
// ==========================================

export function subscribeToExpenseItems(onData, onError) {
  return api.subscribe(
    async () => {
      const list = await api.get("/expenses/items");
      return Array.isArray(list) ? list : [];
    },
    onData,
    onError
  );
}

export async function addExpenseItem(name, notes = "") {
  const trimmed = name ? name.trim() : "";
  if (!trimmed) throw new Error("اسم البند مطلوب");
  return api.post("/expenses/items", { name: trimmed, notes: notes ? notes.trim() : "" });
}

export async function updateExpenseItem(id, updates) {
  return api.put(`/expenses/items/${id}`, updates);
}

export async function deleteExpenseItem(id) {
  return api.delete(`/expenses/items/${id}`);
}

// ==========================================
// 2. Monthly Expenses Ledger
// ==========================================

export function subscribeToAllMonthlyExpenses(onData, onError) {
  return api.subscribe(
    async () => {
      const list = await api.get("/expenses/monthly");
      if (!Array.isArray(list)) return [];
      return list.map((doc) => {
        let txs = doc.transactions || doc.expenses;
        if (typeof txs === "string") {
          try { txs = JSON.parse(txs); } catch (_) { txs = []; }
        }
        if (!Array.isArray(txs)) txs = [];
        return {
          ...doc,
          amount: roundCurrency(Number(doc.amount || 0)),
          transactions: txs,
          expenses: txs,
        };
      });
    },
    onData,
    onError
  );
}

export function subscribeToMonthlyExpenses(monthStr, onData, onError) {
  const currentMonth = monthStr || getLocalMonthString();

  return api.subscribe(
    async () => {
      const list = await api.get(`/expenses/monthly?month=${currentMonth}`);
      const map = {};
      if (Array.isArray(list)) {
        list.forEach((doc) => {
          let txs = doc.transactions || doc.expenses;
          if (typeof txs === "string") {
            try { txs = JSON.parse(txs); } catch (_) { txs = []; }
          }
          if (!Array.isArray(txs)) txs = [];

          map[doc.itemId || doc.item_id || doc.id] = {
            ...doc,
            amount: roundCurrency(Number(doc.amount || 0)),
            transactions: txs,
            expenses: txs,
          };
        });
      }
      return map;
    },
    onData,
    onError
  );
}

/** Today in Cairo as YYYY-MM-DD (the device clock's UTC date is the day before between midnight and 2-3 AM). */
const cairoToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(new Date());

// One payment, appended by the backend in one step (no read-modify-write of the whole month record).
export async function addAmountToExpenseItem(month, itemId, itemName, addAmount, notes = "", method = "نقدي", customDate = null) {
  const inc = roundCurrency(parseFloat(addAmount) || 0);
  if (inc <= 0) throw new Error("المبلغ يجب أن يكون أكبر من صفر");
  const today = cairoToday();
  const txDate = customDate || (today.startsWith(month) ? today : `${month}-01`);
  const res = await api.post("/expenses/monthly/transactions", {
    month, itemId, itemName: itemName || "بند مصروف", amount: inc, date: txDate,
    notes: (notes || "").trim() || "إضافة مصروف", method: method || "نقدي",
  });
  if (!res || res.success === false) throw new Error(res?.error || "تعذر تسجيل المصروف");
  return { success: true, newAmount: res.newAmount };
}

export async function deleteMonthlyTransaction(month, itemId, transactionId) {
  const res = await api.delete(`/expenses/monthly/${encodeURIComponent(month)}/${encodeURIComponent(itemId)}/transactions/${encodeURIComponent(transactionId)}`);
  if (!res || res.success === false) throw new Error(res?.error || "تعذر حذف الدفعة");
  return { success: true, newAmount: res.newAmount };
}

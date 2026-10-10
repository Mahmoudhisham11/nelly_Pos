// suppliersService.js — Suppliers Service Layer Connected to FastAPI & SQLite
import { api, unwrap } from "./apiClient";
import { roundCurrency } from "./utils";

function normalizeSupplier(s) {
  if (!s) return s;
  let txs = s.transactions;
  if (typeof txs === "string") {
    try { txs = JSON.parse(txs); } catch (_) { txs = []; }
  }
  if (!Array.isArray(txs)) txs = [];

  const balance = Number(s.balance !== undefined ? s.balance : (s.currentBalance || s.current_balance || 0));

  return {
    ...s,
    id: s.id,
    local_id: s.id,
    name: s.name,
    phone: s.phone || "",
    address: s.address || "",
    balance,
    currentBalance: balance,
    transactions: txs,
    notes: s.notes || "",
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}

export function subscribeToSuppliers(onData, onError) {
  return api.subscribe(
    async () => {
      const list = await api.get("/suppliers?limit=1000");
      return Array.isArray(list) ? list.map(normalizeSupplier) : [];
    },
    onData,
    onError
  );
}

export async function addSupplier(supplierData) {
  const initialBalance = roundCurrency(parseFloat(supplierData.balance) || 0);
  const initialTransactions = [];
  if (initialBalance !== 0) {
    initialTransactions.push({
      id: `tx_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      date: new Date().toISOString(),
      type: "رصيد افتتاحي",
      amount: Math.abs(initialBalance),
      previousBalance: 0,
      newBalance: initialBalance,
      notes: initialBalance > 0 ? "تسجيل رصيد افتتاحي (مستحق للمورد)" : "تسجيل رصيد افتتاحي (مستحق على المورد)",
      method: "رصيد افتتاحي"
    });
  }

  const payload = {
    name: supplierData.name ? supplierData.name.trim() : "مورد جديد",
    phone: supplierData.phone ? supplierData.phone.trim() : "",
    address: supplierData.address ? supplierData.address.trim() : "",
    balance: initialBalance,
    notes: supplierData.notes ? supplierData.notes.trim() : "",
    transactions: initialTransactions,
  };

  const res = unwrap(await api.post("/suppliers", payload));
  return normalizeSupplier(res);
}

export async function updateSupplier(id, updates) {
  const supp = await api.get(`/suppliers/${id}`);
  const currentBal = roundCurrency(Number(supp.balance || 0));

  let txs = supp.transactions;
  if (typeof txs === "string") {
    try { txs = JSON.parse(txs); } catch (_) { txs = []; }
  }
  if (!Array.isArray(txs)) txs = [];

  const payload = { ...updates };

  if (updates.balance !== undefined) {
    const newBal = roundCurrency(parseFloat(updates.balance) || 0);
    if (newBal !== currentBal) {
      const diff = roundCurrency(newBal - currentBal);
      const adjustmentTx = {
        id: `tx_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        date: new Date().toISOString(),
        type: "تعديل رصيد يدوي",
        amount: Math.abs(diff),
        previousBalance: currentBal,
        newBalance: newBal,
        notes: updates.adjustmentNotes?.trim() || `تعديل يدوي للرصيد من ${currentBal} إلى ${newBal} ج.م`,
        method: "تعديل يدوي"
      };
      txs.push(adjustmentTx);
      payload.balance = newBal;
      payload.transactions = txs;
    }
  }

  const res = unwrap(await api.put(`/suppliers/${id}`, payload));
  return normalizeSupplier(res);
}

export async function makeSupplierPayment(
  supplierId,
  _currentBalance,
  paymentAmount,
  paymentNotes = "",
  paymentMethod = "نقدي",
  transactionType = "payment"
) {
  const amount = Math.abs(parseFloat(paymentAmount) || 0);
  if (amount <= 0) {
    throw new Error("المبلغ يجب أن يكون أكبر من صفر");
  }

  const res = unwrap(
    await api.post(`/suppliers/${supplierId}/payments`, {
      amount,
      notes: (paymentNotes || "").trim(),
      method: paymentMethod || "نقدي",
      type: transactionType === "charge" ? "charge" : "payment",
    })
  );
  return { success: true, newBalance: res.newBalance };
}

export async function deleteSupplierTransaction(supplierId, transactionId) {
  const res = await api.delete(`/suppliers/${supplierId}/transactions/${encodeURIComponent(transactionId)}`);
  if (!res || res.success === false) throw new Error(res?.error || "تعذر حذف الحركة");
  return { success: true, newBalance: res.newBalance };
}

export async function deleteSupplier(id) {
  return api.delete(`/suppliers/${id}`);
}

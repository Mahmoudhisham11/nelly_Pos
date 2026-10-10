// customersService.js — Customers Service Layer Connected to FastAPI & SQLite
import { api, unwrap } from "./apiClient";
import { roundCurrency } from "./utils";

function normalizeCustomer(c) {
  if (!c) return c;
  let txs = c.transactions;
  if (typeof txs === "string") {
    try { txs = JSON.parse(txs); } catch (_) { txs = []; }
  }
  if (!Array.isArray(txs)) txs = [];

  const balance = Number(c.balance !== undefined ? c.balance : (c.remainingBalance || c.remaining_balance || 0));

  return {
    ...c,
    id: c.id,
    local_id: c.id,
    name: c.name,
    phone: c.phone || "",
    address: c.address || "",
    type: c.type || "قطاعي",
    balance,
    remainingBalance: balance,
    totalPurchases: Number(c.totalPurchases || c.total_purchases || 0),
    totalPaid: Number(c.totalPaid || c.total_paid || 0),
    transactions: txs,
    notes: c.notes || "",
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

export function subscribeToCustomers(onData, onError) {
  return api.subscribe(
    async () => {
      const list = await api.get("/customers?limit=1000");
      return Array.isArray(list) ? list.map(normalizeCustomer) : [];
    },
    onData,
    onError
  );
}

export async function addCustomer(customerData) {
  const initialBalance = roundCurrency(parseFloat(customerData.balance) || 0);
  const initialTransactions = [];
  if (initialBalance !== 0) {
    initialTransactions.push({
      id: `ctx_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      date: new Date().toISOString(),
      type: "رصيد افتتاحي",
      amount: Math.abs(initialBalance),
      previousBalance: 0,
      newBalance: initialBalance,
      notes: initialBalance > 0 ? "رصيد مديونية سابقة مستحقة على العميل" : "رصيد دفع مسبق للعميل",
      method: "رصيد افتتاحي"
    });
  }

  const payload = {
    name: customerData.name ? customerData.name.trim() : "عميل جديد",
    phone: customerData.phone ? customerData.phone.trim() : "",
    address: customerData.address ? customerData.address.trim() : "",
    type: customerData.type || "قطاعي",
    balance: initialBalance,
    totalPurchases: 0,
    notes: customerData.notes ? customerData.notes.trim() : "",
    transactions: initialTransactions,
  };

  const res = unwrap(await api.post("/customers", payload));
  return normalizeCustomer(res);
}

export async function updateCustomer(id, updates) {
  const res = unwrap(await api.put(`/customers/${id}`, updates));
  return normalizeCustomer(res);
}

export async function recordCustomerPayment(
  customerId,
  _currentBalance,
  paymentAmount,
  paymentNotes = "",
  paymentMethod = "نقدي"
) {
  const amount = Math.abs(parseFloat(paymentAmount) || 0);
  if (amount <= 0) {
    throw new Error("المبلغ يجب أن يكون أكبر من صفر");
  }

  // Balance, totals and the ledger line are updated together on the server (no read-modify-write race).
  const res = unwrap(
    await api.post(`/customers/${customerId}/payments`, {
      amount,
      notes: (paymentNotes || "").trim(),
      method: paymentMethod || "نقدي",
    })
  );
  return { success: true, newBalance: res.newBalance };
}

export async function deleteCustomer(id) {
  return api.delete(`/customers/${id}`);
}

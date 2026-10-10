// treasuryService.js — Treasury Transactions Connected to FastAPI & SQLite
import { api, unwrap } from "./apiClient";
import { roundCurrency } from "./utils";

function normalizeTreasuryTransaction(t) {
  if (!t) return t;
  let createdBy = t.createdBy || t.created_by;
  if (typeof createdBy === "string") {
    try { createdBy = JSON.parse(createdBy); } catch (_) { createdBy = {}; }
  }

  return {
    ...t,
    id: t.id,
    local_id: t.id,
    type: t.type || "إيداع",
    amount: roundCurrency(Number(t.amount || 0)),
    category: t.category || "حركة خزنة",
    description: t.description || t.notes || "",
    fromMethod: t.fromMethod || t.from_method || "نقدي",
    toMethod: t.toMethod || t.to_method || null,
    source: t.source || "",
    destination: t.destination || "",
    dateStr: t.dateStr || t.date_str || t.date || t.createdAt?.slice(0, 10),
    date: t.date || t.dateStr || t.createdAt?.slice(0, 10),
    notes: t.notes || "",
    createdBy,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

export function subscribeToTreasuryTransactions(onData, onError) {
  return api.subscribe(
    async () => {
      const list = await api.get("/treasury/transactions?limit=500");
      return Array.isArray(list) ? list.map(normalizeTreasuryTransaction) : [];
    },
    onData,
    onError
  );
}

export async function recordTreasuryTransaction(txData) {
  const {
    type = "إيداع",
    amount = 0,
    fromMethod = "نقدي",
    toMethod = null,
    category = "عام",
    notes = "",
    date = null,
    createdBy = null
  } = txData;

  const parsedAmount = roundCurrency(parseFloat(amount) || 0);
  if (parsedAmount <= 0) {
    throw new Error("المبلغ يجب أن يكون أكبر من صفر");
  }

  const txDate = date || new Date().toISOString();

  const payload = {
    type,
    amount: parsedAmount,
    fromMethod,
    toMethod: type === "تحويل" ? toMethod : null,
    category: category.trim() || "حركة خزنة",
    notes: notes.trim(),
    date: txDate,
    dateStr: txDate.slice(0, 10),
    createdBy: createdBy ? {
      uid: createdBy.uid || null,
      name: createdBy.displayName || createdBy.name || createdBy.email || "المسؤول",
      email: createdBy.email || ""
    } : null,
  };

  const res = unwrap(await api.post("/treasury/transactions", payload));
  return {
    success: true,
    id: res.id,
    transaction: normalizeTreasuryTransaction(res)
  };
}

export async function deleteTreasuryTransaction(id) {
  if (!id) throw new Error("معرف الحركة مطلوب لحذفها");
  await api.delete(`/treasury/transactions/${id}`);
  return { success: true };
}

// shopPurchasesService.js — Supplier Purchases & Purchase Returns Connected to FastAPI & SQLite
import { api, unwrap } from "./apiClient";
import { roundCurrency } from "./utils";

function normalizePurchase(p) {
  if (!p) return p;
  let items = p.items;
  if (typeof items === "string") {
    try { items = JSON.parse(items); } catch (_) { items = []; }
  }
  if (!Array.isArray(items)) items = [];

  let supplier = p.supplier;
  if (typeof supplier === "string") {
    try { supplier = JSON.parse(supplier); } catch (_) { supplier = {}; }
  }

  let createdBy = p.createdBy || p.created_by;
  if (typeof createdBy === "string") {
    try { createdBy = JSON.parse(createdBy); } catch (_) { createdBy = {}; }
  }

  const totalCost = Number(p.totalCost !== undefined ? p.totalCost : (p.totalAmount || p.total_amount || 0));
  const paidAmount = Number(p.paidAmount !== undefined ? p.paidAmount : (p.paid_amount || 0));
  const remainingDue = Number(p.remainingDue !== undefined ? p.remainingDue : (p.remaining_due || Math.max(0, totalCost - paidAmount)));

  return {
    ...p,
    id: p.id,
    local_id: p.id,
    invoiceNumber: p.invoiceNumber || p.invoice_number,
    supplier,
    items,
    itemsCount: items.length,
    totalCost,
    totalAmount: totalCost,
    paidAmount,
    remainingDue,
    paymentMethod: p.paymentMethod || p.payment_method || "نقدي",
    status: p.status || "COMPLETED",
    notes: p.notes || "",
    createdBy,
    date: p.date || p.createdAt?.slice(0, 10),
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

function normalizePurchaseReturn(pr) {
  if (!pr) return pr;
  let returnedItems = pr.returnedItems || pr.itemsToReturn || pr.items_to_return;
  if (typeof returnedItems === "string") {
    try { returnedItems = JSON.parse(returnedItems); } catch (_) { returnedItems = []; }
  }
  if (!Array.isArray(returnedItems)) returnedItems = [];

  let supplier = pr.supplier;
  if (typeof supplier === "string") {
    try { supplier = JSON.parse(supplier); } catch (_) { supplier = {}; }
  }

  return {
    ...pr,
    id: pr.id,
    local_id: pr.id,
    returnNumber: pr.returnNumber || pr.return_number,
    invoiceId: pr.invoiceId || pr.invoice_id,
    supplier,
    returnedItems,
    itemsToReturn: returnedItems,
    totalRefund: Number(pr.totalRefund !== undefined ? pr.totalRefund : (pr.total_refund || 0)),
    returnReason: pr.returnReason || pr.return_reason || "",
    deleteIfZero: Boolean(pr.deleteIfZero || pr.delete_if_zero),
    createdAt: pr.createdAt,
    updatedAt: pr.updatedAt,
  };
}

export function subscribeToShopPurchases(onData, onError) {
  return api.subscribe(
    async () => {
      const list = await api.get("/shop/purchases");
      return Array.isArray(list) ? list.map(normalizePurchase) : [];
    },
    onData,
    onError
  );
}

export async function createShopPurchaseInvoice(invoicePayload) {
  const res = unwrap(await api.post("/shop/purchases", invoicePayload));
  return normalizePurchase(res);
}

export async function returnShopPurchaseItems(returnPayload) {
  const res = unwrap(await api.post("/shop/purchase-returns", returnPayload));
  return normalizePurchaseReturn(res);
}

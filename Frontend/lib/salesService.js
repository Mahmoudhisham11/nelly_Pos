// salesService.js — Sales, Reports & Returns Service Layer Connected to FastAPI & Unified SQLite
import { api, unwrap } from "./apiClient";
import { roundCurrency, getLocalDateString } from "./utils";

function normalizeSale(s) {
  if (!s) return s;
  const total = Number(s.total || s.total_amount || 0);
  const paid = Number(s.paidAmount !== undefined ? s.paidAmount : (s.paid_amount || total));
  const subtotal = Number(s.subtotal !== undefined ? s.subtotal : (s.subtotal_amount || total));
  const discount = Number(s.discount !== undefined ? s.discount : (s.discount_amount || 0));
  const totalCost = Number(s.totalCost !== undefined ? s.totalCost : (s.total_cost || 0));
  const totalProfit = Number(s.totalProfit !== undefined ? s.totalProfit : (s.total_profit || Math.max(0, total - totalCost)));

  let items = s.items;
  if (typeof items === "string") {
    try { items = JSON.parse(items); } catch (_) { items = []; }
  }
  if (!Array.isArray(items)) items = [];

  let customer = s.customer;
  if (typeof customer === "string") {
    try { customer = JSON.parse(customer); } catch (_) { customer = { name: s.customerName || "عميل نقدي" }; }
  }

  let cashier = s.cashier;
  if (typeof cashier === "string") {
    try { cashier = JSON.parse(cashier); } catch (_) { cashier = {}; }
  }

  let seller = s.sellerEmployee;
  if (typeof seller === "string") {
    try { seller = JSON.parse(seller); } catch (_) { seller = {}; }
  }

  return {
    ...s,
    id: s.id,
    local_id: s.id,
    invoiceNumber: s.invoiceNumber || s.invoice_number,
    invoice_number: s.invoiceNumber || s.invoice_number,
    customer,
    customerName: s.customerName || s.customer_name || customer?.name || "عميل نقدي",
    sellerEmployee: seller,
    cashier,
    paymentMethod: s.paymentMethod || s.payment_method || "نقدي",
    subtotal,
    discount,
    discountType: s.discountType || s.discount_type || "fixed",
    total,
    paidAmount: paid,
    remainingDue: Number(s.remainingDue !== undefined ? s.remainingDue : (s.remaining_due || 0)),
    changeDue: Number(s.changeDue !== undefined ? s.changeDue : (s.change_due || 0)),
    totalCost,
    totalProfit,
    items,
    itemsCount: items.length,
    notes: s.notes || "",
    status: s.status || "مكتملة",
    date: s.date || s.createdAt?.slice(0, 10),
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}

function normalizeReport(r) {
  if (!r) return r;
  let invoices = r.invoices;
  if (typeof invoices === "string") {
    try { invoices = JSON.parse(invoices); } catch (_) { invoices = []; }
  }
  if (!Array.isArray(invoices)) invoices = [];

  let paymentBreakdown = r.paymentBreakdown || r.payment_breakdown;
  if (typeof paymentBreakdown === "string") {
    try { paymentBreakdown = JSON.parse(paymentBreakdown); } catch (_) { paymentBreakdown = {}; }
  }

  let closedBy = r.closedBy || r.closed_by;
  if (typeof closedBy === "string") {
    try { closedBy = JSON.parse(closedBy); } catch (_) { closedBy = {}; }
  }

  return {
    ...r,
    id: r.id,
    local_id: r.id,
    reportNumber: r.reportNumber || r.report_number,
    closedAt: r.closedAt || r.closed_at,
    closedBy,
    date: r.date || r.closedAt?.slice(0, 10),
    openingCash: Number(r.openingCash !== undefined ? r.openingCash : (r.opening_cash || 0)),
    closingCashActual: Number(r.closingCashActual !== undefined ? r.closingCashActual : (r.closing_cash_actual || 0)),
    closingCashExpected: Number(r.closingCashExpected !== undefined ? r.closingCashExpected : (r.closing_cash_expected || 0)),
    totalSales: Number(r.totalSales !== undefined ? r.totalSales : (r.total_sales || 0)),
    totalProfit: Number(r.totalProfit !== undefined ? r.totalProfit : (r.total_profit || 0)),
    totalCost: Number(r.totalCost !== undefined ? r.totalCost : (r.total_cost || 0)),
    totalPaid: Number(r.totalPaid !== undefined ? r.totalPaid : (r.total_paid || 0)),
    totalDiscount: Number(r.totalDiscount !== undefined ? r.totalDiscount : (r.total_discount || 0)),
    totalExpenses: Number(r.totalExpenses !== undefined ? r.totalExpenses : (r.total_expenses || 0)),
    totalPurchases: Number(r.totalPurchases !== undefined ? r.totalPurchases : (r.total_purchases || 0)),
    totalItemsSold: Number(r.totalItemsSold !== undefined ? r.totalItemsSold : (r.total_items_sold || 0)),
    invoicesCount: Number(r.invoicesCount !== undefined ? r.invoicesCount : (r.invoices_count || invoices.length)),
    invoices,
    paymentBreakdown,
    notes: r.notes || "",
    createdAt: r.createdAt || r.closedAt,
  };
}

function normalizeReturn(ret) {
  if (!ret) return ret;
  let returnedItems = ret.returnedItems || ret.returned_items;
  if (typeof returnedItems === "string") {
    try { returnedItems = JSON.parse(returnedItems); } catch (_) { returnedItems = []; }
  }
  if (!Array.isArray(returnedItems)) returnedItems = [];

  return {
    ...ret,
    id: ret.id,
    local_id: ret.id,
    returnNumber: ret.returnNumber || ret.return_number,
    invoiceNumber: ret.invoiceNumber || ret.invoice_number,
    invoiceId: ret.invoiceId || ret.invoice_id,
    refundedAmount: Number(ret.refundedAmount !== undefined ? ret.refundedAmount : (ret.refunded_amount || 0)),
    returnedItems,
    returnReason: ret.returnReason || ret.return_reason || "",
    date: ret.date || ret.createdAt?.slice(0, 10),
    createdAt: ret.createdAt,
  };
}

// Subscriptions
export function subscribeToSales(onData, onError) {
  return api.subscribe(
    async () => {
      const list = await api.get("/sales?limit=5000");
      return Array.isArray(list) ? list.map(normalizeSale) : [];
    },
    onData,
    onError
  );
}

export function subscribeToReports(onData, onError) {
  return api.subscribe(
    async () => {
      const list = await api.get("/reports?limit=500");
      return Array.isArray(list) ? list.map(normalizeReport) : [];
    },
    onData,
    onError
  );
}

// Generators
export function generateInvoiceNumber() {
  const now = new Date();
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const randomPart = Math.floor(100000 + Math.random() * 900000); // 6 digits: devices numbering offline at the same time practically never collide
  return `INV-${datePart}-${randomPart}`;
}

export function generateReturnNumber() {
  const now = new Date();
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const randomPart = Math.floor(100000 + Math.random() * 900000); // 6 digits: devices numbering offline at the same time practically never collide
  return `RET-${datePart}-${randomPart}`;
}

export function generateReportNumber() {
  const now = new Date();
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const timePart = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  const randomPart = Math.floor(100 + Math.random() * 900);
  return `REP-${datePart}-${timePart}-${randomPart}`;
}

// Create Sale Invoice
export async function createSaleInvoice(saleData) {
  const { 
    items = [], 
    customer = null, 
    discount = 0, 
    paymentMethod = "نقدي", 
    paidAmount = 0, 
    cashier = null, 
    sellerEmployee = null,
    notes = "" 
  } = saleData;

  if (!items || items.length === 0) {
    throw new Error("سلة المشتريات فارغة، يرجى إضافة صنف واحد على الأقل.");
  }

  let subtotal = 0;
  let totalCost = 0;
  const processedItems = [];

  for (const item of items) {
    const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
    const retail = roundCurrency(parseFloat(item.sellingPrice || item.price || 0) || 0);
    const cost = roundCurrency(parseFloat(item.wholesalePrice || item.costPrice || 0) || 0);
    const lineSubtotal = roundCurrency(qty * retail);
    const lineCost = roundCurrency(qty * cost);
    const lineProfit = roundCurrency(lineSubtotal - lineCost);

    subtotal += lineSubtotal;
    totalCost += lineCost;

    processedItems.push({
      productId: item.id || item.productId,
      barcode: item.barcode || "",
      name: item.name || "صنف ميكاب",
      category: item.category || "عام",
      quantity: qty,
      wholesalePrice: cost,
      costPrice: cost,
      sellingPrice: retail,
      subtotal: lineSubtotal,
      profit: lineProfit
    });
  }

  subtotal = roundCurrency(subtotal);
  totalCost = roundCurrency(totalCost);
  const discountVal = roundCurrency(Math.max(0, parseFloat(discount) || 0));

  if (totalCost > 0 && discountVal > 0 && (subtotal - discountVal) <= totalCost) {
    throw new Error(`ممنوع تطبيق هذا الخصم: لا يمكن أن يصل سعر البيع لسعر جملة البضاعة (${totalCost} ج.م) أو أقل منه.`);
  }

  const finalTotal = roundCurrency(Math.max(0, subtotal - discountVal));
  const totalProfit = roundCurrency(finalTotal - totalCost);

  const rawPaid = parseFloat(paidAmount);
  const effectivePaid = paymentMethod === "آجل" 
    ? (isNaN(rawPaid) ? 0 : roundCurrency(Math.max(0, rawPaid)))
    : (isNaN(rawPaid) ? finalTotal : roundCurrency(rawPaid));
  
  const changeDue = effectivePaid > finalTotal ? roundCurrency(effectivePaid - finalTotal) : 0;
  const remainingDue = finalTotal > effectivePaid ? roundCurrency(finalTotal - effectivePaid) : 0;
  const invoiceNumber = saleData.invoiceNumber || generateInvoiceNumber();

  const payload = {
    invoiceNumber,
    items: processedItems,
    itemsCount: processedItems.reduce((acc, curr) => acc + curr.quantity, 0),
    subtotal,
    discount: discountVal,
    total: finalTotal,
    paidAmount: effectivePaid,
    changeDue,
    remainingDue,
    paymentMethod,
    customer: customer ? {
      id: customer.id || null,
      name: customer.name || "عميل نقدي",
      phone: customer.phone || ""
    } : null,
    customerName: customer?.name || "عميل نقدي",
    cashier: cashier ? {
      uid: cashier.uid || cashier.id || null,
      name: cashier.displayName || cashier.name || "كاشير المحل",
      branch: cashier.branch || ""
    } : null,
    sellerEmployee: sellerEmployee ? {
      id: sellerEmployee.id,
      name: sellerEmployee.name || "بائع المحل",
      code: sellerEmployee.code || "",
      commission: roundCurrency(finalTotal * 0.01)
    } : null,
    totalCost,
    totalProfit,
    status: "مكتملة",
    notes: notes ? notes.trim() : "",
  };

  const res = unwrap(await api.post("/sales", payload));
  const normalized = normalizeSale(res);
  return {
    success: true,
    id: normalized.id,
    invoiceNumber: normalized.invoiceNumber,
    invoice: normalized
  };
}

// Close Shift
export async function closeShiftAndMoveToReports({ cashier, notes = "", openingCash = 0, closingCashActual = null } = {}) {
  const salesList = await api.get("/sales?limit=5000");
  if (!Array.isArray(salesList) || salesList.length === 0) {
    throw new Error("لا توجد فواتير مبيعات مسجلة في الوردية الحالية لتقفيلها.");
  }

  const invoices = salesList.map(normalizeSale);
  let totalSales = 0;
  let totalCost = 0;
  let totalProfit = 0;
  let totalDiscount = 0;
  let totalPaid = 0;
  let totalItemsSold = 0;
  const paymentBreakdown = { "نقدي": 0, "فيزا": 0, "تحويل": 0, "آجل": 0 };

  invoices.forEach((inv) => {
    totalSales += inv.total;
    totalCost += inv.totalCost;
    totalProfit += inv.totalProfit;
    totalDiscount += inv.discount;
    totalPaid += inv.paidAmount;

    const method = inv.paymentMethod || "نقدي";
    if (paymentBreakdown[method] !== undefined) {
      paymentBreakdown[method] += inv.total;
    } else {
      paymentBreakdown[method] = inv.total;
    }

    const itemsCount = (inv.items || []).reduce((acc, curr) => acc + (Number(curr.quantity) || 1), 0);
    totalItemsSold += itemsCount;
  });

  const reportNumber = generateReportNumber();
  const reportPayload = {
    reportNumber,
    closedBy: cashier ? {
      uid: cashier.uid || cashier.id || null,
      name: cashier.displayName || cashier.name || "كاشير المحل",
      email: cashier.email || ""
    } : { name: "كاشير المحل" },
    notes: notes ? notes.trim() : "",
    invoicesCount: invoices.length,
    totalItemsSold,
    totalSales: roundCurrency(totalSales),
    totalCost: roundCurrency(totalCost),
    totalProfit: roundCurrency(totalProfit),
    totalDiscount: roundCurrency(totalDiscount),
    totalPaid: roundCurrency(totalPaid),
    paymentBreakdown: Object.fromEntries(
      Object.entries(paymentBreakdown).map(([k, v]) => [k, roundCurrency(v)])
    ),
    invoices,
    // the drawer: expected cash is computed by the backend from the shift's money movements
    openingCash: roundCurrency(Number(openingCash) || 0),
    ...(closingCashActual !== null && closingCashActual !== undefined ? { closingCashActual: roundCurrency(Number(closingCashActual)) } : {}),
    clearSales: true
  };

  const res = unwrap(await api.post("/reports", reportPayload));
  const normalized = normalizeReport(res);

  return {
    success: true,
    reportId: normalized.id,
    reportNumber: normalized.reportNumber,
    invoicesCount: invoices.length,
    totalSales: roundCurrency(totalSales),
    totalProfit: roundCurrency(totalProfit)
  };
}

// Delete Report
export async function deleteReport(reportId) {
  return api.delete(`/reports/${reportId}`);
}

// Return Item or Invoice
export async function returnSaleItemOrInvoice({
  invoiceId,
  invoiceNumber,
  itemsToReturn = [],
  returnReason = "طلب العميل إرجاع البضاعة",
  cashier = null
}) {
  if (!itemsToReturn || itemsToReturn.length === 0) {
    throw new Error("يرجى تحديد صنف واحد على الأقل للمرتجع.");
  }

  const returnNumber = generateReturnNumber();
  let totalRefund = 0;
  for (const it of itemsToReturn) {
    const qty = Number(it.quantity || 1);
    const price = Number(it.sellingPrice || it.price || 0);
    totalRefund += qty * price;
  }
  totalRefund = roundCurrency(totalRefund);

  const payload = {
    returnNumber,
    invoiceNumber: invoiceNumber || "",
    invoiceId: invoiceId || "",
    returnedItems: itemsToReturn,
    refundedAmount: totalRefund,
    returnReason: returnReason.trim(),
    cashier: cashier ? {
      uid: cashier.uid || cashier.id || null,
      name: cashier.displayName || cashier.name || "كاشير المحل"
    } : null
  };

  const res = unwrap(await api.post("/returns", payload));
  return {
    success: true,
    returnNumber,
    refundedAmount: totalRefund,
    returnRecord: normalizeReturn(res)
  };
}

// Search Sold Products in Reports and Active Shift
export async function searchSoldProductsInReports(searchTerm) {
  if (!searchTerm) return [];
  const cleanTerm = searchTerm.trim().toLowerCase();

  const [reportsList, salesList, shopList] = await Promise.all([
    api.get("/reports?limit=500"),
    api.get("/sales?limit=5000"),
    api.get("/shop/products?limit=5000")
  ]);

  const reports = Array.isArray(reportsList) ? reportsList.map(normalizeReport) : [];
  const sales = Array.isArray(salesList) ? salesList.map(normalizeSale) : [];
  const shopProducts = Array.isArray(shopList) ? shopList : [];

  const productMap = new Map();

  const getOrCreateProductEntry = (item, name, barcode, code, productId) => {
    const groupKey = barcode || productId || name;
    if (!productMap.has(groupKey)) {
      const shopItem = shopProducts.find(sp => 
        (barcode && (sp.barcode || "").trim() === barcode) ||
        (productId && sp.id === productId) ||
        (sp.name || "").trim().toLowerCase() === name.toLowerCase()
      );

      productMap.set(groupKey, {
        groupKey,
        productId: productId || (shopItem ? shopItem.id : null),
        shopProductId: shopItem ? shopItem.id : null,
        name: shopItem ? shopItem.name : name,
        barcode: barcode || (shopItem ? shopItem.barcode : ""),
        code: code || (shopItem ? shopItem.code : ""),
        category: shopItem ? shopItem.category : (item.category || "عام"),
        sellingPrice: shopItem ? (shopItem.sellingPrice || item.sellingPrice) : (item.sellingPrice || 0),
        wholesalePrice: shopItem ? (shopItem.wholesalePrice || item.wholesalePrice) : (item.wholesalePrice || 0),
        currentShopStock: shopItem ? (Number(shopItem.quantity) || 0) : 0,
        totalSoldQuantity: 0,
        totalSoldQuantityInReports: 0,
        totalSoldQuantityInActiveShift: 0,
        invoices: []
      });
    }
    return productMap.get(groupKey);
  };

  // 1. Process closed reports
  reports.forEach((rep) => {
    const invoices = (rep.invoices || []).filter(inv => inv.status !== "مرتجعة");
    invoices.forEach((inv) => {
      const items = inv.items || [];
      items.forEach((item) => {
        const name = (item.name || "").trim();
        const barcode = (item.barcode || "").trim();
        const code = (item.code || "").trim();
        const productId = item.productId || item.id || "";
        
        const matchName = name.toLowerCase().includes(cleanTerm);
        const matchBarcode = barcode.toLowerCase().includes(cleanTerm);
        const matchCode = code.toLowerCase().includes(cleanTerm);
        const matchId = productId.toLowerCase() === cleanTerm;

        if (matchName || matchBarcode || matchCode || matchId) {
          const qty = Number(item.quantity) || 0;
          if (qty <= 0) return;

          const pEntry = getOrCreateProductEntry(item, name, barcode, code, productId);
          pEntry.totalSoldQuantity += qty;
          pEntry.totalSoldQuantityInReports += qty;
          pEntry.invoices.push({
            reportId: rep.id,
            reportNumber: rep.reportNumber || "",
            source: "تقرير مؤرشف",
            isCurrentShift: false,
            closedAt: rep.closedAt || rep.date || "",
            invoiceNumber: inv.invoiceNumber || "",
            customerName: inv.customer?.name || inv.customerName || "عميل نقدي",
            cashierName: inv.cashier?.name || "كاشير المحل",
            soldQty: qty,
            sellingPrice: item.sellingPrice || 0,
            subtotal: item.subtotal || qty * (item.sellingPrice || 0)
          });
        }
      });
    });
  });

  // 2. Process active open shift sales
  sales.forEach((sale) => {
    if (sale.status === "مرتجعة") return;
    const items = sale.items || [];

    items.forEach((item) => {
      const name = (item.name || "").trim();
      const barcode = (item.barcode || "").trim();
      const code = (item.code || "").trim();
      const productId = item.productId || item.id || "";
      
      const matchName = name.toLowerCase().includes(cleanTerm);
      const matchBarcode = barcode.toLowerCase().includes(cleanTerm);
      const matchCode = code.toLowerCase().includes(cleanTerm);
      const matchId = productId.toLowerCase() === cleanTerm;

      if (matchName || matchBarcode || matchCode || matchId) {
        const qty = Number(item.quantity) || 0;
        if (qty <= 0) return;

        const pEntry = getOrCreateProductEntry(item, name, barcode, code, productId);
        pEntry.totalSoldQuantity += qty;
        pEntry.totalSoldQuantityInActiveShift += qty;
        pEntry.invoices.push({
          reportId: null,
          reportNumber: "الوردية الحالية",
          source: "الوردية الحالية المفتوحة",
          isCurrentShift: true,
          activeInvoiceId: sale.id,
          closedAt: sale.date || sale.createdAt || "",
          invoiceNumber: sale.invoiceNumber || "",
          customerName: sale.customer?.name || sale.customerName || "عميل نقدي",
          cashierName: sale.cashier?.name || "كاشير المحل",
          soldQty: qty,
          sellingPrice: item.sellingPrice || 0,
          subtotal: item.subtotal || qty * (item.sellingPrice || 0)
        });
      }
    });
  });

  return Array.from(productMap.values()).sort((a, b) => b.totalSoldQuantity - a.totalSoldQuantity);
}

// Return Product Quantity from Reports
export async function returnProductQuantityFromReports({
  productId,
  shopProductId,
  barcode,
  name,
  returnQuantity
}) {
  const qtyToReturn = parseInt(returnQuantity, 10);
  if (isNaN(qtyToReturn) || qtyToReturn <= 0) {
    throw new Error("يرجى إدخال كمية صالحة للإرجاع.");
  }

  // The server restocks the shop inside the same transaction that records the return,
  // so the stock is only touched once (and not at all if the return is rejected).
  const shopList = await api.get("/shop/products?limit=5000");
  let targetShopProduct = null;
  if (Array.isArray(shopList)) {
    targetShopProduct = shopList.find(p => 
      (shopProductId && p.id === shopProductId) ||
      (productId && p.id === productId) ||
      (barcode && (p.barcode || "").trim() === barcode.trim()) ||
      (name && (p.name || "").trim().toLowerCase() === name.trim().toLowerCase())
    );
  }

  unwrap(await api.post("/returns", {
    returnNumber: generateReturnNumber(),
    returnReason: "إرجاع من تقارير سابقة",
    returnedItems: [{
      productId: productId || targetShopProduct?.id || "",
      barcode: barcode || targetShopProduct?.barcode || "",
      name: name || targetShopProduct?.name || "صنف مرتجع",
      quantity: qtyToReturn,
      sellingPrice: targetShopProduct?.sellingPrice || 0,
      wholesalePrice: targetShopProduct?.wholesalePrice || 0
    }],
    refundedAmount: roundCurrency(qtyToReturn * (targetShopProduct?.sellingPrice || 0))
  }));

  const newShopStock = (Number(targetShopProduct?.quantity) || 0) + qtyToReturn;

  return {
    success: true,
    returnedQuantity: qtyToReturn,
    newShopStock
  };
}

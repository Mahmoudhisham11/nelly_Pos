// Read-only tools the assistant calls. They run in the app against the local database (through the normal API),
// return small trimmed results, and never include passwords or tokens.
import { api } from "./apiClient";
import { invoiceTime, invoiceDate } from "./invoiceTime";

const num = (v) => Math.round((Number(v) || 0) * 100) / 100;
const norm = (s) => String(s ?? "").toLowerCase().replace(/[ً-ْ]/g, "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").trim();
const has = (hay, needle) => norm(hay).includes(norm(needle));
const cap = (n, d, max) => Math.min(Math.max(parseInt(n, 10) || d, 1), max);
const cairoFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit" });
const cairoDay = (v) => { const d = v ? new Date(v) : new Date(); return Number.isNaN(d.getTime()) ? "" : cairoFmt.format(d); };
const saleDay = (s) => { const t = invoiceTime(s); return /^\d{4}-\d\d-\d\d$/.test(t) ? t : cairoDay(invoiceDate(s)); };
const addDays = (day, n) => { const d = new Date(day + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const isCancelled = (s) => /ملغ|cancel/i.test(String(s.status || ""));
const asList = (x) => (Array.isArray(x) ? x : []);

// Closing a shift moves its invoices into the day report (the sales table only holds the open shift), so the full
// history is the open invoices plus the invoices stored inside every shift report.
let salesCache = { at: 0, rows: null };
async function allSales() {
  if (salesCache.rows && Date.now() - salesCache.at < 60_000) return salesCache.rows;
  const [open, reports] = await Promise.all([api.get("/sales", { includeClosed: true, limit: 10000 }), api.get("/reports")]);
  const byId = new Map();
  for (const s of asList(open)) byId.set(s.id || s.invoiceNumber, s);
  for (const r of asList(reports)) {
    let inv = r.invoices;
    if (typeof inv === "string") { try { inv = JSON.parse(inv); } catch { inv = []; } }
    for (const s of asList(inv)) if (!byId.has(s.id || s.invoiceNumber)) byId.set(s.id || s.invoiceNumber, s);
  }
  const rows = [...byId.values()].filter((s) => !isCancelled(s));
  salesCache = { at: Date.now(), rows };
  return rows;
}
const customerOf = (s) => s.customerName || s.customer?.name || (typeof s.customer === "string" ? s.customer : "");
const inRange = (s, from, to) => { const d = saleDay(s); return (!from || d >= from) && (!to || d <= to); };
const lines = (s) => asList(s.items);

const slimProduct = (p) => ({ name: p.name, barcode: p.barcode, brand: p.brand, category: p.category, quantity: num(p.quantity), min: num(p.minThreshold), cost: num(p.costPrice), price: num(p.sellingPrice) });
const slimSale = (s) => ({
  invoice: s.invoiceNumber, day: saleDay(s), customer: customerOf(s) || "عميل نقدي", payment: s.paymentMethod, total: num(s.total), discount: num(s.discount),
  paid: num(s.paidAmount), remaining: num(s.remainingDue), profit: num(s.totalProfit),
  items: lines(s).slice(0, 15).map((i) => ({ name: i.name, qty: num(i.quantity), price: num(i.sellingPrice) })),
});

const tools = {
  async search_products({ query, limit }) {
    const rows = asList(await api.get("/shop/products")).filter((p) => has(`${p.name} ${p.barcode} ${p.brand} ${p.category}`, query));
    return { count: rows.length, products: rows.slice(0, cap(limit, 10, 30)).map(slimProduct) };
  },

  async low_stock({ threshold, limit }) {
    const rows = asList(await api.get("/shop/products"))
      .filter((p) => (threshold != null ? num(p.quantity) <= threshold : num(p.quantity) <= num(p.minThreshold)))
      .sort((a, b) => num(a.quantity) - num(b.quantity));
    return { count: rows.length, products: rows.slice(0, cap(limit, 20, 40)).map(slimProduct) };
  },

  async find_invoices({ invoice_number, customer, from, to, limit }) {
    const rows = (await allSales())
      .filter((s) => (!invoice_number || has(s.invoiceNumber, invoice_number)) && (!customer || has(customerOf(s), customer)) && inRange(s, from, to))
      .sort((a, b) => String(invoiceTime(b)).localeCompare(String(invoiceTime(a))));
    return { count: rows.length, invoices: rows.slice(0, cap(limit, 10, 30)).map(slimSale) };
  },

  async sales_summary({ from, to, group_by }) {
    const sales = (await allSales()).filter((s) => inRange(s, from, to));
    const returns = asList(await api.get("/returns")).filter((r) => { const d = String(r.date || r.createdAt || "").slice(0, 10); return d >= from && d <= to; });
    const sum = (arr, f) => num(arr.reduce((a, x) => a + (Number(f(x)) || 0), 0));
    const out = {
      from, to, invoices: sales.length, sales_total: sum(sales, (s) => s.total), cost_total: sum(sales, (s) => s.totalCost), profit_total: sum(sales, (s) => s.totalProfit),
      discounts_total: sum(sales, (s) => s.discount), unpaid_total: sum(sales, (s) => s.remainingDue), returns_count: returns.length, returns_refunded: sum(returns, (r) => r.refundedAmount),
    };
    if (group_by === "day") {
      const m = {};
      for (const s of sales) { const d = saleDay(s); (m[d] ||= { day: d, invoices: 0, sales: 0, profit: 0 }); m[d].invoices++; m[d].sales += Number(s.total) || 0; m[d].profit += Number(s.totalProfit) || 0; }
      out.by_day = Object.values(m).sort((a, b) => a.day.localeCompare(b.day)).map((r) => ({ ...r, sales: num(r.sales), profit: num(r.profit) }));
    } else if (group_by === "payment_method") {
      const m = {};
      for (const s of sales) { const k = s.paymentMethod || "-"; (m[k] ||= { method: k, invoices: 0, sales: 0 }); m[k].invoices++; m[k].sales += Number(s.total) || 0; }
      out.by_payment_method = Object.values(m).map((r) => ({ ...r, sales: num(r.sales) }));
    } else if (group_by === "product") {
      out.by_product = topProducts(sales, "revenue", 15);
    }
    return out;
  },

  async top_products({ from, to, limit, sort_by }) {
    const sales = (await allSales()).filter((s) => inRange(s, from, to));
    return { from, to, products: topProducts(sales, sort_by || "quantity", cap(limit, 10, 30)) };
  },

  async customer_info({ query }) {
    const customers = asList(await api.get("/customers")).filter((c) => has(`${c.name} ${c.phone}`, query));
    const sales = await allSales();
    return {
      count: customers.length,
      customers: customers.slice(0, 5).map((c) => ({
        name: c.name, phone: c.phone, type: c.type, owes_us: num(c.remainingBalance ?? c.balance), total_purchases: num(c.totalPurchases), total_paid: num(c.totalPaid),
        recent_invoices: sales.filter((s) => s.customer === c.id || s.customer?.id === c.id || customerOf(s) === c.name).sort((a, b) => String(invoiceTime(b)).localeCompare(String(invoiceTime(a)))).slice(0, 5).map(slimSale),
      })),
    };
  },

  async employee_info({ query, month }) {
    const m = month || cairoDay().slice(0, 7);
    const emps = asList(await api.get("/employees")).filter((e) => has(`${e.name} ${e.code}`, query));
    const [att, tx] = await Promise.all([api.get("/employees/attendance"), api.get("/employees/transactions")]);
    return {
      month: m,
      employees: emps.slice(0, 3).map((e) => {
        const a = asList(att).filter((r) => r.employeeId === e.id && String(r.date).startsWith(m));
        const t = asList(tx).filter((r) => r.employeeId === e.id && (r.month === m || r.monthStr === m));
        const byType = {};
        for (const r of t) byType[r.type] = num((byType[r.type] || 0) + (Number(r.amount) || 0));
        return {
          name: e.name, code: e.code, role: e.role, status: e.status, base_salary: num(e.baseSalary), commission_rate: e.commissionRate,
          attendance_days: new Set(a.map((r) => r.date)).size, attendance_hours: num(a.reduce((s, r) => s + (Number(r.durationMinutes) || 0), 0) / 60),
          transactions_by_type: byType, transactions_count: t.length,
        };
      }),
    };
  },

  async forecast_sales({ days_ahead }) {
    const n = cap(days_ahead, 7, 30);
    const today = cairoDay();
    const start = addDays(today, -56);
    const sales = (await allSales()).filter((s) => inRange(s, start, addDays(today, -1)));
    const daily = {};
    for (const s of sales) daily[saleDay(s)] = (daily[saleDay(s)] || 0) + (Number(s.total) || 0);
    const activeDays = Object.keys(daily).length;
    if (activeDays < 7) return { error: "البيانات أقل من 7 أيام بيع في آخر 8 أسابيع، التوقع غير موثوق.", active_days: activeDays };
    const wd = (d) => new Date(d + "T12:00:00Z").getUTCDay();
    const byWd = Array.from({ length: 7 }, () => []);
    for (let i = 56; i >= 1; i--) { const d = addDays(today, -i); byWd[wd(d)].push(daily[d] || 0); }
    const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
    const last4 = avg(Array.from({ length: 28 }, (_, i) => daily[addDays(today, -(i + 1))] || 0));
    const prev4 = avg(Array.from({ length: 28 }, (_, i) => daily[addDays(today, -(i + 29))] || 0));
    const trend = prev4 > 0 ? Math.min(1.3, Math.max(0.7, last4 / prev4)) : 1; // damped: never more than +-30%
    const forecast = Array.from({ length: n }, (_, i) => { const d = addDays(today, i); return { day: d, expected_sales: num(avg(byWd[wd(d)]) * trend) }; });
    return { method: "weekday average of last 8 weeks x recent trend (clamped 0.7-1.3)", trend_factor: num(trend), avg_daily_last_28d: num(last4), active_days_in_window: activeDays, forecast, total_expected: num(forecast.reduce((s, f) => s + f.expected_sales, 0)) };
  },

  async stock_cover({ query, limit }) {
    const products = asList(await api.get("/shop/products")).filter((p) => has(`${p.name} ${p.barcode} ${p.brand}`, query)).slice(0, cap(limit, 8, 20));
    const today = cairoDay();
    const sales = (await allSales()).filter((s) => inRange(s, addDays(today, -30), today));
    const sold = {};
    for (const s of sales) for (const i of lines(s)) sold[i.productId] = (sold[i.productId] || 0) + (Number(i.quantity) || 0);
    return {
      window_days: 30,
      products: products.map((p) => {
        const perDay = (sold[p.id] || 0) / 30;
        const q = num(p.quantity);
        return { name: p.name, quantity: q, sold_last_30d: num(sold[p.id] || 0), avg_per_day: num(perDay), days_left: perDay > 0 ? Math.floor(q / perDay) : null, suggested_reorder_for_30d: perDay > 0 ? Math.max(0, Math.ceil(perDay * 30 - q)) : 0 };
      }),
    };
  },
};

function topProducts(sales, sortBy, limit) {
  const m = {};
  for (const s of sales) for (const i of lines(s)) {
    const k = i.productId || i.name;
    const r = (m[k] ||= { name: i.name, quantity: 0, revenue: 0, profit: 0 });
    r.quantity += Number(i.quantity) || 0;
    r.revenue += Number(i.subtotal) || (Number(i.sellingPrice) || 0) * (Number(i.quantity) || 0);
    r.profit += Number(i.profit) || 0;
  }
  const key = sortBy === "revenue" ? "revenue" : sortBy === "profit" ? "profit" : "quantity";
  return Object.values(m).sort((a, b) => b[key] - a[key]).slice(0, limit).map((r) => ({ ...r, quantity: num(r.quantity), revenue: num(r.revenue), profit: num(r.profit) }));
}

/** Runs one tool; errors become a result the model can read instead of breaking the conversation. */
export async function runTool(name, input) {
  const fn = tools[name];
  if (!fn) return { is_error: true, content: `unknown tool ${name}` };
  try {
    return { content: JSON.stringify(await fn(input || {})).slice(0, 24000) };
  } catch (e) {
    return { is_error: true, content: `tool failed: ${e?.message || e}` };
  }
}

// When an invoice happened. New invoices store a date-only `date` plus a real `createdAt`; invoices imported from the
// old cloud have a full-timestamp `date` and a `createdAt` that is not a usable string (a Firestore timestamp object).
const validTs = (v) => typeof v === "string" && v.length > 10 && !Number.isNaN(new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(v) ? v : v + "Z").getTime());

/** ISO timestamp string of the invoice, or the date-only string when no time is known. */
export function invoiceTime(inv) {
  if (!inv) return "";
  if (validTs(inv.date)) return inv.date;
  if (validTs(inv.createdAt)) return inv.createdAt;
  return inv.date || "";
}

/** Date object for display (naive timestamps are UTC, as the backend stores them). */
export function invoiceDate(inv) {
  const t = invoiceTime(inv);
  return new Date(/^\d{4}-\d\d-\d\d$/.test(t) || /[zZ]|[+-]\d\d:?\d\d$/.test(t) ? t : t + "Z");
}

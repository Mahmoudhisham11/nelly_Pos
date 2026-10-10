// Helper to ensure monetary numbers are rounded properly to 2 decimal places
export function roundCurrency(val) {
  const num = Number(val) || 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

// Helper to ensure numbers are ALWAYS formatted with pure English digits (1, 2, 3, 4...)
export function formatNumber(val) {
  if (val === null || val === undefined || val === "") return "0";
  const num = Number(val);
  if (isNaN(num)) return String(val);
  return new Intl.NumberFormat("en-US", { 
    useGrouping: true,
    maximumFractionDigits: 2 
  }).format(num);
}

export function formatCurrency(val) {
  return `${formatNumber(val)} ج.م`;
}

export function formatDateTime(isoString, timeOnly = false) {
  if (!isoString) return "";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return String(isoString);
    if (timeOnly) {
      return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
    }
    return d.toLocaleString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    });
  } catch (e) {
    return String(isoString);
  }
}

// Extract YYYY-MM-DD in local time (prevents midnight timezone rollover bugs)
export function getLocalDateString(dateInput = new Date()) {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Extract YYYY-MM in local time
export function getLocalMonthString(dateInput = new Date()) {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}


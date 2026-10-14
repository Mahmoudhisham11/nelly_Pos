// Product search shared by the cashier and the shop page: every word must match, and the best matches come first
// (exact barcode/code, then barcode that starts with the text, whole words of the name, ... and only then "contains").

const MARKS = /[ً-ٰٟـ]/g; // Arabic diacritics and tatweel

/** Lower case, one spelling for the Arabic letters people mix up, Arabic-Indic digits -> 0-9, single spaces. */
export function normalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(MARKS, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x6f0))
    .replace(/\s+/g, " ")
    .trim();
}

function scoreToken(t, f) {
  if (f.barcode === t || f.code === t) return 1000;
  let best = 0;
  if (f.barcode.startsWith(t) || f.code.startsWith(t)) best = 600;
  if (f.words.includes(t)) best = Math.max(best, 500);
  if (f.name.startsWith(t)) best = Math.max(best, 450);
  if (f.words.some((w) => w.startsWith(t))) best = Math.max(best, 350);
  if (f.brand === t) best = Math.max(best, 300);
  if (f.barcode.endsWith(t) || f.code.endsWith(t)) best = Math.max(best, 200);
  if (f.name.includes(t)) best = Math.max(best, 150);
  if (f.barcode.includes(t) || f.code.includes(t)) best = Math.max(best, 100);
  if (f.brand.includes(t)) best = Math.max(best, 80);
  if (f.category.includes(t)) best = Math.max(best, 40);
  return best;
}

/**
 * Products matching `query`, best first. `limit` caps the list; `includeCategory: false` ignores the category text
 * (the shop page has a separate category filter).
 */
export function searchProducts(products, query, { limit = 30, includeCategory = true } = {}) {
  const q = normalizeText(query);
  if (!q) return [];
  const tokens = q.split(" ");
  const found = [];
  for (const p of products || []) {
    const name = normalizeText(p.name);
    const f = {
      name,
      words: name.split(/[\s\-_/.,()+]+/).filter(Boolean),
      barcode: normalizeText(p.barcode),
      code: normalizeText(p.code),
      brand: normalizeText(p.brand),
      category: includeCategory ? normalizeText(p.category) : "",
    };
    let total = 0;
    let all = true;
    for (const t of tokens) {
      const s = scoreToken(t, f);
      if (!s) { all = false; break; }
      total += s;
    }
    if (all) found.push({ p, score: total - name.length * 0.01 }); // among equals the shorter name first
  }
  found.sort((a, b) => b.score - a.score);
  return found.slice(0, limit).map((x) => x.p);
}

/** The product whose barcode or code is exactly `query` (what a scanner sends), or undefined. */
export function findExactProduct(products, query) {
  const q = normalizeText(query);
  if (!q) return undefined;
  return (products || []).find((p) => normalizeText(p.barcode) === q || normalizeText(p.code) === q);
}

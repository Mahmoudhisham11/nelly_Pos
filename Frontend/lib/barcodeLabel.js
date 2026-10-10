// Thermal barcode labels, printed as VECTOR (SVG bars + real text), the way professional POS software does it:
//  - the bar width (module) is a whole number of printer dots (203 dpi = 8 dots/mm -> 0.25 / 0.375 / 0.5 mm), so every
//    bar prints with the same crisp width and scanners read it first time (a resized bitmap blurs bars unevenly);
//  - quiet zones are kept on both sides; EAN-13 is used for valid 13-digit retail codes, CODE128 for everything else;
//  - one label per page with the exact label size as the page size, N copies in one print job.
import JsBarcode from "jsbarcode";

const MODULES_MM = [0.5, 0.375, 0.25, 0.19]; // 4, 3, 2 dots at 203 dpi; 0.19 ≈ 2 dots at 300 dpi for long codes

export function cleanBarcode(raw) {
  return String(raw ?? "").trim().replace(/[^\x20-\x7E]/g, "");
}

function isValidEan13(code) {
  if (!/^\d{13}$/.test(code)) return false;
  const d = code.split("").map(Number);
  const sum = d.slice(0, 12).reduce((s, n, i) => s + n * (i % 2 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === d[12];
}

/** Bars as an SVG string sized in millimetres, plus the chosen symbology. */
export function barcodeSvg(code, { maxWidthMm, heightMm }) {
  const format = isValidEan13(code) ? "EAN13" : "CODE128";
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  JsBarcode(svg, code, { format, width: 1, height: 100, margin: 0, displayValue: false, flat: true, background: "#ffffff", lineColor: "#000000" });
  const modules = parseFloat(svg.getAttribute("width")) || 100; // JsBarcode writes "95px" (1 module = 1px at width 1)
  const moduleMm = MODULES_MM.find((m) => modules * m <= maxWidthMm) ?? maxWidthMm / modules;
  const widthMm = modules * moduleMm;
  svg.setAttribute("viewBox", `0 0 ${modules} 100`);
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("shape-rendering", "crispEdges");
  svg.setAttribute("width", `${widthMm}mm`);
  svg.setAttribute("height", `${heightMm}mm`);
  svg.removeAttribute("style");
  return { svg: new XMLSerializer().serializeToString(svg), format, widthMm, module: moduleMm };
}

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/**
 * Full print document body + css for `copies` labels.
 * @param {{ code: string, name: string, price?: string|null, widthMm: number, heightMm: number, fontScale?: number, copies?: number, brand?: string }} o
 */
export function labelPrintJob({ code, name, price, widthMm, heightMm, fontScale = 1, copies = 1, brand = "NELLY" }) {
  const pad = Math.max(1.2, widthMm * 0.04); // side margin = quiet zone
  const small = heightMm < 25 || widthMm < 45;
  const nameMm = (small ? 2.6 : 3.4) * fontScale;   // text heights in mm
  const footMm = (small ? 2.5 : 3.2) * fontScale;
  const gap = small ? 0.6 : 1;
  const barsH = Math.max(6, heightMm - 2 * gap - nameMm * 1.25 - footMm * 1.25 - 2.4);
  const bars = barcodeSvg(code, { maxWidthMm: widthMm - 2 * pad, heightMm: barsH });

  const one = `<section class="label">
  <div class="row top"><span class="name">${esc(name)}</span><span class="brand">${esc(brand)}</span></div>
  <div class="bars">${bars.svg}</div>
  <div class="row bottom${price ? "" : " center"}"><span class="code" dir="ltr">${esc(code)}</span>${price ? `<span class="price">${esc(price)}</span>` : ""}</div>
</section>`;
  const count = Math.min(500, Math.max(1, Math.floor(Number(copies) || 1)));
  const body = Array.from({ length: count }, () => one).join("\n");

  const css = `
@page { size: ${widthMm}mm ${heightMm}mm; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: ${widthMm}mm; background: #fff; color: #000; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font-family: "Segoe UI", Tahoma, Arial, sans-serif; }
.label { width: ${widthMm}mm; height: ${heightMm}mm; padding: 1.2mm ${pad}mm; display: flex; flex-direction: column; justify-content: space-between; overflow: hidden; page-break-after: always; break-after: page; }
.label:last-child { page-break-after: auto; break-after: auto; }
.row { display: flex; align-items: center; justify-content: space-between; gap: 1mm; white-space: nowrap; }
.row.center { justify-content: center; }
.name { font-size: ${nameMm}mm; font-weight: 800; overflow: hidden; text-overflow: ellipsis; direction: rtl; flex: 1; text-align: right; }
.brand { font-size: ${(nameMm * 0.72).toFixed(2)}mm; font-weight: 900; letter-spacing: 0.3mm; }
.bars { display: flex; justify-content: center; line-height: 0; }
.bars svg { display: block; }
.code { font-family: Consolas, "Courier New", monospace; font-size: ${footMm}mm; font-weight: 700; letter-spacing: 0.2mm; }
.price { font-size: ${footMm}mm; font-weight: 900; direction: rtl; }
`;
  return { body, css, format: bars.format, moduleMm: bars.module };
}

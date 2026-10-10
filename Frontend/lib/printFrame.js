// Prints a piece of HTML through a hidden iframe, so the app page itself is never printed.
// `copyStyles` copies the app's stylesheets into the frame: an on-screen element (e.g. the receipt preview) then prints
// exactly as it looks. The frame waits for its stylesheets, fonts and images before calling print().

function styleTags() {
  return Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
    .map((el) => (el.tagName === "LINK" ? `<link rel="stylesheet" href="${el.href}">` : el.outerHTML))
    .join("\n");
}

function whenReady(doc) {
  const links = Array.from(doc.querySelectorAll('link[rel="stylesheet"]'));
  const images = Array.from(doc.images);
  const waits = [
    ...links.map((l) => (l.sheet ? null : new Promise((r) => { l.onload = r; l.onerror = r; }))),
    ...images.map((img) => (img.complete ? null : new Promise((r) => { img.onload = r; img.onerror = r; }))),
    doc.fonts?.ready,
  ].filter(Boolean);
  // never hang the print button on a slow resource
  return Promise.race([Promise.all(waits), new Promise((r) => setTimeout(r, 2500))]);
}

/**
 * @param {{ title?: string, body: string, css?: string, copyStyles?: boolean, dir?: string }} opts
 */
export function printHtml({ title = "Nelly", body, css = "", copyStyles = false, dir = "rtl" }) {
  document.getElementById("nelly-print-frame")?.remove();
  const iframe = document.createElement("iframe");
  iframe.id = "nelly-print-frame";
  Object.assign(iframe.style, { position: "fixed", right: "0", bottom: "0", width: "0", height: "0", border: "0", zIndex: "-9999" });
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow?.document;
  if (!doc) { iframe.remove(); window.print(); return; }

  doc.open();
  // with copied styles, also copy the page's root classes (next/font puts the app font on them)
  const htmlClass = copyStyles ? document.documentElement.className : "";
  const bodyClass = copyStyles ? document.body.className : "";
  doc.write(`<!DOCTYPE html><html dir="${dir}" lang="ar" class="${htmlClass}"><head><meta charset="utf-8"><title>${title}</title>
${copyStyles ? styleTags() : ""}
<style>${css}</style></head><body class="${bodyClass}">${body}</body></html>`);
  doc.close();

  whenReady(doc).then(() => {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch (err) {
      console.error("print failed:", err);
    } finally {
      setTimeout(() => iframe.remove(), 60000); // keep it while the print dialog/spooler may still read it
    }
  });
}

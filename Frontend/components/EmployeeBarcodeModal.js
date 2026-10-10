"use client";

import React, { useState, useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";
import { 
  X, 
  Printer, 
  Barcode as BarcodeIcon, 
  Copy, 
  Check, 
  Download
} from "lucide-react";
import styles from "./EmployeeBarcodeModal.module.css";

export default function EmployeeBarcodeModal({ isOpen, onClose, employee }) {
  const [copied, setCopied] = useState(false);
  const [labelSize, setLabelSize] = useState("50x30"); // Default to the large sticker in the photo
  const [orientation, setOrientation] = useState("landscape"); // "landscape" | "portrait"
  const [includeStoreName, setIncludeStoreName] = useState(true);
  const [fontSizeMode, setFontSizeMode] = useState("compact"); // "compact" | "mini" | "standard"
  const barcodeSvgRef = useRef(null);
  const printIframeRef = useRef(null);

  const rawBarcodeValue = employee?.code ? String(employee.code).trim().toUpperCase() : "EMP-01";
  // Code128 supports ASCII printable characters (letters, numbers, dashes)
  const barcodeValue = rawBarcodeValue.replace(/[^\x20-\x7E]/g, "") || "EMP01";

  // Sizes in mm (Calibrated for crisp, high-impact thermal stickers)
  const sizeMap = {
    "50x30": { w: 50, h: 30, barWidth: 1.8, barHeight: 46, label: "50 × 30 مم", sub: "(المقاس الجديد بالصورة)" },
    "50x25": { w: 50, h: 25, barWidth: 1.7, barHeight: 38, label: "50 × 25 مم", sub: "(مقاس عريض)" },
    "50x40": { w: 50, h: 40, barWidth: 1.9, barHeight: 56, label: "50 × 40 مم", sub: "(مقاس كبير جداً)" },
    "60x40": { w: 60, h: 40, barWidth: 2.1, barHeight: 62, label: "60 × 40 مم", sub: "(مقاس جامبو)" },
    "38x25": { w: 38, h: 25, barWidth: 1.25, barHeight: 26, label: "38 × 25 مم", sub: "(مقاس قياسي)" },
    "38x20": { w: 38, h: 20, barWidth: 1.15, barHeight: 20, label: "38 × 20 مم", sub: "(مقاس صغير)" }
  };

  // Generate real vector Code128 Barcode
  useEffect(() => {
    if (!isOpen || !employee || !barcodeSvgRef.current) return;

    try {
      const config = sizeMap[labelSize] || sizeMap["50x30"];
      JsBarcode(barcodeSvgRef.current, barcodeValue, {
        format: "CODE128",
        width: config.barWidth,
        height: config.barHeight,
        displayValue: false,
        margin: 0,
        background: "#ffffff",
        lineColor: "#000000"
      });
    } catch (err) {
      console.error("JsBarcode generation error:", err);
    }
  }, [isOpen, employee, barcodeValue, labelSize, orientation]);

  if (!isOpen || !employee) return null;

  // Render high-res sticker on 300 DPI Canvas (100% BORDERLESS, ULTRA-BOLD & HIGH-LEGIBILITY)
  const createStickerCanvas = (callback) => {
    const config = sizeMap[labelSize] || sizeMap["50x30"];
    let widthMm = config.w;
    let heightMm = config.h;

    if (orientation === "portrait") {
      widthMm = config.h;
      heightMm = config.w;
    }

    const svgElement = barcodeSvgRef.current;
    if (!svgElement) {
      console.warn("Barcode SVG element not found.");
      return;
    }

    let svgString = new XMLSerializer().serializeToString(svgElement);
    if (!svgString.includes("xmlns")) {
      svgString = svgString.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const URL = window.URL || window.webkitURL || window;
    const blobURL = URL.createObjectURL(svgBlob);

    const image = new Image();
    image.onload = () => {
      try {
        const scale = 12; // 12 px per mm = ~300 DPI (304.8 DPI exact)
        const canvasWidth = widthMm * scale;
        const canvasHeight = heightMm * scale;

        const canvas = document.createElement("canvas");
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        const ctx = canvas.getContext("2d");

        // 1. Pure Crisp White Background (100% BORDERLESS - No outer border or edge bleeding)
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        // Calculate proportional layout based on label size (Bigger, more legible fonts)
        const isSmall = widthMm < 45 || heightMm < 25;
        const fontMult = fontSizeMode === "mini" ? 0.84 : fontSizeMode === "standard" ? 1.18 : 1.0;

        // Big, heavy, ultra-legible fonts for thermal print
        const fontHeaderSize = Math.round((isSmall ? 18 : 30) * fontMult);
        const fontStoreSize = Math.round((isSmall ? 11 : 16) * fontMult);
        const fontFooterCode = Math.round((isSmall ? 18 : 28) * fontMult);
        const fontFooterRole = Math.round((isSmall ? 16 : 26) * fontMult);

        const safeMarginX = Math.round(canvasWidth * 0.05); // 5% safe quiet zone on sides

        // Cohesive vertical spacing between elements
        const gapHeaderBarcode = isSmall ? 6 : 10;
        const gapBarcodeFooter = isSmall ? 6 : 10;

        // Strong, well-proportioned barcode bars
        const targetBarH = Math.round(canvasHeight * (isSmall ? 0.36 : 0.44));
        const maxSafeW = Math.round(canvasWidth * (isSmall ? 0.78 : 0.84));

        const imgAspect = (image.width && image.height) ? (image.width / image.height) : 2.6;
        let drawH = targetBarH;
        let drawW = drawH * imgAspect;

        if (drawW > maxSafeW) {
          drawW = maxSafeW;
          drawH = drawW / imgAspect;
        }

        const headerTextHeight = fontHeaderSize;
        const footerTextHeight = Math.max(fontFooterCode, fontFooterRole);

        // Total content block height
        const totalContentHeight = headerTextHeight + gapHeaderBarcode + drawH + gapBarcodeFooter + footerTextHeight;

        // Perfectly vertically center the entire block within the sticker
        const startY = Math.round((canvasHeight - totalContentHeight) / 2);

        const headerCenterY = startY + Math.round(headerTextHeight / 2);
        const barcodeDrawY = startY + headerTextHeight + gapHeaderBarcode;
        const footerCenterY = barcodeDrawY + drawH + gapBarcodeFooter + Math.round(footerTextHeight / 2);
        const barcodeDrawX = Math.round((canvasWidth - drawW) / 2);

        // Helper to truncate text safely if employee name is long
        const truncateToFit = (text, maxW) => {
          if (!text) return "";
          if (ctx.measureText(text).width <= maxW) return text;
          let trimmed = text;
          while (trimmed.length > 2 && ctx.measureText(trimmed + "...").width > maxW) {
            trimmed = trimmed.slice(0, -1);
          }
          return trimmed + "...";
        };

        // 2. Header: Employee Name (Right) + Store Brand (Left) - Heavy 900 weight
        ctx.fillStyle = "#000000";
        ctx.textBaseline = "middle";

        let storeWidth = 0;
        if (includeStoreName) {
          const storeText = "★ NELLY ★";
          ctx.font = `900 ${fontStoreSize}px "Segoe UI", Arial, Tahoma, sans-serif`;
          storeWidth = ctx.measureText(storeText).width;
          ctx.textAlign = "left";
          ctx.fillText(storeText, safeMarginX, headerCenterY);
        }

        ctx.font = `900 ${fontHeaderSize}px "Segoe UI", Arial, Tahoma, sans-serif`;
        ctx.textAlign = "right";
        const maxNameWidth = canvasWidth - (safeMarginX * 2) - storeWidth - (includeStoreName ? 16 : 0);
        const safeName = truncateToFit(employee.name || "موظف", maxNameWidth);
        ctx.fillText(safeName, canvasWidth - safeMarginX, headerCenterY);

        // 3. Barcode Vector Graphic: Sharp, deep black, centered
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(image, barcodeDrawX, barcodeDrawY, drawW, drawH);

        // 4. Footer: Barcode Code (Left) + Role (Right) - Heavy 900 weight
        ctx.fillStyle = "#000000";
        ctx.textBaseline = "middle";

        ctx.font = `900 ${fontFooterCode}px monospace, "Courier New", Courier`;
        ctx.textAlign = "left";
        ctx.fillText(barcodeValue, safeMarginX, footerCenterY);

        ctx.font = `900 ${fontFooterRole}px "Segoe UI", Arial, Tahoma, sans-serif`;
        ctx.textAlign = "right";
        ctx.fillText(employee.role || "موظف", canvasWidth - safeMarginX, footerCenterY);

        callback(canvas, widthMm, heightMm);
      } catch (err) {
        console.error("Canvas draw error in EmployeeBarcodeModal:", err);
      } finally {
        URL.revokeObjectURL(blobURL);
      }
    };

    image.onerror = (err) => {
      console.error("Image decode error from SVG blob:", err);
      URL.revokeObjectURL(blobURL);
    };

    image.src = blobURL;
  };

  // Direct Thermal Printing via Isolated Iframe
  const handlePrint = () => {
    createStickerCanvas((canvas, widthMm, heightMm) => {
      const stickerDataUrl = canvas.toDataURL("image/png");

      const printHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8" />
          <title>Sticker_${barcodeValue}</title>
          <style>
            @page {
              size: ${widthMm}mm ${heightMm}mm;
              margin: 0 !important;
            }
            @media print {
              html, body {
                width: ${widthMm}mm !important;
                height: ${heightMm}mm !important;
                margin: 0 !important;
                padding: 0 !important;
                border: none !important;
                outline: none !important;
                overflow: hidden !important;
                background: #ffffff !important;
                page-break-after: avoid !important;
                page-break-inside: avoid !important;
                break-inside: avoid !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              img {
                width: ${widthMm}mm !important;
                height: ${heightMm}mm !important;
                max-width: ${widthMm}mm !important;
                max-height: ${heightMm}mm !important;
                display: block !important;
                margin: 0 !important;
                padding: 0 !important;
                border: none !important;
                outline: none !important;
                page-break-after: avoid !important;
                page-break-inside: avoid !important;
                break-inside: avoid !important;
                object-fit: fill !important;
              }
            }
            * {
              box-sizing: border-box !important;
              margin: 0 !important;
              padding: 0 !important;
              border: none !important;
              outline: none !important;
            }
            html, body {
              width: ${widthMm}mm;
              height: ${heightMm}mm;
              margin: 0;
              padding: 0;
              overflow: hidden;
              background: #ffffff;
              line-height: 0;
            }
            img {
              width: ${widthMm}mm;
              height: ${heightMm}mm;
              display: block;
              margin: 0;
              padding: 0;
              border: none;
              outline: none;
              object-fit: fill;
            }
          </style>
        </head>
        <body>
          <img src="${stickerDataUrl}" alt="Barcode Sticker" />
        </body>
        </html>
      `;

      // Remove existing iframe to prevent reuse state issues
      const oldIframe = document.getElementById("thermal-print-hidden-iframe");
      if (oldIframe) {
        oldIframe.remove();
      }

      const iframe = document.createElement("iframe");
      iframe.id = "thermal-print-hidden-iframe";
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "none";
      iframe.style.zIndex = "-9999";
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow.document;
      doc.open();
      doc.write(printHtml);
      doc.close();

      setTimeout(() => {
        try {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        } catch (printErr) {
          console.error("Print invocation error:", printErr);
        }
      }, 250);
    });
  };

  // Download barcode image directly
  const handleDownloadImage = () => {
    createStickerCanvas((canvas) => {
      try {
        const pngUrl = canvas.toDataURL("image/png");
        const downloadLink = document.createElement("a");
        downloadLink.href = pngUrl;
        downloadLink.download = `Barcode_${employee?.name || "Employee"}_${barcodeValue}.png`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
      } catch (err) {
        console.error("Download image error:", err);
      }
    });
  };

  const handleCopyCode = () => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(barcodeValue);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getContainerSizeClass = () => {
    switch (labelSize) {
      case "60x40": return styles.previewContainer60x40;
      case "50x40": return styles.previewContainer50x40;
      case "50x30": return styles.previewContainer50x30;
      case "50x25": return styles.previewContainer50x25;
      case "38x25": return styles.previewContainer38x25;
      default: return styles.previewContainer38x20;
    }
  };

  const isLargeLabel = labelSize.startsWith("50") || labelSize.startsWith("60");

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className={`modal-content ${styles.modalContainer}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.headerBrand}>
            <div className={styles.iconBox}>
              <BarcodeIcon size={20} />
            </div>
            <div>
              <h3 className={styles.modalTitle}>
                طباعة باركود الموظف للاستيكر الحراري
              </h3>
              <span className={styles.modalSubtitle}>
                مقاس مخصص لطابعات الباركود الحرارية (Sticker Label)
              </span>
            </div>
          </div>

          <button 
            type="button"
            onClick={onClose}
            className={styles.closeButton}
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className={styles.scrollContent}>
          {/* Controls: Size, Orientation, Font Density */}
          <div className={styles.controlsBox}>
            {/* Label Size Buttons */}
            <div>
              <div className={styles.controlRow}>
                <span className={styles.controlLabel}>
                  مقاس الاستيكر الحراري:
                </span>
                <label className={styles.storeCheckboxLabel}>
                  <input
                    type="checkbox"
                    checked={includeStoreName}
                    onChange={(e) => setIncludeStoreName(e.target.checked)}
                    className={styles.pinkCheckbox}
                  />
                  <span>اسم نيللي</span>
                </label>
              </div>

              <div className={styles.sizesGrid}>
                {[
                  { id: "50x30", label: "50 × 30 مم", sub: "(المقاس الجديد بالصورة)" },
                  { id: "50x25", label: "50 × 25 مم", sub: "(مقاس عريض)" },
                  { id: "50x40", label: "50 × 40 مم", sub: "(مقاس كبير جداً)" },
                  { id: "60x40", label: "60 × 40 مم", sub: "(مقاس جامبو)" },
                  { id: "38x25", label: "38 × 25 مم", sub: "(مقاس قياسي)" },
                  { id: "38x20", label: "38 × 20 مم", sub: "(مقاس صغير)" }
                ].map((size) => (
                  <button
                    key={size.id}
                    type="button"
                    onClick={() => setLabelSize(size.id)}
                    className={`${styles.sizeBtn} ${labelSize === size.id ? styles.sizeBtnActive : styles.sizeBtnInactive}`}
                  >
                    <strong className={styles.sizeBtnLabel}>{size.label}</strong>
                    <span className={styles.sizeBtnSub}>{size.sub}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Font Density Options */}
            <div className={styles.densityRow}>
              <span className={styles.densityLabel}>
                حجم الكتابة على الاستيكر:
              </span>
              <div className={styles.densityBtnGroup}>
                {[
                  { id: "compact", label: "متناسق واحترافي (موصى به)" },
                  { id: "standard", label: "خط عريض وكبير" },
                  { id: "mini", label: "ميني صغير" }
                ].map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setFontSizeMode(mode.id)}
                    className={`${styles.densityBtn} ${fontSizeMode === mode.id ? styles.densityBtnActive : styles.densityBtnInactive}`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Orientation Buttons (Landscape vs Portrait) */}
            <div className={styles.orientationRow}>
              <span className={styles.orientationLabel}>
                اتجاه سحب الورقة في الطابعة:
              </span>
              <div className={styles.orientationBtnGroup}>
                <button
                  type="button"
                  onClick={() => setOrientation("landscape")}
                  className={`${styles.orientationBtn} ${orientation === "landscape" ? styles.orientationBtnActive : styles.orientationBtnInactive}`}
                >
                  بالعرض (Landscape)
                </button>
                <button
                  type="button"
                  onClick={() => setOrientation("portrait")}
                  className={`${styles.orientationBtn} ${orientation === "portrait" ? styles.orientationBtnActive : styles.orientationBtnInactive}`}
                >
                  بالطول (Portrait)
                </button>
              </div>
            </div>
          </div>

          {/* Preview Box */}
          <div className={styles.previewWrapper}>
            <span className={styles.previewHeading}>
              معاينة ملصق الاستيكر الفعلي المطبوع ({sizeMap[labelSize]?.label}):
            </span>

            {/* PREVIEW CONTAINER (100% BORDERLESS) */}
            <div className={`${styles.previewContainer} ${getContainerSizeClass()}`}>
              {/* Header (Clean Borderless) */}
              <div className={styles.previewHeader}>
                <span className={`${styles.previewEmpName} ${isLargeLabel ? styles.previewEmpNameLarge : styles.previewEmpNameSmall}`}>
                  {employee.name}
                </span>
                {includeStoreName && (
                  <span className={`${styles.previewStoreTag} ${isLargeLabel ? styles.previewStoreTagLarge : styles.previewStoreTagSmall}`}>
                    ★ NELLY ★
                  </span>
                )}
              </div>

              {/* Barcode Vector Graphic (Compact & Centered) */}
              <div className={styles.svgContainer}>
                <svg 
                  ref={barcodeSvgRef} 
                  className={`${styles.barcodeSvg} ${labelSize === "60x40" || labelSize === "50x40" ? styles.barcodeSvgLarge : labelSize === "50x30" ? styles.barcodeSvgMedium : styles.barcodeSvgSmall}`} 
                />
              </div>

              {/* Barcode Numbers & Code (Clean Borderless) */}
              <div className={styles.previewFooter}>
                <span className={`num-font ${styles.barcodeText} ${isLargeLabel ? styles.barcodeTextLarge : styles.barcodeTextSmall}`} dir="ltr">
                  {barcodeValue}
                </span>
                <span className={`${styles.roleText} ${isLargeLabel ? styles.roleTextLarge : styles.roleTextSmall}`}>
                  {employee.role || "بائع"}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Copy */}
          <div className={styles.copyBox}>
            <div>
              <span className={styles.copyLabel}>كود البصمة المبرمج:</span>
              <strong className={`num-font ${styles.copyValue}`}>{barcodeValue}</strong>
            </div>

            <button
              type="button"
              onClick={handleCopyCode}
              className={`btn-secondary ${styles.copyButton}`}
            >
              {copied ? <Check size={14} className={styles.checkGreen} /> : <Copy size={14} />}
              <span>{copied ? "تم النسخ!" : "نسخ الكود"}</span>
            </button>
          </div>
        </div>

        {/* Fixed Footer */}
        <div className={styles.modalFooter}>
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
          >
            إغلاق
          </button>

          <div className={styles.footerActions}>
            <button
              type="button"
              onClick={handleDownloadImage}
              className={`btn-secondary ${styles.downloadBtn}`}
              title="تنزيل ملصق الباركود كصورة عالية الجودة"
            >
              <Download size={16} />
              <span>حفظ صورة الاستيكر</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className={`btn-primary ${styles.printBtn}`}
            >
              <Printer size={18} />
              <span>طباعة الاستيكر الحراري</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

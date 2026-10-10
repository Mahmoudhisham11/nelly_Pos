"use client";

import React, { useState, useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";
import { formatNumber } from "@/lib/utils";
import { 
  X, 
  Printer, 
  Barcode as BarcodeIcon, 
  Copy, 
  Check, 
  Download
} from "lucide-react";
import styles from "./BarcodeModal.module.css";
import { printHtml } from "@/lib/printFrame";
import { labelPrintJob } from "@/lib/barcodeLabel";

export default function BarcodeModal({ isOpen, onClose, product }) {
  const [showPrice, setShowPrice] = useState(true);
  const [copied, setCopied] = useState(false);
  const [labelSize, setLabelSize] = useState("50x30"); // Default standard large
  const [fontSizeMode, setFontSizeMode] = useState("compact"); // "compact" | "standard" | "mini"
  const [copies, setCopies] = useState(1);
  const barcodeSvgRef = useRef(null);

  const rawBarcode = product?.barcode || product?.code || "6221001001";
  const barcodeValue = String(rawBarcode).trim().replace(/[^\x20-\x7E]/g, "") || "6221001001";

  // Label sizes in mm (Calibrated for crisp, high-impact thermal stickers)
  const sizeMap = {
    "50x30": { w: 50, h: 30, barWidth: 1.8, barHeight: 46, label: "50 × 30 مم", sub: "(المقاس القياسي)" },
    "50x25": { w: 50, h: 25, barWidth: 1.7, barHeight: 38, label: "50 × 25 مم", sub: "(مقاس عريض)" },
    "50x40": { w: 50, h: 40, barWidth: 1.9, barHeight: 56, label: "50 × 40 مم", sub: "(مقاس كبير جداً)" },
    "60x40": { w: 60, h: 40, barWidth: 2.1, barHeight: 62, label: "60 × 40 مم", sub: "(مقاس جامبو)" },
    "38x25": { w: 38, h: 25, barWidth: 1.25, barHeight: 26, label: "38 × 25 مم", sub: "(مقاس وسط)" },
    "38x20": { w: 38, h: 20, barWidth: 1.15, barHeight: 20, label: "38 × 20 مم", sub: "(مقاس صغير)" }
  };

  const displayPrice = product?.sellingPrice ? product.sellingPrice : product?.wholesalePrice || 0;

  // Generate real vector Code128 Barcode using JsBarcode
  useEffect(() => {
    if (!isOpen || !product || !barcodeSvgRef.current) return;

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
      console.error("JsBarcode error in BarcodeModal:", err);
    }
  }, [isOpen, product, barcodeValue, labelSize]);

  if (!isOpen || !product) return null;

  // Render high-res sticker on 300 DPI Canvas (100% BORDERLESS, ULTRA-BOLD & HIGH-LEGIBILITY)
  const createStickerCanvas = (callback) => {
    const config = sizeMap[labelSize] || sizeMap["50x30"];
    const widthMm = config.w;
    const heightMm = config.h;

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
        const scale = 12; // 12 px per mm = ~300 DPI (304.8 DPI exact for thermal crispness)
        const canvasWidth = widthMm * scale;
        const canvasHeight = heightMm * scale;

        const canvas = document.createElement("canvas");
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        const ctx = canvas.getContext("2d");

        // 1. Pure Crisp White Background (100% BORDERLESS - No outer border or edge bleeding)
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        // Proportional sizing based on sticker dimensions
        const isSmall = widthMm < 45 || heightMm < 25;
        const fontMult = fontSizeMode === "mini" ? 0.84 : fontSizeMode === "standard" ? 1.18 : 1.0;

        // Big, heavy, ultra-legible fonts for thermal print
        const fontTitleSize = Math.round((isSmall ? 18 : 30) * fontMult);
        const fontStoreSize = Math.round((isSmall ? 11 : 16) * fontMult);
        const fontBarcodeSize = Math.round((isSmall ? 18 : 28) * fontMult);
        const fontPriceSize = Math.round((isSmall ? 18 : 28) * fontMult);

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

        const headerTextHeight = fontTitleSize;
        const footerTextHeight = Math.max(fontBarcodeSize, fontPriceSize);

        // Total content block height
        const totalContentHeight = headerTextHeight + gapHeaderBarcode + drawH + gapBarcodeFooter + footerTextHeight;

        // Perfectly vertically center the entire block within the sticker
        const startY = Math.round((canvasHeight - totalContentHeight) / 2);

        const headerCenterY = startY + Math.round(headerTextHeight / 2);
        const barcodeDrawY = startY + headerTextHeight + gapHeaderBarcode;
        const footerCenterY = barcodeDrawY + drawH + gapBarcodeFooter + Math.round(footerTextHeight / 2);
        const barcodeDrawX = Math.round((canvasWidth - drawW) / 2);

        // Helper to truncate text safely if product name is extra long
        const truncateToFit = (text, maxW) => {
          if (!text) return "";
          if (ctx.measureText(text).width <= maxW) return text;
          let trimmed = text;
          while (trimmed.length > 2 && ctx.measureText(trimmed + "...").width > maxW) {
            trimmed = trimmed.slice(0, -1);
          }
          return trimmed + "...";
        };

        // 2. Header: Product Name (Right) + Store Brand (Left) - Heavy 900 weight
        ctx.fillStyle = "#000000";
        ctx.textBaseline = "middle";

        const storeText = "★ NELLY ★";
        ctx.font = `900 ${fontStoreSize}px "Segoe UI", Arial, Tahoma, sans-serif`;
        const storeWidth = ctx.measureText(storeText).width;

        ctx.textAlign = "left";
        ctx.fillText(storeText, safeMarginX, headerCenterY);

        ctx.font = `900 ${fontTitleSize}px "Segoe UI", Arial, Tahoma, sans-serif`;
        ctx.textAlign = "right";
        const maxTitleWidth = canvasWidth - (safeMarginX * 2) - storeWidth - 16;
        const safeTitle = truncateToFit(product.name || "منتج", maxTitleWidth);
        ctx.fillText(safeTitle, canvasWidth - safeMarginX, headerCenterY);

        // 3. Barcode Vector Graphic: Sharp, deep black, centered
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(image, barcodeDrawX, barcodeDrawY, drawW, drawH);

        // 4. Footer: Barcode Digits (Left) + Price (Right) - Heavy 900 weight
        ctx.fillStyle = "#000000";
        ctx.textBaseline = "middle";

        if (showPrice && displayPrice > 0) {
          ctx.font = `900 ${fontBarcodeSize}px monospace, "Courier New", Courier`;
          ctx.textAlign = "left";
          ctx.fillText(barcodeValue, safeMarginX, footerCenterY);

          ctx.font = `900 ${fontPriceSize}px "Segoe UI", Arial, Tahoma, sans-serif`;
          ctx.textAlign = "right";
          ctx.fillText(`${formatNumber(displayPrice)} ج.م`, canvasWidth - safeMarginX, footerCenterY);
        } else {
          // Centered barcode digits if price is hidden
          ctx.font = `900 ${fontBarcodeSize}px monospace, "Courier New", Courier`;
          ctx.textAlign = "center";
          ctx.fillText(barcodeValue, Math.round(canvasWidth / 2), footerCenterY);
        }

        callback(canvas, widthMm, heightMm);
      } catch (err) {
        console.error("Canvas draw error in BarcodeModal:", err);
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

  // Vector thermal print: dot-aligned bars + real text, exact label page size, N copies in one job (lib/barcodeLabel.js).
  const handlePrint = () => {
    const config = sizeMap[labelSize] || sizeMap["50x30"];
    const fontScale = fontSizeMode === "mini" ? 0.84 : fontSizeMode === "standard" ? 1.18 : 1.0;
    try {
      const job = labelPrintJob({
        code: barcodeValue,
        name: product.name || "منتج",
        price: showPrice && displayPrice > 0 ? `${formatNumber(displayPrice)} ج.م` : null,
        widthMm: config.w,
        heightMm: config.h,
        fontScale,
        copies,
      });
      printHtml({ title: `Barcode_${barcodeValue}`, body: job.body, css: job.css });
    } catch (err) {
      console.error("Barcode print error:", err);
      alert("تعذر توليد الباركود لهذا الكود. راجع رقم الباركود.");
    }
  };

  // Download barcode image directly
  const handleDownloadImage = () => {
    createStickerCanvas((canvas) => {
      try {
        const pngUrl = canvas.toDataURL("image/png");
        const downloadLink = document.createElement("a");
        downloadLink.href = pngUrl;
        downloadLink.download = `Barcode_${product?.name || "Product"}_${barcodeValue}.png`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
      } catch (err) {
        console.error("Download image error:", err);
      }
    });
  };

  const handleCopyBarcode = () => {
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
        {/* Top Header */}
        <div className={styles.modalHeader}>
          <div className={styles.brandGroup}>
            <div className={styles.iconBox}>
              <BarcodeIcon size={20} />
            </div>
            <div>
              <h3 className={styles.modalTitle}>
                طباعة ملصق الباركود للمنتج
              </h3>
              <span className={styles.modalSubtitle}>
                ملصق حراري بدون إطار - خط كبير عالي الوضوح
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
          {/* Controls: Size, Price, Font Mode */}
          <div className={styles.controlsBox}>
            {/* Label Size Buttons */}
            <div>
              <div className={styles.controlRow}>
                <span className={styles.controlLabel}>
                  مقاس الاستيكر الحراري:
                </span>
                <label className={styles.priceCheckboxLabel}>
                  <input 
                    type="checkbox" 
                    checked={showPrice} 
                    onChange={(e) => setShowPrice(e.target.checked)} 
                    className={styles.pinkCheckbox}
                  />
                  <span>إظهار السعر بالملصق</span>
                </label>
              </div>

              <div className={styles.sizesGrid}>
                {[
                  { id: "50x30", label: "50 × 30 مم", sub: "(المقاس القياسي)" },
                  { id: "50x25", label: "50 × 25 مم", sub: "(مقاس عريض)" },
                  { id: "50x40", label: "50 × 40 مم", sub: "(مقاس كبير جداً)" },
                  { id: "60x40", label: "60 × 40 مم", sub: "(مقاس جامبو)" },
                  { id: "38x25", label: "38 × 25 مم", sub: "(مقاس وسط)" },
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

            {/* Copies */}
            <div className={styles.densityRow}>
              <span className={styles.densityLabel}>عدد النسخ:</span>
              <input
                type="number"
                min={1}
                max={500}
                value={copies}
                onChange={(e) => setCopies(Math.min(500, Math.max(1, Number(e.target.value) || 1)))}
                className="form-input num-font"
                style={{ width: 90, textAlign: "center" }}
                dir="ltr"
              />
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
          </div>

          {/* ===================================================================
              PREVIEW (BORDERLESS 100% - MATCHES PHYSICAL THERMAL STICKER)
             =================================================================== */}
          <div className={styles.previewWrapper}>
            <span className={styles.previewHeading}>
              معاينة ملصق المنتج الفعلي المطبوع ({sizeMap[labelSize]?.label}):
            </span>

            {/* PREVIEW CONTAINER (100% BORDERLESS) */}
            <div className={`${styles.previewContainer} ${getContainerSizeClass()}`}>
              {/* Product Header (Clean Borderless) */}
              <div className={styles.previewHeader}>
                <span className={`${styles.previewProductName} ${isLargeLabel ? styles.previewProductNameLarge : styles.previewProductNameSmall}`}>
                  {product.name}
                </span>
                <span className={`${styles.previewBrandTag} ${isLargeLabel ? styles.previewBrandTagLarge : styles.previewBrandTagSmall}`}>
                  ★ NELLY ★
                </span>
              </div>

              {/* Barcode Vector Graphic (Compact & Centered) */}
              <div className={styles.svgContainer}>
                <svg 
                  ref={barcodeSvgRef} 
                  className={`${styles.barcodeSvg} ${labelSize === "60x40" || labelSize === "50x40" ? styles.barcodeSvgLarge : labelSize === "50x30" ? styles.barcodeSvgMedium : styles.barcodeSvgSmall}`} 
                />
              </div>

              {/* Barcode Digits & Price (Clean Borderless) */}
              <div className={styles.previewFooter}>
                <span className={`num-font ${styles.barcodeText} ${isLargeLabel ? styles.barcodeTextLarge : styles.barcodeTextSmall}`} dir="ltr">
                  {barcodeValue}
                </span>
                {showPrice && displayPrice > 0 && (
                  <span className={`${styles.productPrice} ${isLargeLabel ? styles.productPriceLarge : styles.productPriceSmall}`}>
                    <span className="num-font" dir="ltr">{formatNumber(displayPrice)}</span> ج.م
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Copy */}
          <div className={styles.copyBox}>
            <div>
              <span className={styles.copyLabel}>كود الباركود الدولي:</span>
              <strong className={`num-font ${styles.copyValue}`}>{barcodeValue}</strong>
            </div>

            <button
              type="button"
              onClick={handleCopyBarcode}
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

"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";
import styles from "./CustomSelect.module.css";

export default function CustomSelect({
  options = [],
  value,
  onChange,
  placeholder = "اختر...",
  icon: Icon = null,
  style = {}
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Normalize options to { value, label } format
  const normalizedOptions = options.map((opt) => {
    if (typeof opt === "object" && opt !== null) {
      return { value: opt.value, label: opt.label || opt.value };
    }
    return { value: opt, label: opt };
  });

  const selectedOption = normalizedOptions.find((opt) => opt.value === value) || {
    value: value,
    label: value || placeholder
  };

  // Close on outside click or Escape
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const triggerClass = `${styles.triggerBtn} ${isOpen ? styles.triggerBtnOpen : ""}`;
  const chevronClass = `${styles.chevronIcon} ${isOpen ? styles.chevronOpen : ""}`;

  return (
    <div 
      ref={dropdownRef} 
      className={styles.selectWrapper}
      style={style}
    >
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={triggerClass}
      >
        <div className={styles.triggerContent}>
          {Icon && <Icon size={16} className={styles.triggerIcon} />}
          <span className={styles.triggerLabel}>
            {selectedOption.label}
          </span>
        </div>

        <ChevronDown size={18} className={chevronClass} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className={styles.dropdownMenu}>
          {normalizedOptions.map((opt) => {
            const isSelected = opt.value === value;
            const itemClass = `${styles.optionItem} ${isSelected ? styles.optionSelected : ""}`;

            return (
              <div
                key={opt.value}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={itemClass}
              >
                <span>{opt.label}</span>

                {isSelected && (
                  <div className={styles.checkBadge}>
                    <Check size={14} strokeWidth={3} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

"use client";

import { formatNumber } from "@/lib/utils";
import styles from "./StatCard.module.css";

const THEME_MAP = {
  rose: styles.themeRose,
  emerald: styles.themeEmerald,
  gold: styles.themeGold,
  ruby: styles.themeRuby,
  purple: styles.themePurple,
};

export default function StatCard({ 
  title, 
  value, 
  suffix = "", 
  subtitle, 
  icon: Icon, 
  theme = "rose",
  trendText,
  onClick
}) {
  const themeClass = THEME_MAP[theme] || styles.themeRose;
  const cardClassName = `glass-card ${styles.card} ${themeClass} ${onClick ? styles.clickable : ""}`;

  return (
    <div className={cardClassName} onClick={onClick}>
      <div className={styles.header}>
        <div className={styles.contentCol}>
          <span className={styles.title}>
            {title}
          </span>
          <div className={styles.valueWrapper}>
            <span className={`num-font ${styles.value}`} dir="ltr">
              {formatNumber(value)}
            </span>
            {suffix && (
              <span className={styles.suffix}>
                {suffix}
              </span>
            )}
          </div>
        </div>

        {Icon && (
          <div className={styles.iconWrapper}>
            <Icon size={20} />
          </div>
        )}
      </div>

      {(subtitle || trendText) && (
        <div className={styles.footer}>
          {subtitle && (
            <span className={styles.subtitle}>
              {subtitle}
            </span>
          )}
          {trendText && (
            <span className={styles.trendBadge}>
              {trendText}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

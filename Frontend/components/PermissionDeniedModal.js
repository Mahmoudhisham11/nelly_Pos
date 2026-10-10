"use client";

import { ShieldAlert, LogIn } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import styles from "./PermissionDeniedModal.module.css";

export default function PermissionDeniedModal({ isOpen, onClose, actionName = "هذه العملية" }) {
  const router = useRouter();
  const { logout } = useAuth();

  if (!isOpen) return null;

  const handleSwitchAccount = async () => {
    onClose();
    await logout();
    router.push("/login");
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className={`modal-content ${styles.modalCard}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Animated Warning / Shield Icon */}
        <div className={styles.iconWrapper}>
          <ShieldAlert size={38} />
        </div>

        {/* Title */}
        <h3 className={styles.title}>
          تنبيه الصلاحيات | غير مصرح
        </h3>

        {/* Message */}
        <p className={styles.message}>
          عذراً، إجراء <strong className={styles.actionHighlight}>"{actionName}"</strong> وتعديل بيانات المخزن ورؤية الأسعار مخصصة فقط لـ <strong className={styles.adminHighlight}>مسؤول المخزن (Admin)</strong>.
        </p>

        {/* Current Role Tag */}
        <div className={styles.roleBox}>
          <span className={styles.roleLabel}>صلاحية حسابك الحالية:</span>
          <span className={styles.roleBadge}>
            👤 مستخدم عادي (User)
          </span>
        </div>

        {/* Action Buttons */}
        <div className={styles.buttonGroup}>
          <button 
            onClick={onClose}
            className={`btn-secondary ${styles.dismissBtn}`}
          >
            حسناً، فهمت
          </button>
          <button 
            onClick={handleSwitchAccount}
            className={`btn-primary ${styles.switchBtn}`}
          >
            <LogIn size={16} />
            دخول كمسؤول
          </button>
        </div>
      </div>
    </div>
  );
}

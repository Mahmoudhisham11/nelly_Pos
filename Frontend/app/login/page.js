"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth, LOGOUT_REASON_KEY } from "@/context/AuthContext";
import { sendPasswordReset, cloudAvailable, cloudErrorMessage } from "@/lib/cloudAccount";
import { 
  Lock, 
  Mail, 
  User, 
  AlertCircle,
  CheckCircle2,
  LogIn,
  UserPlus,
  Eye,
  EyeOff,
  Store
} from "lucide-react";
import styles from "./login.module.css";

export default function LoginPage() {
  const router = useRouter();
  const { 
    user, 
    loginWithEmail, 
    registerWithEmail, 
    loading 
  } = useAuth();

  const [activeTab, setActiveTab] = useState("signin");
  const [name, setName] = useState("");
  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [branch, setBranch] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    try {
      const reason = sessionStorage.getItem(LOGOUT_REASON_KEY);
      if (reason) {
        sessionStorage.removeItem(LOGOUT_REASON_KEY);
        setErrorMsg(reason);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (user && !loading) {
      router.push("/");
    }
  }, [user, loading, router]);

  const handleForgotPassword = async () => {
    setErrorMsg("");
    setSuccessMsg("");
    const email = emailOrUsername.trim();
    if (!email.includes("@")) {
      setErrorMsg("اكتب البريد الإلكتروني بتاع حسابك في الخانة الأول، وبعدين دوس نسيت كلمة المرور.");
      return;
    }
    if (!cloudAvailable()) {
      setErrorMsg("استرجاع كلمة المرور محتاج اتصال بالإنترنت.");
      return;
    }
    try {
      await sendPasswordReset(email);
      setSuccessMsg("لو الإيميل ده مسجل عندنا، هيوصلك عليه رابط لتغيير كلمة المرور (شوف كمان الـ Spam).");
    } catch (e) {
      setErrorMsg(cloudErrorMessage(e));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    const identifier = emailOrUsername.trim();
    const cleanPassword = password.trim();

    if (!identifier || !cleanPassword) {
      setErrorMsg("يرجى ملء جميع الحقول المطلوبة.");
      return;
    }

    if (activeTab === "register") {
      if (!name.trim()) {
        setErrorMsg("يرجى كتابة اسمك الكامل.");
        return;
      }
      if (cleanPassword.length < 6) {
        setErrorMsg("كلمة المرور يجب ألا تقل عن 6 أحرف.");
        return;
      }
      if (cleanPassword !== confirmPassword.trim()) {
        setErrorMsg("كلمات المرور غير متطابقة.");
        return;
      }

      if (!branch.trim()) {
        setErrorMsg("يرجى كتابة اسم المحل.");
        return;
      }
      if (!identifier.includes("@")) {
        setErrorMsg("يرجى كتابة بريد إلكتروني صحيح.");
        return;
      }

      setIsSubmitting(true);
      const res = await registerWithEmail(name, identifier, cleanPassword, branch);
      setIsSubmitting(false);

      if (res && res.pending) {
        // account created, waiting for the admin: go back to sign-in with the e-mail filled in
        setSuccessMsg(res.message || "تم إنشاء الحساب، في انتظار تفعيل المسؤول.");
        setActiveTab("signin");
        setPassword("");
        setConfirmPassword("");
      } else if (res && res.success) {
        setSuccessMsg("تم إنشاء حسابك بنجاح! جاري تحويلك للمخزن...");
        setTimeout(() => router.push("/"), 700);
      } else {
        setErrorMsg(res?.error || "حدث خطأ أثناء إنشاء الحساب.");
      }
    } else {
      setIsSubmitting(true);
      const res = await loginWithEmail(identifier, cleanPassword);
      setIsSubmitting(false);

      if (res && res.success) {
        router.push("/");
      } else if (res?.pending) {
        setSuccessMsg(res.error);
      } else {
        setErrorMsg(res?.error || "اسم المستخدم أو كلمة المرور غير صحيحة.");
      }
    }
  };

  return (
    <div className={styles.loginPageWrapper}>
      {/* Ambient background glows */}
      <div className={styles.ambientGlowTop} />
      <div className={styles.ambientGlowBottom} />

      <div className={`glass-panel ${styles.loginCard}`}>
        {/* Brand Header */}
        <div className={styles.brandHeader}>
          <div className={styles.brandLogoBox}>
            N
          </div>
          <h1 className={styles.brandTitle}>
            <span className="gradient-text-rose">Nelly</span>
          </h1>
          <p className={styles.brandSubtitle}>
            نظام إدارة وجرد المخزون وتحديد الصلاحيات
          </p>
        </div>

        {/* Tab Selector: Sign In vs Register */}
        <div className={styles.tabSelector}>
          <button
            type="button"
            onClick={() => { setActiveTab("signin"); setErrorMsg(""); setSuccessMsg(""); }}
            className={`${styles.tabButton} ${activeTab === "signin" ? styles.tabActive : styles.tabInactive}`}
          >
            <LogIn size={16} />
            تسجيل الدخول
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab("register"); setErrorMsg(""); setSuccessMsg(""); }}
            className={`${styles.tabButton} ${activeTab === "register" ? styles.tabActive : styles.tabInactive}`}
          >
            <UserPlus size={16} />
            إنشاء حساب جديد
          </button>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className={styles.alertError}>
            <AlertCircle size={17} className={styles.alertIcon} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Success Alert */}
        {successMsg && (
          <div className={styles.alertSuccess}>
            <CheckCircle2 size={17} className={styles.alertIcon} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Email & Password Form */}
        <form onSubmit={handleSubmit}>
          {activeTab === "register" && (
            <div className="form-group">
              <label className="form-label">الاسم الكامل <span className={styles.requiredAsterisk}>*</span></label>
              <div className={styles.inputWrapper}>
                <input 
                  type="text"
                  className={`form-input ${styles.inputWithIcon}`}
                  placeholder="مثال: أحمد محمد"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
                <User size={18} className={styles.inputIcon} />
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">
              {activeTab === "register" ? "البريد الإلكتروني" : "اسم المستخدم أو البريد الإلكتروني"} <span className={styles.requiredAsterisk}>*</span>
            </label>
            <div className={styles.inputWrapper}>
              <input 
                type="text"
                className={`form-input ${styles.inputWithIconRtl}`}
                dir="auto"
                placeholder={activeTab === "register" ? "name@example.com" : "admin أو البريد الإلكتروني"}
                value={emailOrUsername}
                onChange={(e) => setEmailOrUsername(e.target.value)}
                required
              />
              <Mail size={18} className={styles.inputIcon} />
            </div>
          </div>

          {activeTab === "register" && (
            <div className="form-group">
              <label className="form-label">اسم المحل <span className={styles.requiredAsterisk}>*</span></label>
              <div className={styles.inputWrapper}>
                <input
                  type="text"
                  className={`form-input ${styles.inputWithIcon}`}
                  placeholder="مثال: Nelly - فرع المعادي"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  maxLength={150}
                  required
                />
                <Store size={18} className={styles.inputIcon} />
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">كلمة المرور <span className={styles.requiredAsterisk}>*</span></label>
            <div className={styles.inputWrapper}>
              <input 
                type={showPassword ? "text" : "password"}
                className={`form-input num-font ${styles.inputWithIconRtl}`}
                dir="ltr"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <Lock size={18} className={styles.inputIcon} />
              <button
                type="button"
                className={styles.passwordToggleBtn}
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {activeTab === "register" && (
            <div className="form-group">
              <label className="form-label">تأكيد كلمة المرور <span className={styles.requiredAsterisk}>*</span></label>
              <div className={styles.inputWrapper}>
                <input 
                  type={showConfirmPassword ? "text" : "password"}
                  className={`form-input num-font ${styles.inputWithIconRtl}`}
                  dir="ltr"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
                <Lock size={18} className={styles.inputIcon} />
                <button
                  type="button"
                  className={styles.passwordToggleBtn}
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  title={showConfirmPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          )}

          {activeTab === "signin" && (
            <label className={styles.rememberMeRow}>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className={styles.rememberMeCheckbox}
              />
              <span>تذكر تسجيل الدخول على هذا الجهاز</span>
            </label>
          )}

          {activeTab === "signin" && (
            <button
              type="button"
              onClick={handleForgotPassword}
              style={{ background: "none", border: "none", color: "#db2777", fontWeight: 700, cursor: "pointer", padding: "0 0 10px", fontSize: "0.85rem" }}
            >
              نسيت كلمة المرور؟
            </button>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className={`btn-primary ${styles.submitBtn}`}
          >
            {isSubmitting ? "جاري المعالجة..." : (activeTab === "register" ? "إنشاء الحساب والتسجيل" : "تسجيل الدخول")}
          </button>
        </form>

        {/* Footer info */}
        <div className={styles.footerCopyright}>
          جميع الحقوق محفوظة © Nelly
        </div>
      </div>
    </div>
  );
}

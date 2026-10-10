"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { api, apiRequest, getAuthToken, setAuthToken } from "@/lib/apiClient";
import { cloudSession } from "@/lib/cloudSession";
import { cloudAvailable, cloudErrorMessage, cloudSignIn, signUpShop } from "@/lib/cloudAccount";
import { openShopDb, shopForEmail } from "@/lib/shopDb";

const STORAGE_KEY = "nelly_desktop_user_auth";
// Accounts this device saw being stopped (or whose shop was suspended / expired): the offline login refuses them
// until an online login proves they were re-activated / renewed.
const BLOCKED_KEY = "nelly:blocked";
export const LOGOUT_REASON_KEY = "nelly:logout-reason";
const readBlocked = () => { try { return JSON.parse(localStorage.getItem(BLOCKED_KEY) || "{}"); } catch { return {}; } };
const setBlocked = (email, reason) => {
  try {
    const b = readBlocked();
    const e = String(email || "").toLowerCase();
    if (!e) return;
    if (reason) b[e] = reason; else delete b[e];
    localStorage.setItem(BLOCKED_KEY, JSON.stringify(b));
  } catch {}
};

const AuthContext = createContext({
  user: null,
  role: "admin",
  isAdmin: true,
  permissions: [],
  loading: true,
  loginWithEmail: async () => {},
  registerWithEmail: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState("admin");
  const [permissions, setPermissions] = useState(["admin.all"]);
  const [loading, setLoading] = useState(true);

  // Validate session on app initialization
  useEffect(() => {
    let isMounted = true;

    // 1. Instantly read local cache to prevent UI flashing or login redirects
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && isMounted) {
          setUser(parsed);
          setRole(parsed.role || "admin");
          setPermissions(parsed.permissions || ["admin.all"]);
          setLoading(false);
        }
      }
    } catch (_) {}

    async function checkAuthSession() {
      const token = getAuthToken();
      if (!token) {
        if (isMounted) setLoading(false);
        return;
      }

      try {
        const userInfo = await api.get("/auth/me");
        if (isMounted && userInfo && userInfo.id) {
          const userObj = {
            uid: userInfo.id,
            id: userInfo.id,
            displayName: userInfo.full_name || userInfo.displayName || userInfo.username || userInfo.name,
            username: userInfo.username,
            email: userInfo.email,
            role: userInfo.roles?.[0]?.toLowerCase() || userInfo.role || "admin",
            roles: userInfo.roles || [userInfo.role || "admin"],
            permissions: userInfo.permissions || ["admin.all"],
            branches: userInfo.branches || [],
            branch: userInfo.branch || "",
          };
          setUser(userObj);
          setRole(userObj.role);
          setPermissions(userObj.permissions);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(userObj));
        }
      } catch (err) {
        // Only clear if server explicitly answered 401 Unauthorized
        if (err?.status === 401) {
          setAuthToken(null);
          localStorage.removeItem(STORAGE_KEY);
          if (isMounted) {
            setUser(null);
            setRole("user");
            setPermissions([]);
          }
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    checkAuthSession();

    return () => {
      isMounted = false;
    };
  }, []);

  // The API client raises this when the server rejects our token (expired / revoked / secret changed)
  useEffect(() => {
    const onUnauthorized = () => {
      try {
        localStorage.removeItem(STORAGE_KEY);
        sessionStorage.removeItem(STORAGE_KEY);
      } catch (_) {}
      setUser(null);
      setRole("user");
      setPermissions([]);
    };
    window.addEventListener("nelly:unauthorized", onUnauthorized);
    return () => window.removeEventListener("nelly:unauthorized", onUnauthorized);
  }, []);

  // Stopped from Devora / by the shop's admin, shop suspended or subscription ended: log out RIGHT NOW on this
  // device (web or desktop), and keep the account out until it is re-activated / renewed.
  useEffect(() => cloudSession.subscribe((st) => {
    if (!st.revoked) return;
    let current = null;
    try { current = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); } catch {}
    const email = current?.email || st.email;
    if (email) setBlocked(email, st.revoked);
    if (!current) return;
    try { sessionStorage.setItem(LOGOUT_REASON_KEY, st.revoked); } catch {}
    api.post("/auth/logout").catch(() => {});
    setAuthToken(null);
    try { localStorage.removeItem(STORAGE_KEY); sessionStorage.removeItem(STORAGE_KEY); } catch {}
    setUser(null);
    setRole("user");
    setPermissions([]);
    cloudSession.signOut().catch(() => {});
  }), []);

  /** Stores the logged-in user returned by the backend (local or cloud login). */
  const applySession = (res) => {
    setAuthToken(res.access_token);
    const authenticatedUser = {
      uid: res.user.id || res.user.uid,
      id: res.user.id || res.user.uid,
      displayName: res.user.full_name || res.user.displayName || res.user.name || res.user.username,
      username: res.user.username || res.user.name,
      email: res.user.email,
      role: res.user.roles?.[0]?.toLowerCase() || res.user.role?.toLowerCase() || "admin",
      roles: res.user.roles || [res.user.role || "admin"],
      permissions: res.user.permissions || ["admin.all"],
      branches: res.user.branches || [],
      branch: res.user.branch || "",
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(authenticatedUser));
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(authenticatedUser));
    setUser(authenticatedUser);
    setRole(authenticatedUser.role);
    setPermissions(authenticatedUser.permissions);
    return authenticatedUser;
  };

  /** Opens the shop's own local database and logs the verified cloud account into it. */
  const enterShop = async ({ uid, idToken, shopId, email, password }) => {
    await openShopDb(shopId, email);
    return apiRequest("/auth/cloud-login", { method: "POST", body: { idToken, uid, password }, timeout: 30000 });
  };

  const localLogin = (identifier, password) =>
    apiRequest("/auth/login", { method: "POST", body: { username: identifier, email: identifier, password, device_id: "desktop-local-01" } });

  // Login. With internet: the cloud account decides the shop, its local database is opened and the account is
  // mirrored into it (so the same login also works offline later). Without internet (or for an account that only
  // exists on this device): the local login on the database this e-mail last used.
  const loginWithEmail = async (emailOrUsername, password) => {
    setLoading(true);
    try {
      const identifier = (emailOrUsername || "").trim();
      const cleanPassword = (password || "").trim();
      if (!identifier || !cleanPassword) {
        return { success: false, error: "يرجى كتابة اسم المستخدم/البريد الإلكتروني وكلمة المرور." };
      }
      const isEmail = identifier.includes("@");

      if (isEmail && cloudAvailable()) {
        let signed = null;
        try {
          signed = await cloudSignIn(identifier, cleanPassword);
        } catch (e) {
          const code = e?.code || "";
          // wrong password / no cloud account: maybe an account that only exists on this device
          if (!["auth/invalid-credential", "auth/user-not-found", "auth/wrong-password", "auth/network-request-failed"].includes(code)) {
            // e.g. auth/user-disabled (stopped by Devora): never let the offline login bypass it
            throw new Error(cloudErrorMessage(e));
          }
        }
        if (signed) {
          if (!signed.link?.shopId) {
            await cloudSession.signOut().catch(() => {});
            throw new Error("الحساب ده مش مرتبط بأي محل.");
          }
          if (signed.link.active === false) {
            setBlocked(identifier, "تم إيقاف هذا الحساب. تواصل مع Devora أو مسؤول المحل.");
            await cloudSession.signOut().catch(() => {});
            throw new Error("تم إيقاف هذا الحساب. تواصل مع Devora أو مسؤول المحل.");
          }
          // the shop must be running too (not suspended, subscription not ended)
          const st = await cloudSession.refresh();
          if (st.revoked) {
            setBlocked(identifier, st.revoked);
            await cloudSession.signOut().catch(() => {});
            throw new Error(st.revoked);
          }
          const res = await enterShop({ uid: signed.uid, idToken: signed.idToken, shopId: signed.link.shopId, email: identifier, password: cleanPassword });
          setBlocked(identifier, null);
          return { success: true, user: applySession(res) };
        }
      }

      // local / offline login, on the database this e-mail used last on this device
      const blockedReason = readBlocked()[identifier.toLowerCase()];
      if (blockedReason) throw new Error(blockedReason);
      const known = isEmail ? await shopForEmail(identifier) : null;
      if (known) await openShopDb(known, identifier);
      let res;
      try {
        res = await localLogin(identifier, cleanPassword);
      } catch (e) {
        if (e?.status === 401 && isEmail && !cloudAvailable() && !known) {
          throw new Error("الحساب ده لسه مادخلش على الجهاز ده قبل كده: محتاج إنترنت لأول دخول.");
        }
        throw e;
      }
      return { success: true, user: applySession(res) };
    } catch (error) {
      console.warn("Login attempt failed:", error.message);
      return { success: false, error: error.message || "اسم المستخدم أو كلمة المرور غير صحيحة." };
    } finally {
      setLoading(false);
    }
  };

  // Sign-up = a NEW shop: its own cloud account (admin), its own shop in the cloud and its own empty local database.
  const registerWithEmail = async (name, email, password, shopName = "") => {
    setLoading(true);
    try {
      const cleanName = (name || "").trim();
      const cleanEmail = (email || "").trim().toLowerCase();
      const cleanPassword = (password || "").trim();
      if (!cleanName || !cleanEmail || !cleanPassword) {
        return { success: false, error: "يرجى تعبئة جميع الحقول المطلوبة." };
      }
      if (!cloudAvailable()) {
        return { success: false, error: "إنشاء حساب جديد محتاج اتصال بالإنترنت." };
      }
      let created;
      try {
        created = await signUpShop({ name: cleanName, email: cleanEmail, password: cleanPassword, shopName });
      } catch (e) {
        throw new Error(cloudErrorMessage(e));
      }
      const res = await enterShop({ uid: created.uid, idToken: created.idToken, shopId: created.shopId, email: cleanEmail, password: cleanPassword });
      await cloudSession.refresh();
      return { success: true, user: applySession(res) };
    } catch (error) {
      console.warn("Registration attempt failed:", error.message);
      return { success: false, error: error.message || "حدث خطأ أثناء إنشاء الحساب." };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await api.post("/auth/logout").catch(() => {});
      // the next login may be another shop's account: unlink this device from the current shop's cloud
      await cloudSession.signOut().catch(() => {});
    } finally {
      setAuthToken(null);
      if (typeof window !== "undefined") {
        localStorage.removeItem(STORAGE_KEY);
        sessionStorage.removeItem(STORAGE_KEY);
      }
      setUser(null);
      setRole("user");
      setPermissions([]);
      setLoading(false);
    }
  };

  const isAdmin = role === "admin" || permissions.includes("admin.all");

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        isAdmin,
        permissions,
        loading,
        authLoading: loading,
        loginWithEmail,
        registerWithEmail,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

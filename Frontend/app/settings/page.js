"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import { subscribeToUsers, createUser, updateUser, deleteUserDoc, ROLE_OPTIONS, normalizeRole } from "@/lib/usersService";
import { formatNumber } from "@/lib/utils";
import {
  Settings,
  Users,
  ShieldAlert,
  Trash2,
  Search,
  ArrowLeft,
  Crown,
  User,
  Sparkles,
  Cloud,
  CloudDownload,
  RefreshCw,
  UserPlus,
  X
} from "lucide-react";
import { syncManager } from "@/lib/syncManager";
import { cloudSession } from "@/lib/cloudSession";
import { addMember, cloudErrorMessage, listMembers, removeMember, updateMember } from "@/lib/cloudAccount";
import BackupCard from "@/components/BackupCard";
import styles from "./settings.module.css";

export default function SettingsPage() {
  const router = useRouter();
  const { user, isAdmin, loading: authLoading } = useAuth();

  const [usersList, setUsersList] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRoleFilter, setSelectedRoleFilter] = useState("all");
  const [userToDelete, setUserToDelete] = useState(null);
  const [toastMessage, setToastMessage] = useState("");
  const [updatingUserId, setUpdatingUserId] = useState(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [newUser, setNewUser] = useState({ name: "", email: "", password: "", confirm: "", role: "cashier", branch: "" });
  const [addUserError, setAddUserError] = useState("");
  const [savingNewUser, setSavingNewUser] = useState(false);
  const [isPullingCloud, setIsPullingCloud] = useState(false);
  const [cloud, setCloud] = useState(cloudSession.state);

  useEffect(() => cloudSession.subscribe(setCloud), []);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3500);
  };

  // Re-reads every collection of the shop from the cloud and pushes anything still pending on this device.
  const handlePullFromCloud = async () => {
    if (cloud.status !== "ready") {
      alert("الجهاز مش مربوط بالسحابة. ادخل بحساب المحل من شارة المزامنة فوق.");
      return;
    }
    setIsPullingCloud(true);
    try {
      await syncManager.resyncAll();
      showToast("تمت المزامنة الكاملة مع السحابة.");
    } catch (err) {
      alert(err?.message || "حدث خطأ أثناء المزامنة.");
    } finally {
      setIsPullingCloud(false);
    }
  };

  // Authentication check
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  // Users: the shop's accounts in the cloud when this device is linked (they log in on any device),
  // otherwise this device's local users.
  const cloudMode = cloud.status === "ready" && !!cloud.shopId;
  const [cloudMembersVersion, setCloudMembersVersion] = useState(0);
  const reloadMembers = () => setCloudMembersVersion((v) => v + 1);

  useEffect(() => {
    if (!user || !isAdmin || cloudMode) return;
    const unsubscribe = subscribeToUsers((data) => {
      setUsersList(data);
      setLoadingUsers(false);
    });
    return () => unsubscribe();
  }, [user, isAdmin, cloudMode]);

  useEffect(() => {
    if (!user || !isAdmin || !cloudMode) return;
    let alive = true;
    listMembers(cloud.shopId)
      .then((list) => {
        if (!alive) return;
        setUsersList(list.map((m) => ({
          id: m.uid, uid: m.uid, cloud: true, name: m.name, displayName: m.name || m.email, email: m.email,
          role: normalizeRole(m.role || "admin"), isActive: m.active !== false, branch: m.branch || "", createdAt: null,
        })));
        setLoadingUsers(false);
      })
      .catch((e) => { if (alive) { setLoadingUsers(false); showToast(cloudErrorMessage(e)); } });
    return () => { alive = false; };
  }, [user, isAdmin, cloudMode, cloud.shopId, cloudMembersVersion]);

  const isMe = (u) => u.uid === user?.uid || (!!u.email && u.email === user?.email);

  const userLabel = (u) => u.displayName || u.name || u.email;

  // Change a user's role (admin / manager / cashier)
  const handleChangeRole = async (targetUser, newRole) => {
    if (isMe(targetUser)) {
      alert("لا يمكنك تغيير صلاحية حسابك الحالي بنفسك.");
      return;
    }
    if (newRole === targetUser.role) return;
    setUpdatingUserId(targetUser.uid);
    try {
      if (targetUser.cloud) {
        await updateMember(targetUser.uid, { role: newRole });
        reloadMembers();
      } else {
        await updateUser(targetUser.uid, { role: newRole });
      }
      const label = ROLE_OPTIONS.find((r) => r.value === newRole)?.label.split(" - ")[0] || newRole;
      showToast(`تم تغيير صلاحية "${userLabel(targetUser)}" إلى ${label}.`);
    } catch (err) {
      alert(targetUser.cloud ? cloudErrorMessage(err) : err.message);
    } finally {
      setUpdatingUserId(null);
    }
  };

  // Activate (approve a new sign-up) or stop an account
  const handleToggleActive = async (targetUser) => {
    if (isMe(targetUser)) {
      alert("لا يمكنك إيقاف حسابك الحالي.");
      return;
    }
    setUpdatingUserId(targetUser.uid);
    try {
      if (targetUser.cloud) {
        await updateMember(targetUser.uid, { active: !targetUser.isActive });
        reloadMembers();
      } else {
        await updateUser(targetUser.uid, { isActive: !targetUser.isActive });
      }
      showToast(targetUser.isActive ? `تم إيقاف حساب "${userLabel(targetUser)}".` : `تم تفعيل حساب "${userLabel(targetUser)}"، ويقدر يدخل دلوقتي.`);
    } catch (err) {
      alert(targetUser.cloud ? cloudErrorMessage(err) : err.message);
    } finally {
      setUpdatingUserId(null);
    }
  };

  const openAddUser = () => {
    setNewUser({ name: "", email: "", password: "", confirm: "", role: "cashier", branch: "" });
    setAddUserError("");
    setIsAddUserOpen(true);
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setAddUserError("");
    const { name, email, password, confirm } = newUser;
    if (!name.trim() || !email.trim() || !password.trim()) return setAddUserError("يرجى كتابة الاسم والبريد الإلكتروني وكلمة المرور.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setAddUserError("البريد الإلكتروني غير صحيح.");
    const minLen = cloudMode ? 6 : 4;
    if (password.trim().length < minLen) return setAddUserError(`كلمة المرور يجب ألا تقل عن ${minLen} أحرف.`);
    if (password.trim() !== confirm.trim()) return setAddUserError("كلمتا المرور غير متطابقتين.");
    setSavingNewUser(true);
    try {
      if (cloudMode) {
        // a cloud account of THIS shop: it can log in on any device; also saved on this device for offline use
        await addMember(cloud.shopId, { ...newUser, password: password.trim() });
        await createUser(newUser).catch(() => {});
        reloadMembers();
      } else {
        await createUser(newUser);
      }
      setIsAddUserOpen(false);
      showToast(`تم إنشاء حساب "${name.trim()}" بنجاح.`);
    } catch (err) {
      setAddUserError(cloudMode ? cloudErrorMessage(err) : err.message);
    } finally {
      setSavingNewUser(false);
    }
  };

  // Confirm delete user
  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    if (isMe(userToDelete)) {
      alert("لا يمكنك حذف حسابك الحالي.");
      setUserToDelete(null);
      return;
    }

    try {
      if (userToDelete.cloud) {
        await removeMember(userToDelete.uid);
        reloadMembers();
      } else {
        await deleteUserDoc(userToDelete.uid);
      }
      showToast(`تم حذف المستخدم "${userToDelete.displayName || userToDelete.email}" من النظام.`);
    } catch (err) {
      alert((userToDelete.cloud ? cloudErrorMessage(err) : err.message) || "حدث خطأ أثناء حذف المستخدم.");
    } finally {
      setUserToDelete(null);
    }
  };

  // Filter users
  const filteredUsers = useMemo(() => {
    return usersList.filter((u) => {
      const q = searchQuery.toLowerCase().trim();
      const name = (u.displayName || u.name || "").toLowerCase();
      const email = (u.email || "").toLowerCase();
      const branch = (u.branch || "").toLowerCase();
      const matchesQuery = !q || name.includes(q) || email.includes(q) || branch.includes(q);

      const matchesRole = selectedRoleFilter === "all"
        || (selectedRoleFilter === "pending" ? !u.isActive : u.role === selectedRoleFilter);

      return matchesQuery && matchesRole;
    });
  }, [usersList, searchQuery, selectedRoleFilter]);

  const totalUsersCount = usersList.length;
  const adminCount = usersList.filter(u => u.role === "admin").length;
  const regularCount = usersList.filter(u => u.role !== "admin").length;
  const pendingCount = usersList.filter(u => !u.isActive).length;

  if (authLoading) {
    return (
      <div className={styles.authLoadingWrapper}>
        <p className={styles.authLoadingText}>جاري التحقق من الصلاحيات...</p>
      </div>
    );
  }

  // If user is logged in but NOT an Admin: Render Permission Denied Screen
  if (user && !isAdmin) {
    return (
      <div className="app-layout">
        <Sidebar
          isMobileOpen={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
        />
        <div className="main-content">
          <Navbar
            onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          />
          <main className={`page-wrapper ${styles.permissionDeniedWrapper}`}>
            <div className={`glass-panel ${styles.permissionDeniedCard}`}>
              <div className={styles.permissionDeniedIcon}>
                <ShieldAlert size={40} />
              </div>

              <h2 className={styles.permissionDeniedTitle}>
                ليس لديك صلاحية لدخول هذه الصفحة
              </h2>

              <p className={styles.permissionDeniedDesc}>
                عذراً، صفحة إعدادات التطبيق وإدارة حسابات وصلاحيات المستخدمين مخصصة ومحمية حصرياً لـ <strong className={styles.permissionDeniedHighlight}>مسؤول المخزن (Admin)</strong>.
              </p>

              <div className={styles.permissionDeniedRoleBox}>
                <span className={styles.roleBoxLabel}>رتبة حسابك الحالية:</span>
                <span className={styles.roleBoxBadge}>
                  👤 مستخدم عادي (User)
                </span>
              </div>

              <div className={styles.permissionDeniedActions}>
                <Link href="/" className={`btn-primary ${styles.returnHomeBtn}`}>
                  <ArrowLeft size={16} />
                  العودة للوحة التحكم
                </Link>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <Sidebar
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      <div className="main-content">
        <Navbar
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
        />

        <main className="page-wrapper">
          {/* Toast Alert */}
          {toastMessage && (
            <div className={styles.toastWrapper}>
              <Sparkles size={18} color="#f472b6" />
              <span>{toastMessage}</span>
            </div>
          )}

          {/* Page Header */}
          <div className={styles.headerRow}>
            <div>
              <div className={styles.headerTitleWrapper}>
                <div className={styles.headerIconBox}>
                  <Settings size={22} />
                </div>
                <h2 className={styles.headerTitle}>إعدادات النظام وإدارة المستخدمين</h2>
              </div>
              <p className={styles.headerSubtitle}>
                التحكم في حسابات المستخدمين، تعديل الرتب والصلاحيات (Admin / User)، وإدارة الأذونات
              </p>
            </div>
          </div>

          {isAdmin && <BackupCard />}

          {/* Stats Cards (Swiper on Mobile, Grid on Desktop) */}
          <section className="mobile-cards-swiper">
            <div className="mobile-swiper-card">
              <div className={`glass-card ${styles.statCardUsers}`}>
                <div className={styles.statInner}>
                  <div>
                    <div className={styles.statLabel}>إجمالي المستخدمين المسجلين</div>
                    <div className={`num-font ${styles.statValue}`} dir="ltr">
                      {formatNumber(totalUsersCount)}
                    </div>
                  </div>
                  <div className={styles.iconUsers}>
                    <Users size={22} />
                  </div>
                </div>
              </div>
            </div>

            <div className="mobile-swiper-card">
              <div className={`glass-card ${styles.statCardAdmins}`}>
                <div className={styles.statInner}>
                  <div>
                    <div className={styles.statLabel}>مسؤولو المخزن (Admins)</div>
                    <div className={`num-font ${styles.statValueAdmins}`} dir="ltr">
                      {formatNumber(adminCount)}
                    </div>
                  </div>
                  <div className={styles.iconAdmins}>
                    <Crown size={22} />
                  </div>
                </div>
              </div>
            </div>

            <div className="mobile-swiper-card">
              <div className={`glass-card ${styles.statCardRegular}`}>
                <div className={styles.statInner}>
                  <div>
                    <div className={styles.statLabel}>المستخدمون العاديون (Users)</div>
                    <div className={`num-font ${styles.statValueRegular}`} dir="ltr">
                      {formatNumber(regularCount)}
                    </div>
                  </div>
                  <div className={styles.iconRegular}>
                    <User size={22} />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Mobile Swipe Hint */}
          <div className="swiper-mobile-hint">
            <span>👈 اسحب لمشاهدة باقي الإحصائيات 👉</span>
          </div>

          {/* Cloud Sync Section */}
          <section className={styles.cloudSyncCard}>
            <div className={styles.cloudSyncHeader}>
              <div className={styles.cloudSyncTitleGroup}>
                <div className={styles.cloudIconBox}>
                  <Cloud size={24} />
                </div>
                <div>
                  <h3 className={styles.cloudTitle}>الربط السحابي ومزامنة قاعدة البيانات (Firebase Cloud)</h3>
                  <p className={styles.cloudSubtitle}>
                    سحب وتحديث كافة بيانات المتجر من السحابة وتخزينها محلياً للعمل بكفاءة تامة بدون إنترنت
                  </p>
                </div>
              </div>

              <div className={styles.cloudSyncActionGroup}>
                <div className={styles.cloudBadge}>
                  <span className={styles.cloudDot} style={cloud.status === "ready" ? undefined : { background: "#f59e0b", boxShadow: "none" }}></span>
                  <span>
                    {cloud.status === "ready"
                      ? `متصل: ${cloud.shopName || cloud.shopId} (${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || ""})`
                      : "غير مربوط بالسحابة"}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handlePullFromCloud}
                  disabled={isPullingCloud}
                  className={styles.cloudSyncBtn}
                >
                  {isPullingCloud ? (
                    <>
                      <RefreshCw size={18} className={styles.spin} />
                      <span>جاري المزامنة...</span>
                    </>
                  ) : (
                    <>
                      <CloudDownload size={18} />
                      <span>مزامنة كاملة مع السحابة الآن</span>
                    </>
                  )}
                </button>
              </div>
            </div>

          </section>

          {/* Users Management Panel */}
          <section className={`glass-panel ${styles.panel}`}>
            {/* Toolbar */}
            <div className={styles.toolbar}>
              <div className={styles.searchWrapper}>
                <input
                  type="text"
                  className={`form-input ${styles.searchInput}`}
                  placeholder="بحث بالاسم أو البريد الإلكتروني..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <Search size={18} color="#db2777" className={styles.searchIcon} />
              </div>

              {/* Role Filter Buttons */}
              <div className={styles.filterGroup}>
                <button
                  onClick={() => setSelectedRoleFilter("all")}
                  className={`${selectedRoleFilter === "all" ? "btn-primary" : "btn-secondary"} ${styles.filterBtn}`}
                >
                  الكل ({totalUsersCount})
                </button>
                <button
                  onClick={() => setSelectedRoleFilter("admin")}
                  className={`${selectedRoleFilter === "admin" ? "btn-primary" : "btn-secondary"} ${styles.filterBtn}`}
                >
                  المسؤولون ({adminCount})
                </button>
                <button
                  onClick={() => setSelectedRoleFilter("manager")}
                  className={`${selectedRoleFilter === "manager" ? "btn-primary" : "btn-secondary"} ${styles.filterBtn}`}
                >
                  المديرين
                </button>
                <button
                  onClick={() => setSelectedRoleFilter("cashier")}
                  className={`${selectedRoleFilter === "cashier" ? "btn-primary" : "btn-secondary"} ${styles.filterBtn}`}
                >
                  الكاشير
                </button>
                <button
                  onClick={() => setSelectedRoleFilter("pending")}
                  className={`${selectedRoleFilter === "pending" ? "btn-primary" : "btn-secondary"} ${styles.filterBtn}`}
                >
                  في انتظار التفعيل ({pendingCount})
                </button>
                <button onClick={openAddUser} className={`btn-primary ${styles.filterBtn}`}>
                  <UserPlus size={15} /> إضافة مستخدم جديد
                </button>
              </div>
            </div>

            {/* Users Table */}
            <div className="table-container">
              {loadingUsers ? (
                <div className={styles.loadingOrEmptyBox}>
                  <p className={styles.loadingOrEmptyText}>جاري تحميل قائمة المستخدمين من Firestore...</p>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className={styles.loadingOrEmptyBox}>
                  <p className={styles.loadingOrEmptyText}>لا يوجد أي مستخدم مطابق لخيارات البحث</p>
                </div>
              ) : (
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>اسم المستخدم</th>
                      <th>البريد الإلكتروني</th>
                      <th>المحل / الفرع</th>
                      <th>الصلاحية</th>
                      <th className={styles.centerTh}>الحالة</th>
                      <th>تاريخ التسجيل</th>
                      <th className={styles.centerTh}>حذف الحساب</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u) => {
                      const isCurrentUser = isMe(u);
                      const isTargetAdmin = u.role === "admin";
                      const isUpdating = updatingUserId === u.uid;

                      return (
                        <tr key={u.uid || u.id}>
                          {/* User info */}
                          <td>
                            <div className={styles.userAvatarWrapper}>
                              <div className={isTargetAdmin ? styles.userAvatarAdmin : styles.userAvatarRegular}>
                                {(u.displayName || u.name || "U")[0].toUpperCase()}
                              </div>
                              <div>
                                <div className={styles.userNameText}>
                                  {u.displayName || u.name || "مستخدم مخزن"}
                                  {isCurrentUser && (
                                    <span className={styles.currentUserBadge}>
                                      أنت (الحساب الحالي)
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Email */}
                          <td>
                            <span className={`num-font ${styles.emailText}`} dir="ltr">
                              {u.email || "—"}
                            </span>
                          </td>

                          {/* Branch */}
                          <td>{u.branch || "—"}</td>

                          {/* Role */}
                          <td>
                            <select
                              className="form-input"
                              value={u.role}
                              disabled={isCurrentUser || isUpdating}
                              onChange={(e) => handleChangeRole(u, e.target.value)}
                              title={isCurrentUser ? "لا يمكنك تغيير صلاحية حسابك الحالي" : "تغيير الصلاحية"}
                              style={{ minWidth: 170 }}
                            >
                              {ROLE_OPTIONS.map((r) => (
                                <option key={r.value} value={r.value}>{r.label}</option>
                              ))}
                            </select>
                          </td>

                          {/* Status: approve a pending sign-up / stop an account */}
                          <td className={styles.centerTd}>
                            <button
                              onClick={() => handleToggleActive(u)}
                              disabled={isCurrentUser || isUpdating}
                              className={`${u.isActive ? "btn-secondary" : "btn-primary"} ${styles.roleActionBtn} ${isCurrentUser ? styles.btnDisabled : styles.btnEnabled}`}
                              title={u.isActive ? "إيقاف الحساب" : "تفعيل الحساب"}
                            >
                              {isUpdating ? "جاري الحفظ..." : u.isActive ? "✅ مفعّل (إيقاف)" : "⏳ تفعيل الحساب"}
                            </button>
                          </td>

                          {/* Date */}
                          <td>
                            <span className={styles.dateText}>
                              {u.createdAt ? new Date(u.createdAt).toLocaleDateString("ar-EG", { timeZone: "Africa/Cairo" }) : "—"}
                            </span>
                          </td>

                          {/* Delete User Action */}
                          <td className={styles.centerTd}>
                            <button
                              onClick={() => setUserToDelete(u)}
                              disabled={isCurrentUser}
                              className={`btn-danger ${styles.deleteActionBtn} ${isCurrentUser ? styles.btnDisabled : styles.btnEnabled}`}
                              title={isCurrentUser ? "لا يمكنك حذف حسابك الحالي" : "حذف المستخدم"}
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </main>

        {/* Add User Modal */}
        {isAddUserOpen && (
          <div className="modal-overlay" onClick={() => setIsAddUserOpen(false)}>
            <div className={`modal-content ${styles.modalCard}`} onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460, textAlign: "right" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h3 className={styles.deleteModalTitle} style={{ margin: 0 }}>إضافة مستخدم جديد</h3>
                <button type="button" onClick={() => setIsAddUserOpen(false)} className="btn-secondary" style={{ padding: 6 }}><X size={16} /></button>
              </div>
              <form onSubmit={handleCreateUser} style={{ display: "grid", gap: 10 }}>
                <label className="form-label">الاسم *
                  <input className="form-input" value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} maxLength={150} required />
                </label>
                <label className="form-label">البريد الإلكتروني *
                  <input className="form-input" type="email" dir="ltr" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} required />
                </label>
                <label className="form-label">كلمة المرور *
                  <input className="form-input" type="password" dir="ltr" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} required />
                </label>
                <label className="form-label">تأكيد كلمة المرور *
                  <input className="form-input" type="password" dir="ltr" value={newUser.confirm} onChange={(e) => setNewUser({ ...newUser, confirm: e.target.value })} required />
                </label>
                <label className="form-label">المحل / الفرع
                  <input className="form-input" value={newUser.branch} onChange={(e) => setNewUser({ ...newUser, branch: e.target.value })} maxLength={150} placeholder="مثال: الفرع الرئيسي" />
                </label>
                <label className="form-label">الصلاحية *
                  <select className="form-input" value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}>
                    {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </label>
                {addUserError && <div style={{ color: "#dc2626", fontSize: "0.85rem" }}>{addUserError}</div>}
                <div className={styles.deleteModalActions}>
                  <button type="button" onClick={() => setIsAddUserOpen(false)} className={`btn-secondary ${styles.cancelModalBtn}`}>إلغاء</button>
                  <button type="submit" disabled={savingNewUser} className="btn-primary">{savingNewUser ? "جاري الحفظ..." : "إنشاء الحساب"}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete User Confirmation Modal */}
        {userToDelete && (
          <div className="modal-overlay" onClick={() => setUserToDelete(null)}>
            <div
              className={`modal-content ${styles.modalCard}`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.deleteModalIcon}>
                <Trash2 size={26} />
              </div>

              <h3 className={styles.deleteModalTitle}>
                تأكيد حذف حساب المستخدم
              </h3>
              <p className={styles.deleteModalDesc}>
                هل أنت متأكد من حذف الحساب <strong className={styles.deleteModalUserHighlight}>"{userToDelete.displayName || userToDelete.email}"</strong> من النظام؟
              </p>

              <div className={styles.deleteModalActions}>
                <button
                  onClick={() => setUserToDelete(null)}
                  className={`btn-secondary ${styles.cancelModalBtn}`}
                >
                  إلغاء
                </button>
                <button
                  onClick={handleConfirmDelete}
                  className={`btn-danger ${styles.confirmDeleteModalBtn}`}
                >
                  نعم، احذف الحساب
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

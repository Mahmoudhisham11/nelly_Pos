"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import {
  subscribeToUsers,
  createUser,
  updateUser,
  deleteUserDoc,
  ROLE_OPTIONS,
  normalizeRole,
} from "@/lib/usersService";
import { formatNumber } from "@/lib/utils";
import {
  Settings,
  Users,
  ShieldAlert,
  Shield,
  Trash2,
  Search,
  ArrowLeft,
  Crown,
  User,
  UserCheck,
  Sparkles,
  Cloud,
  CloudDownload,
  RefreshCw,
  UserPlus,
  X,
  Check,
  Calendar,
  Mail,
  Building,
  Copy,
  LayoutGrid,
  Table as TableIcon,
  Power,
  Eye,
  EyeOff,
  AlertTriangle,
} from "lucide-react";
import { syncManager } from "@/lib/syncManager";
import { cloudSession } from "@/lib/cloudSession";
import {
  addMember,
  cloudErrorMessage,
  listMembers,
  removeMember,
  updateMember,
} from "@/lib/cloudAccount";
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
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    password: "",
    confirm: "",
    role: "cashier",
    branch: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [addUserError, setAddUserError] = useState("");
  const [savingNewUser, setSavingNewUser] = useState(false);
  const [isPullingCloud, setIsPullingCloud] = useState(false);
  const [cloud, setCloud] = useState(cloudSession.state);
  const [viewMode, setViewMode] = useState("auto"); // "auto" | "cards" | "table"
  const [activeStatIndex, setActiveStatIndex] = useState(0);
  const statsSwiperRef = useRef(null);

  const handleStatsScroll = () => {
    if (!statsSwiperRef.current) return;
    const el = statsSwiperRef.current;
    const scrollLeft = Math.abs(el.scrollLeft);
    const cardWidth = el.scrollWidth / 3;
    const index = Math.round(scrollLeft / cardWidth);
    setActiveStatIndex(Math.min(2, Math.max(0, index)));
  };

  const scrollToStatCard = (index) => {
    if (!statsSwiperRef.current) return;
    const el = statsSwiperRef.current;
    const cards = el.querySelectorAll(`.${styles.statCard}`);
    if (cards[index]) {
      cards[index].scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      setActiveStatIndex(index);
    }
  };

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
      showToast("تمت المزامنة الكاملة مع السحابة بنجاح.");
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

  // Users: the shop's accounts in the cloud when this device is linked, otherwise this device's local users.
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
        setUsersList(
          list.map((m) => ({
            id: m.uid,
            uid: m.uid,
            cloud: true,
            name: m.name,
            displayName: m.name || m.email,
            email: m.email,
            role: normalizeRole(m.role || "admin"),
            isActive: m.active !== false,
            branch: m.branch || "",
            createdAt: m.createdAt || null,
          }))
        );
        setLoadingUsers(false);
      })
      .catch((e) => {
        if (alive) {
          setLoadingUsers(false);
          showToast(cloudErrorMessage(e));
        }
      });
    return () => {
      alive = false;
    };
  }, [user, isAdmin, cloudMode, cloud.shopId, cloudMembersVersion]);

  const isMe = (u) => {
    if (!u || !user) return false;
    const uid = u.uid || u.id;
    const currentUid = user.uid || user.id;
    return (
      (uid && uid === currentUid) ||
      (!!u.email && !!user.email && u.email.toLowerCase() === user.email.toLowerCase())
    );
  };

  const userLabel = (u) => u.displayName || u.name || u.email || "المستخدم";

  // Change a user's role (admin / manager / cashier)
  const handleChangeRole = async (targetUser, newRole) => {
    if (isMe(targetUser)) {
      alert("لا يمكنك تغيير صلاحية حسابك الحالي بنفسك.");
      return;
    }
    const currentNormalized = normalizeRole(targetUser.role);
    if (newRole === currentNormalized) return;

    const targetId = targetUser.uid || targetUser.id;
    setUpdatingUserId(targetId);
    try {
      if (targetUser.cloud) {
        await updateMember(targetId, { role: newRole });
        reloadMembers();
      } else {
        await updateUser(targetId, { role: newRole });
      }
      const label =
        ROLE_OPTIONS.find((r) => r.value === newRole)?.label.split(" - ")[0] || newRole;
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
    const targetId = targetUser.uid || targetUser.id;
    setUpdatingUserId(targetId);
    try {
      if (targetUser.cloud) {
        await updateMember(targetId, { active: !targetUser.isActive });
        reloadMembers();
      } else {
        await updateUser(targetId, { isActive: !targetUser.isActive });
      }
      showToast(
        targetUser.isActive
          ? `تم إيقاف حساب "${userLabel(targetUser)}".`
          : `تم تفعيل حساب "${userLabel(targetUser)}"، ويمكنه الدخول الآن.`
      );
    } catch (err) {
      alert(targetUser.cloud ? cloudErrorMessage(err) : err.message);
    } finally {
      setUpdatingUserId(null);
    }
  };

  const openAddUser = () => {
    setNewUser({
      name: "",
      email: "",
      password: "",
      confirm: "",
      role: "cashier",
      branch: "",
    });
    setShowPassword(false);
    setShowConfirmPassword(false);
    setAddUserError("");
    setIsAddUserOpen(true);
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setAddUserError("");
    const { name, email, password, confirm } = newUser;
    if (!name.trim() || !email.trim() || !password.trim()) {
      return setAddUserError("يرجى كتابة الاسم والبريد الإلكتروني وكلمة المرور.");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return setAddUserError("البريد الإلكتروني غير صحيح.");
    }
    const minLen = cloudMode ? 6 : 4;
    if (password.trim().length < minLen) {
      return setAddUserError(`كلمة المرور يجب ألا تقل عن ${minLen} أحرف.`);
    }
    if (password.trim() !== confirm.trim()) {
      return setAddUserError("كلمتا المرور غير متطابقتين.");
    }
    setSavingNewUser(true);
    try {
      if (cloudMode) {
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

    const targetId = userToDelete.uid || userToDelete.id;
    try {
      if (userToDelete.cloud) {
        await removeMember(targetId);
        reloadMembers();
      } else {
        await deleteUserDoc(targetId);
      }
      showToast(
        `تم حذف المستخدم "${userToDelete.displayName || userToDelete.email}" من النظام.`
      );
    } catch (err) {
      alert(
        (userToDelete.cloud ? cloudErrorMessage(err) : err.message) ||
          "حدث خطأ أثناء حذف المستخدم."
      );
    } finally {
      setUserToDelete(null);
    }
  };

  // Copy email to clipboard
  const handleCopyEmail = (email, e) => {
    e?.stopPropagation?.();
    if (!email || email === "—") return;
    if (typeof navigator !== "undefined" && navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(email);
      showToast(`تم نسخ البريد: ${email}`);
    }
  };

  // Format date helper with robust parsing
  const formatDate = (val) => {
    if (!val) return "—";
    try {
      let d;
      if (typeof val?.toDate === "function") {
        d = val.toDate();
      } else if (val?.seconds) {
        d = new Date(val.seconds * 1000);
      } else {
        d = new Date(val);
      }
      if (isNaN(d.getTime())) return "—";
      return d.toLocaleDateString("ar-EG", {
        year: "numeric",
        month: "short",
        day: "numeric",
        timeZone: "Africa/Cairo",
      });
    } catch {
      return "—";
    }
  };

  // Filter users
  const filteredUsers = useMemo(() => {
    return usersList.filter((u) => {
      const q = searchQuery.toLowerCase().trim();
      const name = (u.displayName || u.name || "").toLowerCase();
      const email = (u.email || "").toLowerCase();
      const branch = (u.branch || "").toLowerCase();
      const matchesQuery =
        !q || name.includes(q) || email.includes(q) || branch.includes(q);

      const role = normalizeRole(u.role);
      const matchesRole =
        selectedRoleFilter === "all"
          ? true
          : selectedRoleFilter === "pending"
          ? !u.isActive
          : role === selectedRoleFilter;

      return matchesQuery && matchesRole;
    });
  }, [usersList, searchQuery, selectedRoleFilter]);

  // Statistics counts
  const totalUsersCount = usersList.length;
  const adminCount = usersList.filter((u) => normalizeRole(u.role) === "admin").length;
  const managerCount = usersList.filter((u) => normalizeRole(u.role) === "manager").length;
  const cashierCount = usersList.filter((u) => normalizeRole(u.role) === "cashier").length;
  const staffCount = managerCount + cashierCount;
  const pendingCount = usersList.filter((u) => !u.isActive).length;

  // Helper for role styling
  const getRoleConfig = (roleStr) => {
    const r = normalizeRole(roleStr);
    if (r === "admin") {
      return {
        label: "مسؤول (Admin)",
        shortLabel: "مسؤول",
        avatarClass: styles.userAvatarAdmin,
        tagClass: styles.roleTagAdmin,
        icon: Crown,
      };
    }
    if (r === "manager") {
      return {
        label: "مدير (Manager)",
        shortLabel: "مدير",
        avatarClass: styles.userAvatarManager,
        tagClass: styles.roleTagManager,
        icon: Shield,
      };
    }
    return {
      label: "كاشير (Cashier)",
      shortLabel: "كاشير",
      avatarClass: styles.userAvatarCashier,
      tagClass: styles.roleTagCashier,
      icon: User,
    };
  };

  // If auth is loading
  if (authLoading) {
    return (
      <div className={styles.authLoadingWrapper}>
        <RefreshCw size={36} className={`${styles.spin}`} color="#db2777" />
        <p className={styles.authLoadingText}>جاري التحقق من الصلاحيات والوصول...</p>
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
          <Navbar onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)} />
          <main className={`page-wrapper ${styles.permissionDeniedWrapper}`}>
            <div className={`glass-panel ${styles.permissionDeniedCard}`}>
              <div className={styles.permissionDeniedIcon}>
                <ShieldAlert size={40} />
              </div>

              <h2 className={styles.permissionDeniedTitle}>
                ليس لديك صلاحية لدخول هذه الصفحة
              </h2>

              <p className={styles.permissionDeniedDesc}>
                عذراً، صفحة إعدادات التطبيق وإدارة حسابات وصلاحيات المستخدمين مخصصة ومحمية حصرياً لـ{" "}
                <strong className={styles.permissionDeniedHighlight}>
                  مسؤول المخزن (Admin)
                </strong>
                .
              </p>

              <div className={styles.permissionDeniedRoleBox}>
                <span className={styles.roleBoxLabel}>رتبة حسابك الحالية:</span>
                <span className={styles.roleBoxBadge}>👤 مستخدم عادي</span>
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
        <Navbar onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)} />

        <main className="page-wrapper">
          {/* Toast Notification */}
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
                التحكم الكامل في حسابات الموظفين، تعديل الصلاحيات والرتب، وإدارة الربط السحابي وقاعدة البيانات
              </p>
            </div>
          </div>

          {/* Database Backup Card for Admin */}
          {isAdmin && <BackupCard />}

          {/* Statistics Grid / Mobile Swiper */}
          <div className={styles.statsSwiperWrapper}>
            <section
              className={styles.statsGrid}
              ref={statsSwiperRef}
              onScroll={handleStatsScroll}
            >
              {/* Card 1: Total Users */}
              <div className={`${styles.statCard} ${styles.statCardUsers}`}>
                <div
                  className={styles.statIconBox}
                  style={{ background: "#fdf2f8", color: "#db2777" }}
                >
                  <Users size={22} />
                </div>
                <div className={styles.statContent}>
                  <span className={styles.statLabel}>إجمالي المستخدمين</span>
                  <div className={`num-font ${styles.statValue}`} dir="ltr">
                    {formatNumber(totalUsersCount)}
                  </div>
                </div>
              </div>

              {/* Card 2: Admins */}
              <div className={`${styles.statCard} ${styles.statCardAdmins}`}>
                <div
                  className={styles.statIconBox}
                  style={{ background: "#fffbeb", color: "#d97706" }}
                >
                  <Crown size={22} />
                </div>
                <div className={styles.statContent}>
                  <span className={styles.statLabel}>مسؤولو المخزن (Admins)</span>
                  <div
                    className={`num-font ${styles.statValue} ${styles.statValueAdmins}`}
                    dir="ltr"
                  >
                    {formatNumber(adminCount)}
                  </div>
                </div>
              </div>

              {/* Card 3: Staff & Cashiers */}
              <div className={`${styles.statCard} ${styles.statCardRegular}`}>
                <div
                  className={styles.statIconBox}
                  style={{ background: "#faf5ff", color: "#7e22ce" }}
                >
                  <UserCheck size={22} />
                </div>
                <div className={styles.statContent}>
                  <span className={styles.statLabel}>فريق العمل (مديرين وكاشير)</span>
                  <div
                    className={`num-font ${styles.statValue} ${styles.statValueRegular}`}
                    dir="ltr"
                  >
                    {formatNumber(staffCount)}
                  </div>
                </div>
              </div>
            </section>

            {/* Mobile Swiper Pagination Dots */}
            <div className={styles.swiperDots}>
              <button
                type="button"
                onClick={() => scrollToStatCard(0)}
                className={`${styles.swiperDot} ${
                  activeStatIndex === 0 ? styles.swiperDotActive : ""
                }`}
                title="إجمالي المستخدمين"
              />
              <button
                type="button"
                onClick={() => scrollToStatCard(1)}
                className={`${styles.swiperDot} ${
                  activeStatIndex === 1 ? styles.swiperDotActive : ""
                }`}
                title="مسؤولو المخزن"
              />
              <button
                type="button"
                onClick={() => scrollToStatCard(2)}
                className={`${styles.swiperDot} ${
                  activeStatIndex === 2 ? styles.swiperDotActive : ""
                }`}
                title="فريق العمل"
              />
            </div>
          </div>

          {/* Pending Users Notification Banner */}
          {pendingCount > 0 && (
            <div className={styles.pendingAlertBanner}>
              <div className={styles.pendingAlertContent}>
                <span className={styles.pendingAlertDot}></span>
                <span>
                  يوجد <strong className="num-font">{pendingCount}</strong> مستخدم في انتظار التفعيل والموافقة للعمل على النظام.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRoleFilter("pending")}
                className={styles.pendingAlertBtn}
              >
                عرض المستخدمين المعلقين
              </button>
            </div>
          )}

          {/* Cloud Sync Section */}
          <section className={styles.cloudSyncCard}>
            <div className={styles.cloudSyncHeader}>
              <div className={styles.cloudSyncTitleGroup}>
                <div className={styles.cloudIconBox}>
                  <Cloud size={24} />
                </div>
                <div>
                  <div className={styles.cloudTitleRow}>
                    <h3 className={styles.cloudTitle}>
                      الربط السحابي ومزامنة قاعدة البيانات
                    </h3>
                    <span className={styles.cloudTechBadge}>Firebase Cloud</span>
                  </div>
                  <p className={styles.cloudSubtitle}>
                    سحب وتحديث كافة بيانات المتجر من السحابة وتخزينها محلياً للعمل بكفاءة تامة بدون إنترنت
                  </p>
                </div>
              </div>

              <div className={styles.cloudSyncActionGroup}>
                <div
                  className={`${styles.cloudBadge} ${
                    cloud.status !== "ready" ? styles.cloudBadgeOffline : ""
                  }`}
                >
                  <span
                    className={`${styles.cloudDot} ${
                      cloud.status !== "ready" ? styles.cloudDotOffline : ""
                    }`}
                  ></span>
                  <div className={styles.cloudBadgeText}>
                    {cloud.status === "ready" ? (
                      <>
                        <span>متصل بالسحابة:</span>
                        <span className={styles.cloudBadgeShop}>
                          {cloud.shopName || cloud.shopId}
                        </span>
                      </>
                    ) : (
                      <span>غير مربوط بالسحابة</span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handlePullFromCloud}
                  disabled={isPullingCloud || cloud.status !== "ready"}
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
                      <span>مزامنة كاملة الآن</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </section>

          {/* Users Management Panel */}
          <section className={styles.panel}>
            {/* Panel Header */}
            <div className={styles.panelHeader}>
              <div className={styles.panelTitleWrapper}>
                <div className={styles.panelIconBox}>
                  <Users size={20} />
                </div>
                <div>
                  <h3 className={styles.panelTitle}>حسابات وصلاحيات المستخدمين</h3>
                  <span className={styles.panelSubtitle}>
                    إجمالي المستخدمين: <strong className="num-font">{totalUsersCount}</strong> مستخدم مسجل
                  </span>
                </div>
              </div>

              <div className={styles.panelHeaderActions}>
                {/* View Mode Switcher */}
                <div className={styles.viewModeToggle}>
                  <button
                    type="button"
                    onClick={() => setViewMode("cards")}
                    className={`${styles.viewModeBtn} ${
                      viewMode === "cards" ? styles.viewModeBtnActive : ""
                    }`}
                    title="عرض كبطاقات"
                  >
                    <LayoutGrid size={15} />
                    <span className={styles.viewModeText}>بطاقات</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("table")}
                    className={`${styles.viewModeBtn} ${
                      viewMode === "table" ? styles.viewModeBtnActive : ""
                    }`}
                    title="عرض كجدول"
                  >
                    <TableIcon size={15} />
                    <span className={styles.viewModeText}>جدول</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={openAddUser}
                  className={`btn-primary ${styles.addUserBtn}`}
                >
                  <UserPlus size={16} />
                  <span>إضافة مستخدم جديد</span>
                </button>
              </div>
            </div>

            {/* Toolbar: Search + Filter Chips */}
            <div className={styles.toolbar}>
              <div className={styles.searchWrapper}>
                <input
                  type="text"
                  className={styles.searchInput}
                  placeholder="بحث بالاسم، البريد الإلكتروني أو الفرع..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <Search size={18} color="#db2777" className={styles.searchIcon} />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className={styles.clearSearchBtn}
                    title="مسح البحث"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Filter Chips Scroll Container */}
              <div className={styles.filterChipsContainer}>
                <div className={styles.filterGroup}>
                  <button
                    type="button"
                    onClick={() => setSelectedRoleFilter("all")}
                    className={`${styles.filterChip} ${
                      selectedRoleFilter === "all" ? styles.filterChipActive : ""
                    }`}
                  >
                    <span>الكل</span>
                    <span className={`num-font ${styles.chipCounter}`}>
                      {totalUsersCount}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedRoleFilter("admin")}
                    className={`${styles.filterChip} ${
                      selectedRoleFilter === "admin" ? styles.filterChipActive : ""
                    }`}
                  >
                    <Crown size={13} />
                    <span>المسؤولون</span>
                    <span className={`num-font ${styles.chipCounter}`}>
                      {adminCount}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedRoleFilter("manager")}
                    className={`${styles.filterChip} ${
                      selectedRoleFilter === "manager" ? styles.filterChipActive : ""
                    }`}
                  >
                    <Shield size={13} />
                    <span>المديرين</span>
                    <span className={`num-font ${styles.chipCounter}`}>
                      {managerCount}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedRoleFilter("cashier")}
                    className={`${styles.filterChip} ${
                      selectedRoleFilter === "cashier" ? styles.filterChipActive : ""
                    }`}
                  >
                    <User size={13} />
                    <span>الكاشير</span>
                    <span className={`num-font ${styles.chipCounter}`}>
                      {cashierCount}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedRoleFilter("pending")}
                    className={`${styles.filterChip} ${
                      selectedRoleFilter === "pending"
                        ? styles.filterChipActiveAlert
                        : ""
                    }`}
                  >
                    {pendingCount > 0 && <span className={styles.chipAlertDot}></span>}
                    <span>في انتظار التفعيل</span>
                    <span className={`num-font ${styles.chipCounter}`}>
                      {pendingCount}
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* Users Content: Loading, Empty, or Data Views */}
            {loadingUsers ? (
              <div className={styles.loadingOrEmptyBox}>
                <RefreshCw size={32} className={styles.spin} color="#db2777" />
                <p className={styles.loadingOrEmptyText}>
                  جاري تحميل قائمة المستخدمين من قاعدة البيانات...
                </p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className={styles.loadingOrEmptyBox}>
                <div className={styles.emptyStateIcon}>
                  <Search size={26} />
                </div>
                <p className={styles.loadingOrEmptyText}>
                  لا يوجد أي مستخدم مطابق لخيارات البحث المحددة
                </p>
                {(searchQuery || selectedRoleFilter !== "all") && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setSelectedRoleFilter("all");
                    }}
                    className={styles.clearFilterBtn}
                  >
                    إعادة ضبط التصفية
                  </button>
                )}
              </div>
            ) : (
              <div
                className={`${
                  viewMode === "table"
                    ? styles.forceShowTable
                    : viewMode === "cards"
                    ? styles.forceShowCards
                    : ""
                }`}
              >
                {/* 1. Desktop / Tablet Data Table */}
                <div className={styles.desktopTableContainer}>
                  <div className={styles.tableWrapper}>
                    <table className={styles.usersTable}>
                      <thead>
                        <tr>
                          <th>اسم المستخدم</th>
                          <th>البريد الإلكتروني</th>
                          <th>المحل / الفرع</th>
                          <th>الصلاحية والرتبة</th>
                          <th className={styles.centerTh}>حالة الحساب</th>
                          <th>تاريخ التسجيل</th>
                          <th className={styles.centerTh}>حذف</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers.map((u) => {
                          const isCurrentUser = isMe(u);
                          const targetId = u.uid || u.id;
                          const isUpdating = updatingUserId === targetId;
                          const roleCfg = getRoleConfig(u.role);
                          const initial = (
                            u.displayName ||
                            u.name ||
                            u.email ||
                            "U"
                          )
                            .trim()[0]
                            ?.toUpperCase() || "U";

                          return (
                            <tr key={targetId}>
                              {/* User Info */}
                              <td>
                                <div className={styles.userAvatarWrapper}>
                                  <div
                                    className={`${styles.userAvatar} ${roleCfg.avatarClass}`}
                                  >
                                    {initial}
                                  </div>
                                  <div>
                                    <div className={styles.userNameText}>
                                      <span>
                                        {u.displayName || u.name || "مستخدم مخزن"}
                                      </span>
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
                                <div
                                  className={styles.emailWrapper}
                                  onClick={(e) => handleCopyEmail(u.email, e)}
                                  title="انقر لنسخ البريد الإلكتروني"
                                >
                                  <span
                                    className={`num-font ${styles.emailText}`}
                                    dir="ltr"
                                  >
                                    {u.email || "—"}
                                  </span>
                                  {u.email && (
                                    <Copy size={13} className={styles.copyIcon} />
                                  )}
                                </div>
                              </td>

                              {/* Branch */}
                              <td>
                                {u.branch ? (
                                  <span className={styles.branchBadge}>
                                    <Building size={12} />
                                    <span>{u.branch}</span>
                                  </span>
                                ) : (
                                  <span style={{ color: "var(--text-muted)" }}>—</span>
                                )}
                              </td>

                              {/* Role Selector */}
                              <td>
                                <select
                                  className={styles.roleSelect}
                                  value={normalizeRole(u.role)}
                                  disabled={isCurrentUser || isUpdating}
                                  onChange={(e) =>
                                    handleChangeRole(u, e.target.value)
                                  }
                                  title={
                                    isCurrentUser
                                      ? "لا يمكنك تغيير صلاحية حسابك الحالي"
                                      : "تعديل الصلاحية"
                                  }
                                >
                                  {ROLE_OPTIONS.map((r) => (
                                    <option key={r.value} value={r.value}>
                                      {r.label}
                                    </option>
                                  ))}
                                </select>
                              </td>

                              {/* Account Status */}
                              <td className={styles.centerTd}>
                                <div className={styles.statusBadgeGroup}>
                                  <span
                                    className={`${styles.statusPill} ${
                                      u.isActive
                                        ? styles.statusPillActive
                                        : styles.statusPillInactive
                                    }`}
                                  >
                                    <span className={styles.statusDot} />
                                    <span>{u.isActive ? "نشط" : "معلّق"}</span>
                                  </span>

                                  <button
                                    type="button"
                                    onClick={() => handleToggleActive(u)}
                                    disabled={isCurrentUser || isUpdating}
                                    className={`${styles.toggleStatusBtn} ${
                                      u.isActive
                                        ? styles.toggleStatusBtnActive
                                        : styles.toggleStatusBtnInactive
                                    } ${isCurrentUser ? styles.btnDisabled : ""}`}
                                    title={
                                      isCurrentUser
                                        ? "لا يمكنك إيقاف حسابك الحالي"
                                        : u.isActive
                                        ? "إيقاف الحساب"
                                        : "تفعيل الحساب"
                                    }
                                  >
                                    {isUpdating ? (
                                      <>
                                        <RefreshCw
                                          size={12}
                                          className={styles.spin}
                                        />
                                        <span>جاري...</span>
                                      </>
                                    ) : u.isActive ? (
                                      <>
                                        <Power size={12} />
                                        <span>إيقاف</span>
                                      </>
                                    ) : (
                                      <>
                                        <Check size={12} />
                                        <span>تفعيل</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                              </td>

                              {/* Registration Date */}
                              <td>
                                <span className={styles.dateText}>
                                  {formatDate(u.createdAt)}
                                </span>
                              </td>

                              {/* Delete Action */}
                              <td className={styles.centerTd}>
                                <button
                                  type="button"
                                  onClick={() => setUserToDelete(u)}
                                  disabled={isCurrentUser}
                                  className={`${styles.deleteActionBtn} ${
                                    isCurrentUser ? styles.btnDisabled : ""
                                  }`}
                                  title={
                                    isCurrentUser
                                      ? "لا يمكنك حذف حسابك الحالي"
                                      : "حذف حساب المستخدم"
                                  }
                                >
                                  <Trash2 size={15} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 2. Mobile User Cards View (Zero Horizontal Overflow) */}
                <div className={styles.mobileCardsGrid}>
                  {filteredUsers.map((u) => {
                    const isCurrentUser = isMe(u);
                    const targetId = u.uid || u.id;
                    const isUpdating = updatingUserId === targetId;
                    const roleCfg = getRoleConfig(u.role);
                    const initial = (
                      u.displayName ||
                      u.name ||
                      u.email ||
                      "U"
                    )
                      .trim()[0]
                      ?.toUpperCase() || "U";

                    return (
                      <div key={targetId} className={styles.mobileUserCard}>
                        {/* Top Header of Card */}
                        <div className={styles.mobileCardHeader}>
                          <div className={styles.mobileCardUserSection}>
                            <div
                              className={`${styles.userAvatar} ${roleCfg.avatarClass}`}
                            >
                              {initial}
                            </div>
                            <div className={styles.mobileCardUserNameGroup}>
                              <div className={styles.mobileCardUserName}>
                                <span>
                                  {u.displayName || u.name || "مستخدم مخزن"}
                                </span>
                                {isCurrentUser && (
                                  <span className={styles.currentUserBadge}>
                                    أنت
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className={styles.mobileCardBadges}>
                            <span
                              className={`${styles.roleTag} ${roleCfg.tagClass}`}
                            >
                              {roleCfg.shortLabel}
                            </span>
                            <span
                              className={`${styles.statusPill} ${
                                u.isActive
                                  ? styles.statusPillActive
                                  : styles.statusPillInactive
                              }`}
                            >
                              <span className={styles.statusDot} />
                              <span>{u.isActive ? "نشط" : "معلّق"}</span>
                            </span>
                          </div>
                        </div>

                        {/* Details Info */}
                        <div className={styles.mobileCardDetails}>
                          <div
                            className={styles.mobileDetailItem}
                            onClick={(e) => handleCopyEmail(u.email, e)}
                          >
                            <Mail
                              size={14}
                              className={styles.mobileDetailItemIcon}
                            />
                            <span
                              className={`num-font ${styles.mobileDetailText}`}
                              dir="ltr"
                            >
                              {u.email || "—"}
                            </span>
                            {u.email && (
                              <Copy size={12} className={styles.copyIcon} />
                            )}
                          </div>

                          {u.branch && (
                            <div className={styles.mobileDetailItem}>
                              <Building
                                size={14}
                                className={styles.mobileDetailItemIcon}
                              />
                              <span className={styles.mobileDetailText}>
                                {u.branch}
                              </span>
                            </div>
                          )}

                          <div className={styles.mobileDetailItem}>
                            <Calendar
                              size={14}
                              className={styles.mobileDetailItemIcon}
                            />
                            <span className={styles.mobileDetailText}>
                              التسجيل: {formatDate(u.createdAt)}
                            </span>
                          </div>
                        </div>

                        {/* Actions Row */}
                        <div className={styles.mobileCardActions}>
                          <div className={styles.mobileRoleSelectWrapper}>
                            <select
                              className={styles.mobileRoleSelect}
                              value={normalizeRole(u.role)}
                              disabled={isCurrentUser || isUpdating}
                              onChange={(e) =>
                                handleChangeRole(u, e.target.value)
                              }
                              title={
                                isCurrentUser
                                  ? "لا يمكنك تغيير صلاحية حسابك الحالي"
                                  : "تعديل الصلاحية"
                              }
                            >
                              {ROLE_OPTIONS.map((r) => (
                                <option key={r.value} value={r.value}>
                                  {r.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleToggleActive(u)}
                            disabled={isCurrentUser || isUpdating}
                            className={`${styles.mobileToggleBtn} ${
                              u.isActive
                                ? styles.mobileToggleBtnActive
                                : styles.mobileToggleBtnInactive
                            } ${isCurrentUser ? styles.btnDisabled : ""}`}
                          >
                            {isUpdating ? (
                              <>
                                <RefreshCw size={13} className={styles.spin} />
                                <span>حفظ...</span>
                              </>
                            ) : u.isActive ? (
                              <>
                                <Power size={13} />
                                <span>إيقاف</span>
                              </>
                            ) : (
                              <>
                                <Check size={13} />
                                <span>تفعيل الحساب</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => setUserToDelete(u)}
                            disabled={isCurrentUser}
                            className={`${styles.mobileDeleteBtn} ${
                              isCurrentUser ? styles.btnDisabled : ""
                            }`}
                            title={
                              isCurrentUser
                                ? "لا يمكنك حذف حسابك الحالي"
                                : "حذف الحساب"
                            }
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        </main>

        {/* Add User Modal */}
        {isAddUserOpen && (
          <div className="modal-overlay" onClick={() => setIsAddUserOpen(false)}>
            <div
              className={`modal-content ${styles.modalCard}`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.modalHeader}>
                <div className={styles.modalHeaderTitleGroup}>
                  <div className={styles.modalHeaderIcon}>
                    <UserPlus size={20} />
                  </div>
                  <div>
                    <h3 className={styles.modalTitle}>إضافة مستخدم جديد</h3>
                    <span
                      style={{
                        fontSize: "0.78rem",
                        color: "var(--text-muted)",
                        fontWeight: 600,
                      }}
                    >
                      إنشاء حساب موظف وتحديد صلاحيات الوصول
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddUserOpen(false)}
                  className={styles.modalCloseBtn}
                  title="إغلاق"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleCreateUser} className={styles.addUserForm}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>الاسم بالكامل *</label>
                  <input
                    className="form-input"
                    value={newUser.name}
                    onChange={(e) =>
                      setNewUser({ ...newUser, name: e.target.value })
                    }
                    placeholder="مثال: أحمد محمد"
                    maxLength={150}
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>البريد الإلكتروني *</label>
                  <input
                    className="form-input"
                    type="email"
                    dir="ltr"
                    value={newUser.email}
                    onChange={(e) =>
                      setNewUser({ ...newUser, email: e.target.value })
                    }
                    placeholder="example@shop.com"
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>كلمة المرور *</label>
                  <div className={styles.passwordInputWrapper}>
                    <input
                      className="form-input"
                      type={showPassword ? "text" : "password"}
                      dir="ltr"
                      value={newUser.password}
                      onChange={(e) =>
                        setNewUser({ ...newUser, password: e.target.value })
                      }
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      className={styles.passwordToggleBtn}
                      onClick={() => setShowPassword(!showPassword)}
                      title={showPassword ? "إخفاء" : "إظهار"}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>تأكيد كلمة المرور *</label>
                  <div className={styles.passwordInputWrapper}>
                    <input
                      className="form-input"
                      type={showConfirmPassword ? "text" : "password"}
                      dir="ltr"
                      value={newUser.confirm}
                      onChange={(e) =>
                        setNewUser({ ...newUser, confirm: e.target.value })
                      }
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      className={styles.passwordToggleBtn}
                      onClick={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
                      title={showConfirmPassword ? "إخفاء" : "إظهار"}
                    >
                      {showConfirmPassword ? (
                        <EyeOff size={16} />
                      ) : (
                        <Eye size={16} />
                      )}
                    </button>
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>المحل / الفرع</label>
                  <input
                    className="form-input"
                    value={newUser.branch}
                    onChange={(e) =>
                      setNewUser({ ...newUser, branch: e.target.value })
                    }
                    maxLength={150}
                    placeholder="مثال: الفرع الرئيسي"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>الصلاحية والرتبة *</label>
                  <select
                    className="form-input"
                    value={newUser.role}
                    onChange={(e) =>
                      setNewUser({ ...newUser, role: e.target.value })
                    }
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>

                {addUserError && (
                  <div className={styles.errorBanner}>
                    <AlertTriangle size={16} flexShrink={0} />
                    <span>{addUserError}</span>
                  </div>
                )}

                <div className={styles.modalActions}>
                  <button
                    type="button"
                    onClick={() => setIsAddUserOpen(false)}
                    className="btn-secondary"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={savingNewUser}
                    className="btn-primary"
                  >
                    {savingNewUser ? (
                      <>
                        <RefreshCw size={16} className={styles.spin} />
                        <span>جاري الحفظ...</span>
                      </>
                    ) : (
                      <>
                        <UserPlus size={16} />
                        <span>إنشاء الحساب</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete User Confirmation Modal */}
        {userToDelete && (
          <div className="modal-overlay" onClick={() => setUserToDelete(null)}>
            <div
              className={`modal-content ${styles.modalCard} ${styles.deleteModalCard}`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.deleteModalIcon}>
                <Trash2 size={28} />
              </div>

              <h3 className={styles.deleteModalTitle}>
                تأكيد حذف حساب المستخدم
              </h3>
              <p className={styles.deleteModalDesc}>
                هل أنت متأكد من رغبتك في حذف الحساب{" "}
                <strong className={styles.deleteModalUserHighlight}>
                  &quot;{userToDelete.displayName || userToDelete.email}&quot;
                </strong>{" "}
                من النظام؟ هذا الإجراء نهائي ولا يمكن التراجع عنه.
              </p>

              <div className={styles.deleteModalActions}>
                <button
                  type="button"
                  onClick={() => setUserToDelete(null)}
                  className="btn-secondary"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="btn-danger"
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

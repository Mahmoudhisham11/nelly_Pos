// cloudSession.js — links this device to ONE shop's cloud space (Firebase Auth + userShops/{uid} -> shopId).
// Every synced document lives under shops/{shopId}/..., and Firestore rules (firestore.rules) only let a signed-in
// member of that shop touch it. Writes are additionally blocked once the shop's subscription has expired (read-only grace).
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db, firebaseConfigured } from "./firebase";

class CloudSession {
  constructor() {
    this.state = { status: "signedOut", shopId: null, shopName: null, email: null, activeUntil: null, canWrite: false, error: null };
    this.subscribers = new Set();
    this.started = false;
  }

  subscribe(cb) {
    this.subscribers.add(cb);
    cb(this.state);
    return () => this.subscribers.delete(cb);
  }

  set(patch) {
    this.state = { ...this.state, ...patch };
    this.subscribers.forEach((cb) => { try { cb(this.state); } catch (_) {} });
  }

  start() {
    if (this.started) return;
    if (!auth) {
      this.started = true;
      this.set({ status: "unconfigured", error: firebaseConfigured ? null : "السحابة غير مُعدّة في هذه النسخة (ملف .env.local)." });
      return;
    }
    this.started = true;
    this.set({ status: "loading" });
    onAuthStateChanged(auth, (user) => {
      if (!user) {
        this.stopWatching();
        return this.set({ status: "signedOut", shopId: null, shopName: null, email: null, activeUntil: null, canWrite: false, revoked: null });
      }
      this.resolveShop(user).catch((e) => this.set({ status: "error", error: e?.message || String(e) }));
    });
  }

  /**
   * Live view of the account (userShops/{uid}) and its shop (shops/{shopId}). Any change made in Devora / by the shop's
   * admin reaches the app within seconds: a stopped account, a suspended shop or an ended subscription sets
   * `revoked` (with the reason), and the app logs the user out immediately (see AuthContext).
   */
  async resolveShop(user) {
    this.stopWatching();
    this.set({ status: "loading", email: user.email, error: null, revoked: null });
    const uid = user.uid;
    let link = null;
    let shop = null;

    const evaluate = () => {
      if (auth?.currentUser?.uid !== uid) return;
      if (!link || !link.shopId) return this.revoke("هذا الحساب غير مرتبط بأي محل. تواصل مع Devora.");
      if (link.active === false) return this.revoke("تم إيقاف هذا الحساب. تواصل مع Devora أو مسؤول المحل.");
      if (!shop) return; // shop not loaded yet
      const raw = shop.activeUntil;
      const activeUntil = raw ? (typeof raw.toDate === "function" ? raw.toDate() : new Date(raw)).toISOString() : null;
      const suspended = shop.suspended === true;
      const ended = !activeUntil || new Date(activeUntil).getTime() <= Date.now();
      const plan = shop.plan || (link.shopId.startsWith("shop-") ? "free" : "pro");
      if (suspended) return this.revoke("تم إيقاف المحل. تواصل مع Devora لإعادة التفعيل.");
      if (ended) return this.revoke(plan === "free" ? "انتهت الفترة المجانية (شهر). جدّد الاشتراك مع Devora عشان تكمل." : "انتهى اشتراك المحل. جدّد الاشتراك مع Devora عشان تكمل.");
      // log out by itself at the very moment the subscription ends
      clearTimeout(this.expiryTimer);
      const ms = new Date(activeUntil).getTime() - Date.now();
      if (ms < 2 ** 31 - 1) this.expiryTimer = setTimeout(evaluate, ms + 1000);
      this.set({
        status: "ready", shopId: link.shopId, role: link.role || "admin", shopName: shop.name || link.shopId, plan,
        suspended: false, activeUntil, canWrite: true, error: null, revoked: null,
      });
    };

    const watchShop = (shopId) => {
      if (this.shopUnsub && this.watchedShop === shopId) return;
      if (this.shopUnsub) this.shopUnsub();
      this.watchedShop = shopId;
      this.shopUnsub = onSnapshot(
        doc(db, "shops", shopId),
        (snap) => { shop = snap.exists() ? snap.data() : {}; evaluate(); },
        // members lose read access the moment they are stopped: the account listener reports the reason
        (e) => { if (e?.code !== "permission-denied") this.set({ status: "error", error: e?.message || String(e) }); },
      );
    };

    await new Promise((resolve) => {
      let first = true;
      this.linkUnsub = onSnapshot(
        doc(db, "userShops", uid),
        (snap) => {
          link = snap.exists() ? snap.data() : null;
          if (link?.shopId && link.active !== false) watchShop(link.shopId);
          evaluate();
          if (first) { first = false; resolve(); }
        },
        (e) => {
          this.set({ status: "error", error: e?.message || String(e) });
          if (first) { first = false; resolve(); }
        },
      );
    });
  }

  /** The account may not use the app any more (stopped / shop suspended / subscription ended). */
  revoke(reason) {
    this.set({ status: "blocked", error: reason, revoked: reason, canWrite: false });
  }

  stopWatching() {
    clearTimeout(this.expiryTimer);
    if (this.linkUnsub) { this.linkUnsub(); this.linkUnsub = null; }
    if (this.shopUnsub) { this.shopUnsub(); this.shopUnsub = null; }
    this.watchedShop = null;
  }

  async signIn(email, password) {
    if (!auth) throw new Error("Firebase Auth غير متاح");
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (e) {
      const msg = ["auth/invalid-credential", "auth/wrong-password", "auth/user-not-found"].includes(e?.code)
        ? "البريد أو كلمة المرور غير صحيحة" : (e?.message || "تعذر تسجيل الدخول السحابي");
      throw new Error(msg);
    }
  }

  /** Re-reads the signed-in account's shop (after a sign-up created it, or an admin changed it). */
  async refresh() {
    if (auth?.currentUser) await this.resolveShop(auth.currentUser).catch((e) => this.set({ status: "error", error: e?.message || String(e) }));
    return this.state;
  }

  async signOut() {
    this.stopWatching();
    if (auth) await signOut(auth);
  }
}

export const cloudSession = new CloudSession();

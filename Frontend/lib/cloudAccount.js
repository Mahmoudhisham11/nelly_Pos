// cloudAccount.js — accounts and shops in Firebase (one shop = one tenant).
//   userShops/{uid}            = { shopId, role, active, email, name, branch }   (the account's membership)
//   shops/{shopId}             = { name, ownerUid, activeUntil, createdAt }       (shopId = "shop-<owner uid>")
//   shops/{shopId}/invites/{e} = { role, name, branch }                           (lets a new member join that shop)
// Who may write what is enforced by firestore.rules.
import { initializeApp, deleteApp } from "firebase/app";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile, sendPasswordResetEmail,
} from "firebase/auth";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, collection, query, where, getDocs, serverTimestamp, Timestamp,
} from "firebase/firestore";
import { auth, db, firebaseConfig, firebaseConfigured } from "./firebase";

/** Free period of a newly signed-up shop (must not exceed the limit in firestore.rules). */
export const TRIAL_DAYS = 30;

export const cloudAvailable = () => firebaseConfigured && !!auth && (typeof navigator === "undefined" || navigator.onLine);

const clean = (s) => String(s || "").trim();
const normEmail = (s) => clean(s).toLowerCase();

export function cloudErrorMessage(e) {
  switch (e?.code) {
    case "auth/email-already-in-use": return "البريد الإلكتروني ده مسجل بالفعل بحساب تاني.";
    case "auth/invalid-email": return "البريد الإلكتروني غير صحيح.";
    case "auth/weak-password": return "كلمة المرور ضعيفة: لازم 6 حروف أو أكتر.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found": return "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
    case "auth/too-many-requests": return "محاولات كتير. استنى شوية وجرب تاني.";
    case "auth/user-disabled": return "تم إيقاف هذا الحساب. تواصل مع Devora أو مسؤول المحل.";
    case "auth/network-request-failed":
    case "unavailable": return "مفيش اتصال بالإنترنت.";
    case "permission-denied": return "مش مسموح بالعملية دي (تأكد إن قواعد Firestore متنشورة).";
    default: return e?.message || "حدث خطأ في الاتصال بالسحابة.";
  }
}

/** Signs in to the cloud and returns the account's membership ({ uid, idToken, shopId, role, active, ... }). */
export async function cloudSignIn(email, password) {
  const cred = await signInWithEmailAndPassword(auth, normEmail(email), password);
  const snap = await getDoc(doc(db, "userShops", cred.user.uid));
  const link = snap.exists() ? snap.data() : null;
  return { uid: cred.user.uid, idToken: await cred.user.getIdToken(), link };
}

/**
 * A NEW shop: creates the owner's cloud account, the shop (with a free trial) and the owner's membership (admin).
 * The shop starts empty and has nothing to do with any other shop.
 */
export async function signUpShop({ name, email, password, shopName }) {
  const cred = await createUserWithEmailAndPassword(auth, normEmail(email), password);
  const uid = cred.user.uid;
  try {
    await updateProfile(cred.user, { displayName: clean(name) }).catch(() => {});
    const shopId = `shop-${uid}`;
    // an hour of margin under the rules' limit so a slightly fast clock is never refused
    const until = Timestamp.fromMillis(Date.now() + TRIAL_DAYS * 86400000 - 3600000);
    await setDoc(doc(db, "shops", shopId), {
      name: clean(shopName) || clean(name), ownerUid: uid, ownerEmail: normEmail(email), plan: "free", activeUntil: until, createdAt: serverTimestamp(),
    });
    await setDoc(doc(db, "userShops", uid), {
      shopId, role: "admin", active: true, email: normEmail(email), name: clean(name), branch: clean(shopName),
    });
    return { uid, shopId, idToken: await cred.user.getIdToken() };
  } catch (e) {
    // never leave an account without a shop behind: remove it so the e-mail can be used again
    await cred.user.delete().catch(() => {});
    throw e;
  }
}

/** Sends the "reset your password" e-mail (Firebase). */
export const sendPasswordReset = (email) => sendPasswordResetEmail(auth, normEmail(email));

/** Members of a shop (admin only, see rules). */
export async function listMembers(shopId) {
  const snap = await getDocs(query(collection(db, "userShops"), where("shopId", "==", shopId)));
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
}

/**
 * Admin adds a member: an invitation in the shop, then the member's cloud account is created through a SEPARATE
 * Firebase app instance (the admin stays signed in) and joins the shop with the invited role.
 */
export async function addMember(shopId, { name, email, password, role, branch }) {
  const e = normEmail(email);
  const invite = doc(db, "shops", shopId, "invites", e);
  await setDoc(invite, { role, name: clean(name), branch: clean(branch), createdAt: serverTimestamp() });
  const second = initializeApp(firebaseConfig, `member-${Date.now()}`);
  try {
    const auth2 = getAuth(second);
    const cred = await createUserWithEmailAndPassword(auth2, e, password);
    await updateProfile(cred.user, { displayName: clean(name) }).catch(() => {});
    await setDoc(doc(getFirestore(second), "userShops", cred.user.uid), {
      shopId, role, active: true, email: e, name: clean(name), branch: clean(branch),
    });
    await signOut(auth2).catch(() => {});
    return { uid: cred.user.uid };
  } finally {
    await deleteDoc(invite).catch(() => {});
    await deleteApp(second).catch(() => {});
  }
}

/** Admin changes a member's role / active / name / branch (never the shop). */
export const updateMember = (uid, patch) => updateDoc(doc(db, "userShops", uid), patch);

/** Admin removes a member from the shop (the account can no longer open it on any device). */
export const removeMember = (uid) => deleteDoc(doc(db, "userShops", uid));

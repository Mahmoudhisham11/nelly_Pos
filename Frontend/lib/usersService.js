// usersService.js — Users Service Layer Connected to FastAPI & SQLite
import { api } from "./apiClient";

export const ROLE_OPTIONS = [
  { value: "admin", label: "مسؤول (Admin) - كل الصلاحيات" },
  { value: "manager", label: "مدير - البيع والمخزون والتقارير" },
  { value: "cashier", label: "كاشير - نقطة البيع فقط" },
];

/** "user" is the legacy name of the cashier role. */
export const normalizeRole = (role) => {
  const r = String(role || "cashier").toLowerCase();
  return r === "user" ? "cashier" : ["admin", "manager", "cashier"].includes(r) ? r : "cashier";
};

export function subscribeToUsers(onData, onError) {
  return api.subscribe(
    async () => {
      const list = await api.get("/users");
      if (!Array.isArray(list)) return [];
      return list.map((u) => ({
        ...u,
        id: u.id,
        uid: u.id,
        role: normalizeRole(u.role),
        isActive: u.isActive === undefined ? true : Boolean(u.isActive),
      }));
    },
    onData,
    onError
  );
}

// api.post/put/delete never throw: turn their { success:false, error } into an exception for the callers.
const check = (res, fallback) => {
  if (!res || res.success === false) throw new Error(res?.error || fallback);
  return res;
};

export async function createUser({ name, email, password, role, branch }) {
  return check(await api.post("/users", {
    name: (name || "").trim(),
    displayName: (name || "").trim(),
    email: (email || "").trim().toLowerCase(),
    password: (password || "").trim(),
    role: normalizeRole(role),
    branch: (branch || "").trim(),
    isActive: true,
  }), "تعذر إنشاء المستخدم.");
}

export async function updateUser(userId, patch) {
  return check(await api.put(`/users/${userId}`, patch), "تعذر حفظ التعديل.");
}

export async function deleteUserDoc(userId) {
  return check(await api.delete(`/users/${userId}`), "تعذر حذف المستخدم.");
}

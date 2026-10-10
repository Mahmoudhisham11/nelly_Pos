// apiClient.js — Local API client for Nelly.
// Same contract as the original HTTP client (api.get/post/put/patch/delete, unwrap, subscribe...), but requests no
// longer go to a separate FastAPI process: they are handed to the in-process Nelly backend (@nelly/core) through
// lib/transport.js (Electron IPC on the desktop app, the /api/rpc bridge in the browser).
import { send } from "./transport";
const TOKEN_KEY = "nelly_desktop_auth_token";

export function getAuthToken() {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || null;
  } catch (_) {
    return null;
  }
}

export function setAuthToken(token) {
  if (typeof window === "undefined") return;
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
      sessionStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(TOKEN_KEY);
    }
  } catch (_) {}
}

let debounceTimer = null;
export function notifyDataUpdated(entity = "all") {
  if (typeof window === "undefined") return;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    try {
      window.dispatchEvent(new CustomEvent("nelly:data_updated", { detail: { entity } }));
    } catch (_) {}
  }, 300);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function newIdempotencyKey() {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch (_) {}
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

// The server rejected our token (expired, revoked, secret rotated): drop it and let the UI go to login.
function handleUnauthorized() {
  if (typeof window === "undefined") return;
  setAuthToken(null);
  try {
    window.dispatchEvent(new CustomEvent("nelly:unauthorized"));
  } catch (_) {}
}

async function request(endpoint, options = {}, retries = 1) {
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const query = {};
  if (options.params) {
    Object.entries(options.params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== "") query[key] = String(val);
    });
  }

  const token = getAuthToken();
  const headers = { ...(options.headers || {}) };
  if (token) headers["authorization"] = `Bearer ${token}`;
  // Same key on the automatic retry, so the backend never applies a sale/return/purchase twice.
  if (options.idempotencyKey) headers["idempotency-key"] = options.idempotencyKey;

  const method = (options.method || "GET").toUpperCase();
  const timeoutMs = options.timeout || 15000;
  let timeoutId;
  try {
    const res = await Promise.race([
      send({ method, path: cleanEndpoint, query, body: options.body ?? null, headers }),
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(Object.assign(new Error("aborted"), { name: "AbortError" })), timeoutMs);
      }),
    ]);
    clearTimeout(timeoutId);

    if (res.status === 204) return { success: true };
    const data = res.body;

    if (res.status < 200 || res.status >= 300) {
      if (res.status === 401 && !cleanEndpoint.startsWith("/auth/login") && !cleanEndpoint.startsWith("/auth/register")) {
        handleUnauthorized();
      }
      let errorMsg = `Request failed with status ${res.status}`;
      if (typeof data === "object" && data !== null) {
        if (Array.isArray(data.errors) && data.errors.length > 0) {
          errorMsg = data.errors.map((e) => `${e.field}: ${e.message}`).join(" | ");
        } else if (data.detail) {
          errorMsg = typeof data.detail === "object" ? (data.detail.message || JSON.stringify(data.detail)) : data.detail;
        } else if (data.message) {
          errorMsg = data.message;
        }
      }
      const err = new Error(typeof errorMsg === "string" ? errorMsg : JSON.stringify(errorMsg));
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  } catch (error) {
    clearTimeout(timeoutId);
    // Only transport failures (backend unreachable / timed out) are retried; business errors carry a status.
    const isNetworkError = error.status === undefined && (error.name === "AbortError" || error.isTransportError);
    if (isNetworkError) {
      if (retries > 0) {
        await sleep(250);
        return request(endpoint, options, retries - 1);
      }
      // Return safe fallback for GET or silent failure
      if (method === "GET") return null;
      return { success: false, offline: true, error: "الخادم المحلي غير متاح حالياً" };
    }
    throw error;
  }
}

/**
 * api.post/put/delete never throw (they resolve to { success:false, error }). Call unwrap() where the
 * caller must stop on failure, e.g. a rejected sale must not be shown as saved.
 */
export function unwrap(res) {
  if (res && res.success === false) {
    const err = new Error(res.error || "فشلت العملية");
    err.offline = Boolean(res.offline);
    throw err;
  }
  return res;
}

export const api = {
  async get(endpoint, params = null) {
    try {
      return await request(endpoint, { method: "GET", params });
    } catch (_) {
      return null;
    }
  },

  async post(endpoint, data = null) {
    try {
      const res = await request(endpoint, { method: "POST", body: data, idempotencyKey: newIdempotencyKey() });
      notifyDataUpdated();
      return res;
    } catch (err) {
      return { success: false, error: err.message || "حدث خطأ أثناء تنفيذ الطلب" };
    }
  },

  async put(endpoint, data = null) {
    try {
      const res = await request(endpoint, { method: "PUT", body: data });
      notifyDataUpdated();
      return res;
    } catch (err) {
      return { success: false, error: err.message || "حدث خطأ أثناء تنفيذ الطلب" };
    }
  },

  async patch(endpoint, data = null) {
    try {
      const res = await request(endpoint, { method: "PATCH", body: data });
      notifyDataUpdated();
      return res;
    } catch (err) {
      return { success: false, error: err.message || "حدث خطأ أثناء تنفيذ الطلب" };
    }
  },

  async delete(endpoint, params = null) {
    try {
      const res = await request(endpoint, { method: "DELETE", params });
      notifyDataUpdated();
      return res;
    } catch (err) {
      return { success: false, error: err.message || "حدث خطأ أثناء تنفيذ الطلب" };
    }
  },

  /**
   * Real-time Local Subscription Handler:
   * 1. Fetches immediately on mount.
   * 2. Re-fetches on debounced local data update events.
   * 3. Periodically polls (default every 5 seconds) as background fallback.
   */
  subscribe(fetchFn, onData, onError = null, pollInterval = 5000) {
    let active = true;

    const executeFetch = async () => {
      if (!active) return;
      try {
        const data = await fetchFn();
        if (active && onData && data !== null && data !== undefined) {
          onData(data);
        }
      } catch (err) {
        if (active && onError) {
          try { onError(err); } catch (_) {}
        }
      }
    };

    // 1. Initial immediate execution
    executeFetch();

    // 2. React to local data mutation events
    const handleUpdate = () => {
      if (active) executeFetch();
    };

    if (typeof window !== "undefined") {
      window.addEventListener("nelly:data_updated", handleUpdate);
    }

    // 3. Periodic fallback polling
    const timer = setInterval(() => {
      if (active) executeFetch();
    }, pollInterval);

    return () => {
      active = false;
      clearInterval(timer);
      if (typeof window !== "undefined") {
        window.removeEventListener("nelly:data_updated", handleUpdate);
      }
    };
  },
};

/** Like api.post but THROWS on failure, with `err.status` (for callers that must tell 401 from other errors). */
export const apiRequest = (endpoint, options) => request(endpoint, options);

export default api;

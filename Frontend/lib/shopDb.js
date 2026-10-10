// shopDb.js — every shop has its own local database on a device (desktop: electron/main.js, web: webBackend.worker.js).
// openShopDb() switches the local backend to the database of a shop before its account logs in, so one shop's data
// is never visible to another shop's account.

const desktop = () => (typeof window !== "undefined" ? window.nellyDesktop : null);
const browserBackend = () => process.env.NEXT_PUBLIC_NELLY_BACKEND === "browser" && typeof window !== "undefined";
const REG_KEY = "nelly:shops"; // web: { lastShop, accounts: { email: shopId } }

function readReg() {
  try { return JSON.parse(localStorage.getItem(REG_KEY) || "{}"); } catch { return {}; }
}

export async function openShopDb(shopId, email) {
  const d = desktop();
  if (d?.openShop) {
    if (d.configureCloud) await d.configureCloud(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "");
    return d.openShop({ shopId, email });
  }
  if (browserBackend()) {
    const { openWebShop } = await import("./webBackendClient");
    const res = await openWebShop(shopId, email);
    try {
      const reg = readReg();
      reg.lastShop = shopId;
      reg.accounts = { ...(reg.accounts || {}), [String(email || "").toLowerCase()]: shopId };
      localStorage.setItem(REG_KEY, JSON.stringify(reg));
    } catch {}
    return res;
  }
  return { shopId }; // local dev server (/api/rpc): a single database
}

/** The shop an e-mail last logged in with on this device (for offline login), or null. */
export async function shopForEmail(email) {
  const e = String(email || "").toLowerCase();
  const d = desktop();
  if (d?.shopForEmail) return d.shopForEmail(e);
  return readReg().accounts?.[e] || null;
}

"use client";

import { useEffect } from "react";

/** Registers the service worker (offline web app) for the browser build only: never inside Electron or in dev. */
export default function PwaRegister() {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_NELLY_BACKEND !== "browser" || window.nellyDesktop) return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch((e) => console.warn("Service worker not registered:", e?.message || e));
  }, []);
  return null;
}

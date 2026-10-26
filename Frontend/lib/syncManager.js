// syncManager.js — Bidirectional Real-Time & Offline Sync Engine
import { 
  collection, 
  doc, 
  setDoc, 
  getDocFromServer,
  runTransaction,
  onSnapshot,
  increment,
  query,
  where,
  Timestamp,
  serverTimestamp
} from "firebase/firestore";
import { db as firestoreDb } from "./firebase";
import { cloudSession } from "./cloudSession";
import { api } from "./apiClient";

// The cloud collections to sync, with the local table behind each one and whether its numbers (stock, balances) move
// as increments. They come from the backend (GET /app-info, built from its COLLECTION_PREFIX), so this file never
// names a collection itself.
let collectionsCache = null;
async function syncCollections() {
  if (!collectionsCache) {
    const info = await api.get("/app-info");
    const list = Array.isArray(info?.collections) ? info.collections : [];
    if (!list.length) throw new Error("app-info returned no sync collections");
    collectionsCache = {
      list,
      counters: new Set(list.filter((c) => c.counter).map((c) => c.name)),
    };
  }
  return collectionsCache;
}

// Applied increments are recorded here (one tiny doc per change) so a change sent twice is only counted once.
const APPLIED_OPS = "_appliedOps";

// A cloud document as the /sync/apply-batch item the listeners also produce.
function toApplyItem(colName, docSnap) {
  if (!docSnap.exists()) return null;
  const data = docSnap.data() || {};
  if (data._deleted) return { collectionName: colName, docId: docSnap.id, action: "DELETE" };
  const { _syncedAt, _deleted, ...fields } = data;
  return { collectionName: colName, docId: docSnap.id, action: "SET", data: { id: docSnap.id, ...fields } };
}

// The server applies each cloud document independently and reports the ones it could not store.
function reportApplyResult(res) {
  if (res && (res.failedCount > 0 || res.success === false)) {
    console.warn("Sync: some cloud documents were not applied", res.error || res.failed || res);
  }
  return res;
}

class SyncManager {
  constructor() {
    this.isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
    this.isSyncing = false;
    this.subscribers = new Set();
    this.unsubscribes = [];
    this.pendingCount = 0;
    this.lastSyncedAt = null;
    this.isInitialized = false;
    this.syncInterval = null;

    this.shopId = null;
    this.canWrite = false;

    if (typeof window !== "undefined") {
      window.addEventListener("online", () => this.handleOnlineStatus(true));
      window.addEventListener("offline", () => this.handleOnlineStatus(false));
    }
  }

  // Subscribe UI components to sync state changes
  subscribe(callback) {
    this.subscribers.add(callback);
    callback(this.getState());
    return () => this.subscribers.delete(callback);
  }

  notify() {
    const state = this.getState();
    this.subscribers.forEach((cb) => {
      try { cb(state); } catch (_) {}
    });
  }

  getState() {
    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      pendingCount: this.pendingCount,
      lastSyncedAt: this.lastSyncedAt,
      linked: !!this.shopId,
      canWrite: this.canWrite,
    };
  }

  handleOnlineStatus(status) {
    this.isOnline = status;
    this.notify();
    if (status) {
      this.triggerPush().catch(() => {});
    }
  }

  // Initialize the engine safely after UI mount
  start() {
    if (this.isInitialized || typeof window === "undefined") return;
    this.isInitialized = true;

    // Sync only runs while this device is linked to a shop's cloud space (see cloudSession.js).
    cloudSession.start();
    this.sessionUnsub = cloudSession.subscribe((st) => {
      const shopId = st.status === "ready" ? st.shopId : null;
      this.canWrite = st.status === "ready" && st.canWrite;
      if (shopId === this.shopId) return;
      this.unsubscribes.forEach((u) => { try { u(); } catch (_) {} });
      this.unsubscribes = [];
      this.shopId = shopId;
      this.boundOk = false;
      if (shopId) this.waitForShopDatabase(shopId);
      this.notify();
    });

    this.syncInterval = setInterval(() => {
      if (this.isOnline) {
        this.triggerPush().catch(() => {});
      }
    }, 20000); // Check every 20 seconds
  }

  /**
   * Sync starts only once the OPEN local database belongs to the signed-in shop (the login opens it right after the
   * cloud sign-in). Until then nothing is pushed or pulled, so two shops' data can never mix.
   */
  async waitForShopDatabase(shopId) {
    for (let i = 0; i < 40 && this.isInitialized && this.shopId === shopId; i++) {
      const res = await api.get("/sync/bound-shop").catch(() => null);
      if (this.shopId !== shopId) return;
      if (res && res.shopId === shopId) {
        this.boundOk = true;
        if (this.isOnline) {
          this.startRealtimeListeners();
          setTimeout(() => this.triggerPush().catch(() => {}), 1000);
        }
        this.notify();
        return;
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  stop() {
    if (this.sessionUnsub) { this.sessionUnsub(); this.sessionUnsub = null; }
    this.shopId = null;
    this.unsubscribes.forEach((unsub) => {
      try { unsub(); } catch (_) {}
    });
    this.unsubscribes = [];
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    this.isInitialized = false;
  }

  /** Full re-sync on demand: push what is pending, then re-read every collection (fresh initial snapshots). */
  async resyncAll() {
    if (!this.shopId || !this.boundOk) throw new Error("الجهاز مش مربوط بالسحابة.");
    await this.triggerPush();
    this.unsubscribes.forEach((u) => { try { u(); } catch (_) {} });
    this.unsubscribes = [];
    await this.startRealtimeListeners({ full: true });
    const { list } = await syncCollections();
    await new Promise((r) => setTimeout(r, list.length * 150 + 2000)); // listeners start staggered
    this.lastSyncedAt = new Date().toISOString();
    this.notify();
  }

  // =========================================================================
  // 1. Cloud ➡️ Local Pull (Firebase onSnapshot -> SQLite)
  // =========================================================================
  // Incremental: every pushed document carries _syncedAt (server time). A collection this database already pulled
  // is only queried for documents changed after its cursor (minus a safety margin), so opening the app reads just
  // what changed instead of the whole shop. The first pull of a collection (or a full re-sync) reads everything.
  // Deletions travel as tombstones ({ _deleted: true }) so incremental readers see them too.
  async startRealtimeListeners({ full = false } = {}) {
    const shopId = this.shopId;
    let cursors = {};
    if (!full) {
      const res = await api.get(`/sync/cursors?shopId=${encodeURIComponent(shopId)}`).catch(() => null);
      if (res && typeof res === "object" && !Array.isArray(res)) cursors = res;
    }
    let collections;
    try {
      collections = (await syncCollections()).list;
    } catch (e) {
      console.warn("Sync: could not read the collection list", e?.message || e);
      return;
    }
    if (this.shopId !== shopId || !this.isInitialized) return;

    const MARGIN_MS = 10 * 60 * 1000;
    collections.forEach(({ name: colName }, idx) => {
      setTimeout(() => {
        if (!this.isInitialized || this.shopId !== shopId) return;
        try {
          const ref = collection(firestoreDb, "shops", shopId, colName);
          const since = Number(cursors[colName]) || 0;
          const q = since > 0 ? query(ref, where("_syncedAt", ">", Timestamp.fromMillis(since - MARGIN_MS))) : ref;
          let first = true;
          const unsub = onSnapshot(
            q,
            (snapshot) => {
              const changes = first ? snapshot.docs.map((d) => ({ type: "added", doc: d })) : snapshot.docChanges();
              const wasFirst = first;
              first = false;
              const items = [];
              let newest = 0;
              for (const change of changes) {
                const docSnap = change.doc;
                const data = docSnap.data();
                const stamp = data?._syncedAt?.toMillis?.() || 0;
                if (stamp > newest) newest = stamp;
                if (change.type === "removed") {
                  // left the query: only a real removal when we are listening to the whole collection
                  if (!since) items.push({ collectionName: colName, docId: docSnap.id, action: "DELETE" });
                  continue;
                }
                if (data?._deleted) {
                  items.push({ collectionName: colName, docId: docSnap.id, action: "DELETE" });
                  continue;
                }
                const { _syncedAt, _deleted, ...fields } = data || {};
                items.push({ collectionName: colName, docId: docSnap.id, action: "SET", data: { id: docSnap.id, ...fields } });
              }
              const applied = items.length
                ? api.post("/sync/apply-batch", { shopId, items }).then(reportApplyResult)
                : Promise.resolve({ success: true });
              applied
                .then((res) => {
                  // move the cursor only after the documents are stored; a full first pull of documents written
                  // before _syncedAt existed starts the cursor at "now" (minus the margin applied when reading)
                  const cursor = newest || (wasFirst && !since ? Date.now() : 0);
                  if (cursor && res && res.success !== false) {
                    return api.post("/sync/cursors", { shopId, cursors: { [colName]: cursor } });
                  }
                  return null;
                })
                .catch((e) => console.warn("Sync: apply-batch failed", e?.message || e));
              if (items.length) {
                this.lastSyncedAt = new Date().toISOString();
                this.notify();
              }
            },
            (err) => {
              console.warn(`Realtime listener warning for ${colName}:`, err?.message || err);
            }
          );
          this.unsubscribes.push(unsub);
        } catch (err) {
          console.warn(`Failed to initialize listener for ${colName}:`, err);
        }
      }, idx * 150);
    });
  }

  // =========================================================================
  // 2. Local ➡️ Cloud Push (SQLite sync_queue -> Firebase Firestore)
  // =========================================================================
  async triggerPush() {
    if (this.isSyncing || !this.isOnline || !this.shopId || !this.canWrite || !this.boundOk) return;
    this.isSyncing = true;
    this.notify();

    try {
      let queue = null;
      try {
        queue = await api.get(`/sync/queue?limit=100&shopId=${encodeURIComponent(this.shopId)}`);
      } catch (_) {
        queue = null;
      }

      if (!Array.isArray(queue) || queue.length === 0) {
        this.pendingCount = 0;
        this.isSyncing = false;
        this.notify();
        return;
      }

      this.pendingCount = queue.length;
      this.notify();

      const { counters } = await syncCollections();
      const syncedIds = [];
      // A document whose earlier change failed gets none of its later changes this round: they must reach the cloud
      // in order (e.g. an increment pushed before the product's creation would be overwritten by it).
      const blockedDocs = new Set();
      // Counter documents this device changed: re-read from the cloud afterwards (see refreshCounters).
      const counterDocs = new Map();

      for (const item of queue) {
        const colName = item.collectionName;
        const docId = item.recordId;
        const action = item.action;
        let payload = item.payload;
        if (typeof payload === "string") {
          try { payload = JSON.parse(payload); } catch (_) {}
        }

        const docKey = `${colName}/${docId}`;
        if (blockedDocs.has(docKey)) continue;

        try {
          const docRef = doc(firestoreDb, "shops", this.shopId, colName, docId);

          if (action === "DELETE") {
            // a tombstone (not a real delete) so devices that only read recent changes also see the removal
            await setDoc(docRef, { _deleted: true, _syncedAt: serverTimestamp(), updatedAt: new Date().toISOString() }, { merge: true });
          } else {
            // INSERT or UPDATE
            const cleanPayload = { ...(payload || {}) };
            delete cleanPayload.id;
            // Counters (stock, balances) go up as increments so concurrent devices add up instead of overwriting.
            const deltas = cleanPayload.__deltas;
            const opId = cleanPayload.__opId || `q-${item.recordId}-${item.id}-${item.createdAt}`;
            delete cleanPayload.__deltas;
            delete cleanPayload.__opId;
            let hasIncrement = false;
            if (deltas && action !== "INSERT") {
              // a counter missing from __deltas was SET on purpose (a stock-take) and goes up as its value
              for (const [field, change] of Object.entries(deltas)) {
                if (change) {
                  cleanPayload[field] = increment(Number(change));
                  hasIncrement = true;
                } else {
                  delete cleanPayload[field]; // unchanged here: never overwrite another device's newer value
                }
              }
            }

            Object.keys(cleanPayload).forEach((k) => {
              if (cleanPayload[k] === undefined) delete cleanPayload[k];
            });

            const docData = {
              ...cleanPayload,
              updatedAt: cleanPayload.updatedAt || new Date().toISOString(),
              _deleted: false,
              _syncedAt: serverTimestamp(),
            };
            if (hasIncrement) {
              // The increment and its receipt are written together, and only if the receipt is not there yet: if the
              // app closes (or mark-synced fails) after the cloud took the change, re-sending it changes nothing.
              const opRef = doc(firestoreDb, "shops", this.shopId, APPLIED_OPS, opId);
              await runTransaction(firestoreDb, async (tx) => {
                const done = await tx.get(opRef);
                if (done.exists()) return;
                tx.set(docRef, docData, { merge: true });
                tx.set(opRef, { doc: docKey, at: serverTimestamp() });
              });
            } else {
              await setDoc(docRef, docData, { merge: true });
            }
          }
          if (counters.has(colName)) counterDocs.set(docKey, { colName, docId });

          // Marked right away (not after the loop): an increment must never be sent twice if the app closes mid-push.
          await api.post("/sync/queue/mark-synced", { shopId: this.shopId, ids: [item.id] });
          syncedIds.push(item.id);
        } catch (pushErr) {
          blockedDocs.add(docKey);
          console.error(`Failed to push item ${item.id} (${colName}/${docId}):`, pushErr);
        }
      }

      await this.refreshCounters([...counterDocs.values()]);

      this.pendingCount = Math.max(0, queue.length - syncedIds.length);
      this.lastSyncedAt = new Date().toISOString();
    } catch (err) {
      console.warn("SyncManager triggerPush notice:", err?.message || err);
    } finally {
      this.isSyncing = false;
      this.notify();
    }
  }

  /**
   * After this device pushed its changes to stock / balances, read those documents back from the server and store them
   * locally. Cloud changes from other devices that arrived while this device still had unsent changes for the same
   * document were skipped (local changes win until pushed), and nothing guarantees the listener sends them again, so
   * without this the device could keep showing an old number. Rows that got new local changes meanwhile are skipped by
   * the server again and refreshed after their own push.
   */
  async refreshCounters(docs) {
    if (!docs.length || !this.shopId) return;
    const shopId = this.shopId;
    const items = [];
    for (const { colName, docId } of docs) {
      try {
        const snap = await getDocFromServer(doc(firestoreDb, "shops", shopId, colName, docId));
        const item = toApplyItem(colName, snap);
        if (item) items.push(item);
      } catch (err) {
        console.warn(`Sync: could not re-read ${colName}/${docId}`, err?.message || err);
      }
    }
    if (!items.length || this.shopId !== shopId) return;
    await api.post("/sync/apply-batch", { shopId, items }).then(reportApplyResult).catch((e) => {
      console.warn("Sync: refresh apply failed", e?.message || e);
    });
  }
}

export const syncManager = new SyncManager();

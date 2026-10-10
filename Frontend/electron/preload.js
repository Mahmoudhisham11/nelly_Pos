const { contextBridge, ipcRenderer } = require("electron");

// The renderer (Next.js UI) talks to the Nelly backend running in the main process; no local HTTP server is involved.
contextBridge.exposeInMainWorld("nellyDesktop", {
  request: (req) => ipcRenderer.invoke("nelly:request", req),
  aiTurn: (req) => ipcRenderer.invoke("nelly:ai-turn", req),
  // one local database per shop (see electron/main.js)
  openShop: (arg) => ipcRenderer.invoke("nelly:open-shop", arg),
  shopForEmail: (email) => ipcRenderer.invoke("nelly:shop-for-email", email),
  configureCloud: (projectId) => ipcRenderer.invoke("nelly:configure-cloud", projectId),
  backups: {
    now: () => ipcRenderer.invoke("nelly:backup-now"),
    list: () => ipcRenderer.invoke("nelly:backup-list"),
    restore: (name) => ipcRenderer.invoke("nelly:backup-restore", name),
    openFolder: () => ipcRenderer.invoke("nelly:backup-open-folder"),
  },
});
contextBridge.exposeInMainWorld("electronAPI", {
  getVersion: () => ipcRenderer.invoke("app:version"),
  getPlatform: () => ipcRenderer.invoke("app:platform"),
  isElectron: true,
});

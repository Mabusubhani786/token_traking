import { contextBridge, ipcRenderer } from "electron"

// Expose a minimal, safe API to the renderer. The renderer calls
// getTokenTrakingLogs() to read real token usage from the local system.
contextBridge.exposeInMainWorld("electronAPI", {
  getTokenTrakingLogs: () => ipcRenderer.invoke("token-traking-logs"),
  getSystemUserName: () => ipcRenderer.invoke("system-user-name"),
})

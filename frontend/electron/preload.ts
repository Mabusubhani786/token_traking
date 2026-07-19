import { contextBridge, ipcRenderer } from "electron"

// Expose a minimal, safe API to the renderer. The renderer calls
// getClaudeLogs() to read real token usage from the local system.
contextBridge.exposeInMainWorld("electronAPI", {
  getClaudeLogs: () => ipcRenderer.invoke("claude-logs"),
})

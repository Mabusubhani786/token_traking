// Type for the Electron preload bridge exposed on `window.electronAPI`.
// Only present in the desktop build; the web build uses the HTTP endpoint.
export {}

declare global {
  interface Window {
    electronAPI?: {
      getClaudeLogs: () => Promise<import("./data/ingest-core").IngestedDataset>
      getSystemUserName: () => Promise<string>
    }
  }
}

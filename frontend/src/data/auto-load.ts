// Automatic, real-data bootstrap.
//
// On app start we pull the compiled dataset from the dev-server endpoint
// (`/api/claude-logs`, which reads the local Claude Code session logs) and
// load it into the store. This means the dashboard shows REAL token usage
// immediately — no dummy data and no manual "load folder" step.

import { hydrateFromPersistence, isEmpty, loadDataset } from "./db"
import type { IngestedDataset } from "./ingest-core"

const ENDPOINT = "/api/claude-logs"

let inflight: Promise<boolean> | null = null

// Fetch and load the system dataset. Returns true if data was loaded.
// Safe to call repeatedly; concurrent calls share one request.
export function loadSystemData(): Promise<boolean> {
  if (inflight) return inflight
  inflight = (async () => {
    // Desktop (Electron): read directly from the main process over IPC.
    if (typeof window !== "undefined" && window.electronAPI?.getClaudeLogs) {
      try {
        const data = await window.electronAPI.getClaudeLogs()
        if (data && Array.isArray(data.usageEvents) && data.usageEvents.length > 0) {
          await applyDataset(data)
          return true
        }
      } catch {
        // fall through to the web endpoint below
      }
    }
    // Web (dev/preview): fetch from the dev-server middleware.
    try {
      const res = await fetch(ENDPOINT)
      if (!res.ok) return false
      const data = (await res.json()) as IngestedDataset
      if (!data || !Array.isArray(data.usageEvents) || data.usageEvents.length === 0) {
        return false
      }
      await applyDataset(data)
      return true
    } catch {
      return false
    }
  })()
  return inflight
}

async function applyDataset(data: IngestedDataset) {
  await loadDataset({
    projects: data.projects ?? [],
    users: data.users ?? [],
    models: data.models ?? [],
    tasks: data.tasks ?? [],
    usageEvents: data.usageEvents ?? [],
  })
}

// Load system data only if the store is currently empty.
export function loadSystemDataIfEmpty(): Promise<boolean> {
  // Prefer persisted SQLite data (survives refresh) before re-ingesting.
  return hydrateFromPersistence().then(() => {
    if (!isEmpty()) return true
    return loadSystemData()
  })
}

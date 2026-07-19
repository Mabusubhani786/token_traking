// Automatic, real-data bootstrap.
//
// On app start we pull the compiled dataset from the dev-server endpoint
// (`/api/claude-logs`, which reads the local Claude Code session logs) and
// load it into the store. This means the dashboard shows REAL token usage
// immediately — no dummy data and no manual "load folder" step.

import {
  hasMessageTasks,
  hydrateFromPersistence,
  isEmpty,
  loadDataset,
  getUsers,
  updateUser,
} from "./db"
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

// Resolve the current user's display name from the system. Tries the
// Electron IPC bridge first (desktop), then falls back to a live fetch
// from the dev-server endpoint which reads from the OS.
async function resolveSystemUserName(): Promise<string | null> {
  // Desktop: the main process can provide the name directly.
  if (typeof window !== "undefined" && window.electronAPI?.getSystemUserName) {
    try {
      const name = await window.electronAPI.getSystemUserName()
      if (name) return name
    } catch {
      // fall through
    }
  }
  // Web: the dev-server endpoint returns the full dataset which includes
  // the resolved user name. We only need the name, so fetch & extract.
  try {
    const res = await fetch(ENDPOINT)
    if (res.ok) {
      const data = (await res.json()) as IngestedDataset
      const u = data.users?.find((u) => u.id === "u-you")
      if (u?.name && u.name !== "You") return u.name
    }
  } catch {
    // fall through
  }
  return null
}

// Load system data only if the store is currently empty.
export function loadSystemDataIfEmpty(): Promise<boolean> {
  // Prefer persisted SQLite data (survives refresh) before re-ingesting.
  return hydrateFromPersistence().then(async () => {
    if (!isEmpty() && hasMessageTasks()) {
      // Even when using cached data, update the user's display name from
      // the system so it stays current without a full re-ingestion.
      const name = await resolveSystemUserName()
      if (name) {
        const users = getUsers()
        const you = users.find((u) => u.id === "u-you")
        if (you && you.name !== name) {
          const initials = name
            .split(" ")
            .map((p) => p[0])
            .slice(0, 2)
            .join("")
            .toUpperCase()
          updateUser("u-you", {
            name,
            avatarUrl: `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(initials)}`,
          })
        }
      }
      return true
    }
    return loadSystemData()
  })
}

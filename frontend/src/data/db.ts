// In-memory data store.
//
// This module is the single point where the app reads data. The UI and
// query layer never touch storage directly (see frontend/CLAUDE.md).
//
// There is NO dummy/fake data. The store starts empty and is
// populated at runtime by real ingestion (Claude Code session logs,
// parsed in ./ingest.ts) or by JSON import (Settings). Swap this
// file's internals for a SQLite/sql.js loader later without
// changing any caller.

import { useSyncExternalStore } from "react"

import type { Model, Project, Task, UsageEvent, User } from "./usage-types"
import type { IngestedDataset } from "./ingest"
import { loadPersisted, persistStore } from "./persist"

export type Store = {
  models: Model[]
  projects: Project[]
  users: User[]
  tasks: Task[]
  usageEvents: UsageEvent[]
}

let store: Store = {
  models: [],
  projects: [],
  users: [],
  tasks: [],
  usageEvents: [],
}

// Tiny pub/sub so screens re-render after a dataset is loaded.
type Listener = () => void
const listeners = new Set<Listener>()

function emit() {
  for (const fn of listeners) fn()
}

export function subscribe(fn: Listener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

// Subscribe a React component to the store. Returns the live store snapshot
// and re-renders the caller whenever the dataset is replaced (e.g. after the
// initial API load). Route components read from the store during render, so
// calling this hook is what makes them update once data arrives — TanStack
// Router memoizes outlet components, so the layout's `forceRender` alone does
// not reach them.
export function useDataStore() {
  return useSyncExternalStore(
    subscribe,
    () => store,
    () => store,
  )
}

// Replace the live dataset (real ingestion or JSON import). Persisted to
// SQLite so the data survives a page refresh. Returns the persist promise so
// callers that immediately reload (Settings import/load) can await it first.
export function loadDataset(next: Partial<Store>): Promise<void> {
  store = {
    models: next.models ?? [],
    projects: next.projects ?? [],
    users: next.users ?? [],
    tasks: next.tasks ?? [],
    usageEvents: next.usageEvents ?? [],
  }
  emit()
  return persistStore(store).catch(() => {})
}

// Hydrate the in-memory store from the persisted SQLite database. No-op (and
// silent) if nothing has been persisted yet — the caller then ingests.
export async function hydrateFromPersistence(): Promise<void> {
  try {
    const data = await loadPersisted()
    if (data) {
      store = {
        models: data.models,
        projects: data.projects,
        users: data.users,
        tasks: data.tasks,
        usageEvents: data.usageEvents,
      }
      emit()
    }
  } catch {
    // Fall back to an empty store; ingestion will refill it.
  }
}

export function getProjects(): Project[] {
  return store.projects
}

export function getProjectById(id: string): Project | undefined {
  return store.projects.find((p) => p.id === id)
}

export function getUsers(): User[] {
  return store.users
}

export function getUserById(id: string): User | undefined {
  return store.users.find((u) => u.id === id)
}

export function getModels(): Model[] {
  return store.models
}

export function getModelById(id: string): Model | undefined {
  return store.models.find((m) => m.id === id)
}

export function getTasks(): Task[] {
  return store.tasks
}

export function getTaskById(id: string): Task | undefined {
  return store.tasks.find((t) => t.id === id)
}

export function getUsageEvents(): UsageEvent[] {
  return store.usageEvents
}

// Range covered by the loaded data (used as the default chart window).
export function getDatasetRange(): { from: string; to: string } {
  const ev = store.usageEvents
  if (ev.length === 0) {
    const t = new Date().toISOString().slice(0, 10)
    return { from: t, to: t }
  }
  let min = "9999-12-31"
  let max = "0000-01-01"
  for (const e of ev) {
    const d = e.eventAt.slice(0, 10)
    if (d < min) min = d
    if (d > max) max = d
  }
  return { from: min, to: max }
}

export function isEmpty(): boolean {
  return store.usageEvents.length === 0
}

export function hasMessageTasks(): boolean {
  return (
    store.usageEvents.some((e) => Boolean(e.messageTaskId)) &&
    store.tasks.some((t) => Boolean(t.parentTaskId))
  )
}

// Update a model's cost rates in place (used by Settings).
export function updateModel(
  id: string,
  patch: Partial<
    Pick<Model, "inputCostPer1m" | "outputCostPer1m" | "cachedInputCostPer1m">
  >,
) {
  store.models = store.models.map((m) =>
    m.id === id ? { ...m, ...patch } : m,
  )
  // Persist cost-rate edits so they survive a refresh.
  void persistStore(store).catch(() => {})
}

// Update a user record in place (used by auto-load to sync display name).
export function updateUser(id: string, patch: Partial<Pick<User, "name" | "avatarUrl">>) {
  store.users = store.users.map((u) =>
    u.id === id ? { ...u, ...patch } : u,
  )
  emit()
  void persistStore(store).catch(() => {})
}

export type { IngestedDataset }

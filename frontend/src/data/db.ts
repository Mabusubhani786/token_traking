// In-memory data store.
//
// This module is the single point where the app reads persisted data. The UI
// and query layer never touch storage directly (see frontend/CLAUDE.md).
// Swap this file's internals for a SQLite/sql.js connection later without
// changing any caller.

import { models, projects, seedDateRange, tasks, usageEvents, users } from "./seed"
import type { Model, Project, Task, UsageEvent, User } from "./usage-types"

const db = {
  models,
  projects,
  users,
  tasks,
  usageEvents,
  seedDateRange,
}

export function getProjects(): Project[] {
  return db.projects
}

export function getProjectById(id: string): Project | undefined {
  return db.projects.find((p) => p.id === id)
}

export function getUsers(): User[] {
  return db.users
}

export function getUserById(id: string): User | undefined {
  return db.users.find((u) => u.id === id)
}

export function getModels(): Model[] {
  return db.models
}

export function getModelById(id: string): Model | undefined {
  return db.models.find((m) => m.id === id)
}

export function getTasks(): Task[] {
  return db.tasks
}

export function getTaskById(id: string): Task | undefined {
  return db.tasks.find((t) => t.id === id)
}

export function getUsageEvents(): UsageEvent[] {
  return db.usageEvents
}

export function getSeedDateRange() {
  return db.seedDateRange
}

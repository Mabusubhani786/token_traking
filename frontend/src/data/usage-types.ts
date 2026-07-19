// Core domain types for the token tracking app.
// These mirror the SQLite schema described in frontend/CLAUDE.md.

export type Project = {
  id: string
  name: string
  description: string
  color: string
  createdAt: string
  updatedAt: string
}

export type User = {
  id: string
  name: string
  email: string
  avatarUrl: string
  role: string
  createdAt: string
  updatedAt: string
}

export type Model = {
  id: string
  provider: string
  name: string
  displayName: string
  inputCostPer1m: number
  outputCostPer1m: number
  cachedInputCostPer1m: number
  createdAt: string
  updatedAt: string
}

export type TaskStatus = "active" | "completed" | "paused" | "archived"

export type Task = {
  id: string
  projectId: string
  userId?: string
  title: string
  status: TaskStatus
  tags: string[]
  startedAt?: string
  completedAt?: string
  createdAt: string
  updatedAt: string
}

export type UsageEvent = {
  id: string
  projectId: string
  userId?: string
  taskId?: string
  modelId: string
  inputTokens: number
  outputTokens: number
  cachedInputTokens: number
  totalTokens: number
  estimatedCost: number
  eventAt: string
  createdAt: string
}

export type UsageFilters = {
  projectId?: string
  userId?: string
  modelId?: string
  taskId?: string
  from?: string // ISO date (inclusive)
  to?: string // ISO date (inclusive)
}

export type UsageSummary = {
  totalTokens: number
  inputTokens: number
  outputTokens: number
  cachedInputTokens: number
  estimatedCost: number
  activeProjects: number
  activeUsers: number
  taskCount: number
  eventCount: number
  mostUsedModelId?: string
}

export type DailyPoint = {
  date: string // YYYY-MM-DD
  inputTokens: number
  outputTokens: number
  cachedInputTokens: number
  totalTokens: number
  estimatedCost: number
}

export type HourlyPoint = {
  hour: number // 0-23
  totalTokens: number
  estimatedCost: number
  events: number
}

export type HeatmapCell = {
  day: number // 0 (Sun) - 6 (Sat)
  hour: number // 0-23
  value: number
}

export type NamedTotal = {
  id: string
  name: string
  totalTokens: number
  estimatedCost: number
  count: number
}

// Typed, derived query functions for the dashboard.
//
// Every screen reads from these functions, never from storage directly.
// Heavy aggregation lives here so components stay presentational.

import {
  getDatasetRange,
  getModels,
  getProjects,
  getTasks,
  getUsageEvents,
  getUsers,
} from "./db"
import type { IngestedDataset } from "./ingest-core"
import type {
  DailyPoint,
  HeatmapCell,
  HourlyPoint,
  Model,
  NamedTotal,
  Project,
  Task,
  UsageEvent,
  UsageFilters,
  UsageSummary,
  User,
} from "./usage-types"

// A dataset slice a query can run against instead of the global store. Used
// when a screen (e.g. the project detail page) derives from an API-fetched,
// already-filtered dataset rather than the in-memory store.
type DataSource = Pick<
  IngestedDataset,
  "projects" | "users" | "models" | "tasks" | "usageEvents"
>

function srcEvents(ds?: DataSource) {
  return ds ? ds.usageEvents : getUsageEvents()
}
function srcProjects(ds?: DataSource) {
  return ds ? ds.projects : getProjects()
}
function srcUsers(ds?: DataSource) {
  return ds ? ds.users : getUsers()
}
function srcModels(ds?: DataSource) {
  return ds ? ds.models : getModels()
}
function srcTasks(ds?: DataSource) {
  return ds ? ds.tasks : getTasks()
}

// Date range covered by an arbitrary set of events (used when running a query
// against a dataset slice instead of the global store).
function rangeOfEvents(events: UsageEvent[]): { from: string; to: string } {
  if (events.length === 0) {
    const t = new Date().toISOString().slice(0, 10)
    return { from: t, to: t }
  }
  let min = "9999-12-31"
  let max = "0000-01-01"
  for (const e of events) {
    const d = e.eventAt.slice(0, 10)
    if (d < min) min = d
    if (d > max) max = d
  }
  return { from: min, to: max }
}

function eventDate(iso: string): string {
  return iso.slice(0, 10)
}

function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setUTCDate(x.getUTCDate() + n)
  return x
}

function todayISO(): string {
  return fmtDate(new Date())
}

function eachDay(from: string, to: string): string[] {
  const out: string[] = []
  let cur = parseDate(from)
  const end = parseDate(to)
  while (cur <= end) {
    out.push(fmtDate(cur))
    cur = addDays(cur, 1)
  }
  return out
}

function applyFilters(events: UsageEvent[], filters: UsageFilters): UsageEvent[] {
  return events.filter((e) => {
    if (filters.projectId && e.projectId !== filters.projectId) return false
    if (filters.userId && e.userId !== filters.userId) return false
    if (filters.modelId && e.modelId !== filters.modelId) return false
    if (filters.taskId && e.taskId !== filters.taskId) return false
    const d = eventDate(e.eventAt)
    if (filters.from && d < filters.from) return false
    if (filters.to && d > filters.to) return false
    return true
  })
}

function hasActiveFilters(filters: UsageFilters): boolean {
  return Boolean(
    filters.projectId ||
      filters.userId ||
      filters.modelId ||
      filters.taskId ||
      filters.from ||
      filters.to,
  )
}

// ---- Summary -------------------------------------------------------------

export function getUsageSummary(
  filters: UsageFilters = {},
  ds?: DataSource,
): UsageSummary {
  const events = applyFilters(srcEvents(ds), filters)
  const totals = events.reduce(
    (acc, e) => {
      acc.inputTokens += e.inputTokens
      acc.outputTokens += e.outputTokens
      acc.cachedInputTokens += e.cachedInputTokens
      acc.totalTokens += e.totalTokens
      acc.estimatedCost += e.estimatedCost
      return acc
    },
    {
      inputTokens: 0,
      outputTokens: 0,
      cachedInputTokens: 0,
      totalTokens: 0,
      estimatedCost: 0,
    },
  )

  const modelTokens = new Map<string, number>()
  for (const e of events) {
    modelTokens.set(e.modelId, (modelTokens.get(e.modelId) ?? 0) + e.totalTokens)
  }
  let mostUsedModelId: string | undefined
  let max = -1
  for (const [id, t] of modelTokens) {
    if (t > max) {
      max = t
      mostUsedModelId = id
    }
  }

  return {
    totalTokens: totals.totalTokens,
    inputTokens: totals.inputTokens,
    outputTokens: totals.outputTokens,
    cachedInputTokens: totals.cachedInputTokens,
    estimatedCost: Math.round(totals.estimatedCost * 1000) / 1000,
    activeProjects: new Set(events.map((e) => e.projectId)).size,
    activeUsers: new Set(events.map((e) => e.userId).filter(Boolean)).size,
    taskCount: new Set(events.map((e) => e.taskId).filter(Boolean)).size,
    eventCount: events.length,
    mostUsedModelId,
  }
}

// ---- Time series ---------------------------------------------------------

export function getDailyUsage(
  filters: UsageFilters = {},
  days = 30,
  ds?: DataSource,
): DailyPoint[] {
  const events = applyFilters(srcEvents(ds), filters)
  // Derive `from` from `to` (never the other way around) so the window is
  // always well-formed. When the dataset spans a single day, `range.from`
  // would be *later* than `range.to - (days-1)`, which previously produced
  // an inverted range and an empty series — breaking the trend charts on
  // detail pages (which call this without explicit from/to).
  const range = ds ? rangeOfEvents(events) : getDatasetRange()
  const to = filters.to ?? range.to
  const from = filters.from ?? fmtDate(addDays(parseDate(to), -(days - 1)))
  const map = new Map<string, DailyPoint>()
  for (const day of eachDay(from, to)) {
    map.set(day, {
      date: day,
      inputTokens: 0,
      outputTokens: 0,
      cachedInputTokens: 0,
      totalTokens: 0,
      estimatedCost: 0,
    })
  }
  for (const e of events) {
    const d = eventDate(e.eventAt)
    const point = map.get(d)
    if (!point) continue
    point.inputTokens += e.inputTokens
    point.outputTokens += e.outputTokens
    point.cachedInputTokens += e.cachedInputTokens
    point.totalTokens += e.totalTokens
    point.estimatedCost += e.estimatedCost
  }
  return Array.from(map.values()).map((p) => ({
    ...p,
    estimatedCost: Math.round(p.estimatedCost * 1000) / 1000,
  }))
}

export function getHourlyUsage(
  filters: UsageFilters = {},
  ds?: DataSource,
): HourlyPoint[] {
  const events = applyFilters(srcEvents(ds), filters)
  const points: HourlyPoint[] = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    totalTokens: 0,
    estimatedCost: 0,
    events: 0,
  }))
  for (const e of events) {
    const hour = new Date(e.eventAt).getUTCHours()
    points[hour].totalTokens += e.totalTokens
    points[hour].estimatedCost += e.estimatedCost
    points[hour].events += 1
  }
  for (const p of points) {
    p.estimatedCost = Math.round(p.estimatedCost * 1000) / 1000
  }
  return points
}

export function getHeatmap(
  filters: UsageFilters = {},
  ds?: DataSource,
): HeatmapCell[] {
  const events = applyFilters(srcEvents(ds), filters)
  const cells: HeatmapCell[] = []
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      cells.push({ day, hour, value: 0 })
    }
  }
  const index = (day: number, hour: number) => day * 24 + hour
  for (const e of events) {
    const d = new Date(e.eventAt)
    const day = d.getUTCDay()
    const hour = d.getUTCHours()
    cells[index(day, hour)].value += e.totalTokens
  }
  return cells
}

// ---- Ranked breakdowns ---------------------------------------------------

function toNamedTotals(
  groups: Map<string, { tokens: number; cost: number; count: number }>,
  nameOf: (id: string) => string,
  limit?: number,
): NamedTotal[] {
  const rows = Array.from(groups.entries()).map(([id, v]) => ({
    id,
    name: nameOf(id),
    totalTokens: v.tokens,
    estimatedCost: Math.round(v.cost * 1000) / 1000,
    count: v.count,
  }))
  rows.sort((a, b) => b.totalTokens - a.totalTokens)
  return limit ? rows.slice(0, limit) : rows
}

export function getTopModels(
  filters: UsageFilters = {},
  limit?: number,
  ds?: DataSource,
): NamedTotal[] {
  const events = applyFilters(srcEvents(ds), filters)
  const map = new Map<string, { tokens: number; cost: number; count: number }>()
  const byId = new Map(srcModels(ds).map((m) => [m.id, m]))
  for (const e of events) {
    const cur = map.get(e.modelId) ?? { tokens: 0, cost: 0, count: 0 }
    cur.tokens += e.totalTokens
    cur.cost += e.estimatedCost
    cur.count += 1
    map.set(e.modelId, cur)
  }
  return toNamedTotals(map, (id) => byId.get(id)?.displayName ?? id, limit)
}

export function getTopUsers(
  filters: UsageFilters = {},
  limit?: number,
  ds?: DataSource,
): NamedTotal[] {
  const events = applyFilters(srcEvents(ds), filters)
  const map = new Map<string, { tokens: number; cost: number; count: number }>()
  const byId = new Map(srcUsers(ds).map((u) => [u.id, u]))
  for (const e of events) {
    if (!e.userId) continue
    const cur = map.get(e.userId) ?? { tokens: 0, cost: 0, count: 0 }
    cur.tokens += e.totalTokens
    cur.cost += e.estimatedCost
    cur.count += 1
    map.set(e.userId, cur)
  }
  return toNamedTotals(map, (id) => byId.get(id)?.name ?? id, limit)
}

export function getTopProjects(
  filters: UsageFilters = {},
  limit?: number,
): NamedTotal[] {
  const events = applyFilters(getUsageEvents(), filters)
  const map = new Map<string, { tokens: number; cost: number; count: number }>()
  const byId = new Map(getProjects().map((p) => [p.id, p]))
  for (const e of events) {
    const cur = map.get(e.projectId) ?? { tokens: 0, cost: 0, count: 0 }
    cur.tokens += e.totalTokens
    cur.cost += e.estimatedCost
    cur.count += 1
    map.set(e.projectId, cur)
  }
  return toNamedTotals(map, (id) => byId.get(id)?.name ?? id, limit)
}

export function getTopTasks(
  filters: UsageFilters = {},
  limit?: number,
  ds?: DataSource,
): NamedTotal[] {
  const events = applyFilters(srcEvents(ds), filters)
  const map = new Map<string, { tokens: number; cost: number; count: number }>()
  const byId = new Map(srcTasks(ds).map((t) => [t.id, t]))
  for (const e of events) {
    if (!e.taskId) continue
    const cur = map.get(e.taskId) ?? { tokens: 0, cost: 0, count: 0 }
    cur.tokens += e.totalTokens
    cur.cost += e.estimatedCost
    cur.count += 1
    map.set(e.taskId, cur)
  }
  return toNamedTotals(map, (id) => byId.get(id)?.title ?? id, limit)
}

// ---- List rows -----------------------------------------------------------

export type ProjectRow = {
  project: Project
  totalTokens: number
  estimatedCost: number
  userCount: number
  taskCount: number
  lastActivity: string | null
}

export type UserRow = {
  user: User
  totalTokens: number
  estimatedCost: number
  taskCount: number
  eventCount: number
  lastActivity: string | null
  topModelId?: string
}

export type TaskRow = {
  task: Task
  project: Project
  user?: User
  modelId: string
  totalTokens: number
  estimatedCost: number
  events: number
  lastActivity: string | null
}

export type ModelRow = {
  model: Model
  totalTokens: number
  estimatedCost: number
  inputTokens: number
  outputTokens: number
  cachedInputTokens: number
  events: number
}

export function getProjectRows(filters: UsageFilters = {}): ProjectRow[] {
  const events = applyFilters(getUsageEvents(), filters)
  const map = new Map<
    string,
    { tokens: number; cost: number; users: Set<string>; last: string | null }
  >()
  for (const e of events) {
    const cur =
      map.get(e.projectId) ??
      { tokens: 0, cost: 0, users: new Set<string>(), last: null }
    cur.tokens += e.totalTokens
    cur.cost += e.estimatedCost
    if (e.userId) cur.users.add(e.userId)
    if (!cur.last || e.eventAt > cur.last) cur.last = e.eventAt
    map.set(e.projectId, cur)
  }
  const taskByProject = new Map<string, number>()
  for (const t of getTasks()) {
    taskByProject.set(t.projectId, (taskByProject.get(t.projectId) ?? 0) + 1)
  }
  const rows = getProjects().map((p) => {
    const agg = map.get(p.id)
    return {
      project: p,
      totalTokens: agg?.tokens ?? 0,
      estimatedCost: Math.round((agg?.cost ?? 0) * 1000) / 1000,
      userCount: agg?.users.size ?? 0,
      taskCount: taskByProject.get(p.id) ?? 0,
      lastActivity: agg?.last ?? null,
    }
  })
  return hasActiveFilters(filters) ? rows.filter((r) => r.totalTokens > 0) : rows
}

export function getUserRows(filters: UsageFilters = {}): UserRow[] {
  const events = applyFilters(getUsageEvents(), filters)
  const map = new Map<
    string,
    {
      tokens: number
      cost: number
      tasks: Set<string>
      events: number
      last: string | null
      models: Map<string, number>
    }
  >()
  for (const e of events) {
    if (!e.userId) continue
    const cur =
      map.get(e.userId) ??
      {
        tokens: 0,
        cost: 0,
        tasks: new Set<string>(),
        events: 0,
        last: null,
        models: new Map<string, number>(),
      }
    cur.tokens += e.totalTokens
    cur.cost += e.estimatedCost
    if (e.taskId) cur.tasks.add(e.taskId)
    cur.events += 1
    cur.models.set(e.modelId, (cur.models.get(e.modelId) ?? 0) + e.totalTokens)
    if (!cur.last || e.eventAt > cur.last) cur.last = e.eventAt
    map.set(e.userId, cur)
  }
  const rows = getUsers().map((u) => {
    const agg = map.get(u.id)
    let topModelId: string | undefined
    if (agg) {
      let max = -1
      for (const [id, t] of agg.models) {
        if (t > max) {
          max = t
          topModelId = id
        }
      }
    }
    return {
      user: u,
      totalTokens: agg?.tokens ?? 0,
      estimatedCost: Math.round((agg?.cost ?? 0) * 1000) / 1000,
      taskCount: agg?.tasks.size ?? 0,
      eventCount: agg?.events ?? 0,
      lastActivity: agg?.last ?? null,
      topModelId,
    }
  })
  return hasActiveFilters(filters) ? rows.filter((r) => r.totalTokens > 0) : rows
}

export function getTaskRows(filters: UsageFilters = {}): TaskRow[] {
  const events = applyFilters(getUsageEvents(), filters)
  const map = new Map<
    string,
    { tokens: number; cost: number; events: number; last: string | null; modelId: string }
  >()
  for (const e of events) {
    if (!e.taskId) continue
    const cur =
      map.get(e.taskId) ??
      { tokens: 0, cost: 0, events: 0, last: null, modelId: e.modelId }
    cur.tokens += e.totalTokens
    cur.cost += e.estimatedCost
    cur.events += 1
    cur.modelId = e.modelId
    if (!cur.last || e.eventAt > cur.last) cur.last = e.eventAt
    map.set(e.taskId, cur)
  }
  const projectById = new Map(getProjects().map((p) => [p.id, p]))
  const userById = new Map(getUsers().map((u) => [u.id, u]))
  const rows: TaskRow[] = []
  for (const t of getTasks()) {
    const agg = map.get(t.id)
    if (hasActiveFilters(filters) && !agg) continue
    rows.push({
      task: t,
      project: projectById.get(t.projectId)!,
      user: t.userId ? userById.get(t.userId) : undefined,
      modelId: agg?.modelId ?? getModels()[0].id,
      totalTokens: agg?.tokens ?? 0,
      estimatedCost: Math.round((agg?.cost ?? 0) * 1000) / 1000,
      events: agg?.events ?? 0,
      lastActivity: agg?.last ?? null,
    })
  }
  return rows
}

export function getModelRows(filters: UsageFilters = {}): ModelRow[] {
  const events = applyFilters(getUsageEvents(), filters)
  const map = new Map<
    string,
    {
      tokens: number
      cost: number
      input: number
      output: number
      cached: number
      events: number
    }
  >()
  for (const e of events) {
    const cur =
      map.get(e.modelId) ??
      { tokens: 0, cost: 0, input: 0, output: 0, cached: 0, events: 0 }
    cur.tokens += e.totalTokens
    cur.cost += e.estimatedCost
    cur.input += e.inputTokens
    cur.output += e.outputTokens
    cur.cached += e.cachedInputTokens
    cur.events += 1
    map.set(e.modelId, cur)
  }
  const rows = getModels().map((m) => {
    const agg = map.get(m.id)
    return {
      model: m,
      totalTokens: agg?.tokens ?? 0,
      estimatedCost: Math.round((agg?.cost ?? 0) * 1000) / 1000,
      inputTokens: agg?.input ?? 0,
      outputTokens: agg?.output ?? 0,
      cachedInputTokens: agg?.cached ?? 0,
      events: agg?.events ?? 0,
    }
  })
  return hasActiveFilters(filters) ? rows.filter((r) => r.totalTokens > 0) : rows
}

// ---- Detail helpers ------------------------------------------------------

export function getProjectDetail(projectId: string, ds?: DataSource) {
  const project = srcProjects(ds).find((p) => p.id === projectId)
  if (!project) return undefined
  const filters: UsageFilters = { projectId }
  const projectTasks = srcTasks(ds).filter((t) => t.projectId === projectId)
  return {
    project,
    summary: getUsageSummary(filters, ds),
    daily: getDailyUsage(filters, 30, ds),
    hourly: getHourlyUsage(filters, ds),
    byModel: getTopModels(filters, undefined, ds),
    byUser: getTopUsers(filters, undefined, ds),
    taskStats: {
      total: projectTasks.length,
      completed: projectTasks.filter((t) => t.status === "completed").length,
      active: projectTasks.filter((t) => t.status === "active").length,
    },
  }
}

export function getUserDetail(userId: string) {
  const user = getUsers().find((u) => u.id === userId)
  if (!user) return undefined
  const filters: UsageFilters = { userId }
  return {
    user,
    summary: getUsageSummary(filters),
    daily: getDailyUsage(filters),
    hourly: getHourlyUsage(filters),
    byModel: getTopModels(filters),
    byProject: getTopProjects(filters),
  }
}

export function getTaskDetail(taskId: string) {
  const task = getTasks().find((t) => t.id === taskId)
  if (!task) return undefined
  const project = getProjects().find((p) => p.id === task.projectId)
  const user = task.userId ? getUsers().find((u) => u.id === task.userId) : undefined
  const filters: UsageFilters = { taskId }
  const events = applyFilters(getUsageEvents(), filters).sort((a, b) =>
    a.eventAt < b.eventAt ? 1 : -1,
  )
  return {
    task,
    project,
    user,
    summary: getUsageSummary(filters),
    daily: getDailyUsage(filters),
    hourly: getHourlyUsage(filters),
    byModel: getTopModels(filters),
    events,
  }
}

export { todayISO }

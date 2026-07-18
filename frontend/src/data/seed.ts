// Deterministic seed data generator.
//
// In a production build this module would be replaced by a SQLite-backed
// loader (see db.ts). Everything here is generated from a fixed seed so the
// dashboard renders identical data on every reload, which keeps the demo
// stable and the aggregations testable.

import type {
  Model,
  Project,
  Task,
  UsageEvent,
  User,
} from "./usage-types"

function mulberry32(seed: number) {
  let a = seed
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rand = mulberry32(20240718)

function pick<T>(items: T[]): T {
  return items[Math.floor(rand() * items.length)]
}

function between(min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min
}

function isoDaysAgo(days: number): string {
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

function isoDateDaysAgo(days: number): string {
  return isoDaysAgo(days).slice(0, 10)
}

export const models: Model[] = [
  {
    id: "m-opus",
    provider: "Anthropic",
    name: "claude-opus-4",
    displayName: "Claude Opus 4",
    inputCostPer1m: 15,
    outputCostPer1m: 75,
    cachedInputCostPer1m: 1.5,
  },
  {
    id: "m-sonnet",
    provider: "Anthropic",
    name: "claude-sonnet-4",
    displayName: "Claude Sonnet 4",
    inputCostPer1m: 3,
    outputCostPer1m: 15,
    cachedInputCostPer1m: 0.3,
  },
  {
    id: "m-haiku",
    provider: "Anthropic",
    name: "claude-haiku-4",
    displayName: "Claude Haiku 4",
    inputCostPer1m: 0.8,
    outputCostPer1m: 4,
    cachedInputCostPer1m: 0.08,
  },
  {
    id: "m-gpt4o",
    provider: "OpenAI",
    name: "gpt-4o",
    displayName: "GPT-4o",
    inputCostPer1m: 2.5,
    outputCostPer1m: 10,
    cachedInputCostPer1m: 1.25,
  },
  {
    id: "m-gpt4omini",
    provider: "OpenAI",
    name: "gpt-4o-mini",
    displayName: "GPT-4o mini",
    inputCostPer1m: 0.15,
    outputCostPer1m: 0.6,
    cachedInputCostPer1m: 0.075,
  },
  {
    id: "m-gemini",
    provider: "Google",
    name: "gemini-1.5-pro",
    displayName: "Gemini 1.5 Pro",
    inputCostPer1m: 1.25,
    outputCostPer1m: 5,
    cachedInputCostPer1m: 0.31,
  },
  {
    id: "m-llama",
    provider: "Meta",
    name: "llama-3.1-70b",
    displayName: "Llama 3.1 70B",
    inputCostPer1m: 0.9,
    outputCostPer1m: 0.9,
    cachedInputCostPer1m: 0.18,
  },
].map((m) => ({
  ...m,
  createdAt: isoDaysAgo(200),
  updatedAt: isoDaysAgo(30),
}))

const projectSeeds: Array<{ name: string; description: string; color: string }> = [
  { name: "Atlas Web", description: "Customer-facing web platform", color: "#3b82f6" },
  { name: "Nova Mobile", description: "iOS and Android apps", color: "#10b981" },
  { name: "Orion API", description: "Public REST + streaming API", color: "#8b5cf6" },
  { name: "Pulse Analytics", description: "Usage & billing analytics", color: "#f43f5e" },
  { name: "Helix Docs", description: "Developer documentation site", color: "#f59e0b" },
  { name: "Quasar Infra", description: "Internal tooling & infra", color: "#64748b" },
]

export const projects: Project[] = projectSeeds.map((p, i) => {
  const created = isoDaysAgo(180 - i * 5)
  return {
    id: `p-${i + 1}`,
    name: p.name,
    description: p.description,
    color: p.color,
    createdAt: created,
    updatedAt: isoDaysAgo(between(0, 10)),
  }
})

const firstNames = [
  "Ava", "Liam", "Mia", "Noah", "Zoe", "Ethan", "Lena", "Kai", "Ivy", "Omar",
]
const lastNames = [
  "Reyes", "Patel", "Kim", "Novak", "Costa", "Haas", "Okoro", "Singh", "Marsh", "Webb",
]
const roles = ["Engineer", "Researcher", "Designer", "PM", "Data", "Support"]

export const users: User[] = firstNames.map((fn, i) => {
  const name = `${fn} ${lastNames[i]}`
  const handle = name.toLowerCase().replace(/[^a-z]/g, ".")
  return {
    id: `u-${i + 1}`,
    name,
    email: `${handle}@acme.dev`,
    avatarUrl: `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(name)}`,
    role: pick(roles),
    createdAt: isoDaysAgo(between(120, 200)),
    updatedAt: isoDaysAgo(between(0, 20)),
  }
})

const taskTitles = [
  "Refactor auth flow",
  "Build dashboard widgets",
  "Fix token counting bug",
  "Add streaming responses",
  "Migrate to new router",
  "Write integration tests",
  "Optimize prompt cache",
  "Design empty states",
  "Investigate rate limits",
  "Improve error messages",
  "Add CSV export",
  "Profile slow queries",
  "Ship dark mode",
  "Triage support tickets",
  "Draft API spec",
]

const tagPool = ["backend", "frontend", "infra", "research", "urgent", "experiment"]

export const tasks: Task[] = Array.from({ length: 52 }).map((_, i) => {
  const project = pick(projects)
  const statusRoll = rand()
  const status: Task["status"] =
    statusRoll > 0.55
      ? "completed"
      : statusRoll > 0.35
        ? "active"
        : statusRoll > 0.2
          ? "paused"
          : "archived"
  const started = between(5, 110)
  const tags = Array.from(new Set([pick(tagPool), pick(tagPool)])).filter(
    (t, idx, arr) => arr.indexOf(t) === idx,
  )
  return {
    id: `t-${i + 1}`,
    projectId: project.id,
    userId: rand() > 0.15 ? pick(users).id : undefined,
    title: pick(taskTitles),
    status,
    tags,
    startedAt: isoDaysAgo(started),
    completedAt:
      status === "completed" ? isoDaysAgo(between(0, started)) : undefined,
    createdAt: isoDaysAgo(started),
    updatedAt: isoDaysAgo(between(0, 5)),
  }
})

function costFor(model: Model, input: number, output: number, cached: number): number {
  return (
    (input * model.inputCostPer1m +
      output * model.outputCostPer1m +
      cached * model.cachedInputCostPer1m) /
    1_000_000
  )
}

export const usageEvents: UsageEvent[] = Array.from({ length: 2600 }).map(
  (_, i) => {
    const task = pick(tasks)
    const project = projects.find((p) => p.id === task.projectId)!
    const model = pick(models)
    const daysAgo = between(0, 120)
    const hour = between(7, 22)
    const d = new Date()
    d.setDate(d.getDate() - daysAgo)
    d.setHours(hour, between(0, 59), between(0, 59), 0)
    const eventAt = d.toISOString()

    const inputTokens = between(400, 9000)
    const outputTokens = between(150, 4500)
    const cachedInputTokens =
      rand() > 0.4 ? between(0, Math.floor(inputTokens * 0.7)) : 0
    const totalTokens = inputTokens + outputTokens + cachedInputTokens
    const cost = costFor(model, inputTokens, outputTokens, cachedInputTokens)

    return {
      id: `e-${i + 1}`,
      projectId: project.id,
      userId: task.userId ?? (rand() > 0.3 ? pick(users).id : undefined),
      taskId: task.id,
      modelId: model.id,
      inputTokens,
      outputTokens,
      cachedInputTokens,
      totalTokens,
      estimatedCost: Math.round(cost * 1000) / 1000,
      eventAt,
      createdAt: eventAt,
    }
  },
)

export const seedDateRange = {
  from: isoDateDaysAgo(120),
  to: isoDateDaysAgo(0),
}

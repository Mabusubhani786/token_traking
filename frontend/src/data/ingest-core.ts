// Server- and browser-safe ingestion core.
//
// Contains only pure logic (no Node `fs`/`os` and no browser-only APIs) so it
// can be imported by both the Vite dev-server middleware AND the client. The
// real token usage comes from AI session logs (`*.jsonl`); every
// assistant message carries `message.usage` (input/output/cache tokens), a
// `model`, and a top-level `cwd` + `sessionId`. No fabricated data anywhere.

import type {
  Model,
  Project,
  Task,
  UsageEvent,
  User,
} from "./usage-types"

export type IngestedDataset = {
  projects: Project[]
  users: User[]
  models: Model[]
  tasks: Task[]
  usageEvents: UsageEvent[]
}

// ---- Known per-1M token rates (honest: free/unknown models default to 0) --

export const KNOWN_RATES: Record<
  string,
  { provider: string; input: number; output: number; cached: number }
> = {
  "gpt-": { provider: "OpenAI", input: 2.5, output: 10, cached: 1.25 },
  gemini: { provider: "Google", input: 1.25, output: 5, cached: 0.31 },
  llama: { provider: "Meta", input: 0.9, output: 0.9, cached: 0.18 },
  deepseek: { provider: "DeepSeek", input: 0.55, output: 2.19, cached: 0.14 },
  "tencent/": { provider: "Tencent", input: 0, output: 0, cached: 0 },
}

export function guessProvider(model: string): {
  provider: string
  input: number
  output: number
  cached: number
} {
  const m = model.toLowerCase()
  for (const key of Object.keys(KNOWN_RATES)) {
    if (m.startsWith(key) || m.includes(key.replace("/", ""))) {
      return KNOWN_RATES[key]
    }
  }
  return { provider: "Unknown", input: 0, output: 0, cached: 0 }
}

export function costFor(
  model: Model,
  input: number,
  output: number,
  cached: number,
): number {
  return (
    (input * model.inputCostPer1m +
      output * model.outputCostPer1m +
      cached * model.cachedInputCostPer1m) /
    1_000_000
  )
}

// ---- Small helpers --------------------------------------------------------

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")

function nowISO(): string {
  return new Date().toISOString()
}

// Pull plain text out of a session message `content` (string or array of
// content blocks) so a chat message can get a readable task title.
function extractText(content: unknown): string | undefined {
  if (typeof content === "string") return content.trim() || undefined
  if (Array.isArray(content)) {
    const parts = content
      .filter(
        (b): b is { type: string; text: string } =>
          !!b &&
          typeof b === "object" &&
          (b as { type?: unknown }).type === "text" &&
          typeof (b as { text?: unknown }).text === "string",
      )
      .map((b) => b.text)
    const joined = parts.join(" ").trim()
    return joined.length ? joined : undefined
  }
  return undefined
}

// Each project is scoped by its working directory, so we group by the
// real `cwd` (an absolute path). The project name is the leaf folder; the full
// path is kept in the description for context. If `cwd` is somehow absent we
// fall back to the encoded project-folder name from the log path.
export function decodeProjectPath(folderName: string): string {
  return folderName
}

function projectFromPath(cwd: string | undefined, fallback: string): Project {
  const path = cwd || fallback
  const id = slug(path) || "p-unknown"
  const name = path.split("/").filter(Boolean).at(-1) || path || fallback
  return {
    id,
    name,
    description: path,
    color: "#3b82f6",
    createdAt: nowISO(),
    updatedAt: nowISO(),
  }
}

function modelFromName(model: string): Model {
  const id = slug(model) || "m-unknown"
  const rate = guessProvider(model)
  return {
    id,
    provider: rate.provider,
    name: model,
    displayName: model,
    inputCostPer1m: rate.input,
    outputCostPer1m: rate.output,
    cachedInputCostPer1m: rate.cached,
    createdAt: nowISO(),
    updatedAt: nowISO(),
  }
}

// ---- Parsing --------------------------------------------------------------

type ParsedSession = {
  projectId: string
  cwd?: string
  sessionId?: string
  firstUserText?: string
  events: (UsageEvent & {
    text?: string
    userText?: string
    startAt?: string
  })[]
}

// Parse raw `.jsonl` text from a single session file into usage events.
function parseSession(text: string): ParsedSession {
  const lines = text.split("\n").filter(Boolean)
  let cwd: string | undefined
  let sessionId: string | undefined
  let firstUserText: string | undefined
  // Most recent user prompt seen so far; attached to the following assistant
  // turn so each message task records "what the user gave".
  let lastUserText: string | undefined
  const events: (UsageEvent & {
    text?: string
    userText?: string
    startAt?: string
  })[] = []
  // Timestamp of the previous log line, used as a message's start time so we
  // can show how long each message (turn) took: start = prior activity,
  // end = this message's own timestamp.
  let prevTs: string | undefined

  for (const line of lines) {
    let obj: Record<string, unknown>
    try {
      obj = JSON.parse(line) as Record<string, unknown>
    } catch {
      continue
    }

    const msg = (obj.message ?? null) as Record<string, unknown> | null
    const msgCwd = msg?.cwd
    const usage = msg?.usage as Record<string, unknown> | undefined
    const lineTs = typeof obj.timestamp === "string" ? obj.timestamp : undefined

    // `cwd` lives at the top level on assistant records (verified) and also
    // on `message` for some entries — prefer whichever is present.
    if (!cwd && typeof obj.cwd === "string") cwd = obj.cwd
    if (!cwd && typeof msgCwd === "string") cwd = msgCwd
    if (!sessionId && typeof obj.sessionId === "string") {
      sessionId = obj.sessionId
    }
    const content = msg?.content
    if (obj.type === "user") {
      // Keep the first user message as the session title (truncated).
      if (!firstUserText && typeof content === "string") {
        firstUserText = content.slice(0, 90)
      }
      // Track the latest user prompt to attach to the next assistant turn.
      const ut = extractText(content)
      if (ut) lastUserText = ut
    }

    if (obj.type === "assistant" && msg && usage) {
      const modelStr: string = (msg.model as string) || "unknown"
      const input = Number(usage.input_tokens) || 0
      const output = Number(usage.output_tokens) || 0
      const cached =
        (Number(usage.cache_read_input_tokens) || 0) +
        (Number(usage.cache_creation_input_tokens) || 0)
      const ts = lineTs || nowISO()
      events.push({
        id: `e-${events.length}-${sessionId ?? "x"}`,
        projectId: "",
        userId: "u-you",
        taskId: "",
        modelId: slug(modelStr) || "m-unknown",
        inputTokens: input,
        outputTokens: output,
        cachedInputTokens: cached,
        totalTokens: input + output + cached,
        estimatedCost: 0, // filled in after models are known
        eventAt: ts,
        createdAt: ts,
        text: extractText(msg.content),
        userText: lastUserText,
        startAt: prevTs ?? ts,
      })
    }

    if (lineTs) prevTs = lineTs
  }

  return { projectId: "", cwd, sessionId, firstUserText, events }
}

// Parse many raw files (each from a session) into lightweight sessions.
export function parseTokenTrakingLogs(
  files: { name: string; text: string }[],
): ParsedSession[] {
  return files.map((f) => parseSession(f.text))
}

// ---- Assembly -------------------------------------------------------------

// Turn parsed sessions into a full, costed dataset. Pure + deterministic so
// the server middleware and the browser importer produce identical results.
export function buildDataset(sessions: ParsedSession[], userName?: string): IngestedDataset {
  const projects = new Map<string, Project>()
  const models = new Map<string, Model>()
  const tasks = new Map<string, Task>()
  const users = new Map<string, User>()
  const events: UsageEvent[] = []

  const name = userName || "You"
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

  const you: User = {
    id: "u-you",
    name,
    email: "",
    avatarUrl: `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(initials)}`,
    role: "User",
    createdAt: nowISO(),
    updatedAt: nowISO(),
  }
  users.set(you.id, you)

  let evCounter = 0

  for (const session of sessions) {
    if (session.events.length === 0) continue

    const project = projectFromPath(
      decodeProjectPath(session.cwd ?? "unknown"),
      "unknown",
    )
    if (!projects.has(project.id)) projects.set(project.id, project)

    const taskId =
      `t-${session.sessionId || slug(session.cwd ?? "") || evCounter}`
    if (!tasks.has(taskId)) {
      tasks.set(taskId, {
        id: taskId,
        projectId: project.id,
        userId: you.id,
        title: session.firstUserText || session.sessionId || "Session",
        status: "completed",
        tags: [],
        startedAt: session.events[0].eventAt,
        completedAt: session.events[session.events.length - 1].eventAt,
        createdAt: session.events[0].eventAt,
        updatedAt: session.events[session.events.length - 1].eventAt,
        userText: session.firstUserText,
      })
    }

    for (const ev of session.events) {
      const modelId = ev.modelId
      let model = models.get(modelId)
      if (!model) {
        model = modelFromName(modelId.replace(/^m-/, "") || "unknown")
        models.set(model.id, model)
      }
      ev.id = `e-${evCounter++}`
      ev.projectId = project.id
      ev.taskId = taskId
      ev.modelId = model.id
      ev.estimatedCost =
        Math.round(
          costFor(model, ev.inputTokens, ev.outputTokens, ev.cachedInputTokens) *
            1000,
        ) / 1000

      // Each chat message also becomes its own Task, linked to the session.
      const msgTaskId = `mt-${ev.id}`
      ev.messageTaskId = msgTaskId
      const msgTask: Task = {
        id: msgTaskId,
        projectId: project.id,
        userId: you.id,
        title: ev.text ? ev.text.slice(0, 60) : `Message · ${model.displayName}`,
        status: "completed",
        tags: [],
        startedAt: ev.startAt ?? ev.eventAt,
        completedAt: ev.eventAt,
        createdAt: ev.eventAt,
        updatedAt: ev.eventAt,
        parentTaskId: taskId,
        userText: ev.userText,
      }
      if (!tasks.has(msgTaskId)) tasks.set(msgTaskId, msgTask)

      events.push(ev)
    }
  }

  return {
    projects: Array.from(projects.values()),
    users: Array.from(users.values()),
    models: Array.from(models.values()),
    tasks: Array.from(tasks.values()),
    usageEvents: events,
  }
}

// ---- Dataset filtering (server + browser safe) ---------------------------

// Subset of `UsageFilters` that the API supports for server-side slicing.
// Kept free of date ranges so it only scopes whole entities, never series.
export type DatasetFilters = {
  projectId?: string
  userId?: string
  modelId?: string
  taskId?: string
}

// Return a new dataset containing only the usage events that match the given
// filters, with the projects/users/models/tasks pruned to whatever those
// events reference. Pure + deterministic so the web middleware, the Electron
// server, and any client-side reuse behave identically.
export function filterDataset(
  ds: IngestedDataset,
  f: DatasetFilters,
): IngestedDataset {
  let events = ds.usageEvents
  if (f.projectId) events = events.filter((e) => e.projectId === f.projectId)
  if (f.userId) events = events.filter((e) => e.userId === f.userId)
  if (f.modelId) events = events.filter((e) => e.modelId === f.modelId)
  if (f.taskId) events = events.filter((e) => e.taskId === f.taskId)

  const projectIds = new Set(events.map((e) => e.projectId))
  const userIds = new Set(
    events.map((e) => e.userId).filter(Boolean) as string[],
  )
  const modelIds = new Set(events.map((e) => e.modelId))
  const taskIds = new Set(events.map((e) => e.taskId).filter(Boolean) as string[])

  return {
    projects: ds.projects.filter((p) => projectIds.has(p.id)),
    users: ds.users.filter((u) => userIds.has(u.id)),
    models: ds.models.filter((m) => modelIds.has(m.id)),
    tasks: ds.tasks.filter((t) => taskIds.has(t.id)),
    usageEvents: events,
  }
}

// ---- Analytics helper (UI reuse) -----------------------------------------

export type ModelGroup = {
  provider: string
  models: {
    id: string
    name: string
    displayName: string
    totalTokens: number
    estimatedCost: number
    inputTokens: number
    outputTokens: number
    cachedInputTokens: number
    events: number
  }[]
  totalTokens: number
  estimatedCost: number
  inputTokens: number
  outputTokens: number
  cachedInputTokens: number
}

// Group model rows by provider, sorted by tokens desc within each group and
// by provider total tokens desc across groups. Used by the Models screen.
export function groupModelsByProvider(
  rows: {
    model: Model
    totalTokens: number
    estimatedCost: number
    inputTokens: number
    outputTokens: number
    cachedInputTokens: number
    events: number
  }[],
): ModelGroup[] {
  const byProvider = new Map<string, ModelGroup>()
  for (const r of rows) {
    const provider = r.model.provider
    let group = byProvider.get(provider)
    if (!group) {
      group = {
        provider,
        models: [],
        totalTokens: 0,
        estimatedCost: 0,
        inputTokens: 0,
        outputTokens: 0,
        cachedInputTokens: 0,
      }
      byProvider.set(provider, group)
    }
    group.models.push({
      id: r.model.id,
      name: r.model.name,
      displayName: r.model.displayName,
      totalTokens: r.totalTokens,
      estimatedCost: r.estimatedCost,
      inputTokens: r.inputTokens,
      outputTokens: r.outputTokens,
      cachedInputTokens: r.cachedInputTokens,
      events: r.events,
    })
    group.totalTokens += r.totalTokens
    group.estimatedCost += r.estimatedCost
    group.inputTokens += r.inputTokens
    group.outputTokens += r.outputTokens
    group.cachedInputTokens += r.cachedInputTokens
  }

  const groups = Array.from(byProvider.values())
  for (const g of groups) {
    g.estimatedCost = Math.round(g.estimatedCost * 1000) / 1000
    g.models.sort((a, b) => b.totalTokens - a.totalTokens)
  }
  groups.sort((a, b) => b.totalTokens - a.totalTokens)
  return groups
}

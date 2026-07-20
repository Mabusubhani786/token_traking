# End-to-End (E2E) Data Flow — Token Traking

This document describes the **complete data pipeline** of the Token Traking app:
where token usage data comes from, how it is ingested, the API/bridge contract,
how it is stored and persisted, the query layer, and the UI that renders it.

The app is **local-first**: there is no backend server and no fabricated data.
All figures are compiled from real AI session logs on your machine.

---

## 1. Data Source

| Item | Value |
| --- | --- |
| Source | Real AI session log files (`*.jsonl`) |
| Location (desktop / dev) | `~/.token-traking-logs/**/*.jsonl` |
| Format per line | One JSON session message with `message.usage` (input/output/cache tokens), a `model`, and a top-level `cwd` + `sessionId` |
| Alternative | Any folder containing `.jsonl` files can be loaded manually via Settings → "Load token-traking data folder" (Chromium browsers only, File System Access API) |

Each log line is a chat message. The assistant messages carry the token
usage we care about; the `cwd` (working directory) scopes the message to a
**project**, and `sessionId` groups messages into a **task** (session).

---

## 2. Ingestion Pipeline

```
~/.token-traking-logs/**/*.jsonl
        │
        ▼
readTokenTrakingLogs()              ← node-safe reader  (src/data/token-traking-logs.ts)
        │  collects *.jsonl, resolves system display name
        ▼
parseTokenTrakingLogs(files)        ← pure parser       (src/data/ingest-core.ts)
        │  one ParsedSession per file
        ▼
buildDataset(sessions, userName)    ← aggregator        (src/data/ingest-core.ts)
        │  produces IngestedDataset { projects, users, models, tasks, usageEvents }
        ▼
loadDataset(...)                    ← store writer      (src/data/db.ts)
```

### Key modules

| File | Responsibility |
| --- | --- |
| `src/data/token-traking-logs.ts` | Node-only reader (uses `fs`, `os`, `path`, `execSync`). Single source of truth for the desktop main process **and** the Vite dev middleware. |
| `src/data/ingest-core.ts` | Pure parsing + aggregation. No Node or browser APIs, so it is importable by both server and client. Exports `parseTokenTrakingLogs`, `buildDataset`, `filterDataset`, `guessProvider`, `costFor`, `KNOWN_RATES`. |
| `src/data/ingest.ts` | Thin wrapper `ingestFiles(files)` used by the manual "Load folder" path. |

### Cost model

`ingest-core.ts` estimates cost from per-1M-token rates. The recognizable
prefixes (in `KNOWN_RATES`) map a model string to a provider + rate:

| Prefix | Provider | Input /1M | Output /1M | Cached /1M |
| --- | --- | --- | --- | --- |
| `gpt-` | OpenAI | 2.50 | 10.00 | 1.25 |
| `gemini` | Google | 1.25 | 5.00 | 0.31 |
| `llama` | Meta | 0.90 | 0.90 | 0.18 |
| `deepseek` | DeepSeek | 0.55 | 2.19 | 0.14 |
| `tencent/` | Tencent | 0 | 0 | 0 |

Any model that does not match a known prefix is treated as **Unknown** with
zero cost (`guessProvider`). `costFor(model, input, output, cached)` multiplies
token counts by the matched rate.

### `IngestedDataset` shape

```ts
type IngestedDataset = {
  projects: Project[]
  users: User[]
  models: Model[]
  tasks: Task[]
  usageEvents: UsageEvent[]
}
```

---

## 3. API / Bridge Contract

The compiled dataset is served two ways, depending on runtime:

### Web (Vite dev / preview)

A Vite middleware plugin (`token-traking-logs-api`, registered in
`vite.config.ts`) intercepts:

```
GET /api/token-traking-logs
GET /api/token-traking-logs?projectId=<id>&userId=<id>&modelId=<id>&taskId=<id>
```

- Handler: `tokenTrakingLogsHandler` → `readTokenTrakingLogs()` →
  optional `filterDataset()` when query params are present.
- Response: `application/json`, `Cache-Control: no-store`, the full
  `IngestedDataset` (or a filtered slice).

### Desktop (Electron)

- `electron/main.ts` exposes `handleTokenTrakingLogs(url?)` and serves the same
  `/api/token-traking-logs` route from its tiny static server.
- IPC channel `"token-traking-logs"` → `getTokenTrakingLogs()` on the preload
  bridge (`electron/preload.ts`), typed in `src/electron.d.ts`.

### Browser client

`src/data/api.ts` wraps `fetch` with typed helpers:

- `fetchTokenTrakingLogs(filters)` → `GET /api/token-traking-logs?<qs>`
- `fetchProjectDataset(projectId)` → convenience for `?projectId=`

---

## 4. Store & Auto-Load

`src/data/auto-load.ts` boots the app with real data:

1. `loadSystemDataIfEmpty()` hydrates from SQLite persistence first.
2. If empty (or no message tasks), `loadSystemData()` runs:
   - **Desktop:** calls `window.electronAPI.getTokenTrakingLogs()` (IPC).
   - **Web:** `fetch("/api/token-traking-logs")`.
3. The returned `IngestedDataset` is written into the in-memory store via
   `loadDataset(...)`.

`resolveSystemUserName()` resolves the current OS user's display name (desktop
IPC first, then extracted from the dataset's `u-you` user) so the "You" user
stays current without re-ingesting.

### In-memory store (`src/data/db.ts`)

Single read point for the UI (`useDataStore`, `getProjects`, `getUsers`,
`getModels`, `getTasks`, `getUsageEvents`, `getDatasetRange`, `isEmpty`,
`hasMessageTasks`, `updateModel`, `updateUser`, `loadDataset`). Starts empty;
never touches storage directly.

---

## 5. Persistence

`src/data/persist.ts` provides durable, local-first storage:

- In-browser **SQLite** via `sql.js` (WASM). DB bytes are persisted to
  **IndexedDB** (`token-traking` DB → `sqlite` store → key `db`).
- `hydrateFromPersistence()` reloads the store on startup so a refresh needs
  no re-ingestion.
- `clearPersisted()` wipes it (Settings → "Delete all locally stored data").

The SQLite schema mirrors the domain types in `usage-types.ts`
(`projects`, `users`, `models`, `tasks`, `usage_events` with reporting
indexes).

---

## 6. Domain Types (`src/data/usage-types.ts`)

| Entity | Key fields |
| --- | --- |
| `Project` | `id, name, description, color, createdAt, updatedAt` |
| `User` | `id, name, email, avatarUrl, role, createdAt, updatedAt` |
| `Model` | `id, provider, name, displayName, inputCostPer1m, outputCostPer1m, cachedInputCostPer1m, ...` |
| `Task` | `id, projectId, userId?, title, status, tags[], startedAt?, completedAt?, parentTaskId?, userText?` |
| `UsageEvent` | `id, projectId, userId?, taskId?, modelId, inputTokens, outputTokens, cachedInputTokens, totalTokens, estimatedCost, eventAt, messageTaskId?` |
| `TaskStatus` | `"active" \| "completed" \| "paused" \| "archived"` |

Derived/aggregate types: `UsageSummary`, `DailyPoint`, `HourlyPoint`,
`HeatmapCell`, `NamedTotal`, plus `*Row` types for table views.

---

## 7. Query Layer (`src/data/usage-queries.ts`)

Pure, memoization-friendly functions over the in-memory store (never touches
storage). All accept an optional `UsageFilters`
(`projectId, userId, modelId, taskId, from, to`).

| Function | Purpose |
| --- | --- |
| `getUsageSummary` | Top-level totals: tokens, cost, active projects/users, task/event counts, most-used model |
| `getDailyUsage` | Daily token/cost trend |
| `getHourlyUsage` | Per-hour totals + event counts |
| `getHeatmap` | Day × hour grid of token volume |
| `getTopModels` / `getTopUsers` / `getTopProjects` / `getTopTasks` | Ranked breakdowns (`NamedTotal`) |
| `getProjectRows` / `getUserRows` / `getTaskRows` / `getModelRows` | Table rows with joined names + totals |
| `getProjectDetail` / `getUserDetail` / `getTaskDetail` | Detail views (per-day/hour splits, model & contributor breakdowns) |

---

## 8. UI Surface (TanStack Router)

Routes under `src/routes/__mainLayout/`:

| Route | Screen | Data shown |
| --- | --- | --- |
| `index.tsx` | **Overview** | Summary cards, daily trend, hourly heatmap, top users/tasks/models |
| `projects.tsx` + `projects.$projectId.tsx` | **Projects** | Project table; per-project day/hour/model/user splits |
| `users.tsx` + `users.$userId.tsx` | **Users** | User list; per-user day/hour/model/task/project splits |
| `tasks.tsx` + `tasks.$taskId.tsx` | **Tasks** | Task list + filters; event timeline per task |
| `models.tsx` | **Models** | Models by provider, input vs output vs cached, cost trend |
| `settings.tsx` | **Settings** | Theme, density, currency, model cost rates, data import/export, refresh-from-system, load folder |

The shell (sidebar + top bar) lives in `__mainLayout.tsx`; `components/dashboard.tsx`
holds shared presentational pieces.

---

## 9. Full Round-Trip (one line)

```
~/.token-traking-logs/*.jsonl
  → readTokenTrakingLogs()        [token-traking-logs.ts]
  → parseTokenTrakingLogs()/buildDataset()   [ingest-core.ts]
  → GET /api/token-traking-logs   [vite.config.ts / electron main.ts]
  → loadSystemData()              [auto-load.ts]
  → loadDataset()                 [db.ts]
  → hydrateFromPersistence()      [persist.ts, on refresh]
  → get*()/getUsageSummary()/get*Rows()   [usage-queries.ts]
  → routes/*                      [UI]
```

---

## 10. Manual / Alternative Data Paths

- **Load a folder:** Settings → "Load token-traking data folder" →
  `ingestFiles()` (uses the File System Access API in Chromium browsers).
- **Export / Import JSON:** Settings → "Export JSON" / "Import JSON" round-trips
  the `IngestedDataset` through `loadDataset()`.
- **Refresh from system:** Settings → "Refresh from system" re-runs
  `loadSystemData()` against the active data source.

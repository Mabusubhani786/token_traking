# Token Traking

> A local-first dashboard for tracking AI model token usage — across tasks,
> users, projects, and models. See where tokens (and cost) are being spent,
> which models are most expensive, and how usage changes over time.

Token Traking runs entirely on your machine. There is **no backend server**
and **no fabricated data** — every number is compiled from your real AI
session logs (`*.jsonl`).

---

## Features

- **Overview dashboard** — total/input/output/cached tokens, estimated cost,
  active projects & users, task count, most-used model, daily trend, hourly
  heatmap, and top users / tasks / models.
- **Projects** — per-project usage table with day/hour splits and model/user
  breakdowns.
- **Users** — per-user analytics: usage by day/hour, model preference, task and
  project contribution.
- **Tasks** — task-level tracking with filters (status, project, user, model,
  date range, tags) and a per-task event timeline.
- **Models** — usage and cost grouped by provider, with input vs. output vs.
  cached split and a cost trend.
- **Settings** — theme (light/dark/system), accent color, density, currency,
  editable model cost rates, and data import/export.
- **Local-first persistence** — in-browser SQLite (sql.js/WASM) backed by
  IndexedDB, so a refresh needs no re-ingestion.
- **Desktop app** — packaged with Electron; reads session logs directly from the
  local filesystem.

---

## Tech Stack

| Layer         | Technology                          |
| ------------- | ----------------------------------- |
| UI            | React 19, TypeScript                |
| Build / dev   | Vite 7                              |
| Routing       | TanStack Router (file-based)        |
| Components    | shadcn/ui, Radix UI, Tailwind CSS 4 |
| Icons         | lucide-react                        |
| Charts        | Recharts                            |
| Persistence   | sql.js (SQLite WASM) + IndexedDB    |
| Desktop       | Electron 37                         |
| Lint / format | ESLint 9, Prettier                  |

---

## Project Structure

```
token_traking/
├── CLAUDE.md                 # project-level instructions
├── README.md                 # this file
├── E2E-README.md             # end-to-end data-flow reference
└── frontend/                 # the application
    ├── CLAUDE.md             # product spec, entities, screens, standards
    ├── package.json
    ├── vite.config.ts        # dev-server + /api/token-traking-logs middleware
    ├── electron/             # Electron main process + preload bridge
    ├── src/
    │   ├── data/             # data layer (see below)
    │   ├── routes/           # TanStack Router screens
    │   ├── components/       # shared UI / dashboard pieces
    │   └── features/         # feature-scoped UI modules
    └── ...
```

### Data layer (`frontend/src/data`)

| File                    | Responsibility                                                                                                           |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `token-traking-logs.ts` | Node-safe reader for`~/.token-traking-logs/**/*.jsonl` (used by both the Vite middleware and the Electron main process). |
| `ingest-core.ts`        | Pure parsing + aggregation (`parseTokenTrakingLogs`, `buildDataset`, `filterDataset`, cost model). No Node/browser APIs. |
| `ingest.ts`             | `ingestFiles()` wrapper for manual folder loading.                                                                       |
| `api.ts`                | Typed browser client for the`/api/token-traking-logs` endpoint.                                                          |
| `auto-load.ts`          | Bootstraps the store with real data on startup.                                                                          |
| `db.ts`                 | In-memory store — the single read point for the UI.                                                                      |
| `persist.ts`            | SQLite/IndexedDB durability.                                                                                             |
| `usage-queries.ts`      | Memoization-friendly query functions (summaries, breakdowns, rows, detail views).                                        |
| `usage-types.ts`        | Domain types (Project, User, Model, Task, UsageEvent, …).                                                                |

The full pipeline is documented in [`E2E-README.md`](./E2E-README.md).

---

## Data Model

| Entity         | Key fields                                                                                                                    |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Project**    | `id, name, description, color, createdAt, updatedAt`                                                                          |
| **User**       | `id, name, email, avatarUrl, role, createdAt, updatedAt`                                                                      |
| **Model**      | `id, provider, name, displayName, inputCostPer1m, outputCostPer1m, cachedInputCostPer1m`                                      |
| **Task**       | `id, projectId, userId?, title, status, tags[], startedAt?, completedAt?, parentTaskId?, userText?`                           |
| **UsageEvent** | `id, projectId, userId?, taskId?, modelId, inputTokens, outputTokens, cachedInputTokens, totalTokens, estimatedCost, eventAt` |

A `Task` with `parentTaskId` represents a single chat message; `sessionId`
groups messages into one session task. `UsageEvent` is the atomic unit of
tracked consumption.

---

## Getting Started

All commands run from inside `frontend/`.

```bash
cd frontend

npm install        # install dependencies
npm run dev        # start the Vite dev server (http://localhost:5173)
npm run build      # type-check + production build
npm run preview    # preview the production build
npm run typecheck  # tsc --noEmit
npm run lint       # eslint .
npm run format     # prettier --write "**/*.{ts,tsx}"
```

### Desktop (Electron)

```bash
npm run electron:dev    # run the app in an Electron dev window
npm run electron:build  # build the production Electron app
```

---

## Data Sources

Token Traking reads real AI session logs. By default it scans:

```
~/.token-traking-logs/**/*.jsonl
```

Each log line is a chat message carrying `message.usage` (input/output/cache
tokens), a `model`, and a top-level `cwd` + `sessionId`. The `cwd` scopes a
message to a **project**; `sessionId` groups messages into a **task**.

Alternative data paths (Settings screen):

- **Load a folder** — pick any folder containing `.jsonl` files (Chromium
  browsers, File System Access API).
- **Export / Import JSON** — round-trip the dataset.
- **Refresh from system** — re-read from the active source.

### Cost model

Cost is estimated from per-1M-token rates keyed by model prefix
(`gpt-`, `gemini`, `llama`, `deepseek`, `tencent/`). Unknown models are treated
as **Unknown** with zero cost. Rates are editable in Settings.

---

## Theming & Settings

- **Theme**: light, dark, system.
- **Accent colors**: blue, emerald, violet, rose, amber, slate (applied via CSS
  variables).
- **Density**: comfortable / compact.
- **Currency**: configurable display format.
- **Model cost rates**: view and edit per-model pricing.
- **Data**: refresh from system, load a folder, export/import JSON, clear local
  data.

---

## Privacy

Everything is local. Token Traking never uploads your logs or usage data. The
SQLite database lives in your browser's IndexedDB (web) or the local app
sandbox (desktop).

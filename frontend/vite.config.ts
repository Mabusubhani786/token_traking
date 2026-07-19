import path from "path"
import type { IncomingMessage, ServerResponse } from "http"
import type { Plugin } from "vite"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { tanstackRouter } from "@tanstack/router-plugin/vite"
import { defineConfig } from "vite"

import { readClaudeLogs } from "./src/data/claude-logs"
import {
  filterDataset,
  type DatasetFilters,
} from "./src/data/ingest-core"

// Dev-server endpoint that serves REAL token usage compiled from the local
// Claude Code session logs (~/.claude/projects/**/*.jsonl). Runs server-side
// so the browser never needs the File System Access API.
//
// Supports `?projectId=` (plus `userId`/`modelId`/`taskId`) to return a
// dataset scoped to just those usage events.
function claudeLogsHandler(req: IncomingMessage, res: ServerResponse) {
  try {
    const dataset = readClaudeLogs()
    const url = new URL(req.url ?? "/", "http://localhost")
    const filters: DatasetFilters = {
      projectId: url.searchParams.get("projectId") ?? undefined,
      userId: url.searchParams.get("userId") ?? undefined,
      modelId: url.searchParams.get("modelId") ?? undefined,
      taskId: url.searchParams.get("taskId") ?? undefined,
    }
    const hasFilter =
      filters.projectId || filters.userId || filters.modelId || filters.taskId
    const out = hasFilter ? filterDataset(dataset, filters) : dataset
    res.setHeader("Content-Type", "application/json")
    res.setHeader("Cache-Control", "no-store")
    res.end(JSON.stringify(out))
  } catch (err) {
    res.statusCode = 500
    res.setHeader("Content-Type", "application/json")
    res.end(JSON.stringify({ error: String(err) }))
  }
}

function claudeLogsPlugin(): Plugin {
  return {
    name: "claude-logs-api",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url && req.url.startsWith("/api/claude-logs")) {
          claudeLogsHandler(req, res)
          return
        }
        next()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
    claudeLogsPlugin(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})

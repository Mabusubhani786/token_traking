import { join, normalize, extname } from "node:path"
import { createServer } from "node:http"
import { readFile, stat } from "node:fs/promises"
import {
  app,
  BrowserWindow,
  ipcMain,
  type IpcMainInvokeEvent,
} from "electron"
import { readClaudeLogs, type IngestedDataset } from "../src/data/claude-logs"
import {
  filterDataset,
  type DatasetFilters,
} from "../src/data/ingest-core"


// In dev, serve the Vite dev server. In production, serve the built `dist`
// folder from a tiny static server so the app behaves identically (including
// the `/api/claude-logs` endpoint) whether running in a browser or desktop.
const isDev = !app.isPackaged && !process.env.ELECTRON_TEST_PACKAGED
const DEV_URL = "http://localhost:5173"
const DIST_DIR = join(__dirname, "..", "out", "renderer")

const MIME: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
}

// Real token usage — single source of truth, shared with the web middleware.
// When `url` is provided (the /api/claude-logs HTTP route), apply any
// `?projectId=` / `?userId=` / `?modelId=` / `?taskId=` filters so the
// response is scoped to the requested slice.
function handleClaudeLogs(url?: URL): IngestedDataset {
  const dataset = readClaudeLogs()
  if (!url) return dataset
  const filters: DatasetFilters = {
    projectId: url.searchParams.get("projectId") ?? undefined,
    userId: url.searchParams.get("userId") ?? undefined,
    modelId: url.searchParams.get("modelId") ?? undefined,
    taskId: url.searchParams.get("taskId") ?? undefined,
  }
  const hasFilter =
    filters.projectId || filters.userId || filters.modelId || filters.taskId
  return hasFilter ? filterDataset(dataset, filters) : dataset
}

async function startStaticServer(): Promise<number> {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://localhost")
      if (url.pathname.startsWith("/api/claude-logs")) {
        res.setHeader("Content-Type", "application/json")
        res.setHeader("Cache-Control", "no-store")
        res.end(JSON.stringify(handleClaudeLogs(url)))
        return
      }
      let pathname = decodeURIComponent(url.pathname)
      if (pathname === "/") pathname = "/index.html"
      const filePath = normalize(join(DIST_DIR, pathname))
      if (!filePath.startsWith(DIST_DIR)) {
        res.statusCode = 403
        res.end("Forbidden")
        return
      }
      const info = await stat(filePath).catch(() => null)
      const resolved = info?.isDirectory() ? join(filePath, "index.html") : filePath
      const data = await readFile(resolved)
      res.setHeader("Content-Type", MIME[extname(resolved)] ?? "application/octet-stream")
      res.end(data)
    } catch {
      res.statusCode = 404
      res.end("Not found")
    }
  })
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address()
      const port = typeof addr === "object" && addr ? addr.port : 0
      if (port) console.log(`[token-traking] desktop server on http://127.0.0.1:${port}`)
      resolve(port)
    })
  })
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: "Token Traking",
    backgroundColor: "#0f0f10",
    webPreferences: {
      preload: join(__dirname, "..", "out", "main", "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (isDev) {
    win.loadURL(DEV_URL)
  } else {
    startStaticServer().then((port) => win.loadURL(`http://127.0.0.1:${port}`))
  }
}

app.whenReady().then(() => {
  ipcMain.handle("claude-logs", (_e: IpcMainInvokeEvent) => handleClaudeLogs())
  createWindow()

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit()
})

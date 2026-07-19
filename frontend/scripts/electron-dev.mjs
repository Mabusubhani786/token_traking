// Dev launcher for the desktop app: starts the Vite dev server (which serves
// the React app AND the /api/claude-logs endpoint), waits until it's ready,
// then opens the Electron window pointed at it. Closes the server on exit.
import { spawn } from "node:child_process"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const root = dirname(fileURLToPath(import.meta.url))
const DEV_URL = "http://localhost:5173"

const vite = spawn("npx", ["vite", "--port", "5173"], {
  cwd: resolve(root, ".."),
  stdio: "inherit",
  shell: true,
})

async function waitForServer(timeoutMs = 30000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(DEV_URL)
      if (res.ok) return true
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  return false
}

async function launchElectron() {
  const electron = spawn("npx", ["electron", "."], {
    cwd: resolve(root, ".."),
    stdio: "inherit",
    shell: true,
    env: { ...process.env, ELECTRON_DEV: "1" },
  })
  electron.on("exit", () => {
    vite.kill()
    process.exit(0)
  })
}

waitForServer().then((ok) => {
  if (!ok) {
    console.error("Vite dev server did not start in time.")
    vite.kill()
    process.exit(1)
  }
  launchElectron()
})

process.on("SIGINT", () => {
  vite.kill()
  process.exit(0)
})

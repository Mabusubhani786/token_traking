// Bundle the Electron main + preload processes with esbuild (no file watcher,
// so outputs aren't deleted mid-build). The renderer is built separately by
// Vite (see electron.vite.config.ts / `vite build`). Output: out/main/.
import { build } from "esbuild"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const root = dirname(fileURLToPath(import.meta.url))
const out = resolve(root, "..", "out", "main")

await build({
  entryPoints: [resolve(root, "..", "electron/main.ts")],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  outfile: resolve(out, "main.cjs"),
  external: ["electron"],
  logLevel: "info",
})

await build({
  entryPoints: [resolve(root, "..", "electron/preload.ts")],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  outfile: resolve(out, "preload.cjs"),
  external: ["electron"],
  logLevel: "info",
})

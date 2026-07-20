import { defineConfig, type ConfigEnv, type UserConfig } from "electron-vite"
import { resolve } from "node:path"
import webConfig from "./vite.config.ts"

// Desktop build for Track Ai Tokens.
//
// - The Electron `main` + `preload` are bundled by esbuild
//   (scripts/build-electron.mjs) because electron-vite's file watcher deletes
//   its own main output mid-build. They live in `out/main/`.
// - The renderer is THIS React app, built by Vite into `out/renderer/`
//   (identical to the web `dist/`, just a different folder so the two builds
//   don't clobber each other). `electron/main.ts` serves `out/renderer/`.
export default defineConfig((env: ConfigEnv): UserConfig => {
  const web = (typeof webConfig === "function" ? webConfig(env) : webConfig) as UserConfig
  return {
    renderer: {
      root: __dirname,
      resolve: {
        alias: (web.resolve as { alias?: Record<string, string> })?.alias ?? {},
      },
      build: {
        outDir: resolve(__dirname, "out/renderer"),
        rollupOptions: {
          input: resolve(__dirname, "index.html"),
        },
      },
    },
  }
})

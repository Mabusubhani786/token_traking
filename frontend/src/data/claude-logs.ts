// Shared, NODE-SAFE reader for real Claude Code session logs.
//
// Imports only Node built-ins (`fs`, `os`, `path`) and the pure ingestion
// core — never anything browser-only. Both the Vite dev-server middleware
// AND the Electron main process import this, so there is a single source of
// truth for reading `~/.claude/projects/**/*.jsonl` into a real dataset.

import fs from "fs"
import os from "os"
import path from "path"
import { execSync } from "child_process"

import { buildDataset, parseClaudeLogs, type IngestedDataset } from "./ingest-core"

// Recursively collect every *.jsonl file under a directory.
function collectJsonl(dir: string, out: { name: string; text: string }[]) {
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      collectJsonl(full, out)
    } else if (entry.isFile() && entry.name.endsWith(".jsonl")) {
      try {
        out.push({ name: entry.name, text: fs.readFileSync(full, "utf8") })
      } catch {
        // skip unreadable files
      }
    }
  }
}

// Read the local Claude Code session logs and compile them into a real
// token-usage dataset. Returns an empty dataset if no logs are found.
export function readClaudeLogs(): IngestedDataset {
  const root = path.join(os.homedir(), ".claude", "projects")
  const files: { name: string; text: string }[] = []
  collectJsonl(root, files)

  let displayName = os.userInfo().username
  try {
    const full = execSync(
      `dscl . -read /Users/${os.userInfo().username} RealName 2>/dev/null | tail -1 | sed 's/RealName: //'`,
      { encoding: "utf8", timeout: 2000 },
    ).trim()
    if (full) displayName = full
  } catch {
    // fall back to username
  }

  return buildDataset(parseClaudeLogs(files), displayName)
}

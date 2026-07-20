// Browser-side ingestion.
//
// Real data is assembled by the shared, server-safe core in ./ingest-core.
// This module keeps the browser-only paths: parsing raw text pasted/imported
// as JSON, and the File System Access API folder picker (a manual override
// for when the automatic system load is not available).

import type { Model, Project, Task, UsageEvent, User } from "./usage-types"
import {
  buildDataset,
  parseTokenTrakingLogs,
  type IngestedDataset,
} from "./ingest-core"

export type { IngestedDataset } from "./ingest-core"

// Parse raw `.jsonl` text from one or more session files into a real dataset.
export function ingestFiles(
  files: { name: string; text: string }[],
): IngestedDataset {
  return buildDataset(parseTokenTrakingLogs(files))
}

// Minimal typings for the File System Access API (not yet in all lib defs).
type FsHandle = {
  kind: "file" | "directory"
  name: string
  entries: () => AsyncIterable<[string, FsHandle]>
  getFile?: () => Promise<{ text: () => Promise<string> }>
}

// Runtime: walk a chosen directory for *.jsonl and ingest them live.
// Uses the File System Access API (Chromium). Returns null if the
// picker is unavailable or cancelled. This is a manual override for the
// automatic system load (see ./auto-load.ts).
export async function ingestDirectory(): Promise<IngestedDataset | null> {
  const picker = (
    window as unknown as {
      showDirectoryPicker?: () => Promise<FsHandle>
    }
  ).showDirectoryPicker
  if (typeof picker !== "function") return null

  const dir = await picker()
  const collected: { name: string; text: string }[] = []

  async function walk(handle: FsHandle) {
    for await (const [name, entry] of handle.entries()) {
      if (entry.kind === "file" && name.endsWith(".jsonl")) {
        const file = await entry.getFile!()
        collected.push({ name, text: await file.text() })
      } else if (entry.kind === "directory") {
        await walk(entry)
      }
    }
  }

  await walk(dir)
  if (collected.length === 0) {
    return { projects: [], users: [], models: [], tasks: [], usageEvents: [] }
  }
  return ingestFiles(collected)
}

// Re-export the shared types so callers can import everything from here.
export type { Model, Project, Task, UsageEvent, User }

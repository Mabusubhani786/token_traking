// Browser-side client for the `/api/claude-logs` endpoint.
//
// The endpoint reads the local Claude Code session logs server-side and can
// return a whole dataset or a slice scoped by `projectId` / `userId` /
// `modelId` / `taskId`. These helpers wrap `fetch` with typed responses and
// query-string building so pages never construct URLs by hand.

import type { IngestedDataset } from "./ingest-core"

export type LogFilters = {
  projectId?: string
  userId?: string
  modelId?: string
  taskId?: string
}

// Fetch the compiled usage dataset, optionally narrowed by filter.
export async function fetchClaudeLogs(
  filters: LogFilters = {},
): Promise<IngestedDataset> {
  const params = new URLSearchParams()
  if (filters.projectId) params.set("projectId", filters.projectId)
  if (filters.userId) params.set("userId", filters.userId)
  if (filters.modelId) params.set("modelId", filters.modelId)
  if (filters.taskId) params.set("taskId", filters.taskId)
  const qs = params.toString()
  const res = await fetch(`/api/claude-logs${qs ? `?${qs}` : ""}`)
  if (!res.ok) {
    throw new Error(`Failed to load usage data (${res.status})`)
  }
  const data = (await res.json()) as IngestedDataset
  if (!data || !Array.isArray(data.usageEvents)) {
    throw new Error("Unexpected response from the usage API")
  }
  return data
}

// Fetch the dataset scoped to a single project.
export function fetchProjectDataset(
  projectId: string,
): Promise<IngestedDataset> {
  return fetchClaudeLogs({ projectId })
}

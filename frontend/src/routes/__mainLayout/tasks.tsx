import {
  createFileRoute,
  Link,
  Outlet,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router"
import { ListChecks, Search } from "lucide-react"
import * as React from "react"

import { EmptyState, ModelBadge, PageHeader, StatusBadge } from "@/components/dashboard"
import { CompactNumber } from "@/components/compact-number"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableScroll,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useCompact } from "@/components/settings-provider"
import { getModels, getProjects, useDataStore } from "@/data/db"
import { getTaskRows } from "@/data/usage-queries"
import { formatDuration, formatRelative } from "@/lib/format"

const LEVELS = ["sessions", "messages", "all"] as const
type Level = (typeof LEVELS)[number]

export const Route = createFileRoute("/__mainLayout/tasks")({
  validateSearch: (search: Record<string, unknown>): { level?: Level } => {
    const level = search.level
    return {
      level: LEVELS.includes(level as Level) ? (level as Level) : undefined,
    }
  },
  component: TasksPage,
})

const STATUSES = ["active", "completed", "paused", "archived"] as const

// Empty row list reused when the detail page is mounted (we don't need the
// heavy task aggregation on a child route — see the `rows` memo below).
const EMPTY_ROWS: ReturnType<typeof getTaskRows> = []

// How many rows to render at once. Messages can number in the thousands, so we
// page the table instead of mounting a DOM node per message (keeps it smooth).
const PAGE_SIZE = 50

function TasksPage() {
  const dataStore = useDataStore()
  const compact = useCompact()
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const { level: levelParam } = Route.useSearch()
  const projects = React.useMemo(() => getProjects(), [dataStore])
  const models = React.useMemo(() => getModels(), [dataStore])

  const [search, setSearch] = React.useState("")
  const [projectId, setProjectId] = React.useState("all")
  const [status, setStatus] = React.useState("all")
  const [modelId, setModelId] = React.useState("all")
  const [page, setPage] = React.useState(0)

  // Only the list view needs the full task aggregation. When a child route
  // (e.g. a message detail) is mounted we skip it entirely so opening a detail
  // page doesn't recompute thousands of rows in the parent layout.
  const isList = pathname === "/tasks"

  // The task level (sessions vs individual messages) is URL-addressable so the
  // "Messages" nav entry can deep-link to it and it survives a refresh/share.
  const level: Level = levelParam ?? "sessions"
  const setLevel = React.useCallback(
    (next: string) => {
      navigate({
        to: "/tasks",
        search: { level: next === "sessions" ? undefined : (next as Level) },
      })
    },
    [navigate],
  )

  const filters = React.useMemo(
    () => ({
      projectId: projectId === "all" ? undefined : projectId,
      modelId: modelId === "all" ? undefined : modelId,
    }),
    [projectId, modelId],
  )

  const rows = React.useMemo(() => {
    const base = isList ? getTaskRows(filters) : EMPTY_ROWS
    // Present the most recent work first: newest record at the top, oldest
    // last. Sorting the full set before paging means the first page always
    // leads with the latest record across every page.
    return [...base].sort((a, b) => {
      const ta = Date.parse(
        a.lastActivity ?? a.task.completedAt ?? a.task.createdAt ?? "",
      )
      const tb = Date.parse(
        b.lastActivity ?? b.task.completedAt ?? b.task.createdAt ?? "",
      )
      return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta)
    })
  }, [filters, dataStore, isList])

  const filtered = React.useMemo(
    () =>
      rows.filter((r) => {
        if (status !== "all" && r.task.status !== status) return false
        if (
          search &&
          !r.task.title.toLowerCase().includes(search.toLowerCase())
        )
          return false
        return true
      }),
    [rows, status, search],
  )

  // Level: sessions group a whole chat; messages are individual chat messages
  // (each its own task). Default to sessions so the long message list stays
  // one click away.
  const levelFiltered = React.useMemo(() => {
    if (level === "all") return filtered
    const wantMessage = level === "messages"
    return filtered.filter((r) => Boolean(r.task.parentTaskId) === wantMessage)
  }, [filtered, level])

  // Page the visible rows so the table never mounts thousands of DOM nodes.
  const totalRows = levelFiltered.length
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE))
  React.useEffect(() => {
    setPage(0)
  }, [levelFiltered])
  const safePage = Math.min(page, totalPages - 1)
  const pageRows = levelFiltered.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE,
  )

  const modelName = React.useMemo(
    () => new Map(models.map((m) => [m.id, m.displayName])),
    [models],
  )

  if (pathname !== "/tasks") {
    return <Outlet />
  }

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <PageHeader
        title="Tasks"
        description="Every tracked unit of work and its token spend."
        actions={
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks…"
              className="min-w-0 flex-1 sm:w-56 sm:flex-none"
              startIcon={Search}
            />
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="w-full min-w-[8rem] sm:w-40">
                <SelectValue placeholder="Project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All projects</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={modelId} onValueChange={setModelId}>
              <SelectTrigger className="w-full min-w-[8rem] sm:w-44">
                <SelectValue placeholder="Model" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All models</SelectItem>
                {models.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-full min-w-[7rem] sm:w-32">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={level} onValueChange={setLevel}>
              <SelectTrigger className="w-full min-w-[7rem] sm:w-32">
                <SelectValue placeholder="Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sessions">Sessions</SelectItem>
                <SelectItem value="messages">Messages</SelectItem>
                <SelectItem value="all">All levels</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      />

      {totalRows === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="No tasks found"
          description="Adjust your filters, level, or search."
        />
      ) : (
        <>
        <TableScroll className="max-h-[70vh]">
          <Table className="min-w-[860px]">
            <TableHeader>
              <TableRow>
                <TableHead>Task</TableHead>
                <TableHead>Project</TableHead>
                {!compact && <TableHead>User</TableHead>}
                <TableHead>Model</TableHead>
                <TableHead className="text-right">Tokens</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="text-right">Duration</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Last</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
            {pageRows.map((r) => (
              <TableRow
                key={r.task.id}
                className="cursor-pointer"
                tabIndex={0}
                onClick={() =>
                  navigate({
                    to: "/tasks/$taskId",
                    params: { taskId: r.task.id },
                  })
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault()
                    navigate({
                      to: "/tasks/$taskId",
                      params: { taskId: r.task.id },
                    })
                  }
                }}
              >
                <TableCell>
                  <Link
                    to="/tasks/$taskId"
                    params={{ taskId: r.task.id }}
                    className="block min-w-0"
                  >
                    <span
                      className={
                        r.task.parentTaskId
                          ? "block truncate pl-3 font-medium text-muted-foreground"
                          : "block truncate font-medium"
                      }
                    >
                      {r.task.parentTaskId ? `↳ ${r.task.title}` : r.task.title}
                    </span>
                    {!compact && r.task.tags.length > 0 && (
                      <span className="mt-0.5 flex gap-1">
                        {r.task.tags.map((t) => (
                          <span
                            key={t}
                            className="rounded bg-muted px-1.5 py-0.5 text-2xs text-muted-foreground"
                          >
                            {t}
                          </span>
                        ))}
                      </span>
                    )}
                    {!compact && r.task.parentTaskId && r.task.userText && (
                      <span className="mt-0.5 block truncate pl-3 text-2xs text-muted-foreground/80">
                        {r.task.userText}
                      </span>
                    )}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {r.project.name}
                </TableCell>
                {!compact && (
                  <TableCell className="text-muted-foreground">
                    {r.user?.name ?? "—"}
                  </TableCell>
                )}
                <TableCell>
                  <ModelBadge displayName={modelName.get(r.modelId) ?? r.modelId} />
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  <CompactNumber value={r.totalTokens} />
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  <CompactNumber value={r.estimatedCost} format="currency" />
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {formatDuration(r.task.startedAt, r.task.completedAt)}
                </TableCell>
                <TableCell>
                  <StatusBadge status={r.task.status} />
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {formatRelative(r.lastActivity)}
                </TableCell>
              </TableRow>
            ))}
            </TableBody>
          </Table>
        </TableScroll>

        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-3 pt-1">
            <p className="text-xs text-muted-foreground tabular-nums">
              Showing {safePage * PAGE_SIZE + 1}–
              {Math.min((safePage + 1) * PAGE_SIZE, totalRows)} of {totalRows}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={safePage === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                <ChevronLeft className="size-3.5" /> Prev
              </Button>
              <span className="text-xs tabular-nums text-muted-foreground">
                Page {safePage + 1} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={safePage >= totalPages - 1}
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              >
                Next <ChevronRight className="size-3.5" />
              </Button>
            </div>
          </div>
        )}
        </>
      )}
    </div>
  )
}

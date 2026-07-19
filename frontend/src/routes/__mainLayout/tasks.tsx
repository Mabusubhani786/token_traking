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
import { formatRelative } from "@/lib/format"

export const Route = createFileRoute("/__mainLayout/tasks")({
  component: TasksPage,
})

const STATUSES = ["active", "completed", "paused", "archived"] as const

function TasksPage() {
  const dataStore = useDataStore()
  const compact = useCompact()
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const projects = React.useMemo(() => getProjects(), [dataStore])
  const models = React.useMemo(() => getModels(), [dataStore])

  const [search, setSearch] = React.useState("")
  const [projectId, setProjectId] = React.useState("all")
  const [status, setStatus] = React.useState("all")
  const [modelId, setModelId] = React.useState("all")

  const filters = React.useMemo(
    () => ({
      projectId: projectId === "all" ? undefined : projectId,
      modelId: modelId === "all" ? undefined : modelId,
    }),
    [projectId, modelId],
  )

  const rows = React.useMemo(() => getTaskRows(filters), [filters, dataStore])

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

  const modelName = React.useMemo(
    () => new Map(models.map((m) => [m.id, m.displayName])),
    [models],
  )

  if (pathname !== "/tasks") {
    return <Outlet />
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Tasks"
        description="Every tracked unit of work and its token spend."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks…"
              className="w-44 sm:w-56"
              startIcon={Search}
            />
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="w-36 sm:w-40">
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
              <SelectTrigger className="w-36 sm:w-44">
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
              <SelectTrigger className="w-32">
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
          </div>
        }
      />

      {filtered.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="No tasks found"
          description="Adjust your filters or search."
        />
      ) : (
        <TableScroll className="max-h-[70vh]">
          <Table className="min-w-[760px]">
            <TableHeader>
              <TableRow>
                <TableHead>Task</TableHead>
                <TableHead>Project</TableHead>
                {!compact && <TableHead>User</TableHead>}
                <TableHead>Model</TableHead>
                <TableHead className="text-right">Tokens</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Last</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
            {filtered.map((r) => (
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
                    <span className="block truncate font-medium">
                      {r.task.title}
                    </span>
                    {!compact && r.task.tags.length > 0 && (
                      <span className="mt-0.5 flex gap-1">
                        {r.task.tags.map((t) => (
                          <span
                            key={t}
                            className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                          >
                            {t}
                          </span>
                        ))}
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
      )}
    </div>
  )
}

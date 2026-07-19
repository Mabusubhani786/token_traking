import {
  createFileRoute,
  Link,
  Outlet,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router"
import { Eye, FolderKanban, Search } from "lucide-react"
import * as React from "react"

import { Sparkline } from "@/components/charts"
import { CompactNumber } from "@/components/compact-number"
import { EmptyState, PageHeader } from "@/components/dashboard"
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
import { useCompact } from "@/components/settings-provider"
import { useDataStore } from "@/data/db"
import {
  getDailyUsage,
  getProjectRows,
} from "@/data/usage-queries"
import { formatRelative } from "@/lib/format"

export const Route = createFileRoute("/__mainLayout/projects")({
  component: ProjectsPage,
})

function ProjectsPage() {
  const dataStore = useDataStore()
  const compact = useCompact()
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const [query, setQuery] = React.useState("")

  const rows = React.useMemo(() => getProjectRows(), [dataStore])
  const filtered = React.useMemo(
    () =>
      query
        ? rows.filter((r) =>
            r.project.name.toLowerCase().includes(query.toLowerCase()),
          )
        : rows,
    [rows, query],
  )

  const dailyByProject = React.useMemo(() => {
    const map = new Map<string, number[]>()
    for (const r of rows) {
      map.set(
        r.project.id,
        getDailyUsage({ projectId: r.project.id }, 30).map((d) => d.totalTokens),
      )
    }
    return map
  }, [rows, dataStore])

  if (pathname !== "/projects") {
    return <Outlet />
  }

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <PageHeader
        title="Projects"
        description="Token usage, cost, and activity per project."
        actions={
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects…"
            className="w-full sm:w-56"
            startIcon={Search}
          />
        }
      />

      {filtered.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects found"
          description="Try a different search term."
        />
      ) : (
        <TableScroll className="max-h-[70vh]">
          <Table className="min-w-[720px]">
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead className="text-right">Tokens</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="text-right">Users</TableHead>
                <TableHead className="text-right">Tasks</TableHead>
                <TableHead className="text-right">Last activity</TableHead>
                <TableHead className="text-right">Trend</TableHead>
                <TableHead className="text-right">
                  <Eye className="ml-auto size-4 text-muted-foreground" />
                  <span className="sr-only">View details</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow
                  key={r.project.id}
                  className="cursor-pointer"
                  tabIndex={0}
                  onClick={() =>
                    navigate({
                      to: "/projects/$projectId",
                      params: { projectId: r.project.id },
                    })
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      navigate({
                        to: "/projects/$projectId",
                        params: { projectId: r.project.id },
                      })
                    }
                  }}
                >
                  <TableCell>
                    <Link
                      to="/projects/$projectId"
                      params={{ projectId: r.project.id }}
                      className="flex items-center gap-3"
                    >
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: r.project.color }}
                      />
                      <span className="min-w-0">
                        <span className="block truncate font-mono text-sm font-medium">
                          {r.project.description}
                        </span>
                        {!compact && (
                          <span className="block truncate text-xs text-muted-foreground">
                            {r.project.name}
                          </span>
                        )}
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    <CompactNumber value={r.totalTokens} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <CompactNumber value={r.estimatedCost} format="currency" />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.userCount}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.taskCount}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {formatRelative(r.lastActivity)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end">
                      <Sparkline
                        data={dailyByProject.get(r.project.id) ?? []}
                        width={96}
                        height={28}
                      />
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      to="/projects/$projectId"
                      params={{ projectId: r.project.id }}
                      aria-label={`View ${r.project.name} details`}
                      className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      <Eye className="size-4" />
                    </Link>
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

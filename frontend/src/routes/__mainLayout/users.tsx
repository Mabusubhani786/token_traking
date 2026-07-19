import { createFileRoute, Link } from "@tanstack/react-router"
import { Search, Users } from "lucide-react"
import * as React from "react"

import { Sparkline } from "@/components/charts"
import { CompactNumber } from "@/components/compact-number"
import { EmptyState, PageHeader } from "@/components/dashboard"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
import { getDailyUsage, getUserRows } from "@/data/usage-queries"
import { formatRelative } from "@/lib/format"

export const Route = createFileRoute("/__mainLayout/users")({
  component: UsersPage,
})

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

function UsersPage() {
  const dataStore = useDataStore()
  const compact = useCompact()
  const [query, setQuery] = React.useState("")

  const rows = React.useMemo(() => getUserRows(), [dataStore])
  const filtered = React.useMemo(
    () =>
      query
        ? rows.filter((r) =>
            r.user.name.toLowerCase().includes(query.toLowerCase()),
          )
        : rows,
    [rows, query],
  )

  const dailyByUser = React.useMemo(() => {
    const map = new Map<string, number[]>()
    for (const r of rows) {
      map.set(
        r.user.id,
        getDailyUsage({ userId: r.user.id }, 30).map((d) => d.totalTokens),
      )
    }
    return map
  }, [rows, dataStore])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Users"
        description="Who is driving token usage and cost."
        actions={
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search users…"
            className="w-56"
            startIcon={Search}
          />
        }
      />

      {filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No users found"
          description="Try a different search term."
        />
      ) : (
        <TableScroll className="max-h-[70vh]">
          <Table className="min-w-[640px]">
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead className="text-right">Tokens</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="text-right">Tasks</TableHead>
                <TableHead className="text-right">Last activity</TableHead>
                <TableHead className="text-right">Trend</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
            {filtered.map((r) => (
              <TableRow key={r.user.id}>
                <TableCell>
                  <Link
                    to="/users/$userId"
                    params={{ userId: r.user.id }}
                    className="flex items-center gap-3"
                  >
                    <Avatar size="default">
                      <AvatarImage src={r.user.avatarUrl} alt={r.user.name} />
                      <AvatarFallback>{initials(r.user.name)}</AvatarFallback>
                    </Avatar>
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {r.user.name}
                      </span>
                      {!compact && (
                        <span className="block truncate text-xs text-muted-foreground">
                          {r.user.role}
                        </span>
                      )}
                    </span>
                  </Link>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  <CompactNumber value={r.totalTokens} />
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  <CompactNumber value={r.estimatedCost} format="currency" />
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {r.taskCount}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {formatRelative(r.lastActivity)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end">
                    <Sparkline data={dailyByUser.get(r.user.id) ?? []} width={96} height={28} />
                  </div>
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

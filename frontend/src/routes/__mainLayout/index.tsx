import { createFileRoute, Link } from "@tanstack/react-router"
import { ArrowRight, Boxes, Coins, FolderKanban, Layers, ListChecks, Users } from "lucide-react"
import * as React from "react"

import {
  DonutChart,
  Heatmap,
  HourlyBarChart,
  RankBars,
  TokenTrendChart,
  CostTrendChart,
} from "@/components/charts"
import {
  EmptyState,
  PageHeader,
  SectionCard,
  StatCard,
} from "@/components/dashboard"
import { CompactNumber } from "@/components/compact-number"
import { useDataStore } from "@/data/db"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  getDailyUsage,
  getHeatmap,
  getHourlyUsage,
  getTopModels,
  getTopProjects,
  getTopTasks,
  getTopUsers,
  getUsageSummary,
  todayISO,
} from "@/data/usage-queries"
import {
  formatCompact,
  formatNumber,
  formatRelative,
} from "@/lib/format"

export const Route = createFileRoute("/__mainLayout/")({
  component: OverviewPage,
})

function rangeFrom(days: number): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - (days - 1))
  return d.toISOString().slice(0, 10)
}

function OverviewPage() {
  const dataStore = useDataStore()
  const [range, setRange] = React.useState("30")
  const days = Number(range)
  const to = todayISO()
  const from = rangeFrom(days)

  const filters = React.useMemo(() => ({ from, to }), [from, to])

  const summary = React.useMemo(() => getUsageSummary(filters), [filters, dataStore])
  const daily = React.useMemo(() => getDailyUsage(filters, days), [filters, days, dataStore])
  const hourly = React.useMemo(() => getHourlyUsage(filters), [filters, dataStore])
  const heatmap = React.useMemo(() => getHeatmap(filters), [filters, dataStore])
  const topModels = React.useMemo(() => getTopModels(filters, 6), [filters, dataStore])
  const topUsers = React.useMemo(() => getTopUsers(filters, 6), [filters, dataStore])
  const topTasks = React.useMemo(() => getTopTasks(filters, 6), [filters, dataStore])
  const topProjects = React.useMemo(() => getTopProjects(filters, 5), [filters, dataStore])

  const maxHeat = React.useMemo(
    () => Math.max(...heatmap.map((c) => c.value), 1),
    [heatmap],
  )
  const modelById = React.useMemo(
    () => new Map(topModels.map((m) => [m.id, m.name])),
    [topModels],
  )

  const donutData = topModels.map((m, i) => ({
    name: m.name,
    value: m.totalTokens,
    color: `var(--chart-${(i % 5) + 1})`,
  }))

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Overview"
        description="Executive view of AI token usage, cost, and activity."
        actions={
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Total tokens" value={summary.totalTokens} icon="tokens" format="compact" />
        <StatCard label="Est. cost" value={summary.estimatedCost} icon="cost" format="currency" />
        <StatCard label="Input tokens" value={summary.inputTokens} icon="tokens" format="compact" />
        <StatCard label="Output tokens" value={summary.outputTokens} icon="tokens" format="compact" />
        <StatCard label="Cached" value={summary.cachedInputTokens} icon="tokens" format="compact" />
        <StatCard label="Active users" value={summary.activeUsers} icon="users" format="number" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SectionCard
          title="Token trend"
          description="Daily input, output, and cached tokens"
          className="lg:col-span-2"
        >
          <TokenTrendChart data={daily} />
        </SectionCard>
        <SectionCard title="Top models" description="By total tokens">
          {donutData.length ? (
            <>
              <DonutChart
                data={donutData}
                centerValue={summary.totalTokens}
                centerLabel="tokens"
              />
              <div className="mt-3 space-y-1.5">
                {topModels.slice(0, 4).map((m) => (
                  <div key={m.id} className="flex items-center justify-between text-sm">
                    <span className="truncate">{m.name}</span>
                    <span className="tabular-nums text-muted-foreground">
                      <CompactNumber value={m.totalTokens} />
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <EmptyState title="No usage yet" />
          )}
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SectionCard title="Cost trend" description="Estimated spend over time" className="lg:col-span-2">
          <CostTrendChart data={daily} />
        </SectionCard>
        <SectionCard title="Activity heatmap" description="Tokens by day & hour">
          <Heatmap data={heatmap} max={maxHeat} formatValue={formatNumber} />
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard
          title="Hourly usage"
          description="When tokens are consumed (UTC)"
          action={
            <Badge variant="muted">{formatCompact(summary.totalTokens)} tokens</Badge>
          }
        >
          <HourlyBarChart data={hourly} />
        </SectionCard>
        <SectionCard title="Top projects" description="By total tokens">
          {topProjects.length ? (
            <RankBars
              items={topProjects.map((p) => ({
                id: p.id,
                name: p.name,
                totalTokens: p.totalTokens,
                cost: p.estimatedCost,
              }))}
              renderValue={(p) => <CompactNumber value={p.cost} format="currency" />}
            />
          ) : (
            <EmptyState title="No projects" />
          )}
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SectionCard
          title="Top users"
          description="By total tokens"
          action={
            <Link to="/users">
              <Button variant="ghost" size="sm">
                View all <ArrowRight className="size-3.5" />
              </Button>
            </Link>
          }
        >
          <RankBars
            items={topUsers.map((u) => ({ id: u.id, name: u.name, totalTokens: u.totalTokens }))}
          />
        </SectionCard>
        <SectionCard
          title="Top tasks"
          description="By total tokens"
          action={
            <Link to="/tasks">
              <Button variant="ghost" size="sm">
                View all <ArrowRight className="size-3.5" />
              </Button>
            </Link>
          }
        >
          <RankBars
            items={topTasks.map((t) => ({ id: t.id, name: t.name, totalTokens: t.totalTokens }))}
          />
        </SectionCard>
        <SectionCard
          title="Most used model"
          description={modelById.get(summary.mostUsedModelId ?? "") ?? "—"}
        >
          <div className="flex flex-col items-center justify-center gap-3 py-6">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Boxes className="size-7" />
            </div>
            <div className="text-center">
              <p className="font-semibold">{modelById.get(summary.mostUsedModelId ?? "") ?? "—"}</p>
              <p className="text-xs text-muted-foreground">
                {formatRelative(to)} window · {formatCompact(summary.totalTokens)} tokens
              </p>
            </div>
            <Link to="/models">
              <Button variant="outline" size="sm">
                Compare models <ArrowRight className="size-3.5" />
              </Button>
            </Link>
          </div>
        </SectionCard>
      </div>

      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <FolderKanban className="size-3.5" /> {summary.activeProjects} projects
        </span>
        <span className="inline-flex items-center gap-1">
          <ListChecks className="size-3.5" /> {summary.taskCount} tasks
        </span>
        <span className="inline-flex items-center gap-1">
          <Layers className="size-3.5" /> <CompactNumber value={summary.totalTokens} /> tokens
        </span>
        <span className="inline-flex items-center gap-1">
          <Coins className="size-3.5" /> <CompactNumber value={summary.estimatedCost} format="currency" /> cost
        </span>
        <span className="inline-flex items-center gap-1">
          <Users className="size-3.5" /> {summary.activeUsers} users
        </span>
      </div>
    </div>
  )
}

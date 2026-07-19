import { createFileRoute, Link, useParams } from "@tanstack/react-router"
import { ArrowLeft, Loader2 } from "lucide-react"

import {
  CostTrendChart,
  DonutChart,
  Heatmap,
  HourlyBarChart,
  TokenTrendChart,
} from "@/components/charts"
import {
  EmptyState,
  ModelBadge,
  PageHeader,
  SectionCard,
  StatCard,
  StatusBadge,
} from "@/components/dashboard"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { CompactNumber } from "@/components/compact-number"
import {
  Table,
  TableScroll,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useCurrencyFormatter } from "@/components/settings-provider"
import { getHeatmap, getTaskDetail } from "@/data/usage-queries"
import { getModelById, useDataStore } from "@/data/db"
import {
  formatDateTime,
  formatDuration,
  formatNumber,
  formatRelative,
} from "@/lib/format"

export const Route = createFileRoute("/__mainLayout/tasks/$taskId")({
  component: TaskDetailPage,
})

function TaskDetailPage() {
  const store = useDataStore()
  const { taskId } = useParams({ from: "/__mainLayout/tasks/$taskId" })
  const fmt = useCurrencyFormatter()
  const detail = getTaskDetail(taskId)

  // On a direct load / refresh the store may still be empty while the dataset
  // is fetched. Distinguish "still loading" from "genuinely missing" so a
  // shared message URL doesn't flash "Task not found".
  if (store.usageEvents.length === 0) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
        <p className="text-sm">Loading task…</p>
      </div>
    )
  }

  if (!detail) {
    return (
      <EmptyState
        title="Task not found"
        description="It may have been removed."
        action={
          <Link to="/tasks">
            <Button variant="outline">Back to tasks</Button>
          </Link>
        }
      />
    )
  }

  const { task, project, user, summary, hourly, byModel, events } = detail
  const modelName = (id: string) => getModelById(id)?.displayName ?? id

  // Compact view for a single chat message (its own task).
  if (detail.parent) {
    const from = task.startedAt
    const to = task.completedAt
    const duration = formatDuration(from, to)
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title={task.title}
          description={`${project?.name ?? "—"}${user ? ` · ${user.name}` : ""}`}
          actions={
            <Link to="/tasks">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="size-3.5" /> All tasks
              </Button>
            </Link>
          }
        />

        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={task.status} />
          {from && to && (
            <span className="text-xs text-muted-foreground">
              {formatDateTime(from)} → {formatDateTime(to)} · {duration}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <StatCard label="Total tokens" value={summary.totalTokens} icon="tokens" format="compact" />
          <StatCard label="Est. cost" value={summary.estimatedCost} icon="cost" format="currency" />
          <StatCard label="Input" value={summary.inputTokens} icon="tokens" format="compact" />
          <StatCard label="Output" value={summary.outputTokens} icon="tokens" format="compact" />
          <Card className="stat-card card-pad gap-2 p-4 lg:p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Duration</span>
            </div>
            <div className="stat-value text-2xl font-semibold tabular-nums tracking-tight">
              {duration}
            </div>
          </Card>
        </div>

        <SectionCard title="Belongs to session">
          <Link
            to="/tasks/$taskId"
            params={{ taskId: detail.parent.id }}
            className="font-medium text-primary hover:underline"
          >
            {detail.parent.title}
          </Link>
        </SectionCard>

        <SectionCard title="User prompt" description="What the user gave">
          {task.userText ? (
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
              {task.userText}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              No user text captured for this turn.
            </p>
          )}
        </SectionCard>

        <SectionCard title="Message" description={`${events.length} record`}>
          {events.length ? (
            <TableScroll className="max-h-80">
              <Table className="min-w-[520px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead className="text-right">Tokens</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((ev) => (
                    <TableRow key={ev.id}>
                      <TableCell className="text-muted-foreground">
                        {formatDateTime(ev.eventAt)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDuration(ev.eventAt === to ? from : undefined, ev.eventAt)}
                      </TableCell>
                      <TableCell>
                        <ModelBadge displayName={modelName(ev.modelId)} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        <CompactNumber value={ev.totalTokens} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmt(ev.estimatedCost)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableScroll>
          ) : (
            <EmptyState title="No events" />
          )}
        </SectionCard>
      </div>
    )
  }

  const donutData = byModel.map((m, i) => ({
    name: m.name,
    value: m.totalTokens,
    color: `var(--chart-${(i % 5) + 1})`,
  }))
  const heatmap = getHeatmap({ taskId })
  const maxHeat = Math.max(...heatmap.map((c) => c.value), 1)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={task.title}
        description={`${project?.name ?? "—"}${user ? ` · ${user.name}` : ""}`}
        actions={
          <Link to="/tasks">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="size-3.5" /> All tasks
            </Button>
          </Link>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={task.status} />
        {task.tags.map((t) => (
          <Badge key={t} variant="muted" className="capitalize">
            {t}
          </Badge>
        ))}
        <span className="text-xs text-muted-foreground">
          Created {formatRelative(task.createdAt)}
          {task.completedAt && ` · Completed ${formatRelative(task.completedAt)}`}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Total tokens" value={summary.totalTokens} icon="tokens" format="compact" />
        <StatCard label="Est. cost" value={summary.estimatedCost} icon="cost" format="currency" />
        <StatCard label="Events" value={summary.eventCount} icon="tasks" format="number" hint="records" />
        <StatCard label="Input" value={summary.inputTokens} icon="tokens" format="compact" />
        <StatCard label="Output" value={summary.outputTokens} icon="tokens" format="compact" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SectionCard title="Token trend" className="lg:col-span-2">
          <TokenTrendChart data={detail.daily ?? []} height={200} />
        </SectionCard>
        <SectionCard title="Models used" description="By tokens">
          {donutData.length ? (
            <DonutChart
              data={donutData}
              centerValue={summary.totalTokens}
              centerLabel="tokens"
            />
          ) : (
            <EmptyState title="No usage" />
          )}
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SectionCard title="Cost trend" className="lg:col-span-2">
          <CostTrendChart data={detail.daily ?? []} height={200} />
        </SectionCard>
        <SectionCard title="Activity heatmap" description="UTC">
          <Heatmap data={heatmap} max={maxHeat} formatValue={formatNumber} />
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard title="Hourly usage" description="UTC">
          <HourlyBarChart data={hourly} height={180} />
        </SectionCard>
        <SectionCard
          title="Event timeline"
          description={`${events.length} records`}
        >
          {events.length ? (
            <TableScroll className="max-h-80">
              <Table className="min-w-[420px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead className="text-right">Tokens</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.slice(0, 60).map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="text-muted-foreground">
                        {formatDateTime(e.eventAt)}
                      </TableCell>
                      <TableCell>
                        <ModelBadge displayName={modelName(e.modelId)} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        <CompactNumber value={e.totalTokens} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmt(e.estimatedCost)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableScroll>
          ) : (
            <EmptyState title="No events" />
          )}
        </SectionCard>
      </div>
    </div>
  )
}

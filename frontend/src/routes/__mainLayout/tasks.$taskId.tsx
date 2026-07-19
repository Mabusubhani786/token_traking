import { createFileRoute, Link, useParams } from "@tanstack/react-router"
import { ArrowLeft } from "lucide-react"

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
  formatNumber,
  formatRelative,
} from "@/lib/format"

export const Route = createFileRoute("/__mainLayout/tasks/$taskId")({
  component: TaskDetailPage,
})

function TaskDetailPage() {
  useDataStore()
  const { taskId } = useParams({ from: "/__mainLayout/tasks/$taskId" })
  const fmt = useCurrencyFormatter()
  const detail = getTaskDetail(taskId)

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
  const heatmap = getHeatmap({ taskId })
  const maxHeat = Math.max(...heatmap.map((c) => c.value), 1)
  const modelName = (id: string) => getModelById(id)?.displayName ?? id

  const donutData = byModel.map((m, i) => ({
    name: m.name,
    value: m.totalTokens,
    color: `var(--chart-${(i % 5) + 1})`,
  }))

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

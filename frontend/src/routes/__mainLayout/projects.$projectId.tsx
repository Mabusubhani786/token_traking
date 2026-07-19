import { createFileRoute, Link, useParams } from "@tanstack/react-router"
import * as React from "react"
import { AlertTriangle, ArrowLeft, Loader2 } from "lucide-react"

import {
  CostTrendChart,
  DonutChart,
  Heatmap,
  HourlyBarChart,
  RankBars,
  TokenTrendChart,
} from "@/components/charts"
import { EmptyState, PageHeader, SectionCard, StatCard } from "@/components/dashboard"
import { Button } from "@/components/ui/button"
import { fetchProjectDataset } from "@/data/api"
import type { IngestedDataset } from "@/data/ingest-core"
import { getHeatmap, getProjectDetail, getTopTasks } from "@/data/usage-queries"
import { formatNumber } from "@/lib/format"

export const Route = createFileRoute("/__mainLayout/projects/$projectId")({
  component: ProjectDetailPage,
})

// Load state while we fetch the project-scoped dataset from the API.
type LoadState =
  | { status: "loading" }
  | { status: "ready"; dataset: IngestedDataset }
  | { status: "error"; message: string }

function ProjectDetailPage() {
  const { projectId } = useParams({ from: "/__mainLayout/projects/$projectId" })
  const [state, setState] = React.useState<LoadState>({ status: "loading" })

  React.useEffect(() => {
    let cancelled = false
    setState({ status: "loading" })
    fetchProjectDataset(projectId)
      .then((dataset) => {
        if (!cancelled) setState({ status: "ready", dataset })
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({
            status: "error",
            message: err instanceof Error ? err.message : String(err),
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [projectId])

  if (state.status === "loading") {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
        <p className="text-sm">Loading project usage…</p>
      </div>
    )
  }

  if (state.status === "error") {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Couldn't load project data"
        description={state.message}
        action={
          <Link to="/projects">
            <Button variant="outline">Back to projects</Button>
          </Link>
        }
      />
    )
  }

  // Prefer the API-filtered slice; fall back to the local store only when the
  // returned dataset has no events for this project (e.g. a brand-new project
  // with no logged usage yet).
  const fromApi = getProjectDetail(projectId, state.dataset)
  const detail = fromApi ?? getProjectDetail(projectId)
  if (!detail) {
    return (
      <EmptyState
        title="Project not found"
        description="It may have been removed."
        action={
          <Link to="/projects">
            <Button variant="outline">Back to projects</Button>
          </Link>
        }
      />
    )
  }

  const { project, summary, daily, hourly, byModel, byUser, taskStats } = detail
  // Keep the chart sources consistent with whichever dataset we actually used.
  const ds = fromApi ? state.dataset : undefined
  const heatmap = getHeatmap({ projectId }, ds)
  const topTasks = getTopTasks({ projectId }, 6, ds)
  const maxHeat = Math.max(...heatmap.map((c) => c.value), 1)

  const donutData = byModel.map((m, i) => ({
    name: m.name,
    value: m.totalTokens,
    color: `var(--chart-${(i % 5) + 1})`,
  }))

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={project.name}
        description={project.description}
        actions={
          <Link to="/projects">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="size-3.5" /> All projects
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Tokens used" value={summary.totalTokens} icon="tokens" format="compact" />
        <StatCard label="Est. cost" value={summary.estimatedCost} icon="cost" format="currency" />
        <StatCard
          label="Tasks"
          value={taskStats.total}
          icon="tasks"
          format="number"
          hint={`${taskStats.completed} done`}
        />
        <StatCard label="Active users" value={summary.activeUsers} icon="users" format="number" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SectionCard title="Token trend" description="Daily tokens for this project" className="lg:col-span-2">
          <TokenTrendChart data={daily} />
        </SectionCard>
        <SectionCard title="Top models" description="By tokens in this project">
          {donutData.length ? (
            <DonutChart data={donutData} centerValue={summary.totalTokens} centerLabel="tokens" />
          ) : (
            <EmptyState title="No usage" />
          )}
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SectionCard title="Cost trend" className="lg:col-span-2">
          <CostTrendChart data={daily} />
        </SectionCard>
        <SectionCard title="Activity heatmap" description="Tokens by day & hour">
          <Heatmap data={heatmap} max={maxHeat} formatValue={formatNumber} />
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard title="Hourly usage" description="UTC">
          <HourlyBarChart data={hourly} />
        </SectionCard>
        <SectionCard title="Top contributors" description="Users by tokens">
          <RankBars
            items={byUser.map((u) => ({ id: u.id, name: u.name, totalTokens: u.totalTokens }))}
          />
        </SectionCard>
      </div>

      <SectionCard title="Top tasks" description="By tokens in this project">
        {topTasks.length ? (
          <div className="max-h-80 overflow-y-auto pr-1">
            <RankBars
              items={topTasks.map((t) => ({ id: t.id, name: t.name, totalTokens: t.totalTokens }))}
            />
          </div>
        ) : (
          <EmptyState title="No tasks yet" />
        )}
      </SectionCard>
    </div>
  )
}

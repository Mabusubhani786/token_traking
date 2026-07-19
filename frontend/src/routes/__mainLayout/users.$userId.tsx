import { createFileRoute, Link, useParams } from "@tanstack/react-router"
import { ArrowLeft } from "lucide-react"

import {
  CostTrendChart,
  DonutChart,
  Heatmap,
  HourlyBarChart,
  RankBars,
  TokenTrendChart,
} from "@/components/charts"
import { EmptyState, PageHeader, SectionCard, StatCard } from "@/components/dashboard"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { useCurrencyFormatter } from "@/components/settings-provider"
import { useDataStore } from "@/data/db"
import { getHeatmap, getUserDetail } from "@/data/usage-queries"
import { formatNumber } from "@/lib/format"

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

export const Route = createFileRoute("/__mainLayout/users/$userId")({
  component: UserDetailPage,
})

function UserDetailPage() {
  useDataStore()
  const { userId } = useParams({ from: "/__mainLayout/users/$userId" })
  const fmt = useCurrencyFormatter()
  const detail = getUserDetail(userId)

  if (!detail) {
    return (
      <EmptyState
        title="User not found"
        description="This user may not exist."
        action={
          <Link to="/users">
            <Button variant="outline">Back to users</Button>
          </Link>
        }
      />
    )
  }

  const { user, summary, daily, hourly, byModel, byProject } = detail
  const heatmap = getHeatmap({ userId })
  const maxHeat = Math.max(...heatmap.map((c) => c.value), 1)

  const donutData = byModel.map((m, i) => ({
    name: m.name,
    value: m.totalTokens,
    color: `var(--chart-${(i % 5) + 1})`,
  }))

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={user.name}
        description={user.email}
        actions={
          <Link to="/users">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="size-3.5" /> All users
            </Button>
          </Link>
        }
      />

      <div className="flex items-center gap-4">
        <Avatar size="lg">
          <AvatarImage src={user.avatarUrl} alt={user.name} />
          <AvatarFallback>{initials(user.name)}</AvatarFallback>
        </Avatar>
        <div>
          <p className="font-medium">{user.name}</p>
          <p className="text-sm text-muted-foreground">{user.role}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total tokens" value={summary.totalTokens} icon="tokens" format="compact" />
        <StatCard label="Est. cost" value={summary.estimatedCost} icon="cost" format="currency" />
        <StatCard label="Tasks" value={summary.taskCount} icon="tasks" format="number" />
        <StatCard label="Events" value={summary.eventCount} icon="users" format="number" hint="sessions" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SectionCard title="Token trend" className="lg:col-span-2">
          <TokenTrendChart data={daily} />
        </SectionCard>
        <SectionCard title="Top models" description="By tokens">
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
        <SectionCard title="Top projects" description="By tokens">
          <RankBars
            items={byProject.map((p) => ({ id: p.id, name: p.name, totalTokens: p.totalTokens, cost: p.estimatedCost }))}
            renderValue={(p) => fmt(p.cost)}
          />
        </SectionCard>
      </div>
    </div>
  )
}

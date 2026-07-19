import { createFileRoute, Link, useParams } from "@tanstack/react-router"
import * as React from "react"
import { ArrowLeft } from "lucide-react"

import {
  CostTrendChart,
  DonutChart,
  HourlyBarChart,
  RankBars,
  TokenTrendChart,
} from "@/components/charts"
import { EmptyState, PageHeader, SectionCard, StatCard } from "@/components/dashboard"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useDataStore } from "@/data/db"
import { getUserDetail } from "@/data/usage-queries"

export const Route = createFileRoute("/__mainLayout/users/$userId")({
  component: UserDetailPage,
})

function UserDetailPage() {
  const { userId } = useParams({ from: "/__mainLayout/users/$userId" })
  const dataStore = useDataStore()

  const detail = React.useMemo(() => getUserDetail(userId), [userId, dataStore])

  if (!detail) {
    return (
      <EmptyState
        title="User not found"
        description="This user may have been removed."
        action={
          <Link to="/">
            <Button variant="outline">Back to overview</Button>
          </Link>
        }
      />
    )
  }

  const { user, summary, daily, hourly, byModel, byProject } = detail

  function initials(name: string): string {
    return name
      .split(" ")
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase()
  }

  const donutData = byModel.map((m, i) => ({
    name: m.name,
    value: m.totalTokens,
    color: `var(--chart-${(i % 5) + 1})`,
  }))

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <PageHeader
        title={user.name}
        description={user.email ?? user.role ?? undefined}
        actions={
          <div className="flex items-center gap-2">
            <Avatar size="lg">
              {user.avatarUrl && (
                <AvatarImage src={user.avatarUrl} alt={user.name} />
              )}
              <AvatarFallback>{initials(user.name)}</AvatarFallback>
            </Avatar>
            <Link to="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="size-3.5" /> Overview
              </Button>
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Tokens used" value={summary.totalTokens} icon="tokens" format="compact" />
        <StatCard label="Est. cost" value={summary.estimatedCost} icon="cost" format="currency" />
        <StatCard
          label="Tasks"
          value={summary.taskCount}
          icon="tasks"
          format="number"
        />
        <StatCard label="Projects" value={byProject.length} icon="projects" format="number" />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
        <SectionCard title="Token trend" description="Daily tokens for this user" className="lg:col-span-2">
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

      <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2">
        <SectionCard title="Cost trend">
          <CostTrendChart data={daily} />
        </SectionCard>
        <SectionCard title="Hourly usage" description="UTC">
          <HourlyBarChart data={hourly} />
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2">
        <SectionCard title="Top projects" description="By tokens">
          <RankBars
            items={byProject.map((p) => ({ id: p.id, name: p.name, totalTokens: p.totalTokens }))}
          />
        </SectionCard>
        <SectionCard title="Model preference" description="Tokens by model">
          <RankBars
            items={byModel.map((m) => ({ id: m.id, name: m.name, totalTokens: m.totalTokens }))}
          />
        </SectionCard>
      </div>
    </div>
  )
}

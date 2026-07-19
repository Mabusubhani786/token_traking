import { createFileRoute } from "@tanstack/react-router"
import { Boxes, Building2 } from "lucide-react"
import * as React from "react"

import { DonutChart } from "@/components/charts"
import { CompactNumber } from "@/components/compact-number"
import { EmptyState, PageHeader, SectionCard, StatCard } from "@/components/dashboard"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableScroll,
} from "@/components/ui/table"
import { useCurrencyFormatter } from "@/components/settings-provider"
import { useDataStore } from "@/data/db"
import { getModelRows } from "@/data/usage-queries"
import { groupModelsByProvider } from "@/data/ingest-core"
import { formatCompact, formatNumber } from "@/lib/format"

export const Route = createFileRoute("/__mainLayout/models")({
  component: ModelsPage,
})

type Segment = { key: string; label: string; value: number; color: string }

const SEGMENTS: Segment[] = [
  { key: "input", label: "Input", value: 0, color: "var(--chart-1)" },
  { key: "output", label: "Output", value: 0, color: "var(--chart-2)" },
  { key: "cached", label: "Cached", value: 0, color: "var(--chart-3)" },
]

function ModelsPage() {
  const dataStore = useDataStore()
  const fmt = useCurrencyFormatter()
  const rows = React.useMemo(() => getModelRows(), [dataStore])
  const groups = React.useMemo(() => groupModelsByProvider(rows), [rows])

  const totalTokens = rows.reduce((s, r) => s + r.totalTokens, 0)
  const totalCost = rows.reduce((s, r) => s + r.estimatedCost, 0)
  const providerCount = groups.length

  const donutData = rows.map((r, i) => ({
    name: r.model.displayName,
    value: r.totalTokens,
    color: `var(--chart-${(i % 5) + 1})`,
  }))

  if (rows.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Models"
          description="Token and cost breakdown by AI model and provider."
        />
        <EmptyState
          icon={Boxes}
          title="No models yet"
          description="Load your Claude Code session logs to see real model usage and cost."
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Models"
        description="Token and cost breakdown by AI model and provider."
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Total tokens" value={totalTokens} icon="tokens" format="compact" />
        <StatCard label="Est. cost" value={totalCost} icon="cost" format="currency" />
        <StatCard label="Models" value={rows.length} icon={Boxes} format="number" />
        <StatCard label="Providers" value={providerCount} icon={Building2} format="number" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SectionCard
          title="Tokens by model"
          description="Share of total usage"
          className="lg:col-span-1"
        >
          <DonutChart
            data={donutData}
            centerValue={totalTokens}
            centerLabel="tokens"
          />
        </SectionCard>

        <SectionCard
          title="Tokens by provider"
          description="Where usage is concentrated"
          className="lg:col-span-2"
        >
          <div className="flex flex-col gap-4">
            {groups.map((g) => {
              const pct =
                totalTokens > 0 ? (g.totalTokens / totalTokens) * 100 : 0
              return (
                <div key={g.provider} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 truncate text-sm font-medium">
                    {g.provider}
                  </span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-24 shrink-0 text-right text-sm tabular-nums text-muted-foreground">
                    <CompactNumber value={g.totalTokens} />
                  </span>
                  <span className="w-12 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                    {pct.toFixed(0)}%
                  </span>
                </div>
              )
            })}
          </div>
        </SectionCard>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        {SEGMENTS.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span
              className="size-2.5 rounded-[3px]"
              style={{ backgroundColor: s.color }}
            />
            {s.label}
          </span>
        ))}
      </div>

      {groups.map((g) => {
        const gPct =
          totalTokens > 0 ? (g.totalTokens / totalTokens) * 100 : 0
        return (
          <SectionCard
            key={g.provider}
            title={g.provider}
            description={`${g.models.length} model${g.models.length === 1 ? "" : "s"} · ${formatCompact(g.totalTokens)} tokens · ${fmt(g.estimatedCost)}`}
            action={
              <Badge variant="muted" className="tabular-nums">
                {gPct.toFixed(1)}% of usage
              </Badge>
            }
          >
            <TableScroll className="max-h-[60vh]">
              <Table className="min-w-[820px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Model</TableHead>
                    <TableHead className="w-[28%]">Token split</TableHead>
                    <TableHead className="text-right">Tokens</TableHead>
                    <TableHead className="text-right">Input</TableHead>
                    <TableHead className="text-right">Output</TableHead>
                    <TableHead className="text-right">Cached</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Events</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {g.models.map((m) => {
                    const max = m.totalTokens || 1
                    const inputPct = (m.inputTokens / max) * 100
                    const outputPct = (m.outputTokens / max) * 100
                    const cachedPct = (m.cachedInputTokens / max) * 100
                    return (
                      <TableRow key={m.id}>
                        <TableCell>
                          <div className="min-w-0">
                            <p className="truncate font-medium">{m.displayName}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {m.name}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div
                            className="flex h-2.5 overflow-hidden rounded-full bg-muted"
                            title={`Input ${formatNumber(m.inputTokens)} · Output ${formatNumber(m.outputTokens)} · Cached ${formatNumber(m.cachedInputTokens)}`}
                          >
                            <div
                              style={{ width: `${inputPct}%`, backgroundColor: "var(--chart-1)" }}
                            />
                            <div
                              style={{ width: `${outputPct}%`, backgroundColor: "var(--chart-2)" }}
                            />
                            <div
                              style={{ width: `${cachedPct}%`, backgroundColor: "var(--chart-3)" }}
                            />
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          <CompactNumber value={m.totalTokens} />
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          <CompactNumber value={m.inputTokens} />
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          <CompactNumber value={m.outputTokens} />
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          <CompactNumber value={m.cachedInputTokens} />
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {fmt(m.estimatedCost)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          <CompactNumber value={m.events} format="number" />
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </TableScroll>
          </SectionCard>
        )
      })}
    </div>
  )
}

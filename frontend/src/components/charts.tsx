// Chart feature components, built on the shadcn `chart` (Recharts) primitives.
// Custom heatmap + sparkline are plain SVG/divs to avoid extra deps.

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis } from "recharts"
import type { CSSProperties, ReactNode } from "react"

import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { CompactNumber } from "@/components/compact-number"
import { cn } from "@/lib/utils"
import { formatNumber } from "@/lib/format"

const axisClass = "text-muted-foreground"
const axisLine = false
const tickLine = false

// ---- Token / cost trend (stacked area) --------------------------------

export type TrendDatum = {
  date: string
  inputTokens: number
  outputTokens: number
  cachedInputTokens: number
  estimatedCost: number
}

const trendConfig = {
  inputTokens: { label: "Input", color: "var(--color-chart-1)" },
  outputTokens: { label: "Output", color: "var(--color-chart-2)" },
  cachedInputTokens: { label: "Cached", color: "var(--color-chart-3)" },
  estimatedCost: { label: "Cost", color: "var(--color-chart-4)" },
} satisfies ChartConfig

export function TokenTrendChart({
  data,
  height = 240,
}: {
  data: TrendDatum[]
  height?: number
}) {
  return (
    <ChartContainer config={trendConfig} className={cn("w-full")} style={{ height }}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          dataKey="date"
          tickLine={tickLine}
          axisLine={axisLine}
          tickMargin={8}
          minTickGap={24}
          tickFormatter={(v: string) =>
            new Date(`${v}T12:00:00`).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })
          }
          className={axisClass}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Area
          dataKey="inputTokens"
          type="monotone"
          stackId="a"
          fill="var(--color-inputTokens)"
          stroke="var(--color-inputTokens)"
          fillOpacity={0.6}
        />
        <Area
          dataKey="outputTokens"
          type="monotone"
          stackId="a"
          fill="var(--color-outputTokens)"
          stroke="var(--color-outputTokens)"
          fillOpacity={0.6}
        />
        <Area
          dataKey="cachedInputTokens"
          type="monotone"
          stackId="a"
          fill="var(--color-cachedInputTokens)"
          stroke="var(--color-cachedInputTokens)"
          fillOpacity={0.5}
        />
      </AreaChart>
    </ChartContainer>
  )
}

export function CostTrendChart({
  data,
  height = 240,
}: {
  data: TrendDatum[]
  height?: number
}) {
  return (
    <ChartContainer config={trendConfig} className="w-full" style={{ height }}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="fillCost" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-estimatedCost)" stopOpacity={0.7} />
            <stop offset="95%" stopColor="var(--color-estimatedCost)" stopOpacity={0.1} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          dataKey="date"
          tickLine={tickLine}
          axisLine={axisLine}
          tickMargin={8}
          minTickGap={24}
          tickFormatter={(v: string) =>
            new Date(`${v}T12:00:00`).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })
          }
          className={axisClass}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Area
          dataKey="estimatedCost"
          type="monotone"
          fill="url(#fillCost)"
          stroke="var(--color-estimatedCost)"
        />
      </AreaChart>
    </ChartContainer>
  )
}

// ---- Hourly bars -------------------------------------------------------

export function HourlyBarChart({
  data,
  height = 200,
}: {
  data: { hour: number; totalTokens: number; estimatedCost: number }[]
  height?: number
}) {
  const config = { totalTokens: { label: "Tokens", color: "var(--color-chart-2)" } } satisfies ChartConfig
  return (
    <ChartContainer config={config} className="w-full" style={{ height }}>
      <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          dataKey="hour"
          tickLine={tickLine}
          axisLine={axisLine}
          tickMargin={6}
          interval={2}
          tickFormatter={(v: number) => `${v}h`}
          className={axisClass}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(v) => `${v}:00`}
              formatter={(value, name) => [formatNumber(Number(value)), name as string]}
            />
          }
        />
        <Bar dataKey="totalTokens" fill="var(--color-totalTokens)" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ChartContainer>
  )
}

// ---- Donut -------------------------------------------------------------

export function DonutChart({
  data,
  height = 220,
  centerLabel,
  centerValue,
}: {
  data: { name: string; value: number; color: string }[]
  height?: number
  centerLabel?: string
  centerValue?: string | number
}) {
  const donutConfig = Object.fromEntries(
    data.map((d) => [d.name, { label: d.name, color: d.color }]),
  ) satisfies ChartConfig

  return (
    <div className="relative" style={{ height }}>
      <ChartContainer config={donutConfig} className="h-full w-full" style={{ height }}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="58%"
            outerRadius="90%"
            paddingAngle={2}
            strokeWidth={1}
          >
            {data.map((d) => (
              <Cell key={d.name} fill={d.color} />
            ))}
          </Pie>
          <ChartTooltip content={<ChartTooltipContent nameKey="name" hideLabel />} />
        </PieChart>
      </ChartContainer>
      {(centerLabel || centerValue) && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-semibold tabular-nums">
            {typeof centerValue === "number" ? (
              <CompactNumber value={centerValue} />
            ) : (
              centerValue
            )}
          </span>
          <span className="text-xs text-muted-foreground">{centerLabel}</span>
        </div>
      )}
    </div>
  )
}

// ---- Heatmap (custom) --------------------------------------------------

export function Heatmap({
  data,
  max,
  formatValue,
}: {
  data: { day: number; hour: number; value: number }[]
  max: number
  formatValue?: (v: number) => string
}) {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  const grid = Array.from({ length: 7 }, (_, day) =>
    Array.from({ length: 24 }, (_, hour) => {
      const cell = data.find((c) => c.day === day && c.hour === hour)
      return cell?.value ?? 0
    }),
  )
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      <div className="flex flex-col justify-between py-0.5 pr-1 text-[10px] text-muted-foreground">
        {days.map((d) => (
          <span key={d} className="h-4 leading-4">
            {d}
          </span>
        ))}
      </div>
      <div className="flex flex-col gap-1">
        {grid.map((row, day) => (
          <div key={day} className="flex gap-1">
            {row.map((v, hour) => {
              const intensity = max > 0 ? v / max : 0
              return (
                <div
                  key={hour}
                  title={`${days[day]} ${hour}:00 · ${formatValue ? formatValue(v) : v} tokens`}
                  className="size-4 rounded-[3px] bg-[var(--heat)]"
                  style={
                    {
                      "--heat": `color-mix(in oklch, var(--primary) ${Math.round(intensity * 85)}%, transparent)`,
                    } as CSSProperties
                  }
                />
              )
            })}
          </div>
        ))}
        <div className="flex gap-1 pl-0 text-[10px] text-muted-foreground">
          {[0, 6, 12, 18, 23].map((h) => (
            <span key={h} className="w-4 text-center">
              {h}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

// ---- Sparkline (custom SVG) -------------------------------------------

export function Sparkline({
  data,
  width = 120,
  height = 32,
  className,
}: {
  data: number[]
  width?: number
  height?: number
  className?: string
}) {
  if (data.length === 0) {
    return <svg width={width} height={height} className={className} />
  }
  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const range = max - min || 1
  const step = data.length > 1 ? width / (data.length - 1) : width
  const points = data
    .map((v, i) => {
      const x = i * step
      const y = height - ((v - min) / range) * (height - 4) - 2
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(" ")
  return (
    <svg width={width} height={height} className={className} viewBox={`0 0 ${width} ${height}`}>
      <polyline
        points={points}
        fill="none"
        stroke="var(--primary)"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

// ---- Horizontal rank bars ----------------------------------------------

export function RankBars<T extends { id: string; name: string; totalTokens: number }>({
  items,
  renderValue,
}: {
  items: T[]
  renderValue?: (item: T) => ReactNode
}) {
  const max = Math.max(...items.map((i) => i.totalTokens), 1)
  return (
    <div className="flex flex-col gap-2.5">
      {items.map((item, i) => (
        <div key={item.id} className="flex items-center gap-3">
          <span className="w-32 shrink-0 truncate text-sm">{item.name}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-[var(--bar)]"
              style={
                {
                  width: `${(item.totalTokens / max) * 100}%`,
                  "--bar":
                    (item as { color?: string }).color ??
                    `var(--chart-${(i % 5) + 1})`,
                } as CSSProperties
              }
            />
          </div>
          <span className="w-20 shrink-0 text-right text-sm tabular-nums text-muted-foreground">
            {renderValue ? (
              renderValue(item)
            ) : (
              <CompactNumber value={item.totalTokens} />
            )}
          </span>
        </div>
      ))}
    </div>
  )
}

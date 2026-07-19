// Shared feature components used across dashboard screens.
// Keeps pages small and presentational (see frontend/CLAUDE.md).

import * as React from "react"
import {
  Coins,
  FolderKanban,
  Layers,
  ListChecks,
  type LucideIcon,
  Timer,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { CompactNumber } from "@/components/compact-number"
import { useCompact } from "@/components/settings-provider"
import { cn } from "@/lib/utils"
import type { TaskStatus } from "@/data/usage-types"

// ---- Page header -------------------------------------------------------

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

// ---- Stat card ----------------------------------------------------------

const statIcons: Record<string, LucideIcon> = {
  tokens: Layers,
  cost: Coins,
  projects: FolderKanban,
  users: Users,
  tasks: ListChecks,
  time: Timer,
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  delta,
  format = "number",
}: {
  label: string
  value: number
  hint?: string
  icon?: keyof typeof statIcons | LucideIcon
  delta?: number
  format?: "number" | "compact" | "currency"
}) {
  const compact = useCompact()
  const Icon = typeof icon === "string" ? statIcons[icon] : icon
  return (
    <Card className={cn("stat-card card-pad gap-2", compact ? "p-4" : "p-5")}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">{label}</span>
        {Icon && <Icon className="size-4 text-muted-foreground" />}
      </div>
      <div className="stat-value text-2xl font-semibold tabular-nums tracking-tight">
        <CompactNumber
          value={value}
          format={
            format === "currency"
              ? "currency"
              : format === "number"
                ? "number"
                : "tokens"
          }
        />
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {typeof delta === "number" && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 font-medium",
              delta >= 0 ? "text-emerald-500" : "text-red-500",
            )}
          >
            {delta >= 0 ? (
              <TrendingUp className="size-3" />
            ) : (
              <TrendingDown className="size-3" />
            )}
            {Math.abs(delta).toFixed(1)}%
          </span>
        )}
        {hint && <span>{hint}</span>}
      </div>
    </Card>
  )
}

// ---- Empty / loading states --------------------------------------------

export function EmptyState({
  title,
  description,
  icon: Icon = Layers,
  action,
}: {
  title: string
  description?: string
  icon?: LucideIcon
  action?: React.ReactNode
}) {
  return (
    <Card className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-6" />
      </div>
      <div>
        <p className="font-medium">{title}</p>
        {description && (
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action}
    </Card>
  )
}

export function StatSkeleton() {
  return (
    <Card className="stat-card card-pad gap-2 p-5">
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-7 w-28" />
      <Skeleton className="h-3 w-24" />
    </Card>
  )
}

// ---- Status / model badges ---------------------------------------------

const statusVariant: Record<
  TaskStatus,
  "success" | "secondary" | "warning" | "muted"
> = {
  completed: "success",
  active: "secondary",
  paused: "warning",
  archived: "muted",
}

export function StatusBadge({ status }: { status: TaskStatus }) {
  return (
    <Badge variant={statusVariant[status]} className="capitalize">
      {status}
    </Badge>
  )
}

export function ModelBadge({
  displayName,
  className,
}: {
  displayName: string
  className?: string
}) {
  return (
    <Badge variant="outline" className={cn("font-normal", className)}>
      {displayName}
    </Badge>
  )
}

// ---- Section card wrapper ----------------------------------------------

export function SectionCard({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string
  description?: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <Card className={cn("card-pad", className)}>
      <div className="flex items-start justify-between gap-3 border-b border-border/60 px-5 py-3.5">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          {description && (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        {action}
      </div>
      <div className="px-5 py-4">{children}</div>
    </Card>
  )
}

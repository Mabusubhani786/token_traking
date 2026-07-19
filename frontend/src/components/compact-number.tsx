"use client"

// Renders a large number in compact K/M/B/T form and reveals the exact,
// fully-formatted value on hover via a shadcn tooltip. Used for token counts
// and costs across every dashboard page so the UI stays dense but the precise
// figure is always one hover away.

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { formatCompact, formatCurrency, formatNumber } from "@/lib/format"

type CompactNumberProps = {
  value: number
  format?: "tokens" | "currency" | "number"
  className?: string
}

export function CompactNumber({
  value,
  format = "tokens",
  className,
}: CompactNumberProps) {
  const compact =
    format === "currency" ? formatCurrency(value) : formatCompact(value)
  const exact =
    format === "currency"
      ? formatCurrency(value, undefined, true)
      : formatNumber(value)

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn("cursor-default tabular-nums", className)}>
          {compact}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <span className="tabular-nums">{exact}</span>
      </TooltipContent>
    </Tooltip>
  )
}

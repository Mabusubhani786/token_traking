// Presentation formatters. Components import these instead of formatting
// inline so currency/locale handling stays consistent.

const numberFmt = new Intl.NumberFormat("en-US")

export function formatNumber(n: number): string {
  return numberFmt.format(Math.round(n))
}

const compactFmt = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
})

export function formatCompact(n: number): string {
  return compactFmt.format(n)
}

export function formatTokens(n: number): string {
  return `${formatCompact(n)}`
}

export function formatCurrency(
  n: number,
  currency = "USD",
  full = false,
): string {
  if (full) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n)
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: n >= 100 ? 0 : 2,
    notation: n >= 100_000 ? "compact" : "standard",
  }).format(n)
}

export function formatPercent(n: number, fractionDigits = 1): string {
  return `${(n * 100).toFixed(fractionDigits)}%`
}

export function formatDate(iso?: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function formatShortDate(iso?: string | null): string {
  if (!iso) return "—"
  // Accepts YYYY-MM-DD or full ISO.
  return new Date(iso.length <= 10 ? `${iso}T12:00:00` : iso).toLocaleDateString(
    "en-US",
    { month: "short", day: "numeric" },
  )
}

export function formatDateTime(iso?: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export function formatRelative(iso?: string | null): string {
  if (!iso) return "—"
  const then = new Date(iso).getTime()
  const now = Date.now()
  const diff = Math.max(0, now - then)
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

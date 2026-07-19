/* eslint-disable react-refresh/only-export-components */
import * as React from "react"

import { formatCurrency as formatCurrencyBase } from "@/lib/format"

export type AccentName =
  | "blue"
  | "emerald"
  | "violet"
  | "rose"
  | "amber"
  | "slate"

export type Density = "comfortable" | "compact"

export type CurrencyCode = "USD" | "EUR" | "GBP" | "INR" | "JPY"

export const ACCENTS: { id: AccentName; label: string; swatch: string }[] = [
  { id: "blue", label: "Blue", swatch: "oklch(0.62 0.19 250)" },
  { id: "emerald", label: "Emerald", swatch: "oklch(0.70 0.15 160)" },
  { id: "violet", label: "Violet", swatch: "oklch(0.62 0.21 290)" },
  { id: "rose", label: "Rose", swatch: "oklch(0.65 0.22 15)" },
  { id: "amber", label: "Amber", swatch: "oklch(0.77 0.16 75)" },
  { id: "slate", label: "Slate", swatch: "oklch(0.55 0 0)" },
]

export const CURRENCIES: CurrencyCode[] = ["USD", "EUR", "GBP", "INR", "JPY"]

type SettingsState = {
  accent: AccentName
  density: Density
  currency: CurrencyCode
}

type SettingsContextValue = SettingsState & {
  setAccent: (a: AccentName) => void
  setDensity: (d: Density) => void
  setCurrency: (c: CurrencyCode) => void
}

const STORAGE_KEY = "token-traking:settings"
const SettingsContext = React.createContext<SettingsContextValue | undefined>(
  undefined,
)

function readInitial(): SettingsState {
  const fallback: SettingsState = {
    accent: "blue",
    density: "comfortable",
    currency: "USD",
  }
  if (typeof localStorage === "undefined") return fallback
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<SettingsState>
    return { ...fallback, ...parsed }
  } catch {
    return fallback
  }
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<SettingsState>(readInitial)

  React.useEffect(() => {
    const root = document.documentElement
    root.dataset.accent = state.accent
    root.dataset.density = state.density
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  const value = React.useMemo<SettingsContextValue>(
    () => ({
      ...state,
      setAccent: (accent) => setState((s) => ({ ...s, accent })),
      setDensity: (density) => setState((s) => ({ ...s, density })),
      setCurrency: (currency) => setState((s) => ({ ...s, currency })),
    }),
    [state],
  )

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings(): SettingsContextValue {
  const ctx = React.useContext(SettingsContext)
  if (!ctx) {
    throw new Error("useSettings must be used within a SettingsProvider")
  }
  return ctx
}

export function useCompact(): boolean {
  return useSettings().density === "compact"
}

export function useCurrencyFormatter() {
  const { currency } = useSettings()
  return (n: number) => formatCurrencyBase(n, currency)
}

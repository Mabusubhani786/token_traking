import { createFileRoute } from "@tanstack/react-router"
import { Download, Monitor, Moon, Sun, Upload } from "lucide-react"
import * as React from "react"

import { PageHeader, SectionCard } from "@/components/dashboard"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useTheme } from "@/components/theme-provider"
import {
  ACCENTS,
  CURRENCIES,
  useCompact,
  useCurrencyFormatter,
  useSettings,
} from "@/components/settings-provider"
import { ingestDirectory } from "@/data/ingest"
import { loadSystemData } from "@/data/auto-load"
import {
  getModels,
  getProjects,
  getTasks,
  getUsageEvents,
  getUsers,
  isEmpty,
  loadDataset,
  updateModel,
} from "@/data/db"
import { clearPersisted } from "@/data/persist"
import type { Model } from "@/data/usage-types"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/__mainLayout/settings")({
  component: SettingsPage,
})

const THEMES = [
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
  { id: "system", label: "System", icon: Monitor },
] as const

function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const { accent, currency, setAccent, setCurrency } = useSettings()
  const compact = useCompact()
  const { setDensity } = useSettings()
  const fmt = useCurrencyFormatter()

  const [models, setModels] = React.useState<Model[]>(() => getModels())

  function patchModel(
    id: string,
    field: "inputCostPer1m" | "outputCostPer1m" | "cachedInputCostPer1m",
    value: string,
  ) {
    const num = Number(value)
    if (Number.isNaN(num)) return
    const next = models.map((m) =>
      m.id === id ? { ...m, [field]: num } : m,
    )
    setModels(next)
    updateModel(id, { [field]: num })
  }

  function exportData() {
    const payload = JSON.stringify(
      {
        projects: getProjects(),
        users: getUsers(),
        tasks: getTasks(),
        models: getModels(),
        usageEvents: getUsageEvents(),
      },
      null,
      2,
    )
    const blob = new Blob([payload], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `token-traking-export-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function importData(file: File) {
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const data = JSON.parse(String(reader.result))
        const next = {
          projects: data.projects ?? [],
          users: data.users ?? [],
          models: data.models ?? [],
          tasks: data.tasks ?? [],
          usageEvents: data.usageEvents ?? [],
        }
        await loadDataset(next)
        setModels(next.models)
        window.location.reload()
      } catch {
        alert("Invalid export file.")
      }
    }
    reader.readAsText(file)
  }

  async function loadFolder() {
    try {
      const result = await ingestDirectory()
      if (!result || result.usageEvents.length === 0) {
        alert("No Claude session logs (.jsonl) found in that folder.")
        return
      }
      await loadDataset(result)
      setModels(result.models)
      window.location.reload()
    } catch {
      alert("Could not read that folder. Use a Chromium browser, or import a JSON export instead.")
    }
  }

  async function clearLocalData() {
    if (!confirm("Delete all locally stored data? This cannot be undone.")) return
    await clearPersisted()
    window.location.reload()
  }

  async function refreshFromSystem() {
    const ok = await loadSystemData()
    if (ok) {
      setModels(getModels())
      window.location.reload()
    } else {
      alert("No Claude session logs found in ~/.claude/projects. Use “Load Claude data folder” to pick another location.")
    }
  }

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <PageHeader
        title="Settings"
        description="Theme, density, currency, and data controls."
      />

      <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2">
        <SectionCard title="Appearance" description="Theme mode">
          <div className="grid grid-cols-3 gap-2">
            {THEMES.map((t) => {
              const Icon = t.icon
              const active = theme === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTheme(t.id)}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-lg border p-3 text-sm transition-colors sm:p-4",
                    active
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-border text-muted-foreground hover:bg-muted",
                  )}
                >
                  <Icon className="size-5" />
                  {t.label}
                </button>
              )
            })}
          </div>

          <div className="mt-6">
            <p className="mb-2 text-sm font-medium">Accent color</p>
            <div className="flex flex-wrap gap-2">
              {ACCENTS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  title={a.label}
                  onClick={() => setAccent(a.id)}
                  className={cn(
                    "flex size-9 items-center justify-center rounded-full ring-2 ring-offset-2 ring-offset-background transition-all",
                    accent === a.id ? "ring-foreground" : "ring-transparent",
                  )}
                  style={{ backgroundColor: a.swatch }}
                >
                  {accent === a.id && (
                    <span className="size-2 rounded-full bg-white/90" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Compact density</p>
              <p className="text-xs text-muted-foreground">
                Tighter spacing for dense data.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant={!compact ? "default" : "outline"}
                size="sm"
                onClick={() => setDensity("comfortable")}
              >
                Comfortable
              </Button>
              <Button
                variant={compact ? "default" : "outline"}
                size="sm"
                onClick={() => setDensity("compact")}
              >
                Compact
              </Button>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Currency" description="Display unit for all costs">
          <Select value={currency} onValueChange={(v) => setCurrency(v as typeof currency)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <p className="mt-4 text-sm text-muted-foreground">
            Sample: a cost of 1,234.50 reads as{" "}
            <span className="font-medium text-foreground">{fmt(1234.5)}</span>.
          </p>

          <div className="mt-6 border-t border-border/60 pt-4">
            <p className="mb-1 text-sm font-medium">Data</p>
            <p className="mb-3 text-xs text-muted-foreground">
              Load real token usage from Claude Code session logs. Pick
              your <code className="rounded bg-muted px-1">~/.claude/projects</code>{" "}
              folder (or any folder with <code className="rounded bg-muted px-1">.jsonl</code>{" "}
              files). Works in Chromium browsers.
            </p>
            {!isEmpty() && (
              <p className="mb-3 text-xs text-muted-foreground">
                Loaded: <span className="font-medium text-foreground">{getProjects().length}</span>{" "}
                projects · <span className="font-medium text-foreground">{getTasks().length}</span>{" "}
                tasks · <span className="font-medium text-foreground">{getUsageEvents().length}</span>{" "}
                events
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button variant="default" size="sm" onClick={refreshFromSystem}>
                <Monitor className="size-3.5" /> Refresh from system
              </Button>
              <Button variant="outline" size="sm" onClick={loadFolder}>
                <Upload className="size-3.5" /> Load Claude data folder
              </Button>
              <Button variant="outline" size="sm" onClick={exportData}>
                <Download className="size-3.5" /> Export JSON
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => document.getElementById("import-file")?.click()}
              >
                <Upload className="size-3.5" /> Import JSON
              </Button>
              <input
                id="import-file"
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) importData(f)
                  e.target.value = ""
                }}
              />
            </div>
            {!isEmpty() && (
              <div className="mt-4 border-t border-border/60 pt-4">
                <p className="mb-2 text-sm font-medium">Reset</p>
                <p className="mb-3 text-xs text-muted-foreground">
                  Data is stored locally in your browser (SQLite via IndexedDB)
                  and survives refreshes. Clear it to start from scratch.
                </p>
                <Button variant="outline" size="sm" onClick={clearLocalData}>
                  Clear local data
                </Button>
              </div>
            )}
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Model cost rates"
        description="Per 1M tokens. Edits apply immediately and are saved to local storage."
      >
        <Card className="card-pad overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 text-xs text-muted-foreground">
                  <th className="px-3 py-2 text-left font-medium">Model</th>
                  <th className="px-3 py-2 text-right font-medium">Input / 1M</th>
                  <th className="px-3 py-2 text-right font-medium">Output / 1M</th>
                  <th className="px-3 py-2 text-right font-medium">Cached / 1M</th>
                </tr>
              </thead>
              <tbody>
                {models.map((m) => (
                  <tr key={m.id} className="border-b border-border/40 last:border-0">
                    <td className="px-3 py-2">
                      <p className="font-medium">{m.displayName}</p>
                      <p className="text-xs text-muted-foreground">
                        {m.provider}
                      </p>
                    </td>
                    {(
                      [
                        "inputCostPer1m",
                        "outputCostPer1m",
                        "cachedInputCostPer1m",
                      ] as const
                    ).map((field) => (
                      <td key={field} className="px-3 py-2">
                        <Input
                          type="number"
                          step="0.01"
                          value={m[field]}
                          onChange={(e) => patchModel(m.id, field, e.target.value)}
                          className="ml-auto w-28 text-right tabular-nums"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </SectionCard>
    </div>
  )
}

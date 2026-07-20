import { Link, useRouterState } from "@tanstack/react-router"
import {
  BellIcon,
  Boxes,
  FolderKanban,
  LayoutDashboard,
  ListChecks,
  MenuIcon,
  MessageSquare,
  MoonIcon,
  Settings,
  SunIcon,
  TrendingUp,
} from "lucide-react"
import * as React from "react"

import { cn } from "@/lib/utils"
import { useTheme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { getProjectById, getTasks, updateUser, useDataStore } from "@/data/db"
import { resolveSystemUserName } from "@/data/auto-load"
import { formatRelative } from "@/lib/format"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { CompactNumber } from "@/components/compact-number"
import { Sparkline } from "@/components/charts"
import { getDailyUsage, getUsageSummary } from "@/data/usage-queries"

// Real-time notifications: the most recent per-message tasks (each chat
// message is its own task). Subscribed to the store so it updates as new
// usage is ingested. Only the latest few are shown.
function useLatestMessageNotifications(limit = 3) {
  const dataStore = useDataStore()
  return React.useMemo(() => {
    return getTasks()
      .filter((t) => Boolean(t.parentTaskId))
      .sort((a, b) => {
        const at = a.completedAt ?? a.createdAt
        const bt = b.completedAt ?? b.createdAt
        return bt < at ? -1 : bt > at ? 1 : 0
      })
      .slice(0, limit)
      .map((t) => {
        const project = getProjectById(t.projectId)
        const when = t.completedAt ?? t.createdAt
        return {
          id: t.id,
          title: (t.userText?.trim() || t.title).slice(0, 120),
          description: project?.name ?? "Unknown project",
          time: formatRelative(when),
        }
      })
  }, [dataStore, limit])
}

const NAV_ITEMS = [
  { title: "Overview", to: "/", icon: LayoutDashboard },
  { title: "Projects", to: "/projects", icon: FolderKanban },
  { title: "Tasks", to: "/tasks", icon: ListChecks },
  {
    title: "Messages",
    to: "/tasks",
    icon: MessageSquare,
    search: { level: "messages" },
  },
  { title: "Models", to: "/models", icon: Boxes },
] as const

// Static avatar image for the current user (kept as a real `src` on the
// AvatarImage so it always renders an image, with initials as the fallback).
const AVATAR_SRC = "https://github.com/shadcn.png"

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const search = useRouterState({
    select: (state) => state.location.search,
  })

  return (
    <>
      {NAV_ITEMS.map((item) => {
        const onPath =
          item.to === "/"
            ? pathname === "/"
            : pathname === item.to || pathname.startsWith(`${item.to}/`)
        const wantMessages =
          "search" in item && item.search?.level === "messages"
        const matchesLevel = wantMessages
          ? search.level === "messages"
          : search.level !== "messages"
        const active = onPath && matchesLevel
        return (
          <Link
            key={item.title}
            to={item.to}
            search={("search" in item ? item.search : undefined) as never}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
            )}
          >
            <item.icon className="size-4" />
            <span>{item.title}</span>
          </Link>
        )
      })}
    </>
  )
}

// Floating, segmented nav pill for the desktop header. The active item gets a
// raised "chip" so the current screen reads at a glance without a hard border.
function DesktopNav() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const search = useRouterState({
    select: (state) => state.location.search,
  })

  return (
    <div className="flex items-center gap-1 rounded-full border border-border/50 bg-muted/40 p-1 shadow-sm backdrop-blur">
      {NAV_ITEMS.map((item) => {
        const onPath =
          item.to === "/"
            ? pathname === "/"
            : pathname === item.to || pathname.startsWith(`${item.to}/`)
        const wantMessages =
          "search" in item && item.search?.level === "messages"
        const matchesLevel = wantMessages
          ? search.level === "messages"
          : search.level !== "messages"
        const active = onPath && matchesLevel
        return (
          <Link
            key={item.title}
            to={item.to}
            search={("search" in item ? item.search : undefined) as never}
            className={cn(
              "flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all",
              active
                ? "bg-card text-foreground shadow-sm ring-1 ring-border/50"
                : "text-muted-foreground hover:bg-card/60 hover:text-foreground"
            )}
          >
            <item.icon className="size-4" />
            <span>{item.title}</span>
          </Link>
        )
      })}
    </div>
  )
}

export function HeaderLayout() {
  const { theme, setTheme } = useTheme()
  const notifications = useLatestMessageNotifications(3)
  const dataStore = useDataStore()
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false)
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })

  const resolvedTheme = theme === "system" ? "dark" : theme

  // The "current" user is the system user (id "u-you"). Derive it from the
  // live store so the avatar updates the moment real data is ingested —
  // freezing on the empty store captured at first render previously left the
  // header stuck on the "U"/"User" placeholder forever.
  const user = React.useMemo(
    () =>
      dataStore.users.find((u) => u.id === "u-you") ??
      dataStore.users[0] ??
      null,
    [dataStore]
  )

  // Keep the displayed name in sync with the real system account. If the
  // store's current user still carries the default "You" placeholder (e.g.
  // loaded before the name was resolved), resolve it from the OS and persist
  // it so the header reflects the actual logged-in user dynamically.
  React.useEffect(() => {
    if (!user || (user.name && user.name !== "You")) return
    let cancelled = false
    void resolveSystemUserName().then((name) => {
      if (cancelled || !name || !user) return
      const initials = name
        .split(" ")
        .map((p) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
      updateUser(user.id, {
        name,
        avatarUrl: `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(initials)}`,
      })
    })
    return () => {
      cancelled = true
    }
  }, [user])

  // Compute compact usage stats for the popover
  const usageData = React.useMemo(() => {
    const summary = getUsageSummary()
    const daily = getDailyUsage({}, 7)
    const sparkData = daily.map((d) => d.totalTokens)

    // Last activity: most recent event timestamp
    const tasks = getTasks()
    const latestTask = tasks
      .filter((t) => t.completedAt)
      .sort((a, b) =>
        (b.completedAt ?? b.createdAt) < (a.completedAt ?? a.createdAt) ? -1 : 0
      )[0]

    return {
      totalTokens: summary.totalTokens,
      estimatedCost: summary.estimatedCost,
      taskCount: summary.taskCount,
      activeUsers: summary.activeUsers,
      lastActivity: latestTask
        ? formatRelative(latestTask.completedAt ?? latestTask.createdAt)
        : "—",
      sparkData,
    }
  }, [dataStore])

  function initials(name: string): string {
    return name
      .split(" ")
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase()
  }

  return (
    <header className="sticky top-3 z-30 mx-3 flex h-14 shrink-0 items-center gap-3 rounded-xl border border-border/60 bg-card/70 px-3 shadow-lg shadow-black/5 backdrop-blur-xl md:top-4 md:mx-4 md:h-16 md:px-4">
      {/* Left: mobile menu + brand */}
      <div className="flex min-w-0 items-center gap-2.5">
        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="shrink-0 md:hidden"
              aria-label="Open menu"
            >
              <MenuIcon className="size-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <SheetHeader className="border-b">
              <SheetTitle>Menu</SheetTitle>
            </SheetHeader>
            <nav className="flex flex-col gap-1 p-3">
              <NavLinks onNavigate={() => setMobileNavOpen(false)} />
            </nav>
          </SheetContent>
        </Sheet>

        <Link
          to="/"
          className="flex shrink-0 items-center gap-2 font-semibold tracking-tight"
        >
          <span className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/70 text-xs font-bold text-primary-foreground shadow-sm ring-1 ring-inset ring-white/10">
            T
          </span>
          <span className="hidden text-sm sm:inline">Track Ai Tokens</span>
        </Link>
      </div>

      {/* Center: floating desktop nav pill */}
      <div className="hidden flex-1 items-center justify-center md:flex">
        <DesktopNav />
      </div>

      {/* Right: notifications + theme + avatar */}
      <div className="flex flex-1 items-center justify-end gap-1.5 md:flex-none">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="relative rounded-full"
              type="button"
              aria-label="Open notifications"
            >
              <BellIcon className="size-4" />
              {notifications.length > 0 && (
                <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-primary" />
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80" sideOffset={10}>
            <PopoverHeader>
              <PopoverTitle>Latest messages</PopoverTitle>
            </PopoverHeader>
            <Separator />
            {notifications.length === 0 ? (
              <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                No recent messages.
              </p>
            ) : (
              <div className="flex flex-col gap-1">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className="rounded-md px-2 py-2 transition-colors hover:bg-accent"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <p className="truncate text-sm font-medium">
                          {notification.title}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {notification.description}
                        </p>
                      </div>
                      <span className="shrink-0 text-2xs text-muted-foreground">
                        {notification.time}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </PopoverContent>
        </Popover>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="rounded-full"
              onClick={() =>
                setTheme(resolvedTheme === "dark" ? "light" : "dark")
              }
              aria-label={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} mode`}
            >
              {resolvedTheme === "dark" ? (
                <SunIcon className="size-4" />
              ) : (
                <MoonIcon className="size-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {resolvedTheme === "dark" ? "light" : "dark"} mode
          </TooltipContent>
        </Tooltip>

        {/* Avatar with usage popover */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              className="ml-1 cursor-pointer rounded-full outline-none ring-2 ring-transparent transition-all hover:ring-primary/40 hover:shadow-md focus-visible:ring-primary/50"
              aria-label="User menu"
            >
              <Avatar size="default">
                <AvatarImage src={AVATAR_SRC} alt={user?.name ?? "User"} />
                <AvatarFallback>
                  {user ? initials(user.name) : "U"}
                </AvatarFallback>
              </Avatar>
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0" sideOffset={10}>
            {/* User info header */}
            <div className="flex items-center gap-3 px-4 pt-4 pb-3">
              <Avatar size="lg">
                <AvatarImage src={AVATAR_SRC} alt={user?.name ?? "User"} />
                <AvatarFallback>
                  {user ? initials(user.name) : "U"}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {user?.name ?? "User"}
                </p>
                {user?.role && (
                  <p className="truncate text-xs text-muted-foreground">
                    {user.role}
                  </p>
                )}
              </div>
            </div>

            <Separator />

            {/* Token usage stats */}
            <div className="grid grid-cols-2 gap-px bg-border/40">
              <div className="flex flex-col gap-0.5 bg-card px-4 py-3">
                <span className="text-2xs font-medium text-muted-foreground">
                  Tokens
                </span>
                <span className="text-base font-semibold tabular-nums">
                  <CompactNumber value={usageData.totalTokens} />
                </span>
              </div>
              <div className="flex flex-col gap-0.5 bg-card px-4 py-3">
                <span className="text-2xs font-medium text-muted-foreground">
                  Cost
                </span>
                <span className="text-base font-semibold tabular-nums">
                  <CompactNumber
                    value={usageData.estimatedCost}
                    format="currency"
                  />
                </span>
              </div>
              <div className="flex flex-col gap-0.5 bg-card px-4 py-3">
                <span className="text-2xs font-medium text-muted-foreground">
                  Tasks
                </span>
                <span className="text-base font-semibold tabular-nums">
                  {usageData.taskCount}
                </span>
              </div>
              <div className="flex flex-col gap-0.5 bg-card px-4 py-3">
                <span className="text-2xs font-medium text-muted-foreground">
                  Users
                </span>
                <span className="text-base font-semibold tabular-nums">
                  {usageData.activeUsers}
                </span>
              </div>
            </div>

            {/* 7-day trend */}
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <TrendingUp className="size-3.5" />
                7-day trend
              </div>
              <Sparkline data={usageData.sparkData} width={80} height={20} />
            </div>

            {/* Last activity */}
            <div className="flex items-center justify-between border-t border-border/40 px-4 py-2.5">
              <span className="text-xs text-muted-foreground">
                Last activity
              </span>
              <span className="text-xs font-medium text-foreground">
                {usageData.lastActivity}
              </span>
            </div>

            <Separator />

            {/* Bottom actions */}
            <div className="flex items-center gap-1 p-2">
              <Link
                to="/settings"
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                  pathname === "/settings"
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <Settings className="size-3.5" />
                Settings
              </Link>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </header>
  )
}

import { Link, useRouterState } from "@tanstack/react-router"
import {
  Boxes,
  FolderKanban,
  LayoutDashboard,
  ListChecks,
  MessageSquare,
  PanelLeftClose,
  Settings,
  Users,
} from "lucide-react"
import * as React from "react"

import { getProjects, getUsers, subscribe } from "@/data/db"
import { getUsageSummary } from "@/data/usage-queries"
import { useCurrencyFormatter } from "@/components/settings-provider"
import { CompactNumber } from "@/components/compact-number"
import { formatNumber } from "@/lib/format"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"

const navigationItems = [
  { title: "Overview", to: "/", icon: LayoutDashboard },
  { title: "Projects", to: "/projects", icon: FolderKanban },
  { title: "Users", to: "/users", icon: Users },
  { title: "Tasks", to: "/tasks", icon: ListChecks },
  { title: "Messages", to: "/tasks", icon: MessageSquare, search: { level: "messages" } },
  { title: "Models", to: "/models", icon: Boxes },
  { title: "Settings", to: "/settings", icon: Settings },
] as const

export function Menulayout() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const search = useRouterState({
    select: (state) => state.location.search,
  })

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader className="h-16 justify-center rounded-t-xl border border-b-0 border-sidebar-border bg-sidebar px-3 py-0">
        <Link
          to="/"
          className="flex h-10 items-center gap-3 rounded-lg px-2 py-1 text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <div className="flex size-9 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
            <PanelLeftClose className="size-4" />
          </div>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-sm font-semibold">Workspace</p>
            <p className="truncate text-xs text-muted-foreground">
              Main navigation
            </p>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="border-x border-sidebar-border bg-sidebar">
        <SidebarGroup>
          <SidebarGroupLabel>Pages</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => {
                // Tasks and Messages share the /tasks route, so disambiguate by
                // the level search param: Messages is active only when
                // ?level=messages, Tasks otherwise.
                const onPath =
                  item.to === "/"
                    ? pathname === "/"
                    : pathname === item.to || pathname.startsWith(`${item.to}/`)
                const wantMessages = "search" in item && item.search?.level === "messages"
                const matchesLevel = wantMessages
                  ? search.level === "messages"
                  : search.level !== "messages"
                const isActive = onPath && matchesLevel

                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link
                        to={item.to}
                        search={("search" in item ? item.search : undefined) as never}
                      >
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="rounded-b-xl border border-t-0 border-sidebar-border bg-sidebar p-3">
        <WorkspaceSummary />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}

// Live workspace totals shown in the sidebar footer. Re-renders when a
// dataset is loaded so the numbers stay in sync with the data.
function WorkspaceSummary() {
  const fmt = useCurrencyFormatter()
  const [, force] = React.useState(0)
  React.useEffect(() => subscribe(() => force((n) => n + 1)), [])

  const projects = getProjects().length
  const users = getUsers().length
  const summary = getUsageSummary()

  return (
    <>
      <div className="group-data-[collapsible=icon]:hidden rounded-xl border border-sidebar-border bg-sidebar-accent/40 px-3 py-2.5">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Workspace
        </p>
        <p className="mt-0.5 text-sm font-medium text-sidebar-foreground">
          {formatNumber(projects)} projects · {formatNumber(users)} users
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div>
            <p className="text-[11px] text-muted-foreground">Tokens</p>
            <p className="text-sm font-semibold tabular-nums text-sidebar-foreground">
              <CompactNumber value={summary.totalTokens} />
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-muted-foreground">Cost</p>
            <p className="text-sm font-semibold tabular-nums text-sidebar-foreground">
              {fmt(summary.estimatedCost)}
            </p>
          </div>
        </div>
      </div>
      <div className="hidden size-9 items-center justify-center rounded-xl bg-sidebar-accent/40 text-sidebar-foreground group-data-[collapsible=icon]:flex">
        <Boxes className="size-4" />
      </div>
    </>
  )
}

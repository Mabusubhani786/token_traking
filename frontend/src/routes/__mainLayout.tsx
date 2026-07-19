import { createFileRoute, Outlet } from "@tanstack/react-router"
import * as React from "react"

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { subscribe } from "@/data/db"
import { loadSystemDataIfEmpty } from "@/data/auto-load"
import { HeaderLayout } from "@/layout/HeaderLayout"
import { Menulayout } from "@/layout/Menulayout"

export const Route = createFileRoute("/__mainLayout")({
  component: RouteComponent,
})

function RouteComponent() {
  // Load real system data once on mount so every screen reflects live token
  // usage immediately. Re-render the tree when a dataset is loaded.
  React.useEffect(() => {
    loadSystemDataIfEmpty()
  }, [])
  const [, forceRender] = React.useState(0)
  React.useEffect(() => subscribe(() => forceRender((n) => n + 1)), [])

  return (
    <SidebarProvider className="h-dvh overflow-hidden">
      <Menulayout />
      <SidebarInset className="h-dvh overflow-hidden">
        <HeaderLayout />
        <main className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
            <div className="mx-auto w-full max-w-[1500px] p-4 md:p-6">
              <Outlet />
            </div>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

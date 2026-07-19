import { createFileRoute, Outlet } from "@tanstack/react-router"
import * as React from "react"

import { subscribe } from "@/data/db"
import { loadSystemDataIfEmpty } from "@/data/auto-load"
import { HeaderLayout } from "@/layout/HeaderLayout"

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
    <div className="flex h-dvh flex-col overflow-hidden">
      <HeaderLayout />
      <main className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          <div className="mx-auto w-full max-w-[1500px] px-3 py-4 sm:px-4 sm:py-5 md:px-6 md:py-6">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  )
}

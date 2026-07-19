import { createFileRoute, Outlet } from "@tanstack/react-router"

export const Route = createFileRoute("/__mainLayout/users")({
  component: UsersLayout,
})

function UsersLayout() {
  return <Outlet />
}

import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/__mainLayout/about')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/__mainLayout/about"!</div>
}

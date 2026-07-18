import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/__mainLayout/setting')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/__mainLayout/setting"!</div>
}

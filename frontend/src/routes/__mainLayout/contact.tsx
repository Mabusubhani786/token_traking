import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/__mainLayout/contact')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/__mainLayout/contact"!</div>
}

import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/__authLayout')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/__authLayout"!</div>
}

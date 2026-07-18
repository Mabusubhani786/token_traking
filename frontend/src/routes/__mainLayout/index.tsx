import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/__mainLayout/')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-semibold text-slate-900">Welcome</h1>
      <p className="mt-3 text-slate-600">Pick a menu item to navigate: Home, About, Contact, or Setting.</p>
    </div>
  )
}

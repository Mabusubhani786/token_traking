# CLAUDE.md

## Role

Act as a senior frontend/product engineer for this repository. Build a modern token tracking application that feels fast, polished, and practical for daily use. Make conservative technical choices, follow the existing React + TypeScript + shadcn/ui structure, and keep the product experience smooth across desktop and mobile.

## Product Goal

Create an application for tracking AI model token usage across:

- Individual tasks
- Individual users
- Whole project users
- Models used per task
- Daily usage
- Hourly usage
- Project-level totals
- User-level totals

The app should help users understand where tokens are being spent, which models cost the most, how usage changes over time, and which tasks or users drive the highest consumption.

## Tech Stack

Use the existing frontend stack (React + TypeScript + Vite + TanStack Router + shadcn/ui + Tailwind + lucide-react; exact versions in `package.json`).

Prefer local-first behavior. The frontend should be able to read usage data from SQLite-backed APIs or a local bridge layer, depending on the runtime available in the project. Keep SQLite access behind a clean data-access module so UI components never query storage directly.

## Core Entities

Design the product around these concepts:

- `Project`: a workspace or product being tracked.
- `User`: a person generating token usage.
- `Task`: a unit of work, prompt, ticket, feature, chat, or workflow.
- `Model`: the AI model used for the task.
- `UsageEvent`: one tracked interaction or aggregated usage record.
- `CostRate`: pricing metadata for a model.

The SQLite schema (projects, users, models, tasks, usage_events, with reporting indexes) is implemented in `src/data/persist.ts` — read that for canonical column definitions.

## Required Screens

Build the app as an actual working dashboard, not a marketing page.

### Overview

Show executive-level usage:

- Total tokens
- Input tokens
- Output tokens
- Cached input tokens
- Estimated cost
- Active projects
- Active users
- Task count
- Most used model
- Daily trend
- Hourly heatmap
- Top users
- Top tasks
- Top models

### Projects

Show project-level token usage:

- Project table with total tokens, cost, users, tasks, and last activity
- Project detail view
- Per-day and per-hour breakdown
- Model split per project
- User split per project

### Users

Show user-level analytics:

- User list with token totals and cost
- Usage by day and hour
- Model preference
- Task contribution
- Project contribution

### Tasks

Show task-level tracking:

- Task list with project, user, model, tokens, cost, status, and time
- Task detail with event timeline
- Filters for status, project, user, model, date range, and tags

### Models

Show model usage and cost:

- Model list by provider
- Token and cost totals
- Input vs output split
- Cached token usage
- Cost trend over time

### Settings

Provide practical controls:

- Theme mode: light, dark, system
- Accent color picker
- Density preference: comfortable, compact
- Currency display
- Model cost rates
- Data import/export entry points

## UI/UX Direction

Create a modern, rich, smooth dashboard UI:

- Use a real application shell with sidebar navigation and a compact top bar.
- Keep information dense but readable.
- Use cards only for individual metrics, repeated items, modals, and bounded tools.
- Avoid nested cards and decorative clutter.
- Make tables scannable with sticky headers, clear numeric alignment, and useful empty states.
- Use charts for trends, heatmaps, and comparisons.
- Use lucide icons for navigation, actions, and metric context.
- Use shadcn/ui primitives for buttons, inputs, popovers, sheets, tooltips, tabs, and dialogs.
- Use Aceternity-style effects sparingly: subtle motion, refined hover states, soft borders, and depth. Do not make the product feel like a landing page.
- Do not rely on huge hero sections. The dashboard is the first screen.
- Ensure all text fits on mobile and desktop.
- Use responsive layouts with stable dimensions for metric cards, tables, filters, and chart panels.

## Theme System

Support light, dark, and system modes.

Support user-selectable accent colors. Store the selected accent in local settings and apply it through CSS variables. The theme should feel professional in every color, with accessible foreground/background contrast.

Suggested accents:

- Blue
- Emerald
- Violet
- Rose
- Amber
- Slate

Avoid a one-note color palette. Use neutral surfaces for structure and accents for emphasis. Dark mode must not be only black panels; use layered surfaces, borders, and muted text carefully.

## Data Experience

The frontend should make SQLite-backed data feel instant:

- Keep database access outside UI components.
- Create typed query functions for dashboard summaries and charts.
- Use memoized derived values for chart/table transforms.
- Avoid expensive recalculation during render.
- Paginate or virtualize large tables.
- Debounce search and filter controls.
- Show skeleton states while loading.
- Provide graceful empty states with clear next actions.
- Handle missing or partial token data without breaking the UI.

## Data Access

The data layer lives under `src/data` (`db.ts`, `usage-queries.ts`, `usage-types.ts`, `persist.ts`, ingestion) with feature modules under `src/features/{dashboard,projects,users,tasks,models,settings}`. Add new query functions there rather than querying storage from components.

## Routing

Use TanStack Router route files consistently with the existing `src/routes` structure. Keep route components light; put complex UI in feature components and data logic in data modules.

## Performance Requirements

No performance issues should be introduced.

- Use `React.memo` only where it measurably helps repeated heavy components.
- Use `useMemo` for expensive aggregations and chart transforms.
- Do not build giant computed arrays inside JSX.
- Keep chart datasets bounded by selected date range.
- Use virtualization for long tables if row counts can grow large.
- Avoid layout shift in cards, tables, and charts.
- Prefer CSS transitions for small UI motion.
- Keep animations subtle and interruptible.
- Do not block the main thread with large synchronous parsing.

## Accessibility

The app must be usable with keyboard and screen readers:

- Use semantic buttons, links, labels, and headings.
- Provide visible focus states.
- Use tooltip text for icon-only controls.
- Ensure color is not the only signal for status.
- Keep chart values available in nearby labels, legends, or tables.
- Use accessible contrast in light and dark themes.

## Code Standards

- Use shadcn/ui components before creating new primitives.
- Use lucide icons instead of custom inline SVGs when possible.
- Keep naming clear: `TokenSummaryCard`, `UsageTrendChart`, `ProjectUsageTable`, `ModelCostBreakdown`.
- Do not mix storage, aggregation, and presentation in a single component.
- Do not add unrelated refactors while implementing a feature.

## Testing And Verification

Before considering work complete:

- Manually inspect the dashboard in light and dark mode.
- Check mobile and desktop layouts.
- Verify filtering by project, user, model, task, and date range.
- Verify hourly and daily aggregations.
- Verify token and cost math.

## Definition Of Done

A feature is complete when:

- The UI is implemented and responsive.
- Data is loaded through typed query/service functions.
- Empty, loading, and error states are handled.
- Light, dark, and accent color themes work.
- Large data sets do not make the UI sluggish.
- Typecheck, lint, and build pass.
- The result feels like a polished token analytics product, not a template.

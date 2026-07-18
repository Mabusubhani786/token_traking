# CLAUDE.md

## Project

**Token Traking** — a local-first web app for tracking AI model token usage across
tasks, users, projects, and models. The goal is to help users see where tokens
(and cost) are being spent, which models are most expensive, and how usage
changes over time.

This repository is currently a single-app workspace:

- `frontend/` — the React + TypeScript + Vite application (the product).

## Repository Layout

```
token_traking/
├── CLAUDE.md          # this file (project-level)
└── frontend/          # the app — see frontend/CLAUDE.md for the full spec
    ├── CLAUDE.md      # detailed product, entities, screens, and standards
    ├── src/
    ├── index.html
    ├── package.json
    └── vite.config.ts
```

The detailed product spec, data model, required screens, UI/UX direction, and
code standards live in [`frontend/CLAUDE.md`](frontend/CLAUDE.md). Read that
before implementing frontend work — this root file only frames the project.

## Working in This Repo

- All application code, features, and UI live under `frontend/`.
- Follow the standards in `frontend/CLAUDE.md` for anything inside `frontend/`.
- Prefer local-first behavior; persistence is SQLite behind a clean data-access
  module (UI never queries storage directly).

## Frontend Commands

Run these from inside `frontend/`:

```bash
cd frontend
npm install        # install dependencies
npm run dev        # start the Vite dev server
npm run build      # type-check + production build
npm run preview    # preview the production build
npm run typecheck  # tsc --noEmit
npm run lint       # eslint .
npm run format     # prettier --write "**/*.{ts,tsx}"
```

## Tech Stack (frontend)

React 19 · TypeScript · Vite · TanStack Router · shadcn/ui · Tailwind CSS ·
lucide-react · SQLite (local persistence).

## Definition of Done (summary)

A change is done when the UI is responsive, data flows through typed
query/service functions, loading/empty/error states are handled, light + dark +
accent themes work, large data sets stay smooth, and `typecheck`, `lint`, and
`build` all pass. See `frontend/CLAUDE.md` for the full checklist.

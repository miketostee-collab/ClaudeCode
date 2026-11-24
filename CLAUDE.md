# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projects

- `workout-tracker/` – phone workout logging PWA. React 19 + TypeScript + Vite, data in IndexedDB via Dexie, no backend. See `workout-tracker/README.md`.

## Commands (run inside `workout-tracker/`)

- `npm install` – install dependencies
- `npm run dev` – dev server
- `npm test` – unit tests (Vitest + fake-indexeddb); single file: `npx vitest run src/db.test.ts`
- `npm run typecheck` – TypeScript
- `npm run build` – production build to `dist/`

## Architecture notes

- All persistence goes through `src/db.ts`; screens never touch Dexie tables directly except via `useLiveQuery` around those helpers.
- An entry's `date` is the phone's local day (YYYY-MM-DD) and `timestamp` is the exact save time; "most recent" is ordered by `[exerciseId+timestamp]`.
- Each entry stores its own unit (lb/kg); the unit setting only affects new entries and pre-fill.
- Vite `base` is `./` so the build works under any GitHub Pages sub-path. The service worker in `public/sw.js` is hand-written (no plugin).
- CI/deploy: `.github/workflows/workout-tracker.yml`.

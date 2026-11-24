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
- An entry holds a `sets` list (`{ weight, reps }` per set) and its own unit (kg default, lb optional); the unit setting only affects new entries and pre-fill. Dexie schema v2 upgrades v1 entries (single weight/reps × N sets) and `importData` accepts v1 backups. Bump the Dexie version with an upgrade function for any future shape change.
- Workouts (`workouts` table, Dexie v3): one per local day (`&date`), holding an ordered `exerciseIds` list. Entries logged in a workout carry `workoutId`; `saveWorkoutEntry` keeps one entry per exercise per workout. Removing an exercise from a workout deletes its entry there. Backups are version 3 and include workouts; older backups import with none. `repeatWorkout` copies a workout's name/exercises/order and sets `copiedFrom`; `getStartingEntry` pre-fills each exercise from that source workout's entry (same set count), falling back to the last entry.
- Vite `base` is `./` so the build works under any GitHub Pages sub-path. The service worker in `public/sw.js` is hand-written (no plugin).
- CI/deploy: `.github/workflows/workout-tracker.yml`.

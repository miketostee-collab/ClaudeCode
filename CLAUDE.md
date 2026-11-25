# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projects

- `workout-tracker/` – phone workout logging PWA. React 19 + TypeScript + Vite, data in IndexedDB via Dexie, optional sync to Supabase with Google sign-in. See `workout-tracker/README.md` and `workout-tracker/SYNC_SETUP.md`.

## Commands (run inside `workout-tracker/`)

- `npm install` – install dependencies
- `npm run dev` – dev server
- `npm test` – unit tests (Vitest + fake-indexeddb); single file: `npx vitest run src/db.test.ts` (`src/sync.test.ts` simulates two devices against an in-memory server)
- `npm run typecheck` – TypeScript
- `npm run build` – production build to `dist/`

## Architecture notes

- All persistence goes through `src/db.ts`; screens never touch Dexie tables directly except via `useLiveQuery` around those helpers.
- An entry's `date` is the phone's local day (YYYY-MM-DD) and `timestamp` is the save time; "most recent" is ordered by `[exerciseId+timestamp]`. Past days can be logged and edited (no future days, `checkDay`): `timestampForDay` stamps a past day at exactly 12:00 local so ordering follows the day (the UI hides that placeholder time). `updateEntry` can move a quick-log entry's day; `updateWorkout({ date })` moves a workout and its entries; when filling a past workout, pre-fill only looks at entries on or before its day.
- An entry is one "max set": `weight` and `reps` (the heaviest set), plus its own unit (kg default, lb optional); the unit setting only affects new entries and pre-fill. Dexie v6 switched from a `sets` list to this and cleared all old entries and workouts (exercises kept), recording each delete so sync clears them from the account too; sync stores the max set in the server's `sets` jsonb column as a one-item list and ignores rows with more than one. Bump the Dexie version with an upgrade function for any future shape change.
- Workouts (`workouts` table, Dexie v3): one per local day (enforced by `createWorkout`; sync merges same-day duplicates), holding an ordered `exerciseIds` list. Entries logged in a workout carry `workoutId`; `saveWorkoutEntry` keeps one entry per exercise per workout. Removing an exercise from a workout deletes its entry there. Backups are version 5 (max set, string ids) and include workouts; older backups (multi-set) are refused. `repeatWorkout` copies a workout's name/exercises/order and sets `copiedFrom`; `getStartingEntry` pre-fills each exercise's max set from that source workout's entry, falling back to the last entry. `repeatWorkout(..., replace=true)` swaps out an existing workout for that day (used by "Repeat a previous workout instead" and "Repeat today" on Previous).
- Ids are strings unique across devices (Dexie v4 copied the old number-id tables to `exercises_u`/`workouts_u`/`entries_u`, v5 dropped the old ones; the class maps them back to `exercises`/`workouts`/`entries`). Built-in exercises have fixed ids `default:<slug>` (`defaultExerciseId`) and are seeded with `updatedAt: 0, dirty: 0`. New rows use `newId()`.
- Change tracking: Dexie hooks set `updatedAt`/`dirty: 1` on every write and record deletes in `pendingDeletes`, unless the transaction is marked with `untracked(tx)` (sync's own writes, seeding). Transactions that delete should include `database.all` so the delete record is atomic. Names and workout dates are not unique indexes any more (a duplicate can arrive from another device until sync merges it).
- Sync (`src/sync.ts`, against the `Remote` interface): pull entries, workouts, exercises (children first) since a per-table cursor; newer `client_updated_at` wins; tombstones (`deleted_at`) delete; then `mergeDuplicates` (exercises by name keeping `default:` or smallest id, workouts by date keeping smallest id, one entry per exercise per workout keeping newest); then upload deletes and dirty rows. Server schema: `supabase/schema.sql`, keyed `(user_id, id)` with RLS. Sync only exists when `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` are set at build (GitHub repo variables `SUPABASE_URL`/`SUPABASE_ANON_KEY`); supabase-js is loaded lazily. Any new synced field needs the Dexie upgrade, the schema column and the `toRemote`/`fromRemote` mapping.
- Exercise reference guide: `src/exerciseGuide.ts` holds `GUIDES` (summary, equipment, primary/secondary muscles, steps, tips) for every name in `DEFAULT_EXERCISES`; `guideFor` looks up by fixed `default:` id (so renames keep the guide) or by name. Static app data, not stored or synced. Add a guide when adding a default exercise (a test checks they match).
- Vite `base` is `./` so the build works under any GitHub Pages sub-path. The service worker in `public/sw.js` is hand-written (no plugin).
- CI/deploy: `.github/workflows/workout-tracker.yml`.

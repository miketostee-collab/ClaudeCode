# Workout Tracker

A phone-first web app for logging your max set (heaviest weight and its reps) per exercise per day.
For each exercise you record one **max set**: the heaviest weight you lifted and how many reps. Pick an exercise, see last time's max set, and save today's. Weights default to kg.

**Workouts** group the day's exercises: pick today's exercises, or tap **Repeat** on a previous workout to copy its exercises with that day's max weight and reps pre-filled, fill in each one's max set, edit the workout during the day, and browse previous workouts. **Exercises** is also a reference guide: tap one to see what it is, the muscles it works, step-by-step how to do it, tips, and your last and best max set. **Quick log** records a single exercise outside a workout. Both work for past days too: pick the day with the arrows or date on the Workout tab (or **Edit** on a previous workout), or set the date in Quick log; History can move a quick-log entry to another day. **History** opens with a bar chart of the selected exercise: weight (left axis) and reps (right axis) for each of the last 12 days logged, using the heaviest set of each day in your current unit. Each axis starts just below your lowest number (not at zero) so changes stand out; tap a day to see its numbers.

It is a PWA: open it in your phone's browser and use **Add to Home Screen** to install it.
It then opens full screen and works offline. Data is kept on the phone (IndexedDB) and the app
works fully without an account. Optionally, **Settings > Sign in with Google** syncs it across
devices through Supabase once that is set up: see [SYNC_SETUP.md](SYNC_SETUP.md).
**Settings > Export backup** still saves a file copy.

## Commands

```sh
npm install
npm run dev        # local dev server (add --host to open it from your phone on the same Wi-Fi)
npm test           # unit tests (Vitest, fake IndexedDB)
npm run typecheck  # TypeScript
npm run build      # production build to dist/
npm run preview    # serve the production build
```

`node scripts/make-icons.cjs` regenerates the PNG icons from `public/icon.svg` (needs Playwright).

## Structure

- `src/db.ts` – data model and all reads/writes (Dexie over IndexedDB): exercises, workouts, entries, change tracking, backup export/import.
- `src/sync.ts` – two-way sync engine (download, apply, merge duplicates, upload); `src/remote.ts` Supabase calls; `src/account.ts` Google sign-in and when to sync.
- `supabase/schema.sql` – server tables and row-level security.
- `src/prefs.ts` – per-device preferences (unit, last selected exercise) and formatting helpers.
- `src/screens/` – Workout (today / previous), Quick log, History, Exercises, Settings screens plus shared picker/stepper.
- `public/sw.js` – hand-written service worker for offline use; `public/manifest.webmanifest` for install.

## Deploying

`.github/workflows/workout-tracker.yml` tests and builds on every push/PR touching this folder,
and deploys `dist/` to GitHub Pages from the default branch. Enable it once under
repo **Settings > Pages > Source: GitHub Actions**.

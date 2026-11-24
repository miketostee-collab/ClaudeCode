# Workout Tracker

A phone-first web app for logging weight, reps and sets per exercise per day.
Pick an exercise from the dropdown, see each set you did last time, and save today's sets (each with its own weight and reps). Weights default to kg.

**Workouts** group the day's exercises: pick today's exercises, or tap **Repeat** on a previous workout to copy its exercises and sets with that day's weights and reps pre-filled, fill in each one's sets, edit the workout during the day, and browse previous workouts. **Quick log** records a single exercise outside a workout.

It is a PWA: open it in your phone's browser and use **Add to Home Screen** to install it.
It then opens full screen and works offline. All data stays on the phone (IndexedDB);
use **Settings > Export backup** now and then.

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

- `src/db.ts` – data model and all reads/writes (Dexie over IndexedDB): exercises, entries, backup export/import.
- `src/prefs.ts` – per-device preferences (unit, last selected exercise) and formatting helpers.
- `src/screens/` – Workout (today / previous), Quick log, History, Exercises, Settings screens plus shared picker/stepper.
- `public/sw.js` – hand-written service worker for offline use; `public/manifest.webmanifest` for install.

## Deploying

`.github/workflows/workout-tracker.yml` tests and builds on every push/PR touching this folder,
and deploys `dist/` to GitHub Pages from the default branch. Enable it once under
repo **Settings > Pages > Source: GitHub Actions**.

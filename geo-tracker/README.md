# Geo Tracker

A phone-first PWA for recording geological observations: each one saved with a GPS position, a type
(outcrop, sample, structure, note), rock type, strike/dip, sample number, formation, description and notes.
Data lives on the device (IndexedDB, works offline) and syncs to your own Supabase project so the same
observations are on your iPhone and your laptop.

## What it does

- **Record** – shows the live GPS fix with its accuracy (green ≤ 10 m, amber ≤ 30 m, red worse). **Record here** saves the
  position together with the form. It records only when you press the button; it does not track continuously.
- **Map** – your observations on an OpenStreetMap map (Leaflet, loaded only when opened), filterable by project.
- **List** – grouped by day; search by rock, formation, sample or notes; filter by project and type; tap to edit or delete.
- **Settings** – Google sign-in and sync, projects, export (GeoJSON, GPX, CSV) and JSON backup/restore.

## Run it

```
npm install
npm run dev        # http://localhost:5173
npm test           # Vitest + fake-indexeddb (db, sync between two devices, export, GPS formatting)
npm run typecheck
npm run build && npm run preview
```

Sync needs `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` at build time; without them the app is device-only.
Setup steps: [`SYNC_SETUP.md`](SYNC_SETUP.md).

## iPhone notes

- Open the site in Safari, Share > **Add to Home Screen**, then open it from the home screen and allow location.
- A web app can read GPS only while it is open with the screen on. iOS suspends it otherwise, so continuous background
  tracking is not possible without a native app. This is why the app captures one fix per recorded observation.
- Safari can clear a web app's local data if the app is unused for a long time. Sign in and sync (or export a backup) so
  your account holds the real copy.
- Maps need a connection. Recording works offline.

## Hosting

`.github/workflows/pages.yml` publishes this app together with the workout tracker as one GitHub Pages site, only from the
default branch: the workout tracker stays at https://miketostee-collab.github.io/ClaudeCode/ and this app is at
**https://miketostee-collab.github.io/ClaudeCode/geo-tracker/** (HTTPS, which GPS needs). One-time setup: repo **Settings > Pages >
Source: GitHub Actions**. `geo-tracker.yml` runs the typecheck, tests and build on every push and pull request.

Because both apps share one origin, their service workers, IndexedDB databases and localStorage keys are kept separate
(the workout tracker's service worker skips `./geo-tracker/`).

## Not built yet

Continuous track recording, photos, offline map tiles, and custom fields. The `observations` row has a fixed set of
columns; adding a field means a Dexie version bump with an upgrade, a column in `supabase/schema.sql`, and the
`toRemote`/`fromRemote` mapping in `src/sync.ts`.

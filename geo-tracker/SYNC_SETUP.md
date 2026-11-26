# Turning on sync (new Supabase project + Google sign-in)

Sync is optional. Until these steps are done the app works on one device with no sign-in button. After them,
**Settings** shows **Sign in with Google**, and signing in on your phone and laptop keeps them in step. About 15 minutes,
all on free tiers. This uses its **own** Supabase project, separate from the workout tracker's.

## 1. Create the Supabase project

1. At <https://supabase.com> create a **New project** (e.g. `geo-tracker`, nearest region). Save the database password; the app doesn't need it.
2. **SQL Editor > New query**, paste all of [`supabase/schema.sql`](supabase/schema.sql), **Run**. It should say "Success. No rows returned".

## 2. Create a Google sign-in client

1. In Supabase open **Authentication > Sign In / Providers > Google** and copy the **Callback URL** (`https://<project>.supabase.co/auth/v1/callback`).
2. At <https://console.cloud.google.com> create a project (or reuse one), then **APIs & Services > OAuth consent screen**: External, app name and your email; add your Google address as a test user or publish the app.
3. **Credentials > Create credentials > OAuth client ID**, type **Web application**, with the Callback URL as an **Authorized redirect URI**. Copy the Client ID and secret.
4. Back in Supabase, turn Google **on** and paste the Client ID and secret.

## 3. Tell Supabase where the app lives

**Authentication > URL Configuration**: set **Site URL** to `https://miketostee-collab.github.io/ClaudeCode/geo-tracker/` and add the same address
(and `http://localhost:5173/` for local use) under **Redirect URLs**. Keep the trailing slash.

## 4. Give the build the project's address

From **Project Settings > API** copy the **Project URL** and the **anon / publishable key**. The anon key is meant to be public:
row-level security in the schema stops anyone reading rows that aren't theirs. Never use the `service_role` key.

For GitHub builds add two repository variables (**Settings > Secrets and variables > Actions > Variables**):
`GEO_SUPABASE_URL` and `GEO_SUPABASE_ANON_KEY` (different names from the workout tracker's, since this is a different project).
For a local build put them in `geo-tracker/.env.local` as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

## 5. Sign in

Open the app, **Settings > Sign in with Google**. Whatever is on the device uploads; sign in on the other device and its data
merges in. Sync runs when the app opens or comes to the front, a few seconds after each change, when you come back online,
and from **Sync now**. **Sign out** keeps local data.

- **iPhone installed app:** if Google sign-in doesn't return to the home-screen app signed in, sign in once from Safari, or re-add the app after signing in (an iOS limitation for home-screen apps).

## How it works (for later changes)

- Rows (`projects`, `observations`) have UUID ids made on the device, plus `updatedAt` and `dirty`, set by the hooks in `src/db.ts`. Deletes go to `pendingDeletes`.
- `src/sync.ts` downloads rows changed since the last sync (newer change wins; deletes are tombstones), then uploads deletes and changed rows. `src/remote.ts` talks to Supabase; `src/account.ts` handles sign-in and when to sync.
- If a project is deleted on one device while another records into it, the stray observations lose their project link after the next sync.

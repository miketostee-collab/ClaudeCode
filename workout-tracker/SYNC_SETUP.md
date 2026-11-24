# Turning on sync (Supabase + Google sign-in)

Sync is optional. Until these steps are done, the app works exactly as before, on one phone,
with no sign-in button. After them, **Settings** shows **Sign in with Google**; signing in on
two devices keeps their workouts in step. Takes about 15 minutes. Everything here is free tier.

## 1. Create the Supabase project

1. Go to <https://supabase.com>, sign up, and create a **New project** (any name, e.g. `workout-tracker`; pick the region closest to you; save the database password somewhere, though the app doesn't need it).
2. When it's ready, open **SQL Editor > New query**, paste the whole of [`supabase/schema.sql`](supabase/schema.sql), and press **Run**. It should say "Success. No rows returned".

## 2. Create a Google sign-in client

1. In Supabase open **Authentication > Sign In / Providers > Google** and copy the **Callback URL** shown there (it looks like `https://<your-project>.supabase.co/auth/v1/callback`). Keep this tab open.
2. Go to <https://console.cloud.google.com>, create a project (any name).
3. **APIs & Services > OAuth consent screen** (may be called "Google Auth Platform"): choose **External**, enter an app name and your email, save. Under **Audience**, either add your Google address as a **test user** or press **Publish app**.
4. **APIs & Services > Credentials > Create credentials > OAuth client ID**: type **Web application**. Under **Authorized redirect URIs** add the Callback URL from step 1. Create, then copy the **Client ID** and **Client secret**.
5. Back in Supabase (the Google provider page), turn Google **on**, paste the Client ID and Client secret, and **Save**.

## 3. Tell Supabase where the app lives

**Authentication > URL Configuration**:

- **Site URL**: `https://miketostee-collab.github.io/ClaudeCode/`
- **Redirect URLs**: add `https://miketostee-collab.github.io/ClaudeCode/` (and `http://localhost:5173/` if you run it locally).

## 4. Give the app the project's address

1. In Supabase open **Project Settings > API** (or **Connect**) and copy the **Project URL** and the **anon / publishable key**. This key is meant to be public: it ships inside the app, and the row-level security in the schema stops anyone reading data that isn't theirs. Never use the `service_role` / secret key here.
2. In GitHub open the repo's **Settings > Secrets and variables > Actions > Variables** tab and add two **repository variables**:
   - `SUPABASE_URL` = the Project URL
   - `SUPABASE_ANON_KEY` = the anon / publishable key
3. Rebuild the live app: **Actions > Workout Tracker > Run workflow** on the default branch (or merge any change).

## 5. Sign in

On your phone open the app, go to **Settings**, and tap **Sign in with Google**. Whatever is already on the phone is uploaded. Then sign in on your other device; its data is merged in (same exercises are matched by name, and two workouts on the same day become one).

- **Sign out** keeps the data on that device; it just stops syncing.
- Sync runs when the app opens or comes to the front, a few seconds after each change, when you come back online, and from **Sync now**.
- **iPhone, installed app:** if Google sign-in opens and then doesn't return to the installed app signed in, sign in once from Safari instead, or remove and re-add the home-screen app after signing in. This is an iOS limitation with home-screen apps.

## How it works (for later changes)

- Every row has a string id made on the device (UUID, or `default:<name>` for built-in exercises), plus `updatedAt` and `dirty`. Change-tracking hooks in `src/db.ts` set those; deletes go to `pendingDeletes`.
- `src/sync.ts` downloads rows changed since the last sync, applies them (newer change wins; deletes are tombstones), merges duplicates, then uploads deletes and changed rows. `src/remote.ts` talks to Supabase; `src/account.ts` handles sign-in and when to sync.
- Server tables are in `supabase/schema.sql`. Changing a field means: Dexie version bump with an upgrade, the column in the schema, and the mapping in `sync.ts`.

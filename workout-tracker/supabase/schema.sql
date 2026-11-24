-- Workout Tracker: server tables for cross-device sync.
-- Run once in the Supabase dashboard: SQL Editor > New query > paste this file > Run.
-- Safe to run again.
--
-- Every row belongs to the signed-in user (user_id) and row level security makes sure
-- each person can only ever read or write their own rows. Ids are made on the phone
-- (random UUIDs, or "default:<name>" for built-in exercises), so the key is (user_id, id).
-- Deletes are kept as tombstones (deleted_at set) so other devices learn about them.

create table if not exists public.exercises (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  name text,
  client_updated_at bigint not null default 0,
  updated_at timestamptz not null default clock_timestamp(),
  deleted_at timestamptz,
  primary key (user_id, id)
);

create table if not exists public.workouts (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  date text,
  name text,
  exercise_ids jsonb,
  created_at bigint,
  copied_from text,
  client_updated_at bigint not null default 0,
  updated_at timestamptz not null default clock_timestamp(),
  deleted_at timestamptz,
  primary key (user_id, id)
);

create table if not exists public.entries (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  exercise_id text,
  workout_id text,
  date text,
  logged_at bigint,
  unit text,
  sets jsonb,
  notes text,
  client_updated_at bigint not null default 0,
  updated_at timestamptz not null default clock_timestamp(),
  deleted_at timestamptz,
  primary key (user_id, id)
);

-- updated_at is always the server's clock at write time; the app downloads rows
-- changed since the last updated_at it saw.
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['exercises', 'workouts', 'entries'] loop
    execute format('drop trigger if exists touch_updated_at on public.%I', t);
    execute format(
      'create trigger touch_updated_at before insert or update on public.%I
         for each row execute function public.touch_updated_at()', t);
    execute format('create index if not exists %I on public.%I (user_id, updated_at)', t || '_changes', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated
         using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
  end loop;
end $$;

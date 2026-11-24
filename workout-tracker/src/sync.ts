import {
  type Entry,
  type Exercise,
  type PendingDelete,
  type SyncedTable,
  type Workout,
  type WorkoutDB,
  untracked,
} from './db';

/**
 * Two-way sync between this device's database and the server.
 *
 * Every row has a string id that is unique across devices, an `updatedAt` time and a
 * `dirty` flag (set by the change-tracking hooks in db.ts). Deletes are recorded in
 * `pendingDeletes` and uploaded as tombstones (`deleted_at` set) so other devices learn
 * about them. Conflicts on the same row: the newer change wins.
 *
 * Because two devices can each create "Bench Press", or each start a workout for the same
 * day, before they first sync, duplicates are merged after every download: exercises by
 * name, workouts by day, and a workout's entries by exercise. The choice of which copy to
 * keep is the same on every device, so they all converge.
 */

/** A row as stored on the server. Column names are snake_case. */
export interface RemoteRow {
  id: string;
  /** The device's `updatedAt` for this change, ms since epoch. Used to pick the newer change. */
  client_updated_at: number;
  /** Server time of the last write (ISO string). Used to download only what changed. */
  updated_at?: string;
  deleted_at: string | null;
  [column: string]: unknown;
}

/** The server, as seen by the sync engine. Implemented with Supabase in remote.ts and in memory in tests. */
export interface Remote {
  /** The signed-in user's id, or null when signed out. */
  userId(): Promise<string | null>;
  /** All of the user's rows in a table written at or after `since` (everything when null), oldest first. */
  pull(table: SyncedTable, since: string | null): Promise<RemoteRow[]>;
  /** Inserts or replaces rows by id. */
  upsert(table: SyncedTable, rows: RemoteRow[]): Promise<void>;
}

export interface SyncState {
  userId?: string;
  /** Per table: the newest server `updated_at` seen. */
  cursors: Partial<Record<SyncedTable, string>>;
  lastSyncedAt?: number;
}

export interface SyncResult {
  pulled: number;
  pushed: number;
  merged: number;
}

// Download children before parents and upload parents before children: anything a
// downloaded entry refers to was uploaded before it, so it arrives in the same sync.
const PULL_ORDER: SyncedTable[] = ['entries', 'workouts', 'exercises'];
const PUSH_ORDER: SyncedTable[] = ['exercises', 'workouts', 'entries'];

/** Re-read a little before the cursor, in case server writes committed out of order. */
const CURSOR_OVERLAP_MS = 60_000;

type LocalRow = (Exercise | Workout | Entry) & { id: string };

function toRemote(table: SyncedTable, row: LocalRow): RemoteRow {
  const base = { id: row.id, client_updated_at: row.updatedAt ?? 0, deleted_at: null };
  switch (table) {
    case 'exercises': {
      const e = row as Exercise;
      return { ...base, name: e.name };
    }
    case 'workouts': {
      const w = row as Workout;
      return {
        ...base,
        date: w.date,
        name: w.name ?? null,
        exercise_ids: w.exerciseIds,
        created_at: w.createdAt,
        copied_from: w.copiedFrom ?? null,
      };
    }
    case 'entries': {
      const e = row as Entry;
      return {
        ...base,
        exercise_id: e.exerciseId,
        workout_id: e.workoutId ?? null,
        date: e.date,
        logged_at: e.timestamp,
        unit: e.unit,
        // Stored in the existing jsonb column as a one-item list, so the server schema is unchanged.
        sets: [{ weight: e.weight, reps: e.reps }],
        notes: e.notes ?? null,
      };
    }
  }
}

/** The local row for a downloaded one, or null for an entry in the old multi-set shape (ignored). */
function fromRemote(table: SyncedTable, r: RemoteRow): LocalRow | null {
  const tracked = { updatedAt: Number(r.client_updated_at), dirty: 0 as const };
  const opt = <K extends string>(key: K, v: unknown) => (v == null ? {} : ({ [key]: v } as Record<K, string>));
  switch (table) {
    case 'exercises':
      return { id: r.id, name: String(r.name ?? ''), ...tracked };
    case 'workouts':
      return {
        id: r.id,
        date: String(r.date),
        exerciseIds: Array.isArray(r.exercise_ids) ? (r.exercise_ids as string[]) : [],
        createdAt: Number(r.created_at ?? 0),
        ...opt('name', r.name),
        ...opt('copiedFrom', r.copied_from),
        ...tracked,
      };
    case 'entries': {
      const sets = r.sets as { weight?: unknown; reps?: unknown }[] | null;
      if (!Array.isArray(sets) || sets.length !== 1) return null;
      return {
        id: r.id,
        exerciseId: String(r.exercise_id),
        date: String(r.date),
        timestamp: Number(r.logged_at ?? 0),
        unit: r.unit === 'lb' ? 'lb' : 'kg',
        weight: Number(sets[0].weight),
        reps: Number(sets[0].reps),
        ...opt('workoutId', r.workout_id),
        ...opt('notes', r.notes),
        ...tracked,
      };
    }
  }
}

function table(database: WorkoutDB, name: SyncedTable) {
  return database[name] as unknown as import('dexie').Table<LocalRow, string>;
}

export async function getSyncState(database: WorkoutDB): Promise<SyncState> {
  const row = await database.meta.get('sync');
  return (row?.value as SyncState | undefined) ?? { cursors: {} };
}

async function saveSyncState(database: WorkoutDB, state: SyncState) {
  await database.meta.put({ key: 'sync', value: state });
}

/** Runs `fn` in a transaction over every table whose writes are not change-tracked. */
function untrackedTx<T>(database: WorkoutDB, fn: () => Promise<T>) {
  return database.transaction('rw', database.all, async (tx) => {
    untracked(tx);
    return fn();
  });
}

const running = new WeakMap<WorkoutDB, Promise<SyncResult | null>>();

/** Syncs once. Returns null when signed out. Concurrent calls share one run. */
export function sync(database: WorkoutDB, remote: Remote): Promise<SyncResult | null> {
  const current = running.get(database);
  if (current) return current;
  const run = syncOnce(database, remote).finally(() => running.delete(database));
  running.set(database, run);
  return run;
}

async function syncOnce(database: WorkoutDB, remote: Remote): Promise<SyncResult | null> {
  const userId = await remote.userId();
  if (!userId) return null;
  let state = await getSyncState(database);

  if (state.userId !== userId) {
    // First sync on this device for this account (or a different account than last time):
    // download everything, and upload everything this device has.
    state = { userId, cursors: {} };
    await untrackedTx(database, async () => {
      for (const name of PUSH_ORDER) {
        await table(database, name)
          .filter((r) => (r.updatedAt ?? 0) > 0)
          .modify({ dirty: 1 });
      }
    });
    await saveSyncState(database, state);
  }

  // 1. Download.
  let pulled = 0;
  for (const name of PULL_ORDER) {
    const cursor = state.cursors[name];
    const since = cursor ? new Date(Date.parse(cursor) - CURSOR_OVERLAP_MS).toISOString() : null;
    const rows = await remote.pull(name, since);
    if (rows.length === 0) continue;
    pulled += await untrackedTx(database, () => applyRemote(database, name, rows));
    const newest = rows.reduce((m, r) => (r.updated_at && (!m || Date.parse(r.updated_at) > Date.parse(m)) ? r.updated_at : m), cursor);
    if (newest) state.cursors[name] = newest;
  }
  await saveSyncState(database, state);

  // 2. Merge duplicates that came from different devices.
  const merged = await untrackedTx(database, () => mergeDuplicates(database));

  // 3. Upload deletes, then changed rows.
  let pushed = 0;
  const deletes = await database.pendingDeletes.toArray();
  for (const name of PUSH_ORDER) {
    const mine = deletes.filter((d) => d.table === name);
    if (mine.length === 0) continue;
    await remote.upsert(
      name,
      mine.map((d) => ({ id: d.id, client_updated_at: d.at, deleted_at: new Date(d.at).toISOString() })),
    );
    pushed += mine.length;
  }
  await untrackedTx(database, async () => {
    for (const d of deletes) {
      const now = await database.pendingDeletes.get(d.key);
      if (now && now.at === d.at) await database.pendingDeletes.delete(d.key);
    }
  });

  for (const name of PUSH_ORDER) {
    const dirty = await table(database, name).where('dirty').equals(1).toArray();
    if (dirty.length === 0) continue;
    await remote.upsert(
      name,
      dirty.map((r) => toRemote(name, r)),
    );
    pushed += dirty.length;
    // Clear the flag only on rows that haven't changed again while uploading.
    await untrackedTx(database, async () => {
      for (const r of dirty) {
        const now = await table(database, name).get(r.id);
        if (now && now.updatedAt === r.updatedAt) await table(database, name).update(r.id, { dirty: 0 });
      }
    });
  }

  state.lastSyncedAt = Date.now();
  await saveSyncState(database, state);
  return { pulled, pushed, merged };
}

/** Applies downloaded rows. Runs in an untracked transaction. Returns how many changed this device. */
async function applyRemote(database: WorkoutDB, name: SyncedTable, rows: RemoteRow[]) {
  const t = table(database, name);
  let changed = 0;
  // Live rows first, so a merge's kept copy is here before the deleted copy is handled.
  const ordered = [...rows.filter((r) => !r.deleted_at), ...rows.filter((r) => r.deleted_at)];
  for (const r of ordered) {
    const local = await t.get(r.id);
    const remoteTime = Number(r.client_updated_at);
    if (r.deleted_at) {
      // Deleted elsewhere: delete here too, unless this device changed it more recently.
      if (local && !(local.dirty && (local.updatedAt ?? 0) > remoteTime)) {
        if (name === 'exercises') await adoptDuplicateExercise(database, local as Exercise);
        if (name === 'workouts') await adoptDuplicateWorkout(database, local as Workout);
        await t.delete(r.id);
        changed++;
      }
      continue;
    }
    const pending = await database.pendingDeletes.get(`${name}:${r.id}`);
    if (pending) {
      // Deleted here: keep it deleted unless it was changed elsewhere after that.
      if (pending.at >= remoteTime) continue;
      await database.pendingDeletes.delete(pending.key);
    }
    if (!local || remoteTime > (local.updatedAt ?? 0)) {
      const row = fromRemote(name, r);
      if (!row) continue;
      await t.put(row);
      changed++;
    }
  }
  return changed;
}

// ---- Merging duplicates (all run inside an untracked transaction, marking changes by hand) ----

function touch<T extends object>(changes: T) {
  return { ...changes, updatedAt: Date.now(), dirty: 1 as const };
}

async function recordDelete(database: WorkoutDB, name: SyncedTable, id: string) {
  const row: PendingDelete = { key: `${name}:${id}`, table: name, id, at: Date.now() };
  await database.pendingDeletes.put(row);
}

/** Which of two duplicates to keep. Every device picks the same one. */
function preferExercise(a: Exercise, b: Exercise) {
  const ad = a.id.startsWith('default:');
  const bd = b.id.startsWith('default:');
  if (ad !== bd) return ad ? a : b;
  return a.id < b.id ? a : b;
}

async function repointExercise(database: WorkoutDB, fromId: string, toId: string) {
  const entries = await database.entries.where('exerciseId').equals(fromId).toArray();
  for (const e of entries) await database.entries.update(e.id, touch({ exerciseId: toId }));
  const workouts = await database.workouts.filter((w) => w.exerciseIds.includes(fromId)).toArray();
  for (const w of workouts) {
    const ids = [...new Set(w.exerciseIds.map((x) => (x === fromId ? toId : x)))];
    await database.workouts.update(w.id, touch({ exerciseIds: ids }));
  }
}

async function repointWorkout(database: WorkoutDB, from: Workout, to: Workout) {
  const ids = [...new Set([...to.exerciseIds, ...from.exerciseIds])];
  await database.workouts.update(
    to.id,
    touch({ exerciseIds: ids, name: to.name ?? from.name, copiedFrom: to.copiedFrom ?? from.copiedFrom }),
  );
  const entries = await database.entries.where('workoutId').equals(from.id).toArray();
  for (const e of entries) await database.entries.update(e.id, touch({ workoutId: to.id }));
  const copies = await database.workouts.filter((w) => w.copiedFrom === from.id).toArray();
  for (const w of copies) await database.workouts.update(w.id, touch({ copiedFrom: to.id }));
}

/**
 * Another device merged this exercise into a same-named one and deleted it. Anything here
 * still pointing at it (logged before this device heard) moves to the one that was kept.
 */
async function adoptDuplicateExercise(database: WorkoutDB, gone: Exercise) {
  const lower = gone.name.toLowerCase();
  const keep = (await database.exercises.toArray()).find((e) => e.id !== gone.id && e.name.toLowerCase() === lower);
  if (keep) await repointExercise(database, gone.id, keep.id);
}

async function adoptDuplicateWorkout(database: WorkoutDB, gone: Workout) {
  const keep = (await database.workouts.where('date').equals(gone.date).toArray()).find((w) => w.id !== gone.id);
  if (keep) await repointWorkout(database, gone, keep);
}

/** Merges duplicate exercises, workouts and workout entries. Returns how many rows were merged away. */
export async function mergeDuplicates(database: WorkoutDB): Promise<number> {
  let merged = 0;

  // Exercises with the same name.
  const byName = new Map<string, Exercise>();
  for (const e of await database.exercises.toArray()) {
    const key = e.name.toLowerCase();
    const other = byName.get(key);
    if (!other) {
      byName.set(key, e);
      continue;
    }
    const keep = preferExercise(e, other);
    const drop = keep === e ? other : e;
    await repointExercise(database, drop.id, keep.id);
    await database.exercises.delete(drop.id);
    await recordDelete(database, 'exercises', drop.id);
    byName.set(key, keep);
    merged++;
  }

  // Workouts on the same day.
  const byDate = new Map<string, Workout>();
  for (const w of await database.workouts.orderBy('id').toArray()) {
    const keep = byDate.get(w.date);
    if (!keep) {
      byDate.set(w.date, w);
      continue;
    }
    await repointWorkout(database, w, keep);
    await database.workouts.delete(w.id);
    await recordDelete(database, 'workouts', w.id);
    byDate.set(w.date, (await database.workouts.get(keep.id))!);
    merged++;
  }

  // More than one entry for the same exercise in a workout: keep the newest.
  const inWorkouts = await database.entries.filter((e) => !!e.workoutId).toArray();
  const byPair = new Map<string, Entry>();
  for (const e of inWorkouts) {
    const key = `${e.workoutId}|${e.exerciseId}`;
    const other = byPair.get(key);
    if (!other) {
      byPair.set(key, e);
      continue;
    }
    const newer = e.timestamp !== other.timestamp ? (e.timestamp > other.timestamp ? e : other) : e.id < other.id ? e : other;
    const drop = newer === e ? other : e;
    await database.entries.delete(drop.id);
    await recordDelete(database, 'entries', drop.id);
    byPair.set(key, newer);
    merged++;
  }

  return merged;
}

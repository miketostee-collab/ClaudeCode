import { type GeoDB, type Observation, type Project, type SyncedTable, untracked } from './db';

/**
 * Two-way sync between this device's database and the server.
 *
 * Every row has a string id that is unique across devices, an `updatedAt` time and a
 * `dirty` flag (set by the change-tracking hooks in db.ts). Deletes are recorded in
 * `pendingDeletes` and uploaded as tombstones (`deleted_at` set) so other devices learn
 * about them. Conflicts on the same row: the newer change wins.
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
}

// Download observations before projects and upload projects before observations: anything a
// downloaded observation refers to was uploaded before it, so it arrives in the same sync.
const PULL_ORDER: SyncedTable[] = ['observations', 'projects'];
const PUSH_ORDER: SyncedTable[] = ['projects', 'observations'];

/** Re-read a little before the cursor, in case server writes committed out of order. */
const CURSOR_OVERLAP_MS = 60_000;

type LocalRow = (Project | Observation) & { id: string };

function toRemote(table: SyncedTable, row: LocalRow): RemoteRow {
  const base = { id: row.id, client_updated_at: row.updatedAt ?? 0, deleted_at: null };
  if (table === 'projects') {
    const p = row as Project;
    return { ...base, name: p.name, area: p.area ?? null, notes: p.notes ?? null, created_at: p.createdAt };
  }
  const o = row as Observation;
  return {
    ...base,
    project_id: o.projectId ?? null,
    lat: o.lat,
    lng: o.lng,
    altitude: o.altitude ?? null,
    accuracy: o.accuracy ?? null,
    recorded_at: o.recordedAt,
    date: o.date,
    type: o.type,
    rock_type: o.rockType ?? null,
    formation: o.formation ?? null,
    description: o.description ?? null,
    sample_id: o.sampleId ?? null,
    strike: o.strike ?? null,
    dip: o.dip ?? null,
    dip_direction: o.dipDirection ?? null,
    notes: o.notes ?? null,
  };
}

/** The local row for a downloaded one, or null if it is unusable (ignored). */
function fromRemote(table: SyncedTable, r: RemoteRow): LocalRow | null {
  const tracked = { updatedAt: Number(r.client_updated_at), dirty: 0 as const };
  const str = <K extends string>(key: K, v: unknown) => (v == null || v === '' ? {} : ({ [key]: String(v) } as Record<K, string>));
  const num = <K extends string>(key: K, v: unknown) =>
    v == null || !Number.isFinite(Number(v)) ? {} : ({ [key]: Number(v) } as Record<K, number>);
  if (table === 'projects') {
    return {
      id: r.id,
      name: String(r.name ?? ''),
      createdAt: Number(r.created_at ?? 0),
      ...str('area', r.area),
      ...str('notes', r.notes),
      ...tracked,
    };
  }
  const lat = Number(r.lat);
  const lng = Number(r.lng);
  if (r.lat == null || r.lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const type = ['outcrop', 'sample', 'structure', 'note'].includes(String(r.type)) ? (r.type as Observation['type']) : 'note';
  return {
    id: r.id,
    lat,
    lng,
    recordedAt: Number(r.recorded_at ?? 0),
    date: String(r.date ?? ''),
    type,
    ...str('projectId', r.project_id),
    ...num('altitude', r.altitude),
    ...num('accuracy', r.accuracy),
    ...str('rockType', r.rock_type),
    ...str('formation', r.formation),
    ...str('description', r.description),
    ...str('sampleId', r.sample_id),
    ...num('strike', r.strike),
    ...num('dip', r.dip),
    ...str('dipDirection', r.dip_direction),
    ...str('notes', r.notes),
    ...tracked,
  };
}

function table(database: GeoDB, name: SyncedTable) {
  return database[name] as unknown as import('dexie').Table<LocalRow, string>;
}

export async function getSyncState(database: GeoDB): Promise<SyncState> {
  const row = await database.meta.get('sync');
  return (row?.value as SyncState | undefined) ?? { cursors: {} };
}

async function saveSyncState(database: GeoDB, state: SyncState) {
  await database.meta.put({ key: 'sync', value: state });
}

/** Runs `fn` in a transaction over every table whose writes are not change-tracked. */
function untrackedTx<T>(database: GeoDB, fn: () => Promise<T>) {
  return database.transaction('rw', database.all, async (tx) => {
    untracked(tx);
    return fn();
  });
}

const running = new WeakMap<GeoDB, Promise<SyncResult | null>>();

/** Syncs once. Returns null when signed out. Concurrent calls share one run. */
export function sync(database: GeoDB, remote: Remote): Promise<SyncResult | null> {
  const current = running.get(database);
  if (current) return current;
  const run = syncOnce(database, remote).finally(() => running.delete(database));
  running.set(database, run);
  return run;
}

async function syncOnce(database: GeoDB, remote: Remote): Promise<SyncResult | null> {
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

  // 2. Observations pointing at a project that no longer exists lose that link.
  await untrackedTx(database, () => clearMissingProjects(database));

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
  return { pulled, pushed };
}

/** Applies downloaded rows. Runs in an untracked transaction. Returns how many changed this device. */
async function applyRemote(database: GeoDB, name: SyncedTable, rows: RemoteRow[]) {
  const t = table(database, name);
  let changed = 0;
  for (const r of rows) {
    const local = await t.get(r.id);
    const remoteTime = Number(r.client_updated_at);
    if (r.deleted_at) {
      // Deleted elsewhere: delete here too, unless this device changed it more recently.
      if (local && !(local.dirty && (local.updatedAt ?? 0) > remoteTime)) {
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

/** Runs inside an untracked transaction, so the changes are marked for upload by hand. */
async function clearMissingProjects(database: GeoDB) {
  const ids = new Set(await database.projects.toCollection().primaryKeys());
  const orphans = await database.observations.filter((o) => !!o.projectId && !ids.has(o.projectId)).toArray();
  for (const o of orphans) {
    const { projectId: _p, ...rest } = o;
    await database.observations.put({ ...rest, updatedAt: Date.now(), dirty: 1 });
  }
}

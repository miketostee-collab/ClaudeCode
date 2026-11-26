import Dexie, { type EntityTable, type Transaction } from 'dexie';

/**
 * Every synced row carries these. Ids are strings that are unique across devices
 * (random UUIDs), so two devices can create rows offline without colliding.
 */
export interface Tracked {
  /** When this row last changed on this device (or the remote change it took), ms since epoch. */
  updatedAt?: number;
  /** 1 while the row has a local change that has not been uploaded yet. */
  dirty?: 0 | 1;
}

export type ObservationType = 'outcrop' | 'sample' | 'structure' | 'note';

export const OBSERVATION_TYPES: { id: ObservationType; label: string }[] = [
  { id: 'outcrop', label: 'Outcrop' },
  { id: 'sample', label: 'Sample' },
  { id: 'structure', label: 'Structure' },
  { id: 'note', label: 'Note' },
];

export const DIP_DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;

/** A trip or study area that groups observations. */
export interface Project extends Tracked {
  id: string;
  name: string;
  area?: string;
  notes?: string;
  createdAt: number;
}

/** One place you stopped and recorded something. */
export interface Observation extends Tracked {
  id: string;
  projectId?: string;
  /** Decimal degrees, WGS84. */
  lat: number;
  lng: number;
  /** Metres above sea level, when the phone reports it. */
  altitude?: number;
  /** Horizontal accuracy of the GPS fix in metres (smaller is better). */
  accuracy?: number;
  /** When the observation was recorded, ms since epoch. */
  recordedAt: number;
  /** Local calendar day of `recordedAt`, YYYY-MM-DD. */
  date: string;
  type: ObservationType;
  rockType?: string;
  formation?: string;
  description?: string;
  sampleId?: string;
  /** Strike 0-360 degrees, dip 0-90 degrees, and the compass direction the plane dips towards. */
  strike?: number;
  dip?: number;
  dipDirection?: string;
  notes?: string;
}

export type SyncedTable = 'projects' | 'observations';

/** A row deleted on this device that the server has not been told about yet. */
export interface PendingDelete {
  /** "<table>:<id>" */
  key: string;
  table: SyncedTable;
  id: string;
  at: number;
}

export interface Meta {
  key: string;
  value: unknown;
}

export function newId(): string {
  return crypto.randomUUID();
}

/**
 * Marks a transaction as "don't track": writes in it are not flagged for upload and
 * deletes are not recorded. Used for changes that came from the server.
 */
export function untracked(tx: Transaction | null | undefined) {
  if (tx) (tx as unknown as { __untracked?: boolean }).__untracked = true;
}

function isUntracked(tx: Transaction | null | undefined) {
  return !!(tx as unknown as { __untracked?: boolean } | undefined)?.__untracked;
}

type Listener = () => void;
const changeListeners = new Set<Listener>();

/** Called after any local change that will need uploading. Returns an unsubscribe function. */
export function onLocalChange(fn: Listener) {
  changeListeners.add(fn);
  return () => changeListeners.delete(fn);
}

export class GeoDB extends Dexie {
  projects!: EntityTable<Project, 'id'>;
  observations!: EntityTable<Observation, 'id'>;
  pendingDeletes!: EntityTable<PendingDelete, 'key'>;
  meta!: EntityTable<Meta, 'key'>;

  constructor(name = 'geo-tracker') {
    super(name);
    // Bump the version with an upgrade function for any future change to a row's shape.
    this.version(1).stores({
      projects: 'id, createdAt, dirty',
      observations: 'id, projectId, recordedAt, date, type, dirty',
      pendingDeletes: 'key',
      meta: 'key',
    });

    const track = (table: SyncedTable) => {
      const t = this[table] as unknown as Dexie.Table<Tracked & { id: string }, string>;
      const notify = (tx: Transaction) => tx.on('complete', () => changeListeners.forEach((fn) => fn()));
      t.hook('creating', function (_key, obj, tx) {
        if (isUntracked(tx)) return;
        obj.updatedAt = Date.now();
        obj.dirty = 1;
        notify(tx);
      });
      t.hook('updating', function (_mods, _key, _obj, tx) {
        if (isUntracked(tx)) return;
        notify(tx);
        return { updatedAt: Date.now(), dirty: 1 };
      });
      t.hook('deleting', (key, _obj, tx) => {
        if (isUntracked(tx)) return;
        const row: PendingDelete = { key: `${table}:${key}`, table, id: String(key), at: Date.now() };
        // Recorded in the same transaction when it includes pendingDeletes (all helpers here do);
        // otherwise straight after it.
        if (tx.storeNames.includes('pendingDeletes')) tx.table('pendingDeletes').put(row);
        else tx.on('complete', () => void this.pendingDeletes.put(row));
        notify(tx);
      });
    };
    track('projects');
    track('observations');
  }

  /** Every table, for read-write transactions that may delete. */
  get all() {
    return [this.projects, this.observations, this.pendingDeletes, this.meta];
  }
}

export const db = new GeoDB();

/** The phone's local calendar day as YYYY-MM-DD. */
export function localDate(ms: number = Date.now()): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// ---- Validation ----

const clean = (s: string | undefined) => {
  const t = s?.trim();
  return t ? t : undefined;
};

/** Returns an error message, or null when the position and measurements are acceptable. */
export function validateObservation(o: Partial<Observation>): string | null {
  if (typeof o.lat !== 'number' || !Number.isFinite(o.lat) || o.lat < -90 || o.lat > 90) {
    return 'Latitude must be between -90 and 90.';
  }
  if (typeof o.lng !== 'number' || !Number.isFinite(o.lng) || o.lng < -180 || o.lng > 180) {
    return 'Longitude must be between -180 and 180.';
  }
  if (o.strike != null && (!Number.isFinite(o.strike) || o.strike < 0 || o.strike > 360)) {
    return 'Strike must be between 0 and 360 degrees.';
  }
  if (o.dip != null && (!Number.isFinite(o.dip) || o.dip < 0 || o.dip > 90)) {
    return 'Dip must be between 0 and 90 degrees.';
  }
  if (o.dipDirection != null && o.dipDirection !== '' && !(DIP_DIRECTIONS as readonly string[]).includes(o.dipDirection)) {
    return 'Dip direction must be a compass point such as N or SW.';
  }
  return null;
}

// ---- Projects ----

export function listProjects(database: GeoDB = db) {
  return database.projects.orderBy('createdAt').reverse().toArray();
}

export async function addProject(
  input: { name: string; area?: string; notes?: string },
  database: GeoDB = db,
): Promise<string> {
  const name = input.name.trim();
  if (!name) throw new Error('Give the project a name.');
  const id = newId();
  await database.projects.add({
    id,
    name,
    createdAt: Date.now(),
    ...(clean(input.area) ? { area: clean(input.area) } : {}),
    ...(clean(input.notes) ? { notes: clean(input.notes) } : {}),
  });
  return id;
}

export async function renameProject(id: string, name: string, database: GeoDB = db) {
  const n = name.trim();
  if (!n) throw new Error('Give the project a name.');
  await database.projects.update(id, { name: n });
}

/** Deletes a project. Its observations are kept, just no longer grouped. */
export function deleteProject(id: string, database: GeoDB = db) {
  return database.transaction('rw', database.all, async () => {
    await database.observations.where('projectId').equals(id).modify((o) => {
      delete o.projectId;
    });
    await database.projects.delete(id);
  });
}

// ---- Observations ----

export type NewObservation = Omit<Observation, 'id' | 'date' | 'recordedAt' | keyof Tracked> & { recordedAt?: number };

/** Keeps only meaningful optional fields (drops empty strings and nulls). */
function tidy(o: Partial<Observation>): Partial<Observation> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    if (v === undefined || v === null) continue;
    if (typeof v === 'string') {
      const t = v.trim();
      if (t) out[k] = t;
    } else out[k] = v;
  }
  return out as Partial<Observation>;
}

export async function addObservation(input: NewObservation, database: GeoDB = db): Promise<string> {
  const err = validateObservation(input);
  if (err) throw new Error(err);
  const recordedAt = input.recordedAt ?? Date.now();
  const id = newId();
  await database.observations.add({
    ...(tidy(input) as NewObservation),
    id,
    recordedAt,
    date: localDate(recordedAt),
  } as Observation);
  return id;
}

/** Edits an observation. Pass `null` for a field to clear it. */
export async function updateObservation(
  id: string,
  changes: { [K in keyof Omit<Observation, 'id' | keyof Tracked>]?: Observation[K] | null },
  database: GeoDB = db,
) {
  const current = await database.observations.get(id);
  if (!current) throw new Error('That observation no longer exists.');
  const merged = { ...current, ...changes } as Partial<Observation>;
  const err = validateObservation(merged);
  if (err) throw new Error(err);
  const set: Record<string, unknown> = {};
  const unset: string[] = [];
  for (const [k, v] of Object.entries(changes)) {
    const t = typeof v === 'string' ? v.trim() : v;
    if (t === null || t === undefined || t === '') unset.push(k);
    else set[k] = t;
  }
  if (typeof changes.recordedAt === 'number') set.date = localDate(changes.recordedAt);
  await database.transaction('rw', database.all, () =>
    database.observations.where('id').equals(id).modify((o) => {
      const row = o as unknown as Record<string, unknown>;
      Object.assign(row, set);
      for (const k of unset) delete row[k];
    }),
  );
}

export function deleteObservation(id: string, database: GeoDB = db) {
  return database.transaction('rw', database.all, () => database.observations.delete(id));
}

export function listObservations(database: GeoDB = db) {
  return database.observations.orderBy('recordedAt').reverse().toArray();
}

export function getObservation(id: string, database: GeoDB = db) {
  return database.observations.get(id);
}

// ---- Backup ----

export interface Backup {
  app: 'geo-tracker';
  version: 1;
  exportedAt: string;
  projects: Project[];
  observations: Observation[];
}

const strip = <T extends Tracked>({ updatedAt: _u, dirty: _d, ...rest }: T) => rest;

export async function exportData(database: GeoDB = db): Promise<Backup> {
  const [projects, observations] = await Promise.all([database.projects.toArray(), database.observations.toArray()]);
  return {
    app: 'geo-tracker',
    version: 1,
    exportedAt: new Date().toISOString(),
    projects: projects.map(strip),
    observations: observations.map(strip),
  };
}

/** Replaces all data with the contents of a backup. */
export async function importData(data: unknown, database: GeoDB = db) {
  const b = data as Partial<Backup>;
  if (!b || b.app !== 'geo-tracker' || !Array.isArray(b.projects) || !Array.isArray(b.observations)) {
    throw new Error('This file is not a Geo Tracker backup.');
  }
  if (b.version !== 1) throw new Error('This backup was made by a different version of the app.');
  const projects = b.projects.map(strip);
  const observations = b.observations.map(strip);
  const ids = new Set(projects.map((p) => p.id));
  if (
    observations.some((o) => validateObservation(o) || (o.projectId != null && !ids.has(o.projectId))) ||
    projects.some((p) => !p.id || !String(p.name ?? '').trim())
  ) {
    throw new Error('Backup is damaged: some projects or observations are invalid.');
  }
  await database.transaction('rw', database.all, async () => {
    // Deleting row by row (rather than clear) records each delete for sync.
    await database.observations.toCollection().delete();
    await database.projects.toCollection().delete();
    await database.projects.bulkAdd(projects);
    await database.observations.bulkAdd(observations);
  });
  return { projects: projects.length, observations: observations.length };
}

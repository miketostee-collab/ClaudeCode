import Dexie, { type EntityTable, type Transaction } from 'dexie';

export type Unit = 'lb' | 'kg';

/**
 * Every synced row carries these. Ids are strings that are unique across devices
 * (random UUIDs, or "default:<slug>" for the built-in exercises).
 */
export interface Tracked {
  /** When this row last changed on this device (or the remote change it took), ms since epoch. */
  updatedAt?: number;
  /** 1 while the row has a local change that has not been uploaded yet. */
  dirty?: 0 | 1;
}

export interface Exercise extends Tracked {
  id: string;
  name: string;
}

/** Shape of one set in older versions (entries held a list of them). */
interface SetEntry {
  weight: number;
  reps: number;
}

export interface Entry extends Tracked {
  id: string;
  exerciseId: string;
  /** Local calendar day, YYYY-MM-DD. */
  date: string;
  /** Exact save time, ms since epoch. Used to find the most recent entry. */
  timestamp: number;
  unit: Unit;
  /** The max set: the heaviest weight lifted, and for how many reps. */
  weight: number;
  reps: number;
  notes?: string;
  /** Set when the entry was logged as part of a workout. */
  workoutId?: string;
}

/** A day's workout: the exercises picked for that day, in order. Entries link back via workoutId. */
export interface Workout extends Tracked {
  id: string;
  /** Local calendar day, YYYY-MM-DD. One workout per day. */
  date: string;
  name?: string;
  exerciseIds: string[];
  createdAt: number;
  /** The workout this one was repeated from; its sets are the starting point for each exercise. */
  copiedFrom?: string;
}

export type SyncedTable = 'exercises' | 'workouts' | 'entries';

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

/** Entry shape from version 1: one weight and rep count repeated for N sets. */
type EntryV1<T> = Omit<T, 'sets'> & { weight: number; reps: number; sets: number };

function upgradeEntry<T>(e: EntryV1<T>): Omit<T, 'sets'> & { sets: SetEntry[] } {
  const { weight, reps, sets, ...rest } = e;
  return { ...rest, sets: Array.from({ length: Math.max(1, sets) }, () => ({ weight, reps })) } as Omit<T, 'sets'> & {
    sets: SetEntry[];
  };
}

export type NewEntry = Omit<Entry, 'id' | 'date' | 'timestamp' | keyof Tracked> & { timestamp?: number };

export const DEFAULT_EXERCISES = [
  'Bench Press',
  'Squat',
  'Deadlift',
  'Overhead Press',
  'Barbell Row',
  'Pull-up',
  'Lat Pulldown',
  'Bicep Curl',
  'Tricep Pushdown',
  'Leg Press',
  'Incline Bench Press',
  'Dumbbell Bench Press',
  'Chest Fly',
  'Dips',
  'Dumbbell Shoulder Press',
  'Lateral Raise',
  'Face Pull',
  'Shrugs',
  'Front Squat',
  'Romanian Deadlift',
  'Lunges',
  'Hip Thrust',
  'Leg Extension',
  'Leg Curl',
  'Calf Raise',
  'Seated Cable Row',
  'Dumbbell Row',
  'Chin-up',
  'Hammer Curl',
  'Skull Crusher',
];

/** A new id that will not clash with one made on another device. */
export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  // randomUUID needs a secure context (https or localhost); fall back for plain-http testing.
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** The fixed id of a built-in exercise, so every device (and every fresh install) agrees on it. */
export function defaultExerciseId(name: string): string | undefined {
  const match = DEFAULT_EXERCISES.find((d) => d.toLowerCase() === name.trim().toLowerCase());
  return match ? 'default:' + match.toLowerCase().replace(/[^a-z0-9]+/g, '-') : undefined;
}

/** Built-in exercises as seeded rows. They count as unchanged (not dirty, time 0), so any edit made elsewhere wins. */
function seedExercises(names: string[] = DEFAULT_EXERCISES): Exercise[] {
  return names.map((name) => ({ id: defaultExerciseId(name)!, name, updatedAt: 0, dirty: 0 }));
}

/**
 * Marks a transaction as "don't track": writes in it are not flagged for upload and
 * deletes are not recorded. Used for changes that came from the server, and for seeding.
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

export class WorkoutDB extends Dexie {
  exercises!: EntityTable<Exercise, 'id'>;
  entries!: EntityTable<Entry, 'id'>;
  workouts!: EntityTable<Workout, 'id'>;
  pendingDeletes!: EntityTable<PendingDelete, 'key'>;
  meta!: EntityTable<Meta, 'key'>;

  constructor(name = 'workout-tracker') {
    super(name);
    this.version(1).stores({
      exercises: '++id, &name',
      entries: '++id, exerciseId, date, [exerciseId+timestamp]',
    });
    // v2: each set has its own weight and reps; adds the larger default exercise list.
    this.version(2)
      .stores({})
      .upgrade(async (tx) => {
        await tx
          .table('entries')
          .toCollection()
          .modify((e: { sets: unknown }, ref: { value: unknown }) => {
            if (!Array.isArray(e.sets)) ref.value = upgradeEntry(e as unknown as EntryV1<{ sets: SetEntry[] }>);
          });
        const have = new Set(
          ((await tx.table('exercises').toArray()) as { name: string }[]).map((x) => x.name.toLowerCase()),
        );
        const missing = DEFAULT_EXERCISES.filter((n) => !have.has(n.toLowerCase()));
        await tx.table('exercises').bulkAdd(missing.map((name) => ({ name })));
      });
    // v3: workouts, and entries can belong to one.
    this.version(3).stores({
      entries: '++id, exerciseId, date, workoutId, [exerciseId+timestamp]',
      workouts: '++id, &date',
    });
    // v4: ids that are unique across devices, plus change tracking, for sync.
    // IndexedDB can't change a table's key type in place, so rows are copied to new tables.
    // Names and dates are no longer unique indexes: two devices can briefly hold a
    // duplicate until sync merges them.
    this.version(4)
      .stores({
        exercises_u: 'id, name, dirty',
        workouts_u: 'id, date, dirty',
        entries_u: 'id, exerciseId, date, workoutId, [exerciseId+timestamp], dirty',
        pendingDeletes: 'key',
        meta: 'key',
      })
      .upgrade(async (tx) => {
        untracked(tx);
        const now = Date.now();
        const exMap = new Map<number, string>();
        const woMap = new Map<number, string>();
        const oldEx = (await tx.table('exercises').toArray()) as { id: number; name: string }[];
        const exercises: Exercise[] = oldEx.map((e) => {
          const fixed = defaultExerciseId(e.name);
          const unchangedDefault = fixed && DEFAULT_EXERCISES.includes(e.name);
          const id = fixed ?? newId();
          exMap.set(e.id, id);
          return unchangedDefault
            ? { id, name: e.name, updatedAt: 0, dirty: 0 }
            : { id, name: e.name, updatedAt: now, dirty: 1 };
        });
        const oldWo = (await tx.table('workouts').toArray()) as (Omit<Workout, 'id' | 'exerciseIds' | 'copiedFrom'> & {
          id: number;
          exerciseIds: number[];
          copiedFrom?: number;
        })[];
        for (const w of oldWo) woMap.set(w.id, newId());
        const workouts: Workout[] = oldWo.map((w) => {
          const { copiedFrom, ...rest } = w;
          const from = copiedFrom != null ? woMap.get(copiedFrom) : undefined;
          return {
            ...rest,
            id: woMap.get(w.id)!,
            exerciseIds: w.exerciseIds.map((x) => exMap.get(x)).filter((x): x is string => !!x),
            ...(from ? { copiedFrom: from } : {}),
            updatedAt: now,
            dirty: 1,
          };
        });
        const oldEn = (await tx.table('entries').toArray()) as (Omit<Entry, 'id' | 'exerciseId' | 'workoutId'> & {
          id: number;
          exerciseId: number;
          workoutId?: number;
        })[];
        const entries: Entry[] = oldEn
          .filter((e) => exMap.has(e.exerciseId))
          .map((e) => {
            const { workoutId, ...rest } = e;
            const wid = workoutId != null ? woMap.get(workoutId) : undefined;
            return {
              ...rest,
              id: newId(),
              exerciseId: exMap.get(e.exerciseId)!,
              ...(wid ? { workoutId: wid } : {}),
              updatedAt: now,
              dirty: 1,
            };
          });
        await tx.table('exercises_u').bulkAdd(exercises);
        await tx.table('workouts_u').bulkAdd(workouts);
        await tx.table('entries_u').bulkAdd(entries);
      });
    // v5: drop the old number-id tables.
    this.version(5).stores({ exercises: null, entries: null, workouts: null });
    // v6: an entry is one "max set" (weight and reps) instead of a list of sets. Logged
    // history in the old shape is cleared (entries and workouts; exercises are kept), and
    // each delete is recorded so sync clears it from the account too.
    this.version(6)
      .stores({})
      .upgrade(async (tx) => {
        untracked(tx);
        const at = Date.now();
        const gone: PendingDelete[] = [];
        for (const [name, store] of [['entries', 'entries_u'], ['workouts', 'workouts_u']] as const) {
          const keys = (await tx.table(store).toCollection().primaryKeys()) as string[];
          for (const id of keys) gone.push({ key: `${name}:${id}`, table: name, id, at });
          await tx.table(store).clear();
        }
        await tx.table('pendingDeletes').bulkPut(gone);
      });

    // The app uses the new tables under their usual names.
    this.exercises = this.table('exercises_u');
    this.workouts = this.table('workouts_u');
    this.entries = this.table('entries_u');

    this.on('populate', (tx) => {
      untracked(tx);
      tx.table('exercises_u').bulkAdd(seedExercises());
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
    track('exercises');
    track('workouts');
    track('entries');
  }

  /** Every table, for read-write transactions that may delete. */
  get all() {
    return [this.exercises, this.workouts, this.entries, this.pendingDeletes, this.meta];
  }
}

export const db = new WorkoutDB();

/** Today's date in the phone's local time zone, as YYYY-MM-DD. */
export function localDate(ms: number = Date.now()): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function listExercises(database: WorkoutDB = db) {
  return database.exercises.orderBy('name').toArray();
}

async function findExerciseByName(name: string, database: WorkoutDB) {
  const lower = name.toLowerCase();
  return (await database.exercises.toArray()).find((e) => e.name.toLowerCase() === lower);
}

export async function addExercise(name: string, database: WorkoutDB = db): Promise<string> {
  const clean = name.trim();
  if (!clean) throw new Error('Exercise name is required.');
  const existing = await findExerciseByName(clean, database);
  if (existing) throw new Error(`"${existing.name}" already exists.`);
  return database.exercises.add({ id: newId(), name: clean });
}

export async function renameExercise(id: string, name: string, database: WorkoutDB = db) {
  const clean = name.trim();
  if (!clean) throw new Error('Exercise name is required.');
  const existing = await findExerciseByName(clean, database);
  if (existing && existing.id !== id) throw new Error(`"${existing.name}" already exists.`);
  await database.exercises.update(id, { name: clean });
}

/** Deletes an exercise, all of its entries, and removes it from any workouts. */
export function deleteExercise(id: string, database: WorkoutDB = db) {
  return database.transaction('rw', database.all, async () => {
    await database.entries.where('exerciseId').equals(id).delete();
    await database.workouts
      .filter((w) => w.exerciseIds.includes(id))
      .modify((w) => {
        w.exerciseIds = w.exerciseIds.filter((x) => x !== id);
      });
    await database.exercises.delete(id);
  });
}

export function countEntries(exerciseId: string, database: WorkoutDB = db) {
  return database.entries.where('exerciseId').equals(exerciseId).count();
}

/** The newest entry for an exercise, or undefined if none yet. */
export function getLastEntry(exerciseId: string, database: WorkoutDB = db) {
  return database.entries
    .where('[exerciseId+timestamp]')
    .between([exerciseId, Dexie.minKey], [exerciseId, Dexie.maxKey])
    .last();
}

/** Entries for an exercise, newest first. */
export function listEntries(exerciseId: string, database: WorkoutDB = db) {
  return database.entries
    .where('[exerciseId+timestamp]')
    .between([exerciseId, Dexie.minKey], [exerciseId, Dexie.maxKey])
    .reverse()
    .toArray();
}

/** Checks a max set. Returns an error message, or null when it's valid. */
export function validateMaxSet(set: { weight: number; reps: number }): string | null {
  if (!Number.isFinite(set.weight) || set.weight < 0) return 'Weight must be 0 or more.';
  if (!Number.isInteger(set.reps) || set.reps < 1) return 'Reps must be a whole number of 1 or more.';
  return null;
}

/** Records an entry stamped with the current day (or the given timestamp). */
export async function addEntry(input: NewEntry, database: WorkoutDB = db): Promise<string> {
  const error = validateMaxSet(input);
  if (error) throw new Error(error);
  const timestamp = input.timestamp ?? Date.now();
  const notes = input.notes?.trim();
  return database.entries.add({
    id: newId(),
    exerciseId: input.exerciseId,
    unit: input.unit,
    weight: input.weight,
    reps: input.reps,
    ...(notes ? { notes } : {}),
    ...(input.workoutId ? { workoutId: input.workoutId } : {}),
    timestamp,
    date: localDate(timestamp),
  });
}

export async function updateEntry(
  id: string,
  changes: { weight: number; reps: number; notes?: string },
  database: WorkoutDB = db,
) {
  const error = validateMaxSet(changes);
  if (error) throw new Error(error);
  await database.entries.update(id, {
    weight: changes.weight,
    reps: changes.reps,
    notes: changes.notes?.trim() || undefined,
  });
}

export function deleteEntry(id: string, database: WorkoutDB = db) {
  return database.transaction('rw', database.all, () => database.entries.delete(id));
}

// ---- Workouts ----

export function getWorkout(id: string, database: WorkoutDB = db) {
  return database.workouts.get(id);
}

export function getWorkoutByDate(date: string, database: WorkoutDB = db) {
  return database.workouts.where('date').equals(date).first();
}

/** All workouts, newest first. */
export function listWorkouts(database: WorkoutDB = db) {
  return database.workouts.orderBy('date').reverse().toArray();
}

export function listWorkoutEntries(workoutId: string, database: WorkoutDB = db) {
  return database.entries.where('workoutId').equals(workoutId).toArray();
}

function cleanIds(ids: string[]) {
  return [...new Set(ids)];
}

/** Starts the workout for a day (today by default). Only one workout per day. */
export async function createWorkout(
  input: { exerciseIds: string[]; name?: string; date?: string; copiedFrom?: string },
  database: WorkoutDB = db,
): Promise<string> {
  const date = input.date ?? localDate();
  const exerciseIds = cleanIds(input.exerciseIds);
  if (exerciseIds.length === 0) throw new Error('Pick at least one exercise.');
  if (await getWorkoutByDate(date, database)) throw new Error('There is already a workout for that day.');
  const name = input.name?.trim();
  return database.workouts.add({
    id: newId(),
    date,
    exerciseIds,
    createdAt: Date.now(),
    ...(name ? { name } : {}),
    ...(input.copiedFrom != null ? { copiedFrom: input.copiedFrom } : {}),
  });
}

/**
 * Starts a workout (today by default) with the same name and exercises, in the same order,
 * as an earlier one. Each exercise then starts from that workout's sets.
 */
export async function repeatWorkout(
  sourceId: string,
  date?: string,
  database: WorkoutDB = db,
  /** Replace a workout that already exists for that day (and its logged sets). */
  replace = false,
): Promise<string> {
  const day = date ?? localDate();
  return database.transaction('rw', database.all, async () => {
    const source = await database.workouts.get(sourceId);
    if (!source) throw new Error('Workout not found.');
    if (source.date === day) throw new Error("That's already today's workout.");
    if (replace) {
      const current = await getWorkoutByDate(day, database);
      if (current) await deleteWorkout(current.id, database);
    }
    const existing = new Set((await database.exercises.toArray()).map((e) => e.id));
    return createWorkout(
      { exerciseIds: source.exerciseIds.filter((id) => existing.has(id)), name: source.name, date: day, copiedFrom: sourceId },
      database,
    );
  });
}

/**
 * The max set a workout's exercise should start from: the entry in the workout it was
 * repeated from, if there is one, otherwise the most recent entry from outside this workout.
 */
export async function getStartingEntry(workout: Workout, exerciseId: string, database: WorkoutDB = db) {
  if (workout.copiedFrom != null) {
    const fromSource = await database.entries
      .where('workoutId')
      .equals(workout.copiedFrom)
      .filter((e) => e.exerciseId === exerciseId)
      .first();
    if (fromSource) return fromSource;
  }
  return getLastEntryOutside(exerciseId, workout.id, database);
}

/**
 * Changes a workout's name or exercise list. Removing an exercise also deletes
 * the entry logged for it in this workout.
 */
export async function updateWorkout(
  id: string,
  changes: { exerciseIds?: string[]; name?: string },
  database: WorkoutDB = db,
) {
  await database.transaction('rw', database.all, async () => {
    const w = await database.workouts.get(id);
    if (!w) throw new Error('Workout not found.');
    const patch: Partial<Workout> = {};
    if (changes.name !== undefined) patch.name = changes.name.trim() || undefined;
    if (changes.exerciseIds) {
      const ids = cleanIds(changes.exerciseIds);
      if (ids.length === 0) throw new Error('A workout needs at least one exercise.');
      const keep = new Set(ids);
      await database.entries
        .where('workoutId')
        .equals(id)
        .filter((e) => !keep.has(e.exerciseId))
        .delete();
      patch.exerciseIds = ids;
    }
    await database.workouts.update(id, patch);
  });
}

/** Deletes a workout and the entries logged in it. */
export function deleteWorkout(id: string, database: WorkoutDB = db) {
  return database.transaction('rw', database.all, async () => {
    await database.entries.where('workoutId').equals(id).delete();
    await database.workouts.delete(id);
  });
}

/** Creates or replaces the entry for one exercise in a workout. */
export async function saveWorkoutEntry(
  workoutId: string,
  exerciseId: string,
  input: { unit: Unit; weight: number; reps: number; notes?: string },
  database: WorkoutDB = db,
): Promise<string> {
  const error = validateMaxSet(input);
  if (error) throw new Error(error);
  return database.transaction('rw', database.workouts, database.entries, async () => {
    const w = await database.workouts.get(workoutId);
    if (!w) throw new Error('Workout not found.');
    if (!w.exerciseIds.includes(exerciseId)) throw new Error('That exercise is not in this workout.');
    const existing = await database.entries
      .where('workoutId')
      .equals(workoutId)
      .filter((e) => e.exerciseId === exerciseId)
      .first();
    const notes = input.notes?.trim() || undefined;
    const { weight, reps } = input;
    if (existing) {
      await database.entries.update(existing.id, { unit: input.unit, weight, reps, notes });
      return existing.id;
    }
    return database.entries.add({
      id: newId(),
      exerciseId,
      workoutId,
      unit: input.unit,
      weight,
      reps,
      notes,
      timestamp: Date.now(),
      date: w.date,
    });
  });
}

/** The newest entry for an exercise that is not part of the given workout. */
export async function getLastEntryOutside(exerciseId: string, workoutId: string, database: WorkoutDB = db) {
  return database.entries
    .where('[exerciseId+timestamp]')
    .between([exerciseId, Dexie.minKey], [exerciseId, Dexie.maxKey])
    .reverse()
    .filter((e) => e.workoutId !== workoutId)
    .first();
}

// ---- Backup ----

export interface Backup {
  app: 'workout-tracker';
  version: 5;
  exportedAt: string;
  exercises: Exercise[];
  entries: Entry[];
  workouts: Workout[];
}

const strip = <T extends Tracked>({ updatedAt: _u, dirty: _d, ...rest }: T) => rest;

export async function exportData(database: WorkoutDB = db): Promise<Backup> {
  const [exercises, entries, workouts] = await Promise.all([
    database.exercises.toArray(),
    database.entries.toArray(),
    database.workouts.toArray(),
  ]);
  return {
    app: 'workout-tracker',
    version: 5,
    exportedAt: new Date().toISOString(),
    exercises: exercises.map(strip),
    entries: entries.map(strip),
    workouts: workouts.map(strip),
  };
}

/**
 * Replaces all data with the contents of a backup. Only backups from the max-set version
 * (version 5) can be restored: older ones hold lists of sets, which the app no longer keeps.
 */
export async function importData(data: unknown, database: WorkoutDB = db) {
  const b = data as Partial<Backup> & { version?: number };
  if (!b || b.app !== 'workout-tracker' || !Array.isArray(b.exercises) || !Array.isArray(b.entries)) {
    throw new Error('This file is not a Workout Tracker backup.');
  }
  if (b.version !== 5) {
    throw new Error('This backup is from the older multi-set version of the app and can no longer be restored.');
  }
  const exercises = b.exercises.map((e) => ({ id: String(e.id), name: String(e.name) }));
  const workouts = (Array.isArray(b.workouts) ? b.workouts : []).map(strip);
  const entries = b.entries.map(strip);
  const exIds = new Set(exercises.map((e) => e.id));
  const woIds = new Set(workouts.map((w) => w.id));
  if (
    entries.some((e) => !exIds.has(e.exerciseId) || validateMaxSet(e) || (e.workoutId != null && !woIds.has(e.workoutId))) ||
    workouts.some((w) => !Array.isArray(w.exerciseIds) || w.exerciseIds.some((x) => !exIds.has(x)))
  ) {
    throw new Error('Backup is damaged: some entries or workouts are invalid or refer to missing items.');
  }
  await database.transaction('rw', database.all, async () => {
    // Deleting row by row (rather than clear) records each delete for sync.
    await database.entries.toCollection().delete();
    await database.workouts.toCollection().delete();
    await database.exercises.toCollection().delete();
    await database.exercises.bulkAdd(exercises);
    await database.workouts.bulkAdd(workouts as Workout[]);
    await database.entries.bulkAdd(entries as Entry[]);
  });
  return { exercises: exercises.length, entries: entries.length, workouts: workouts.length };
}

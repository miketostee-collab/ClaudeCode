import Dexie, { type EntityTable } from 'dexie';

export type Unit = 'lb' | 'kg';

export interface Exercise {
  id: number;
  name: string;
}

export interface SetEntry {
  weight: number;
  reps: number;
}

export interface Entry {
  id: number;
  exerciseId: number;
  /** Local calendar day, YYYY-MM-DD. */
  date: string;
  /** Exact save time, ms since epoch. Used to find the most recent entry. */
  timestamp: number;
  unit: Unit;
  /** One item per set, in the order performed. */
  sets: SetEntry[];
  notes?: string;
  /** Set when the entry was logged as part of a workout. */
  workoutId?: number;
}

/** A day's workout: the exercises picked for that day, in order. Entries link back via workoutId. */
export interface Workout {
  id: number;
  /** Local calendar day, YYYY-MM-DD. One workout per day. */
  date: string;
  name?: string;
  exerciseIds: number[];
  createdAt: number;
  /** The workout this one was repeated from; its sets are the starting point for each exercise. */
  copiedFrom?: number;
}

/** Entry shape from version 1: one weight and rep count repeated for N sets. */
interface EntryV1 extends Omit<Entry, 'sets'> {
  weight: number;
  reps: number;
  sets: number;
}

function upgradeEntry(e: EntryV1): Entry {
  const { weight, reps, sets, ...rest } = e;
  return { ...rest, sets: Array.from({ length: Math.max(1, sets) }, () => ({ weight, reps })) };
}

export const MAX_SETS = 20;

export type NewEntry = Omit<Entry, 'id' | 'date' | 'timestamp'> & { timestamp?: number };


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

export class WorkoutDB extends Dexie {
  exercises!: EntityTable<Exercise, 'id'>;
  entries!: EntityTable<Entry, 'id'>;
  workouts!: EntityTable<Workout, 'id'>;

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
          .modify((e: Entry & Partial<EntryV1>, ref: { value: Entry }) => {
            if (!Array.isArray(e.sets)) ref.value = upgradeEntry(e as unknown as EntryV1);
          });
        const have = new Set(
          ((await tx.table('exercises').toArray()) as Exercise[]).map((x) => x.name.toLowerCase()),
        );
        const missing = DEFAULT_EXERCISES.filter((n) => !have.has(n.toLowerCase()));
        await tx.table('exercises').bulkAdd(missing.map((name) => ({ name })));
      });
    // v3: workouts, and entries can belong to one.
    this.version(3).stores({
      entries: '++id, exerciseId, date, workoutId, [exerciseId+timestamp]',
      workouts: '++id, &date',
    });
    this.on('populate', (tx) => {
      tx.table('exercises').bulkAdd(DEFAULT_EXERCISES.map((name) => ({ name })));
    });
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

export async function addExercise(name: string, database: WorkoutDB = db): Promise<number> {
  const clean = name.trim();
  if (!clean) throw new Error('Exercise name is required.');
  const existing = await database.exercises.where('name').equalsIgnoreCase(clean).first();
  if (existing) throw new Error(`"${existing.name}" already exists.`);
  return database.exercises.add({ name: clean } as Exercise);
}

export async function renameExercise(id: number, name: string, database: WorkoutDB = db) {
  const clean = name.trim();
  if (!clean) throw new Error('Exercise name is required.');
  const existing = await database.exercises.where('name').equalsIgnoreCase(clean).first();
  if (existing && existing.id !== id) throw new Error(`"${existing.name}" already exists.`);
  await database.exercises.update(id, { name: clean });
}

/** Deletes an exercise, all of its entries, and removes it from any workouts. */
export function deleteExercise(id: number, database: WorkoutDB = db) {
  return database.transaction('rw', database.exercises, database.entries, database.workouts, async () => {
    await database.entries.where('exerciseId').equals(id).delete();
    await database.workouts
      .filter((w) => w.exerciseIds.includes(id))
      .modify((w) => {
        w.exerciseIds = w.exerciseIds.filter((x) => x !== id);
      });
    await database.exercises.delete(id);
  });
}

export function countEntries(exerciseId: number, database: WorkoutDB = db) {
  return database.entries.where('exerciseId').equals(exerciseId).count();
}

/** The newest entry for an exercise, or undefined if none yet. */
export function getLastEntry(exerciseId: number, database: WorkoutDB = db) {
  return database.entries
    .where('[exerciseId+timestamp]')
    .between([exerciseId, Dexie.minKey], [exerciseId, Dexie.maxKey])
    .last();
}

/** Entries for an exercise, newest first. */
export function listEntries(exerciseId: number, database: WorkoutDB = db) {
  return database.entries
    .where('[exerciseId+timestamp]')
    .between([exerciseId, Dexie.minKey], [exerciseId, Dexie.maxKey])
    .reverse()
    .toArray();
}

export function validateSets(sets: SetEntry[]): string | null {
  if (!Array.isArray(sets) || sets.length === 0) return 'Add at least one set.';
  if (sets.length > MAX_SETS) return `No more than ${MAX_SETS} sets.`;
  for (const [i, s] of sets.entries()) {
    if (!Number.isFinite(s.weight) || s.weight < 0) return `Set ${i + 1}: weight must be 0 or more.`;
    if (!Number.isInteger(s.reps) || s.reps < 1) return `Set ${i + 1}: reps must be a whole number of 1 or more.`;
  }
  return null;
}

/** Records an entry stamped with the current day (or the given timestamp). */
export async function addEntry(input: NewEntry, database: WorkoutDB = db): Promise<number> {
  const error = validateSets(input.sets);
  if (error) throw new Error(error);
  const timestamp = input.timestamp ?? Date.now();
  const notes = input.notes?.trim();
  return database.entries.add({
    exerciseId: input.exerciseId,
    unit: input.unit,
    sets: input.sets.map(({ weight, reps }) => ({ weight, reps })),
    ...(notes ? { notes } : {}),
    timestamp,
    date: localDate(timestamp),
  } as Entry);
}

export async function updateEntry(
  id: number,
  changes: { sets: SetEntry[]; notes?: string },
  database: WorkoutDB = db,
) {
  const error = validateSets(changes.sets);
  if (error) throw new Error(error);
  await database.entries.update(id, {
    sets: changes.sets.map(({ weight, reps }) => ({ weight, reps })),
    notes: changes.notes?.trim() || undefined,
  });
}

export function deleteEntry(id: number, database: WorkoutDB = db) {
  return database.entries.delete(id);
}

// ---- Workouts ----

export function getWorkout(id: number, database: WorkoutDB = db) {
  return database.workouts.get(id);
}

export function getWorkoutByDate(date: string, database: WorkoutDB = db) {
  return database.workouts.where('date').equals(date).first();
}

/** All workouts, newest first. */
export function listWorkouts(database: WorkoutDB = db) {
  return database.workouts.orderBy('date').reverse().toArray();
}

export function listWorkoutEntries(workoutId: number, database: WorkoutDB = db) {
  return database.entries.where('workoutId').equals(workoutId).toArray();
}

function cleanIds(ids: number[]) {
  return [...new Set(ids)];
}

/** Starts the workout for a day (today by default). Only one workout per day. */
export async function createWorkout(
  input: { exerciseIds: number[]; name?: string; date?: string; copiedFrom?: number },
  database: WorkoutDB = db,
): Promise<number> {
  const date = input.date ?? localDate();
  const exerciseIds = cleanIds(input.exerciseIds);
  if (exerciseIds.length === 0) throw new Error('Pick at least one exercise.');
  if (await getWorkoutByDate(date, database)) throw new Error('There is already a workout for that day.');
  const name = input.name?.trim();
  return database.workouts.add({
    date,
    exerciseIds,
    createdAt: Date.now(),
    ...(name ? { name } : {}),
    ...(input.copiedFrom != null ? { copiedFrom: input.copiedFrom } : {}),
  } as Workout);
}

/**
 * Starts a workout (today by default) with the same name and exercises, in the same order,
 * as an earlier one. Each exercise then starts from that workout's sets.
 */
export async function repeatWorkout(
  sourceId: number,
  date?: string,
  database: WorkoutDB = db,
  /** Replace a workout that already exists for that day (and its logged sets). */
  replace = false,
): Promise<number> {
  const day = date ?? localDate();
  return database.transaction('rw', database.workouts, database.entries, database.exercises, async () => {
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
 * The sets a workout's exercise should start from: the entry in the workout it was
 * repeated from, if there is one, otherwise the most recent entry from outside this workout.
 */
export async function getStartingEntry(workout: Workout, exerciseId: number, database: WorkoutDB = db) {
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
  id: number,
  changes: { exerciseIds?: number[]; name?: string },
  database: WorkoutDB = db,
) {
  await database.transaction('rw', database.workouts, database.entries, async () => {
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
export function deleteWorkout(id: number, database: WorkoutDB = db) {
  return database.transaction('rw', database.workouts, database.entries, async () => {
    await database.entries.where('workoutId').equals(id).delete();
    await database.workouts.delete(id);
  });
}

/** Creates or replaces the entry for one exercise in a workout. */
export async function saveWorkoutEntry(
  workoutId: number,
  exerciseId: number,
  input: { unit: Unit; sets: SetEntry[]; notes?: string },
  database: WorkoutDB = db,
): Promise<number> {
  const error = validateSets(input.sets);
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
    const sets = input.sets.map(({ weight, reps }) => ({ weight, reps }));
    if (existing) {
      await database.entries.update(existing.id, { unit: input.unit, sets, notes });
      return existing.id;
    }
    return database.entries.add({
      exerciseId,
      workoutId,
      unit: input.unit,
      sets,
      notes,
      timestamp: Date.now(),
      date: w.date,
    } as Entry);
  });
}

/** The newest entry for an exercise that is not part of the given workout. */
export async function getLastEntryOutside(exerciseId: number, workoutId: number, database: WorkoutDB = db) {
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
  version: 3;
  exportedAt: string;
  exercises: Exercise[];
  entries: Entry[];
  workouts: Workout[];
}

export async function exportData(database: WorkoutDB = db): Promise<Backup> {
  const [exercises, entries, workouts] = await Promise.all([
    database.exercises.toArray(),
    database.entries.toArray(),
    database.workouts.toArray(),
  ]);
  return { app: 'workout-tracker', version: 3, exportedAt: new Date().toISOString(), exercises, entries, workouts };
}

/** Replaces all data with the contents of a backup. */
export async function importData(data: unknown, database: WorkoutDB = db) {
  const b = data as Partial<Backup>;
  if (!b || b.app !== 'workout-tracker' || !Array.isArray(b.exercises) || !Array.isArray(b.entries)) {
    throw new Error('This file is not a Workout Tracker backup.');
  }
  // Version 1 backups stored a single weight/reps per entry.
  const entries = (b.entries as unknown[]).map((e) =>
    Array.isArray((e as Entry).sets) ? (e as Entry) : upgradeEntry(e as EntryV1),
  );
  // Backups before version 3 have no workouts.
  const workouts = Array.isArray(b.workouts) ? b.workouts : [];
  const ids = new Set(b.exercises.map((e) => e.id));
  const workoutIds = new Set(workouts.map((w) => w.id));
  if (
    entries.some((e) => !ids.has(e.exerciseId) || validateSets(e.sets) || (e.workoutId != null && !workoutIds.has(e.workoutId))) ||
    workouts.some((w) => !Array.isArray(w.exerciseIds) || w.exerciseIds.some((x) => !ids.has(x)))
  ) {
    throw new Error('Backup is damaged: some entries or workouts are invalid or refer to missing items.');
  }
  await database.transaction('rw', database.exercises, database.entries, database.workouts, async () => {
    await database.entries.clear();
    await database.workouts.clear();
    await database.exercises.clear();
    await database.exercises.bulkAdd(b.exercises!);
    await database.workouts.bulkAdd(workouts);
    await database.entries.bulkAdd(entries);
  });
  return { exercises: b.exercises.length, entries: entries.length, workouts: workouts.length };
}

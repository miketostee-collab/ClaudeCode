import Dexie, { type EntityTable } from 'dexie';

export type Unit = 'lb' | 'kg';

export interface Exercise {
  id: number;
  name: string;
}

export interface Entry {
  id: number;
  exerciseId: number;
  /** Local calendar day, YYYY-MM-DD. */
  date: string;
  /** Exact save time, ms since epoch. Used to find the most recent entry. */
  timestamp: number;
  weight: number;
  unit: Unit;
  reps: number;
  sets: number;
  notes?: string;
}

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
];

export class WorkoutDB extends Dexie {
  exercises!: EntityTable<Exercise, 'id'>;
  entries!: EntityTable<Entry, 'id'>;

  constructor(name = 'workout-tracker') {
    super(name);
    this.version(1).stores({
      exercises: '++id, &name',
      entries: '++id, exerciseId, date, [exerciseId+timestamp]',
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

/** Deletes an exercise and all of its entries. */
export function deleteExercise(id: number, database: WorkoutDB = db) {
  return database.transaction('rw', database.exercises, database.entries, async () => {
    await database.entries.where('exerciseId').equals(id).delete();
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

export function validateEntry(e: { weight: number; reps: number; sets: number }): string | null {
  if (!Number.isFinite(e.weight) || e.weight < 0) return 'Weight must be 0 or more.';
  if (!Number.isInteger(e.reps) || e.reps < 1) return 'Reps must be a whole number of 1 or more.';
  if (!Number.isInteger(e.sets) || e.sets < 1) return 'Sets must be a whole number of 1 or more.';
  return null;
}

/** Records an entry stamped with the current day (or the given timestamp). */
export async function addEntry(input: NewEntry, database: WorkoutDB = db): Promise<number> {
  const error = validateEntry(input);
  if (error) throw new Error(error);
  const timestamp = input.timestamp ?? Date.now();
  const notes = input.notes?.trim();
  return database.entries.add({
    exerciseId: input.exerciseId,
    weight: input.weight,
    unit: input.unit,
    reps: input.reps,
    sets: input.sets,
    ...(notes ? { notes } : {}),
    timestamp,
    date: localDate(timestamp),
  } as Entry);
}

export async function updateEntry(
  id: number,
  changes: Pick<Entry, 'weight' | 'reps' | 'sets'> & { notes?: string },
  database: WorkoutDB = db,
) {
  const error = validateEntry(changes);
  if (error) throw new Error(error);
  await database.entries.update(id, { ...changes, notes: changes.notes?.trim() || undefined });
}

export function deleteEntry(id: number, database: WorkoutDB = db) {
  return database.entries.delete(id);
}

export interface Backup {
  app: 'workout-tracker';
  version: 1;
  exportedAt: string;
  exercises: Exercise[];
  entries: Entry[];
}

export async function exportData(database: WorkoutDB = db): Promise<Backup> {
  const [exercises, entries] = await Promise.all([
    database.exercises.toArray(),
    database.entries.toArray(),
  ]);
  return { app: 'workout-tracker', version: 1, exportedAt: new Date().toISOString(), exercises, entries };
}

/** Replaces all data with the contents of a backup. */
export async function importData(data: unknown, database: WorkoutDB = db) {
  const b = data as Partial<Backup>;
  if (!b || b.app !== 'workout-tracker' || !Array.isArray(b.exercises) || !Array.isArray(b.entries)) {
    throw new Error('This file is not a Workout Tracker backup.');
  }
  const ids = new Set(b.exercises.map((e) => e.id));
  if (b.entries.some((e) => !ids.has(e.exerciseId))) {
    throw new Error('Backup is damaged: some entries refer to missing exercises.');
  }
  await database.transaction('rw', database.exercises, database.entries, async () => {
    await database.entries.clear();
    await database.exercises.clear();
    await database.exercises.bulkAdd(b.exercises!);
    await database.entries.bulkAdd(b.entries!);
  });
  return { exercises: b.exercises.length, entries: b.entries.length };
}

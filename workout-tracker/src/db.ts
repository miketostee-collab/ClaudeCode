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

export interface Backup {
  app: 'workout-tracker';
  version: 2;
  exportedAt: string;
  exercises: Exercise[];
  entries: Entry[];
}

export async function exportData(database: WorkoutDB = db): Promise<Backup> {
  const [exercises, entries] = await Promise.all([
    database.exercises.toArray(),
    database.entries.toArray(),
  ]);
  return { app: 'workout-tracker', version: 2, exportedAt: new Date().toISOString(), exercises, entries };
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
  const ids = new Set(b.exercises.map((e) => e.id));
  if (entries.some((e) => !ids.has(e.exerciseId) || validateSets(e.sets))) {
    throw new Error('Backup is damaged: some entries are invalid or refer to missing exercises.');
  }
  await database.transaction('rw', database.exercises, database.entries, async () => {
    await database.entries.clear();
    await database.exercises.clear();
    await database.exercises.bulkAdd(b.exercises!);
    await database.entries.bulkAdd(entries);
  });
  return { exercises: b.exercises.length, entries: entries.length };
}

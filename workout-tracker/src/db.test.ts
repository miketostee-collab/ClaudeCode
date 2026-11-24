import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_EXERCISES,
  WorkoutDB,
  addEntry,
  addExercise,
  createWorkout,
  deleteExercise,
  deleteWorkout,
  getLastEntryOutside,
  getStartingEntry,
  repeatWorkout,
  getWorkoutByDate,
  listWorkoutEntries,
  listWorkouts,
  saveWorkoutEntry,
  updateWorkout,
  exportData,
  getLastEntry,
  importData,
  listEntries,
  listExercises,
  localDate,
  renameExercise,
  updateEntry,
  defaultExerciseId,
  untracked,
} from './db';

const ms = (weight: number, reps: number) => ({ weight, reps });

let db: WorkoutDB;
let n = 0;

beforeEach(async () => {
  db = new WorkoutDB(`test-${n++}`);
  await db.open();
});

afterEach(async () => {
  await db.delete();
});

async function benchId() {
  return (await db.exercises.where('name').equals('Bench Press').first())!.id;
}

describe('exercises', () => {
  it('seeds default exercises, sorted by name', async () => {
    const list = await listExercises(db);
    expect(list.map((e) => e.name)).toEqual([...DEFAULT_EXERCISES].sort());
  });

  it('adds, rejects duplicates case-insensitively, and renames', async () => {
    const id = await addExercise('  Sissy Squat ', db);
    expect((await db.exercises.get(id))!.name).toBe('Sissy Squat');
    await expect(addExercise('bench press', db)).rejects.toThrow(/already exists/);
    await expect(addExercise('   ', db)).rejects.toThrow(/required/);
    await renameExercise(id, 'Glute Bridge', db);
    expect((await db.exercises.get(id))!.name).toBe('Glute Bridge');
    await expect(renameExercise(id, 'Squat', db)).rejects.toThrow(/already exists/);
  });

  it('deleting an exercise removes its entries', async () => {
    const id = await benchId();
    await addEntry({ exerciseId: id, unit: 'lb', ...ms(100, 5) }, db);
    await deleteExercise(id, db);
    expect(await db.exercises.get(id)).toBeUndefined();
    expect(await db.entries.count()).toBe(0);
  });
});

describe('entries', () => {
  it('returns undefined when there is no history', async () => {
    expect(await getLastEntry(await benchId(), db)).toBeUndefined();
  });

  it('stamps entries with the local day and finds the most recent one', async () => {
    const bench = await benchId();
    const squat = (await db.exercises.where('name').equals('Squat').first())!.id;
    const day1 = new Date(2026, 10, 20, 18, 0).getTime();
    const day2 = new Date(2026, 10, 22, 7, 30).getTime();
    await addEntry({ exerciseId: bench, unit: 'lb', ...ms(185, 8), timestamp: day2 }, db);
    await addEntry({ exerciseId: bench, unit: 'lb', ...ms(175, 8), timestamp: day1 }, db);
    await addEntry({ exerciseId: squat, unit: 'lb', ...ms(225, 5), timestamp: day2 + 1000 }, db);

    const last = await getLastEntry(bench, db);
    expect(last).toMatchObject({ ...ms(185, 8), date: '2026-11-22' });
    expect((await listEntries(bench, db)).map((e) => e.weight)).toEqual([185, 175]);
  });

  it('defaults the date to today', async () => {
    const id = await addEntry({ exerciseId: await benchId(), unit: 'kg', ...ms(50, 10) }, db);
    expect((await db.entries.get(id))!.date).toBe(localDate());
  });

  it('stores a different weight and rep count for each set', async () => {
    const id = await addEntry(
      { exerciseId: await benchId(), unit: 'kg', weight: 80, reps: 5 },
      db,
    );
    expect(await db.entries.get(id)).toMatchObject({ weight: 80, reps: 5 });
  });

  it('validates sets', async () => {
    const id = await benchId();
    await expect(addEntry({ exerciseId: id, unit: 'kg', weight: -1, reps: 5 }, db)).rejects.toThrow(/Weight/);
    await expect(addEntry({ exerciseId: id, unit: 'kg', weight: NaN, reps: 5 }, db)).rejects.toThrow(/Weight/);
    await expect(addEntry({ exerciseId: id, unit: 'kg', weight: 10, reps: 0 }, db)).rejects.toThrow(/Reps/);
    await expect(addEntry({ exerciseId: id, unit: 'kg', weight: 10, reps: 1.5 }, db)).rejects.toThrow(/Reps/);
  });

  it('updates an entry', async () => {
    const id = await addEntry({ exerciseId: await benchId(), unit: 'lb', ...ms(100, 5) }, db);
    await updateEntry(id, { weight: 105, reps: 6, notes: ' felt good ' }, db);
    expect(await db.entries.get(id)).toMatchObject({ weight: 105, reps: 6, notes: 'felt good' });
  });
});

describe('backup', () => {
  it('round-trips export and import', async () => {
    await addEntry({ exerciseId: await benchId(), unit: 'lb', ...ms(100, 5) }, db);
    const backup = JSON.parse(JSON.stringify(await exportData(db)));

    const other = new WorkoutDB(`test-${n++}`);
    await other.open();
    const result = await importData(backup, other);
    expect(result).toEqual({ exercises: DEFAULT_EXERCISES.length, entries: 1, workouts: 0 });
    const plain = (rows: object[]) => rows.map((row) => { const { updatedAt: _u, dirty: _d, ...r } = row as Record<string, unknown>; return r; });
    expect(plain(await other.entries.toArray())).toEqual(plain(await db.entries.toArray()));
    await other.delete();
  });

  it('refuses backups from the multi-set version, leaving data untouched', async () => {
    await addEntry({ exerciseId: await benchId(), unit: 'kg', ...ms(80, 5) }, db);
    const v4 = { app: 'workout-tracker', version: 4, exercises: [{ id: 'x', name: 'Squat' }], entries: [], workouts: [] };
    await expect(importData(v4, db)).rejects.toThrow(/older multi-set version/);
    expect(await db.entries.count()).toBe(1);
  });

  it('rejects files that are not backups', async () => {
    await expect(importData({ hello: 'world' }, db)).rejects.toThrow(/not a Workout Tracker backup/);
    expect(await db.exercises.count()).toBe(DEFAULT_EXERCISES.length);
  });
});

async function makeOld(name: string, version: number, stores: Record<string, string>) {
  const old = new Dexie(name);
  old.version(version).stores(stores);
  await old.open();
  return old;
}

describe('upgrade from version 1', () => {
  it('keeps exercises (adding new defaults) and clears the old multi-set history', async () => {
    const name = `test-upgrade-${n++}`;
    const old = await makeOld(name, 1, { exercises: '++id, &name', entries: '++id, exerciseId, date, [exerciseId+timestamp]' });
    const benchId = await old.table('exercises').add({ name: 'Bench Press' });
    await old.table('exercises').add({ name: 'hip thrust' });
    await old.table('exercises').add({ name: 'Zercher Squat' });
    await old.table('entries').add({ exerciseId: benchId, date: '2026-11-20', timestamp: 5, weight: 185, unit: 'lb', reps: 8, sets: 3 });
    old.close();

    const upgraded = new WorkoutDB(name);
    await upgraded.open();
    expect(await getLastEntry(defaultExerciseId('Bench Press')!, upgraded)).toBeUndefined();
    expect(await upgraded.entries.count()).toBe(0);
    const names = (await listExercises(upgraded)).map((e) => e.name.toLowerCase());
    expect(names.filter((x) => x === 'hip thrust')).toHaveLength(1);
    expect(names).toContain('zercher squat');
    expect(names).toHaveLength(DEFAULT_EXERCISES.length + 1);
    await upgraded.delete();
  });
});

describe('upgrade from version 3', () => {
  it('moves exercises to cross-device ids and clears workouts and entries, recording the deletes for sync', async () => {
    const name = `test-upgrade3-${n++}`;
    const old = await makeOld(name, 3, {
      exercises: '++id, &name',
      entries: '++id, exerciseId, date, workoutId, [exerciseId+timestamp]',
      workouts: '++id, &date',
    });
    const bench = (await old.table('exercises').add({ name: 'Bench Press' })) as number;
    const mine = (await old.table('exercises').add({ name: 'Cable Crunch' })) as number;
    const w1 = await old.table('workouts').add({ date: '2026-11-01', exerciseIds: [bench, mine], createdAt: 1, name: 'A' });
    await old.table('entries').add({ exerciseId: mine, workoutId: w1, date: '2026-11-01', timestamp: 9, unit: 'kg', sets: [{ weight: 30, reps: 12 }] });
    old.close();

    const up = new WorkoutDB(name);
    await up.open();
    const ex = await listExercises(up);
    expect(ex.find((e) => e.name === 'Bench Press')).toMatchObject({ id: 'default:bench-press', dirty: 0 });
    const mineRow = ex.find((e) => e.name === 'Cable Crunch')!;
    expect(mineRow.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(mineRow.dirty).toBe(1);
    expect(await up.workouts.count()).toBe(0);
    expect(await up.entries.count()).toBe(0);
    expect((await up.pendingDeletes.toArray()).map((d) => d.table).sort()).toEqual(['entries', 'workouts']);
    expect(up.tables.map((t) => t.name).sort()).toEqual(['entries_u', 'exercises_u', 'meta', 'pendingDeletes', 'workouts_u']);
    await up.delete();
  });
});

describe('change tracking', () => {
  it('seeds built-in exercises with fixed ids and no pending changes', async () => {
    const ex = await listExercises(db);
    expect(ex.every((e) => e.id.startsWith('default:') && e.dirty === 0 && e.updatedAt === 0)).toBe(true);
  });

  it('flags adds and edits for upload and records deletes', async () => {
    const id = await addExercise('Cable Crunch', db);
    expect(await db.exercises.get(id)).toMatchObject({ dirty: 1 });
    const bench = await benchId();
    await renameExercise(bench, 'Flat Bench', db);
    expect(await db.exercises.get(bench)).toMatchObject({ dirty: 1, name: 'Flat Bench' });
    const e = await addEntry({ exerciseId: bench, unit: 'kg', ...ms(80, 5) }, db);
    await deleteExercise(bench, db);
    const keys = (await db.pendingDeletes.toArray()).map((d) => d.key).sort();
    expect(keys).toEqual([`entries:${e}`, `exercises:${bench}`]);
  });

  it('does not track changes made in an untracked transaction', async () => {
    const bench = await benchId();
    await db.transaction('rw', db.all, async (tx) => {
      untracked(tx);
      await db.exercises.update(bench, { name: 'Remote name' });
      await db.exercises.delete(defaultExerciseId('Squat')!);
    });
    expect(await db.exercises.get(bench)).toMatchObject({ dirty: 0, name: 'Remote name' });
    expect(await db.pendingDeletes.count()).toBe(0);
  });
});

describe('workouts', () => {
  async function ids(...names: string[]) {
    return Promise.all(names.map(async (n) => (await db.exercises.where('name').equals(n).first())!.id));
  }

  it("creates today's workout, one per day", async () => {
    const [bench, squat] = await ids('Bench Press', 'Squat');
    const id = await createWorkout({ exerciseIds: [bench, squat, bench], name: ' Push ' }, db);
    const w = (await getWorkoutByDate(localDate(), db))!;
    expect(w).toMatchObject({ id, exerciseIds: [bench, squat], name: 'Push' });
    await expect(createWorkout({ exerciseIds: [bench] }, db)).rejects.toThrow(/already a workout/);
    await expect(createWorkout({ exerciseIds: [], date: '2026-01-01' }, db)).rejects.toThrow(/at least one/);
  });

  it('saves one entry per exercise and replaces it on re-save', async () => {
    const [bench, squat] = await ids('Bench Press', 'Squat');
    const w = await createWorkout({ exerciseIds: [bench] }, db);
    const e1 = await saveWorkoutEntry(w, bench, { unit: 'kg', ...ms(80, 8) }, db);
    const e2 = await saveWorkoutEntry(w, bench, { unit: 'kg', weight: 85, reps: 5 }, db);
    expect(e2).toBe(e1);
    const entries = await listWorkoutEntries(w, db);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ workoutId: w, date: localDate(), weight: 85, reps: 5 });
    await expect(saveWorkoutEntry(w, squat, { unit: 'kg', ...ms(100, 5) }, db)).rejects.toThrow(/not in this workout/);
  });

  it('removing an exercise from the workout deletes its entry there', async () => {
    const [bench, squat, row] = await ids('Bench Press', 'Squat', 'Barbell Row');
    const w = await createWorkout({ exerciseIds: [bench, squat] }, db);
    await saveWorkoutEntry(w, bench, { unit: 'kg', ...ms(80, 8) }, db);
    await saveWorkoutEntry(w, squat, { unit: 'kg', ...ms(100, 5) }, db);
    await updateWorkout(w, { exerciseIds: [squat, row] }, db);
    expect((await db.workouts.get(w))!.exerciseIds).toEqual([squat, row]);
    expect((await listWorkoutEntries(w, db)).map((e) => e.exerciseId)).toEqual([squat]);
    await expect(updateWorkout(w, { exerciseIds: [] }, db)).rejects.toThrow(/at least one/);
  });

  it('finds the last entry from before this workout', async () => {
    const [bench] = await ids('Bench Press');
    await addEntry({ exerciseId: bench, unit: 'kg', ...ms(75, 8), timestamp: 1000 }, db);
    const w = await createWorkout({ exerciseIds: [bench] }, db);
    await saveWorkoutEntry(w, bench, { unit: 'kg', ...ms(80, 8) }, db);
    expect((await getLastEntryOutside(bench, w, db))!.weight).toBe(75);
  });

  it('lists newest first, and deleting removes its entries', async () => {
    const [bench] = await ids('Bench Press');
    const older = await createWorkout({ exerciseIds: [bench], date: '2026-11-01' }, db);
    const newer = await createWorkout({ exerciseIds: [bench], date: '2026-11-10' }, db);
    expect((await listWorkouts(db)).map((w) => w.id)).toEqual([newer, older]);
    await saveWorkoutEntry(older, bench, { unit: 'kg', ...ms(80, 8) }, db);
    await deleteWorkout(older, db);
    expect(await db.workouts.count()).toBe(1);
    expect(await db.entries.count()).toBe(0);
  });

  it('repeats a workout with the same name, exercises and order, starting from its sets', async () => {
    const [bench, squat, row] = await ids('Bench Press', 'Squat', 'Barbell Row');
    const src = await createWorkout({ exerciseIds: [squat, bench, row], name: 'Full body', date: '2026-11-20' }, db);
    await saveWorkoutEntry(src, squat, { unit: 'kg', weight: 110, reps: 3 }, db);
    await saveWorkoutEntry(src, bench, { unit: 'kg', ...ms(80, 8) }, db);
    // A newer one-off squat entry must not override the repeated workout's sets.
    await addEntry({ exerciseId: squat, unit: 'kg', ...ms(60, 10), timestamp: Date.now() - 1000 }, db);

    const id = await repeatWorkout(src, undefined, db);
    const w = (await db.workouts.get(id))!;
    expect(w).toMatchObject({ date: localDate(), name: 'Full body', exerciseIds: [squat, bench, row], copiedFrom: src });
    expect(await getStartingEntry(w, squat, db)).toMatchObject({ weight: 110, reps: 3 });
    expect((await getStartingEntry(w, bench, db))!).toMatchObject(ms(80, 8));
    // Not logged in the source: falls back to the last entry, or nothing.
    expect(await getStartingEntry(w, row, db)).toBeUndefined();
    await expect(repeatWorkout(src, undefined, db)).rejects.toThrow(/already a workout/);
  });

  it("can replace today's workout with a repeat", async () => {
    const [bench, squat] = await ids('Bench Press', 'Squat');
    const src = await createWorkout({ exerciseIds: [squat], name: 'Legs', date: '2026-11-20' }, db);
    await saveWorkoutEntry(src, squat, { unit: 'kg', ...ms(100, 5) }, db);
    const todayId = await createWorkout({ exerciseIds: [bench] }, db);
    await saveWorkoutEntry(todayId, bench, { unit: 'kg', ...ms(80, 8) }, db);

    await expect(repeatWorkout(src, undefined, db)).rejects.toThrow(/already a workout/);
    const id = await repeatWorkout(src, undefined, db, true);
    const w = (await getWorkoutByDate(localDate(), db))!;
    expect(w).toMatchObject({ id, name: 'Legs', exerciseIds: [squat], copiedFrom: src });
    expect(await db.workouts.get(todayId)).toBeUndefined();
    expect(await listWorkoutEntries(todayId, db)).toHaveLength(0);
    // Source untouched; repeating today's own workout onto itself is refused.
    expect(await listWorkoutEntries(src, db)).toHaveLength(1);
    await expect(repeatWorkout(id, undefined, db, true)).rejects.toThrow(/already today's/);
  });

  it('falls back to the last entry if the source workout was deleted', async () => {
    const [bench] = await ids('Bench Press');
    const src = await createWorkout({ exerciseIds: [bench], date: '2026-11-20' }, db);
    await saveWorkoutEntry(src, bench, { unit: 'kg', ...ms(80, 8) }, db);
    await addEntry({ exerciseId: bench, unit: 'kg', ...ms(70, 10), timestamp: 5 }, db);
    const id = await repeatWorkout(src, undefined, db);
    await deleteWorkout(src, db);
    const w = (await db.workouts.get(id))!;
    expect((await getStartingEntry(w, bench, db))!).toMatchObject(ms(70, 10));
  });

  it('deleting an exercise removes it from workouts', async () => {
    const [bench, squat] = await ids('Bench Press', 'Squat');
    const w = await createWorkout({ exerciseIds: [bench, squat] }, db);
    await deleteExercise(bench, db);
    expect((await db.workouts.get(w))!.exerciseIds).toEqual([squat]);
  });

  it('round-trips workouts through a backup', async () => {
    const [bench] = await ids('Bench Press');
    const w = await createWorkout({ exerciseIds: [bench] }, db);
    await saveWorkoutEntry(w, bench, { unit: 'kg', ...ms(80, 8) }, db);
    const backup = JSON.parse(JSON.stringify(await exportData(db)));
    const other = new WorkoutDB(`test-${n++}`);
    await other.open();
    expect(await importData(backup, other)).toMatchObject({ workouts: 1, entries: 1 });
    expect((await listWorkoutEntries(w, other))[0].workoutId).toBe(w);
    await other.delete();
  });
});

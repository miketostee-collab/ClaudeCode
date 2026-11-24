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

const sets = (weight: number, reps: number, n: number) => Array.from({ length: n }, () => ({ weight, reps }));

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
    await addEntry({ exerciseId: id, unit: 'lb', sets: sets(100, 5, 3) }, db);
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
    await addEntry({ exerciseId: bench, unit: 'lb', sets: sets(185, 8, 3), timestamp: day2 }, db);
    await addEntry({ exerciseId: bench, unit: 'lb', sets: sets(175, 8, 3), timestamp: day1 }, db);
    await addEntry({ exerciseId: squat, unit: 'lb', sets: sets(225, 5, 5), timestamp: day2 + 1000 }, db);

    const last = await getLastEntry(bench, db);
    expect(last).toMatchObject({ sets: sets(185, 8, 3), date: '2026-11-22' });
    expect((await listEntries(bench, db)).map((e) => e.sets[0].weight)).toEqual([185, 175]);
  });

  it('defaults the date to today', async () => {
    const id = await addEntry({ exerciseId: await benchId(), unit: 'kg', sets: sets(50, 10, 2) }, db);
    expect((await db.entries.get(id))!.date).toBe(localDate());
  });

  it('stores a different weight and rep count for each set', async () => {
    const id = await addEntry(
      { exerciseId: await benchId(), unit: 'kg', sets: [{ weight: 60, reps: 10 }, { weight: 70, reps: 8 }, { weight: 80, reps: 5 }] },
      db,
    );
    expect((await db.entries.get(id))!.sets).toEqual([{ weight: 60, reps: 10 }, { weight: 70, reps: 8 }, { weight: 80, reps: 5 }]);
  });

  it('validates sets', async () => {
    const id = await benchId();
    await expect(addEntry({ exerciseId: id, unit: 'kg', sets: [] }, db)).rejects.toThrow(/at least one set/);
    await expect(addEntry({ exerciseId: id, unit: 'kg', sets: [{ weight: 10, reps: 5 }, { weight: -1, reps: 5 }] }, db)).rejects.toThrow(/Set 2: weight/);
    await expect(addEntry({ exerciseId: id, unit: 'kg', sets: [{ weight: 10, reps: 0 }] }, db)).rejects.toThrow(/Set 1: reps/);
    await expect(addEntry({ exerciseId: id, unit: 'kg', sets: [{ weight: 10, reps: 1.5 }] }, db)).rejects.toThrow(/reps/);
  });

  it('updates an entry', async () => {
    const id = await addEntry({ exerciseId: await benchId(), unit: 'lb', sets: sets(100, 5, 3) }, db);
    await updateEntry(id, { sets: [{ weight: 105, reps: 6 }, { weight: 100, reps: 5 }], notes: ' felt good ' }, db);
    expect(await db.entries.get(id)).toMatchObject({ sets: [{ weight: 105, reps: 6 }, { weight: 100, reps: 5 }], notes: 'felt good' });
  });
});

describe('backup', () => {
  it('round-trips export and import', async () => {
    await addEntry({ exerciseId: await benchId(), unit: 'lb', sets: sets(100, 5, 3) }, db);
    const backup = JSON.parse(JSON.stringify(await exportData(db)));

    const other = new WorkoutDB(`test-${n++}`);
    await other.open();
    const result = await importData(backup, other);
    expect(result).toEqual({ exercises: DEFAULT_EXERCISES.length, entries: 1, workouts: 0 });
    const plain = (rows: object[]) => rows.map((row) => { const { updatedAt: _u, dirty: _d, ...r } = row as Record<string, unknown>; return r; });
    expect(plain(await other.entries.toArray())).toEqual(plain(await db.entries.toArray()));
    await other.delete();
  });

  it('imports a version 1 backup (number ids) by expanding each entry into sets', async () => {
    const v1 = {
      app: 'workout-tracker',
      version: 1,
      exercises: [
        { id: 1, name: 'Bench Press' },
        { id: 2, name: 'Zercher Squat' },
      ],
      entries: [
        { id: 1, exerciseId: 1, date: '2026-11-20', timestamp: 1, weight: 80, unit: 'kg', reps: 8, sets: 3 },
        { id: 2, exerciseId: 2, date: '2026-11-20', timestamp: 2, weight: 60, unit: 'kg', reps: 5, sets: 1 },
      ],
    };
    await importData(v1, db);
    // Built-in exercises get their fixed id; others a fresh one.
    expect((await getLastEntry(defaultExerciseId('Bench Press')!, db))!.sets).toEqual(sets(80, 8, 3));
    const zercher = (await listExercises(db)).find((e) => e.name === 'Zercher Squat')!;
    expect(typeof zercher.id).toBe('string');
    expect((await getLastEntry(zercher.id, db))!.sets).toEqual(sets(60, 5, 1));
  });

  it('imports a version 3 backup with workouts', async () => {
    const v3 = {
      app: 'workout-tracker',
      version: 3,
      exercises: [{ id: 7, name: 'Squat' }],
      workouts: [
        { id: 1, date: '2026-11-01', exerciseIds: [7], createdAt: 1 },
        { id: 2, date: '2026-11-08', exerciseIds: [7], createdAt: 2, copiedFrom: 1 },
      ],
      entries: [{ id: 3, exerciseId: 7, workoutId: 1, date: '2026-11-01', timestamp: 1, unit: 'kg', sets: sets(100, 5, 2) }],
    };
    await importData(v3, db);
    const [newer, older] = await listWorkouts(db);
    expect(newer.copiedFrom).toBe(older.id);
    expect(older.exerciseIds).toEqual([defaultExerciseId('Squat')]);
    expect((await listWorkoutEntries(older.id, db))[0].sets).toEqual(sets(100, 5, 2));
  });

  it('rejects files that are not backups', async () => {
    await expect(importData({ hello: 'world' }, db)).rejects.toThrow(/not a Workout Tracker backup/);
    expect(await db.exercises.count()).toBe(DEFAULT_EXERCISES.length);
  });
});

describe('upgrade from version 1', () => {
  it('converts old entries to per-set lists and adds the new default exercises', async () => {
    const name = `test-upgrade-${n++}`;
    const old = new Dexie(name);
    old.version(1).stores({ exercises: '++id, &name', entries: '++id, exerciseId, date, [exerciseId+timestamp]' });
    await old.open();
    const benchId = await old.table('exercises').add({ name: 'Bench Press' });
    await old.table('exercises').add({ name: 'hip thrust' });
    await old.table('entries').add({ exerciseId: benchId, date: '2026-11-20', timestamp: 5, weight: 185, unit: 'lb', reps: 8, sets: 3 });
    old.close();

    expect(benchId).toBe(1);

    const upgraded = new WorkoutDB(name);
    await upgraded.open();
    expect((await getLastEntry(defaultExerciseId('Bench Press')!, upgraded))!).toMatchObject({ unit: 'lb', sets: sets(185, 8, 3) });
    const names = (await listExercises(upgraded)).map((e) => e.name.toLowerCase());
    expect(names.filter((x) => x === 'hip thrust')).toHaveLength(1);
    expect(names).toHaveLength(DEFAULT_EXERCISES.length);
    await upgraded.delete();
  });
});

describe('upgrade from version 3', () => {
  it('moves rows to cross-device ids, keeping links, and flags them for upload', async () => {
    const name = `test-upgrade3-${n++}`;
    const old = new Dexie(name);
    old.version(3).stores({
      exercises: '++id, &name',
      entries: '++id, exerciseId, date, workoutId, [exerciseId+timestamp]',
      workouts: '++id, &date',
    });
    await old.open();
    const bench = (await old.table('exercises').add({ name: 'Bench Press' })) as number;
    const mine = (await old.table('exercises').add({ name: 'Cable Crunch' })) as number;
    const w1 = await old.table('workouts').add({ date: '2026-11-01', exerciseIds: [bench, mine], createdAt: 1, name: 'A' });
    await old.table('workouts').add({ date: '2026-11-08', exerciseIds: [mine], createdAt: 2, copiedFrom: w1 });
    await old.table('entries').add({ exerciseId: mine, workoutId: w1, date: '2026-11-01', timestamp: 9, unit: 'kg', sets: sets(30, 12, 3) });
    old.close();

    const up = new WorkoutDB(name);
    await up.open();
    const ex = await listExercises(up);
    const benchRow = ex.find((e) => e.name === 'Bench Press')!;
    const mineRow = ex.find((e) => e.name === 'Cable Crunch')!;
    expect(benchRow).toMatchObject({ id: 'default:bench-press', dirty: 0 });
    expect(mineRow.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(mineRow.dirty).toBe(1);
    const [newer, older] = await listWorkouts(up);
    expect(older).toMatchObject({ name: 'A', exerciseIds: [benchRow.id, mineRow.id], dirty: 1 });
    expect(newer.copiedFrom).toBe(older.id);
    const entries = await listWorkoutEntries(older.id, up);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ exerciseId: mineRow.id, sets: sets(30, 12, 3), dirty: 1 });
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
    const e = await addEntry({ exerciseId: bench, unit: 'kg', sets: sets(80, 5, 1) }, db);
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
    const e1 = await saveWorkoutEntry(w, bench, { unit: 'kg', sets: sets(80, 8, 3) }, db);
    const e2 = await saveWorkoutEntry(w, bench, { unit: 'kg', sets: [{ weight: 85, reps: 5 }] }, db);
    expect(e2).toBe(e1);
    const entries = await listWorkoutEntries(w, db);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ workoutId: w, date: localDate(), sets: [{ weight: 85, reps: 5 }] });
    await expect(saveWorkoutEntry(w, squat, { unit: 'kg', sets: sets(100, 5, 1) }, db)).rejects.toThrow(/not in this workout/);
  });

  it('removing an exercise from the workout deletes its entry there', async () => {
    const [bench, squat, row] = await ids('Bench Press', 'Squat', 'Barbell Row');
    const w = await createWorkout({ exerciseIds: [bench, squat] }, db);
    await saveWorkoutEntry(w, bench, { unit: 'kg', sets: sets(80, 8, 1) }, db);
    await saveWorkoutEntry(w, squat, { unit: 'kg', sets: sets(100, 5, 1) }, db);
    await updateWorkout(w, { exerciseIds: [squat, row] }, db);
    expect((await db.workouts.get(w))!.exerciseIds).toEqual([squat, row]);
    expect((await listWorkoutEntries(w, db)).map((e) => e.exerciseId)).toEqual([squat]);
    await expect(updateWorkout(w, { exerciseIds: [] }, db)).rejects.toThrow(/at least one/);
  });

  it('finds the last entry from before this workout', async () => {
    const [bench] = await ids('Bench Press');
    await addEntry({ exerciseId: bench, unit: 'kg', sets: sets(75, 8, 3), timestamp: 1000 }, db);
    const w = await createWorkout({ exerciseIds: [bench] }, db);
    await saveWorkoutEntry(w, bench, { unit: 'kg', sets: sets(80, 8, 3) }, db);
    expect((await getLastEntryOutside(bench, w, db))!.sets[0].weight).toBe(75);
  });

  it('lists newest first, and deleting removes its entries', async () => {
    const [bench] = await ids('Bench Press');
    const older = await createWorkout({ exerciseIds: [bench], date: '2026-11-01' }, db);
    const newer = await createWorkout({ exerciseIds: [bench], date: '2026-11-10' }, db);
    expect((await listWorkouts(db)).map((w) => w.id)).toEqual([newer, older]);
    await saveWorkoutEntry(older, bench, { unit: 'kg', sets: sets(80, 8, 1) }, db);
    await deleteWorkout(older, db);
    expect(await db.workouts.count()).toBe(1);
    expect(await db.entries.count()).toBe(0);
  });

  it('repeats a workout with the same name, exercises and order, starting from its sets', async () => {
    const [bench, squat, row] = await ids('Bench Press', 'Squat', 'Barbell Row');
    const src = await createWorkout({ exerciseIds: [squat, bench, row], name: 'Full body', date: '2026-11-20' }, db);
    await saveWorkoutEntry(src, squat, { unit: 'kg', sets: [{ weight: 100, reps: 5 }, { weight: 105, reps: 5 }, { weight: 110, reps: 3 }] }, db);
    await saveWorkoutEntry(src, bench, { unit: 'kg', sets: sets(80, 8, 4) }, db);
    // A newer one-off squat entry must not override the repeated workout's sets.
    await addEntry({ exerciseId: squat, unit: 'kg', sets: sets(60, 10, 1), timestamp: Date.now() - 1000 }, db);

    const id = await repeatWorkout(src, undefined, db);
    const w = (await db.workouts.get(id))!;
    expect(w).toMatchObject({ date: localDate(), name: 'Full body', exerciseIds: [squat, bench, row], copiedFrom: src });
    expect((await getStartingEntry(w, squat, db))!.sets).toHaveLength(3);
    expect((await getStartingEntry(w, squat, db))!.sets[2]).toEqual({ weight: 110, reps: 3 });
    expect((await getStartingEntry(w, bench, db))!.sets).toEqual(sets(80, 8, 4));
    // Not logged in the source: falls back to the last entry, or nothing.
    expect(await getStartingEntry(w, row, db)).toBeUndefined();
    await expect(repeatWorkout(src, undefined, db)).rejects.toThrow(/already a workout/);
  });

  it("can replace today's workout with a repeat", async () => {
    const [bench, squat] = await ids('Bench Press', 'Squat');
    const src = await createWorkout({ exerciseIds: [squat], name: 'Legs', date: '2026-11-20' }, db);
    await saveWorkoutEntry(src, squat, { unit: 'kg', sets: sets(100, 5, 3) }, db);
    const todayId = await createWorkout({ exerciseIds: [bench] }, db);
    await saveWorkoutEntry(todayId, bench, { unit: 'kg', sets: sets(80, 8, 1) }, db);

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
    await saveWorkoutEntry(src, bench, { unit: 'kg', sets: sets(80, 8, 2) }, db);
    await addEntry({ exerciseId: bench, unit: 'kg', sets: sets(70, 10, 1), timestamp: 5 }, db);
    const id = await repeatWorkout(src, undefined, db);
    await deleteWorkout(src, db);
    const w = (await db.workouts.get(id))!;
    expect((await getStartingEntry(w, bench, db))!.sets).toEqual(sets(70, 10, 1));
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
    await saveWorkoutEntry(w, bench, { unit: 'kg', sets: sets(80, 8, 1) }, db);
    const backup = JSON.parse(JSON.stringify(await exportData(db)));
    const other = new WorkoutDB(`test-${n++}`);
    await other.open();
    expect(await importData(backup, other)).toMatchObject({ workouts: 1, entries: 1 });
    expect((await listWorkoutEntries(w, other))[0].workoutId).toBe(w);
    await other.delete();
  });
});

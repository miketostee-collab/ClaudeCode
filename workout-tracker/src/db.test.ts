import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_EXERCISES,
  WorkoutDB,
  addEntry,
  addExercise,
  deleteExercise,
  exportData,
  getLastEntry,
  importData,
  listEntries,
  listExercises,
  localDate,
  renameExercise,
  updateEntry,
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
    expect(result).toEqual({ exercises: DEFAULT_EXERCISES.length, entries: 1 });
    expect(await other.entries.toArray()).toEqual(await db.entries.toArray());
    await other.delete();
  });

  it('imports a version 1 backup by expanding each entry into sets', async () => {
    const bench = await benchId();
    const exercises = await db.exercises.toArray();
    const v1 = {
      app: 'workout-tracker',
      version: 1,
      exercises,
      entries: [{ id: 1, exerciseId: bench, date: '2026-11-20', timestamp: 1, weight: 80, unit: 'kg', reps: 8, sets: 3 }],
    };
    await importData(v1, db);
    expect((await getLastEntry(bench, db))!.sets).toEqual(sets(80, 8, 3));
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

    const upgraded = new WorkoutDB(name);
    await upgraded.open();
    expect((await getLastEntry(benchId as number, upgraded))!).toMatchObject({ unit: 'lb', sets: sets(185, 8, 3) });
    const names = (await listExercises(upgraded)).map((e) => e.name.toLowerCase());
    expect(names.filter((x) => x === 'hip thrust')).toHaveLength(1);
    expect(names).toHaveLength(DEFAULT_EXERCISES.length);
    await upgraded.delete();
  });
});

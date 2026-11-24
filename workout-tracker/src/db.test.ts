import 'fake-indexeddb/auto';
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
    const id = await addExercise('  Hip Thrust ', db);
    expect((await db.exercises.get(id))!.name).toBe('Hip Thrust');
    await expect(addExercise('bench press', db)).rejects.toThrow(/already exists/);
    await expect(addExercise('   ', db)).rejects.toThrow(/required/);
    await renameExercise(id, 'Glute Bridge', db);
    expect((await db.exercises.get(id))!.name).toBe('Glute Bridge');
    await expect(renameExercise(id, 'Squat', db)).rejects.toThrow(/already exists/);
  });

  it('deleting an exercise removes its entries', async () => {
    const id = await benchId();
    await addEntry({ exerciseId: id, weight: 100, unit: 'lb', reps: 5, sets: 3 }, db);
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
    await addEntry({ exerciseId: bench, weight: 185, unit: 'lb', reps: 8, sets: 3, timestamp: day2 }, db);
    await addEntry({ exerciseId: bench, weight: 175, unit: 'lb', reps: 8, sets: 3, timestamp: day1 }, db);
    await addEntry({ exerciseId: squat, weight: 225, unit: 'lb', reps: 5, sets: 5, timestamp: day2 + 1000 }, db);

    const last = await getLastEntry(bench, db);
    expect(last).toMatchObject({ weight: 185, reps: 8, sets: 3, date: '2026-11-22' });
    expect((await listEntries(bench, db)).map((e) => e.weight)).toEqual([185, 175]);
  });

  it('defaults the date to today', async () => {
    const id = await addEntry({ exerciseId: await benchId(), weight: 50, unit: 'kg', reps: 10, sets: 2 }, db);
    expect((await db.entries.get(id))!.date).toBe(localDate());
  });

  it('validates numbers', async () => {
    const id = await benchId();
    await expect(addEntry({ exerciseId: id, weight: -1, unit: 'lb', reps: 5, sets: 1 }, db)).rejects.toThrow(/Weight/);
    await expect(addEntry({ exerciseId: id, weight: 10, unit: 'lb', reps: 0, sets: 1 }, db)).rejects.toThrow(/Reps/);
    await expect(addEntry({ exerciseId: id, weight: 10, unit: 'lb', reps: 5, sets: 1.5 }, db)).rejects.toThrow(/Sets/);
  });

  it('updates an entry', async () => {
    const id = await addEntry({ exerciseId: await benchId(), weight: 100, unit: 'lb', reps: 5, sets: 3 }, db);
    await updateEntry(id, { weight: 105, reps: 6, sets: 3, notes: ' felt good ' }, db);
    expect(await db.entries.get(id)).toMatchObject({ weight: 105, reps: 6, notes: 'felt good' });
  });
});

describe('backup', () => {
  it('round-trips export and import', async () => {
    await addEntry({ exerciseId: await benchId(), weight: 100, unit: 'lb', reps: 5, sets: 3 }, db);
    const backup = JSON.parse(JSON.stringify(await exportData(db)));

    const other = new WorkoutDB(`test-${n++}`);
    await other.open();
    const result = await importData(backup, other);
    expect(result).toEqual({ exercises: DEFAULT_EXERCISES.length, entries: 1 });
    expect(await other.entries.toArray()).toEqual(await db.entries.toArray());
    await other.delete();
  });

  it('rejects files that are not backups', async () => {
    await expect(importData({ hello: 'world' }, db)).rejects.toThrow(/not a Workout Tracker backup/);
    expect(await db.exercises.count()).toBe(DEFAULT_EXERCISES.length);
  });
});

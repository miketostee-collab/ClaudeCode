import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  WorkoutDB,
  addEntry,
  addExercise,
  createWorkout,
  defaultExerciseId,
  deleteEntry,
  deleteExercise,
  getLastEntry,
  listExercises,
  listWorkoutEntries,
  listWorkouts,
  localDate,
  renameExercise,
  saveWorkoutEntry,
  updateEntry,
} from './db';
import type { SyncedTable } from './db';
import { type Remote, type RemoteRow, sync } from './sync';

/** An in-memory server shared by simulated devices, with per-user rows like the real one. */
class FakeServer {
  rows = new Map<string, RemoteRow & { user_id: string }>();
  private clock = Date.parse('2026-01-01T00:00:00Z');
  user: string | null = 'user-a';
  failNextUpsert = false;

  remote(): Remote {
    return {
      userId: async () => this.user,
      pull: async (table: SyncedTable, since: string | null) =>
        [...this.rows.values()]
          .filter((r) => r.user_id === this.user && r.table === table && (!since || r.updated_at! >= since))
          .sort((a, b) => a.updated_at!.localeCompare(b.updated_at!))
          .map(({ user_id: _u, table: _t, ...r }) => ({ ...r }) as RemoteRow),
      upsert: async (table: SyncedTable, rows: RemoteRow[]) => {
        if (this.failNextUpsert) {
          this.failNextUpsert = false;
          throw new Error('offline');
        }
        for (const r of rows) {
          const key = `${this.user}|${table}|${r.id}`;
          this.rows.set(key, {
            ...(this.rows.get(key) ?? {}),
            ...structuredClone(r),
            table,
            user_id: this.user!,
            updated_at: new Date((this.clock += 1000)).toISOString(),
          });
        }
      },
    };
  }

  live(table: SyncedTable) {
    return [...this.rows.values()].filter((r) => r.user_id === this.user && r.table === table && !r.deleted_at);
  }
}

const sets = (weight: number, reps: number, n: number) => Array.from({ length: n }, () => ({ weight, reps }));
const BENCH = defaultExerciseId('Bench Press')!;
const SQUAT = defaultExerciseId('Squat')!;

let server: FakeServer;
let phone: WorkoutDB;
let laptop: WorkoutDB;
let n = 0;

beforeEach(async () => {
  server = new FakeServer();
  phone = new WorkoutDB(`sync-phone-${n}`);
  laptop = new WorkoutDB(`sync-laptop-${n++}`);
  await Promise.all([phone.open(), laptop.open()]);
});

afterEach(async () => {
  await Promise.all([phone.delete(), laptop.delete()]);
});

const syncBoth = async () => {
  await sync(phone, server.remote());
  await sync(laptop, server.remote());
  await sync(phone, server.remote());
};

describe('sync between two devices', () => {
  it('does nothing when signed out', async () => {
    server.user = null;
    expect(await sync(phone, server.remote())).toBeNull();
    expect(server.rows.size).toBe(0);
  });

  it('copies entries and workouts to the other device', async () => {
    const w = await createWorkout({ exerciseIds: [BENCH, SQUAT], name: 'Push' }, phone);
    await saveWorkoutEntry(w, BENCH, { unit: 'kg', sets: sets(80, 8, 3), notes: 'easy' }, phone);
    await addEntry({ exerciseId: SQUAT, unit: 'lb', sets: sets(225, 5, 1), timestamp: 1000 }, phone);

    await syncBoth();

    const [lw] = await listWorkouts(laptop);
    expect(lw).toMatchObject({ id: w, date: localDate(), name: 'Push', exerciseIds: [BENCH, SQUAT], dirty: 0 });
    const [le] = await listWorkoutEntries(w, laptop);
    expect(le).toMatchObject({ exerciseId: BENCH, unit: 'kg', sets: sets(80, 8, 3), notes: 'easy' });
    expect((await getLastEntry(SQUAT, laptop))!).toMatchObject({ unit: 'lb', timestamp: 1000, date: localDate(1000) });
    // Built-in exercises are the same rows everywhere, so nothing is duplicated.
    expect(await laptop.exercises.count()).toBe(await phone.exercises.count());
    expect(await phone.exercises.where('dirty').equals(1).count()).toBe(0);
  });

  it('copies edits and deletes, and the newer change wins', async () => {
    const e = await addEntry({ exerciseId: BENCH, unit: 'kg', sets: sets(80, 8, 3) }, phone);
    const gone = await addEntry({ exerciseId: BENCH, unit: 'kg', sets: sets(60, 8, 1), timestamp: 5 }, phone);
    await syncBoth();

    await updateEntry(e, { sets: sets(90, 5, 3) }, laptop);
    await deleteEntry(gone, laptop);
    await renameExercise(SQUAT, 'Back Squat', laptop);
    await syncBoth();

    expect((await phone.entries.get(e))!.sets).toEqual(sets(90, 5, 3));
    expect(await phone.entries.get(gone)).toBeUndefined();
    expect((await phone.exercises.get(SQUAT))!.name).toBe('Back Squat');
    expect(server.live('entries')).toHaveLength(1);

    // Both edit offline; the later edit wins on both.
    await updateEntry(e, { sets: sets(91, 5, 3) }, phone);
    await new Promise((r) => setTimeout(r, 5));
    await updateEntry(e, { sets: sets(95, 5, 3) }, laptop);
    await syncBoth();
    await sync(laptop, server.remote());
    expect((await phone.entries.get(e))!.sets).toEqual(sets(95, 5, 3));
    expect((await laptop.entries.get(e))!.sets).toEqual(sets(95, 5, 3));
  });

  it('a renamed built-in exercise is not undone by a fresh install', async () => {
    await renameExercise(BENCH, 'Flat Bench', phone);
    await sync(phone, server.remote());
    // laptop is a brand new install whose seeded "Bench Press" is older than any edit.
    await sync(laptop, server.remote());
    expect((await laptop.exercises.get(BENCH))!.name).toBe('Flat Bench');
  });

  it('merges exercises with the same name created on both devices', async () => {
    const a = await addExercise('Cable Crunch', phone);
    const b = await addExercise('cable crunch', laptop);
    await addEntry({ exerciseId: a, unit: 'kg', sets: sets(30, 12, 1), timestamp: 1 }, phone);
    await addEntry({ exerciseId: b, unit: 'kg', sets: sets(35, 12, 1), timestamp: 2 }, laptop);
    await syncBoth();
    await sync(laptop, server.remote());

    const keep = a < b ? a : b;
    for (const d of [phone, laptop]) {
      const crunch = (await listExercises(d)).filter((e) => e.name.toLowerCase() === 'cable crunch');
      expect(crunch.map((e) => e.id)).toEqual([keep]);
      expect((await d.entries.where('exerciseId').equals(keep).count())).toBe(2);
    }
    expect(server.live('exercises').filter((r) => String(r.name).toLowerCase() === 'cable crunch')).toHaveLength(1);
  });

  it('keeps entries logged against an exercise another device merged away', async () => {
    await phone.exercises.add({ id: 'aaa', name: 'Cable Crunch' });
    await laptop.exercises.add({ id: 'zzz', name: 'Cable Crunch' });
    await sync(laptop, server.remote());
    await sync(phone, server.remote()); // phone merges: keeps 'aaa', deletes 'zzz'
    // laptop logs against its copy before hearing about the merge
    const logged = await addEntry({ exerciseId: 'zzz', unit: 'kg', sets: sets(40, 10, 1) }, laptop);
    await sync(laptop, server.remote());
    await sync(phone, server.remote());
    expect(await laptop.exercises.get('zzz')).toBeUndefined();
    expect((await laptop.entries.get(logged))!.exerciseId).toBe('aaa');
    expect((await phone.entries.get(logged))!.exerciseId).toBe('aaa');
  });

  it("merges two workouts started for the same day, and their entries", async () => {
    const wp = await createWorkout({ exerciseIds: [BENCH] }, phone);
    const wl = await createWorkout({ exerciseIds: [SQUAT, BENCH], name: 'Legs' }, laptop);
    await saveWorkoutEntry(wp, BENCH, { unit: 'kg', sets: sets(80, 8, 3) }, phone);
    await new Promise((r) => setTimeout(r, 5));
    await saveWorkoutEntry(wl, BENCH, { unit: 'kg', sets: sets(85, 8, 3) }, laptop);
    await saveWorkoutEntry(wl, SQUAT, { unit: 'kg', sets: sets(100, 5, 3) }, laptop);
    await syncBoth();
    await sync(laptop, server.remote());

    const keep = wp < wl ? wp : wl;
    for (const d of [phone, laptop]) {
      const ws = await listWorkouts(d);
      expect(ws).toHaveLength(1);
      expect(ws[0].id).toBe(keep);
      expect([...ws[0].exerciseIds].sort()).toEqual([BENCH, SQUAT].sort());
      const entries = await listWorkoutEntries(keep, d);
      expect(entries).toHaveLength(2);
      // The newer bench entry wins.
      expect(entries.find((e) => e.exerciseId === BENCH)!.sets[0].weight).toBe(85);
    }
  });

  it('deleting an exercise removes it and its entries everywhere', async () => {
    await addEntry({ exerciseId: BENCH, unit: 'kg', sets: sets(80, 8, 1) }, phone);
    await syncBoth();
    await deleteExercise(BENCH, laptop);
    await syncBoth();
    expect(await phone.exercises.get(BENCH)).toBeUndefined();
    expect(await phone.entries.count()).toBe(0);
  });

  it('a device that was used before signing in uploads everything on first sync', async () => {
    await addEntry({ exerciseId: BENCH, unit: 'kg', sets: sets(80, 8, 1) }, phone);
    // Synced under another account first: nothing on this account yet.
    server.user = 'user-b';
    await sync(phone, server.remote());
    server.user = 'user-a';
    await sync(phone, server.remote());
    expect(server.live('entries')).toHaveLength(1);
    await sync(laptop, server.remote());
    expect(await laptop.entries.count()).toBe(1);
  });

  it('keeps changes for next time if an upload fails', async () => {
    const e = await addEntry({ exerciseId: BENCH, unit: 'kg', sets: sets(80, 8, 1) }, phone);
    server.failNextUpsert = true;
    await expect(sync(phone, server.remote())).rejects.toThrow('offline');
    expect((await phone.entries.get(e))!.dirty).toBe(1);
    await sync(phone, server.remote());
    expect((await phone.entries.get(e))!.dirty).toBe(0);
    expect(server.live('entries')).toHaveLength(1);
  });
});

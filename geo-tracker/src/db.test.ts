import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  GeoDB,
  addObservation,
  addProject,
  deleteObservation,
  deleteProject,
  exportData,
  getObservation,
  importData,
  listObservations,
  listProjects,
  localDate,
  renameProject,
  updateObservation,
  validateObservation,
} from './db';

let database: GeoDB;
let n = 0;
beforeEach(() => {
  database = new GeoDB(`test-${n++}`);
});
afterEach(async () => {
  await database.delete();
});

const here = { lat: 64.1466, lng: -21.9426, type: 'outcrop' as const };

describe('observations', () => {
  it('saves a position with the day it was recorded', async () => {
    const at = new Date(2026, 5, 3, 14, 30).getTime();
    const id = await addObservation({ ...here, accuracy: 6.2, altitude: 20, rockType: ' basalt ', recordedAt: at }, database);
    const o = (await getObservation(id, database))!;
    expect(o).toMatchObject({ lat: 64.1466, lng: -21.9426, accuracy: 6.2, altitude: 20, rockType: 'basalt', date: '2026-06-03', recordedAt: at });
    expect(o.dirty).toBe(1);
    expect(o.updatedAt).toBeGreaterThan(0);
  });

  it('drops empty optional fields', async () => {
    const id = await addObservation({ ...here, rockType: '  ', notes: '', sampleId: undefined }, database);
    const o = (await getObservation(id, database))!;
    expect('rockType' in o).toBe(false);
    expect('notes' in o).toBe(false);
  });

  it('rejects impossible positions and measurements', async () => {
    expect(validateObservation({ lat: 91, lng: 0 })).toMatch(/Latitude/);
    expect(validateObservation({ lat: 0, lng: 181 })).toMatch(/Longitude/);
    expect(validateObservation({ lat: NaN, lng: 0 })).toMatch(/Latitude/);
    expect(validateObservation({ lat: 0, lng: 0, dip: 120 })).toMatch(/Dip/);
    expect(validateObservation({ lat: 0, lng: 0, strike: 400 })).toMatch(/Strike/);
    expect(validateObservation({ lat: 0, lng: 0, dipDirection: 'Q' })).toMatch(/Dip direction/);
    expect(validateObservation({ lat: -33.9, lng: 18.4, strike: 45, dip: 30, dipDirection: 'SE' })).toBeNull();
    await expect(addObservation({ ...here, lat: 200 }, database)).rejects.toThrow(/Latitude/);
  });

  it('edits fields and clears them with null', async () => {
    const id = await addObservation({ ...here, rockType: 'basalt', notes: 'first' }, database);
    await database.observations.update(id, { dirty: 0 });
    await updateObservation(id, { rockType: 'gabbro', notes: null, strike: 45, dip: 30, dipDirection: 'SE' }, database);
    const o = (await getObservation(id, database))!;
    expect(o.rockType).toBe('gabbro');
    expect('notes' in o).toBe(false);
    expect(o).toMatchObject({ strike: 45, dip: 30, dipDirection: 'SE', dirty: 1 });
  });

  it('refuses an invalid edit and leaves the row alone', async () => {
    const id = await addObservation({ ...here, dip: 20 }, database);
    await expect(updateObservation(id, { dip: 95 }, database)).rejects.toThrow(/Dip/);
    expect((await getObservation(id, database))!.dip).toBe(20);
  });

  it('moving the recorded time updates the day', async () => {
    const id = await addObservation({ ...here }, database);
    const at = new Date(2026, 0, 2, 9, 0).getTime();
    await updateObservation(id, { recordedAt: at }, database);
    expect((await getObservation(id, database))!.date).toBe(localDate(at));
  });

  it('lists newest first and records deletes for sync', async () => {
    const a = await addObservation({ ...here, recordedAt: 1_000_000 }, database);
    const b = await addObservation({ ...here, recordedAt: 2_000_000 }, database);
    expect((await listObservations(database)).map((o) => o.id)).toEqual([b, a]);
    await deleteObservation(a, database);
    expect((await listObservations(database)).map((o) => o.id)).toEqual([b]);
    expect(await database.pendingDeletes.get(`observations:${a}`)).toMatchObject({ table: 'observations', id: a });
  });
});

describe('projects', () => {
  it('adds, renames and lists projects', async () => {
    const id = await addProject({ name: ' Iceland 2026 ', area: 'Reykjanes' }, database);
    await renameProject(id, 'Iceland', database);
    expect(await listProjects(database)).toMatchObject([{ id, name: 'Iceland', area: 'Reykjanes' }]);
    await expect(addProject({ name: '  ' }, database)).rejects.toThrow(/name/);
    await expect(renameProject(id, '', database)).rejects.toThrow(/name/);
  });

  it('deleting a project keeps its observations, ungrouped and marked for upload', async () => {
    const p = await addProject({ name: 'Trip' }, database);
    const o = await addObservation({ ...here, projectId: p }, database);
    await database.observations.update(o, { dirty: 0 });
    await deleteProject(p, database);
    const row = (await getObservation(o, database))!;
    expect('projectId' in row).toBe(false);
    expect(row.dirty).toBe(1);
    expect(await database.pendingDeletes.get(`projects:${p}`)).toBeTruthy();
  });
});

describe('backup', () => {
  it('round-trips through export and import', async () => {
    const p = await addProject({ name: 'Trip' }, database);
    await addObservation({ ...here, projectId: p, rockType: 'basalt' }, database);
    const backup = await exportData(database);
    expect('dirty' in backup.observations[0]).toBe(false);

    const other = new GeoDB(`test-restore-${n++}`);
    try {
      await addObservation({ ...here, rockType: 'old' }, other);
      expect(await importData(JSON.parse(JSON.stringify(backup)), other)).toEqual({ projects: 1, observations: 1 });
      expect((await listObservations(other)).map((o) => o.rockType)).toEqual(['basalt']);
    } finally {
      await other.delete();
    }
  });

  it('rejects files that are not valid backups', async () => {
    await expect(importData({ app: 'workout-tracker' }, database)).rejects.toThrow(/not a Geo Tracker backup/);
    await expect(importData({ app: 'geo-tracker', version: 9, projects: [], observations: [] }, database)).rejects.toThrow(/different version/);
    await expect(
      importData({ app: 'geo-tracker', version: 1, projects: [], observations: [{ id: 'x', lat: 0, lng: 0, projectId: 'missing' }] }, database),
    ).rejects.toThrow(/damaged/);
  });
});

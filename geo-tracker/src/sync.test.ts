import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GeoDB, addObservation, addProject, deleteObservation, deleteProject, getObservation, listObservations, listProjects, updateObservation } from './db';
import type { SyncedTable } from './db';
import { type Remote, type RemoteRow, sync } from './sync';

/** An in-memory server shared by simulated devices, with per-user rows like the real one. */
class FakeServer {
  rows = new Map<string, RemoteRow & { user_id: string; table: string }>();
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

const spot = { lat: 64.1, lng: -21.9, type: 'outcrop' as const };

let server: FakeServer;
let phone: GeoDB;
let laptop: GeoDB;
let n = 0;
beforeEach(() => {
  server = new FakeServer();
  phone = new GeoDB(`phone-${n++}`);
  laptop = new GeoDB(`laptop-${n++}`);
});
afterEach(async () => {
  await phone.delete();
  await laptop.delete();
});

describe('sync between a phone and a laptop', () => {
  it('does nothing when signed out', async () => {
    server.user = null;
    await addObservation(spot, phone);
    expect(await sync(phone, server.remote())).toBeNull();
    expect(server.rows.size).toBe(0);
  });

  it('uploads what was recorded offline, and a second device downloads it', async () => {
    const p = await addProject({ name: 'Iceland', area: 'Reykjanes' }, phone);
    const id = await addObservation(
      { ...spot, projectId: p, accuracy: 5, altitude: 30, rockType: 'basalt', strike: 45, dip: 30, dipDirection: 'SE', notes: 'fresh surface' },
      phone,
    );
    expect(await sync(phone, server.remote())).toMatchObject({ pushed: 2 });
    expect(server.live('observations')).toHaveLength(1);
    expect(server.live('projects')).toHaveLength(1);

    expect(await sync(laptop, server.remote())).toMatchObject({ pulled: 2 });
    const { dirty, updatedAt, ...copy } = (await getObservation(id, laptop))!;
    expect(dirty).toBe(0);
    expect(updatedAt).toBeGreaterThan(0);
    expect(copy).toMatchObject({ projectId: p, lat: 64.1, lng: -21.9, accuracy: 5, altitude: 30, rockType: 'basalt', strike: 45, dip: 30, dipDirection: 'SE', notes: 'fresh surface' });
    expect(await listProjects(laptop)).toMatchObject([{ id: p, name: 'Iceland', area: 'Reykjanes' }]);
  });

  it('syncing again with no changes moves nothing', async () => {
    await addObservation(spot, phone);
    await sync(phone, server.remote());
    expect(await sync(phone, server.remote())).toMatchObject({ pulled: 0, pushed: 0 });
  });

  it('merges records made on both devices', async () => {
    await addObservation({ ...spot, rockType: 'phone rock' }, phone);
    await addObservation({ ...spot, rockType: 'laptop rock' }, laptop);
    await sync(phone, server.remote());
    await sync(laptop, server.remote());
    await sync(phone, server.remote());
    const names = async (d: GeoDB) => (await listObservations(d)).map((o) => o.rockType).sort();
    expect(await names(phone)).toEqual(['laptop rock', 'phone rock']);
    expect(await names(laptop)).toEqual(['laptop rock', 'phone rock']);
  });

  it('the newer edit wins, and clearing a field syncs too', async () => {
    const id = await addObservation({ ...spot, rockType: 'basalt', notes: 'a' }, phone);
    await sync(phone, server.remote());
    await sync(laptop, server.remote());
    await new Promise((r) => setTimeout(r, 5));
    await updateObservation(id, { rockType: 'gabbro', notes: null }, laptop);
    await sync(laptop, server.remote());
    await sync(phone, server.remote());
    const o = (await getObservation(id, phone))!;
    expect(o.rockType).toBe('gabbro');
    expect('notes' in o).toBe(false);
  });

  it('a delete on one device removes it on the other', async () => {
    const id = await addObservation(spot, phone);
    await sync(phone, server.remote());
    await sync(laptop, server.remote());
    await deleteObservation(id, laptop);
    await sync(laptop, server.remote());
    expect(server.live('observations')).toHaveLength(0);
    await sync(phone, server.remote());
    expect(await listObservations(phone)).toHaveLength(0);
    expect(await phone.pendingDeletes.count()).toBe(0);
  });

  it('a failed upload is retried next time and nothing is lost', async () => {
    const id = await addObservation(spot, phone);
    server.failNextUpsert = true;
    await expect(sync(phone, server.remote())).rejects.toThrow('offline');
    expect((await getObservation(id, phone))!.dirty).toBe(1);
    await sync(phone, server.remote());
    expect(server.live('observations')).toHaveLength(1);
    expect((await getObservation(id, phone))!.dirty).toBe(0);
  });

  it('deleting a project elsewhere ungroups observations that still pointed at it', async () => {
    const p = await addProject({ name: 'Trip' }, phone);
    await sync(phone, server.remote());
    await sync(laptop, server.remote());
    // Laptop deletes the project while the phone records into it offline.
    await deleteProject(p, laptop);
    await sync(laptop, server.remote());
    const o = await addObservation({ ...spot, projectId: p }, phone);
    await sync(phone, server.remote());
    expect(await listProjects(phone)).toHaveLength(0);
    expect('projectId' in (await getObservation(o, phone))!).toBe(false);
    await sync(laptop, server.remote());
    expect('projectId' in (await getObservation(o, laptop))!).toBe(false);
  });

  it("signing in as a different account doesn't mix data", async () => {
    await addObservation({ ...spot, rockType: 'mine' }, phone);
    await sync(phone, server.remote());
    server.user = 'user-b';
    await sync(laptop, server.remote());
    expect(await listObservations(laptop)).toHaveLength(0);
  });

  it('ignores a downloaded observation with no usable position', async () => {
    server.rows.set('user-a|observations|bad', {
      id: 'bad', table: 'observations', user_id: 'user-a', client_updated_at: 5, deleted_at: null,
      lat: null, lng: 1, updated_at: '2026-01-01T00:00:01.000Z',
    });
    await sync(phone, server.remote());
    expect(await listObservations(phone)).toHaveLength(0);
  });
});

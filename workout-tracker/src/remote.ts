import type { SupabaseClient } from '@supabase/supabase-js';
import type { SyncedTable } from './db';
import type { Remote, RemoteRow } from './sync';

const PAGE = 1000;
const CHUNK = 500;

/** The sync engine's view of the Supabase tables in supabase/schema.sql. */
export function supabaseRemote(client: SupabaseClient): Remote {
  const userId = async () => (await client.auth.getSession()).data.session?.user.id ?? null;
  return {
    userId,
    async pull(table: SyncedTable, since: string | null) {
      const out: RemoteRow[] = [];
      for (let from = 0; ; from += PAGE) {
        let q = client.from(table).select('*');
        if (since) q = q.gte('updated_at', since);
        const { data, error } = await q.order('updated_at').order('id').range(from, from + PAGE - 1);
        if (error) throw new Error(error.message);
        for (const { user_id: _u, ...row } of data as (RemoteRow & { user_id: string })[]) out.push(row as RemoteRow);
        if (data.length < PAGE) return out;
      }
    },
    async upsert(table: SyncedTable, rows: RemoteRow[]) {
      const uid = await userId();
      if (!uid) throw new Error('Signed out.');
      for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK).map((r) => ({ ...r, user_id: uid }));
        const { error } = await client.from(table).upsert(chunk, { onConflict: 'user_id,id' });
        if (error) throw new Error(error.message);
      }
    },
  };
}

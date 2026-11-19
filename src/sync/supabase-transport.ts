import type { SupabaseClient } from '@supabase/supabase-js';

import { SyncError } from './errors';
import type { ServerRow, SyncTransport } from './transport';

type Res<T> = { data: T | null; error: { code?: string; message: string } | null; status: number };

function unwrap<T>(res: Res<T>): T | null {
  if (res.error) throw { status: res.status, code: res.error.code, message: res.error.message };
  return res.data;
}

/** Quote a value for a PostgREST `or=(…)` filter (timestamps contain ':' '+' '.'). */
const q = (v: string) => `"${v.replace(/"/g, '\\"')}"`;

export function createSupabaseTransport(supabase: SupabaseClient): SyncTransport {
  return {
    async ensureSession() {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw new SyncError('retry', error.message);
      const session = data.session;
      if (!session) throw new SyncError('auth', 'Not signed in');
      const expiresAtMs = (session.expires_at ?? 0) * 1000;
      if (expiresAtMs - Date.now() < 60_000) {
        const refreshed = await supabase.auth.refreshSession();
        if (refreshed.error) {
          const status = (refreshed.error as { status?: number }).status;
          throw new SyncError(status && status >= 400 && status < 500 ? 'auth' : 'retry', refreshed.error.message, undefined, status);
        }
      }
    },

    async insertIgnore(table, payload) {
      const rows = unwrap<ServerRow[]>(
        await supabase.from(table).upsert(payload, { onConflict: 'id', ignoreDuplicates: true }).select(),
      );
      return rows?.[0] ?? null;
    },

    async casUpdate(table, id, baseVersion, patch) {
      const rows = unwrap<ServerRow[]>(await supabase.from(table).update(patch).eq('id', id).eq('version', baseVersion).select());
      return rows?.[0] ?? null;
    },

    async fetchRow(table, id) {
      return unwrap<ServerRow>(await supabase.from(table).select('*').eq('id', id).maybeSingle());
    },

    async pullPage({ table, since, after, limit }) {
      let query = supabase.from(table).select('*');
      if (after) {
        query = query.or(`updated_at.gt.${q(after.updated_at)},and(updated_at.eq.${q(after.updated_at)},id.gt.${after.id})`);
      } else if (since) {
        query = query.gte('updated_at', since);
      }
      return unwrap<ServerRow[]>(await query.order('updated_at').order('id').limit(limit)) ?? [];
    },
  };
}

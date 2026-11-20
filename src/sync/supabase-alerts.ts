import type { SupabaseClient } from '@supabase/supabase-js';

import type { ServerAlert } from '@/db/alerts-local';

import type { AlertsTransport } from './alerts-sync';

const COLS = 'id, farm_id, crop_id, kind, severity, title, body, start_date, created_at, updated_at, pushed_at, read_at';
const q = (v: string) => `"${v.replace(/"/g, '\\"')}"`;

export function createSupabaseAlertsTransport(supabase: SupabaseClient): AlertsTransport {
  return {
    async pull(after, limit) {
      let query = supabase.from('alerts').select(COLS);
      if (after) query = query.or(`updated_at.gt.${q(after.updated_at)},and(updated_at.eq.${q(after.updated_at)},id.gt.${after.id})`);
      const { data, error, status } = await query.order('updated_at').order('id').limit(limit);
      if (error) throw { status, code: error.code, message: error.message };
      return (data ?? []) as ServerAlert[];
    },
    async markRead(ids) {
      // Only read_at is writable; the database keeps the first read time.
      const { error, status } = await supabase.from('alerts').update({ read_at: new Date().toISOString() }).in('id', ids).is('read_at', null);
      if (error) throw { status, code: error.code, message: error.message };
    },
  };
}

// KisanConnect · scan-cleanup — daily backstop for scan photos.
// The phone deletes a photo when its scan is deleted; this catches anything missed:
// photos of scans soft-deleted more than a day ago are removed from storage and the
// row's photo_path is cleared. Called by pg_cron (supabase/setup/schedule_ai_cleanup.sql)
// with the same Vault cron secret as weather-alerts.
// Deploy: npx supabase functions deploy scan-cleanup --use-api   (verify_jwt=false in config.toml)
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: ok } = await admin.rpc('check_cron_secret', { p_secret: req.headers.get('x-cron-secret') ?? '' });
  if (ok !== true) return json({ error: 'unauthorized' }, 401);

  const before = new Date(Date.now() - 24 * 3_600_000).toISOString();
  let removed = 0;
  for (let round = 0; round < 20; round++) {
    const { data: rows, error } = await admin
      .from('scans')
      .select('id, photo_path')
      .not('deleted_at', 'is', null)
      .lt('deleted_at', before)
      .not('photo_path', 'is', null)
      .limit(100);
    if (error) return json({ error: error.code }, 500);
    if (!rows?.length) break;
    const { error: rmError } = await admin.storage.from('scan-photos').remove(rows.map((r) => r.photo_path as string));
    if (rmError) return json({ error: 'storage_remove_failed', removed }, 500);
    await admin.from('scans').update({ photo_path: null }).in('id', rows.map((r) => r.id));
    removed += rows.length;
  }
  await admin.rpc('purge_ai_data');
  return json({ removed }, 200);
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

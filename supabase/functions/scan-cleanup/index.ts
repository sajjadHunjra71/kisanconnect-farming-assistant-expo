// KisanConnect · scan-cleanup — daily backstop for scan photos.
// The phone deletes a photo when its scan is deleted; this catches anything missed:
//  1. photos of scans soft-deleted more than a day ago are removed from storage and the
//     row's photo_path is cleared;
//  2. orphans: any file in scan-photos older than a day that isn't the photo of a live
//     scan (no row, wrong name, nested folders, leftovers) is removed, so the bucket can't
//     be used as free general storage. Called by pg_cron (supabase/setup/schedule_ai_cleanup.sql)
// with the same Vault cron secret as weather-alerts.
// Deploy: npx supabase functions deploy scan-cleanup --use-api   (verify_jwt=false in config.toml)
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

const DAY_MS = 24 * 3_600_000;
const MAX_FOLDERS = 500; // per run; the next run continues

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
  const orphans = await removeOrphans(admin, Date.now() - DAY_MS);
  await admin.rpc('purge_ai_data');
  return json({ removed, orphans }, 200);
});

type FileEntry = { path: string; createdAt: string | null };

/** All files under a prefix, following sub-folders (a few levels deep). */
async function listFiles(admin: SupabaseClient, prefix: string, depth = 0): Promise<FileEntry[]> {
  const out: FileEntry[] = [];
  for (let offset = 0; offset < 20_000; offset += 1000) {
    const { data, error } = await admin.storage.from('scan-photos').list(prefix, { limit: 1000, offset });
    if (error || !data?.length) break;
    for (const f of data) {
      const path = prefix ? `${prefix}/${f.name}` : f.name;
      if (f.id === null) {
        if (depth < 4) out.push(...(await listFiles(admin, path, depth + 1)));
      } else {
        out.push({ path, createdAt: f.created_at ?? null });
      }
    }
    if (data.length < 1000) break;
  }
  return out;
}

const PHOTO_NAME = /^[0-9a-f-]{36}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$/i;

/** Remove files older than `beforeMs` that aren't the photo of a live (not deleted) scan. */
async function removeOrphans(admin: SupabaseClient, beforeMs: number): Promise<number> {
  const { data: folders } = await admin.storage.from('scan-photos').list('', { limit: MAX_FOLDERS });
  let removed = 0;
  for (const folder of folders ?? []) {
    const files = folder.id === null ? await listFiles(admin, folder.name, 1) : [{ path: folder.name, createdAt: folder.created_at ?? null }];
    const old = files.filter((f) => !f.createdAt || Date.parse(f.createdAt) < beforeMs);
    for (let i = 0; i < old.length; i += 100) {
      const batch = old.slice(i, i + 100);
      const named = batch.map((f) => f.path).filter((p) => PHOTO_NAME.test(p));
      const live = new Set<string>();
      if (named.length) {
        const { data: rows, error } = await admin.from('scans').select('photo_path').in('photo_path', named).is('deleted_at', null);
        if (error) return removed; // can't tell what's live: keep everything this run
        for (const r of rows ?? []) live.add(r.photo_path as string);
      }
      const gone = batch.map((f) => f.path).filter((p) => !live.has(p));
      if (gone.length && !(await admin.storage.from('scan-photos').remove(gone)).error) removed += gone.length;
    }
  }
  return removed;
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

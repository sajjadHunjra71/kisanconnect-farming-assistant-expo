// KisanConnect · delete-account
// Deletes the calling user's scan photos, then their auth account (all their rows cascade).
// Deploy: supabase functions deploy delete-account
// Uses SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY, which Supabase injects automatically.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'unauthorized' }, 401);

  const url = Deno.env.get('SUPABASE_URL')!;
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) return json({ error: 'unauthorized' }, 401);

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // Remove the user's leaf photos first (storage files are not deleted by the cascade).
  // Sub-folders are followed too, so nothing the user uploaded is left behind.
  const photos = admin.storage.from('scan-photos');
  const listAll = async (prefix: string, depth: number): Promise<string[] | null> => {
    const { data: entries, error: listError } = await photos.list(prefix, { limit: 1000 });
    if (listError) return null;
    const out: string[] = [];
    for (const e of entries ?? []) {
      const path = `${prefix}/${e.name}`;
      if (e.id === null) {
        if (depth >= 4) continue;
        const sub = await listAll(path, depth + 1);
        if (!sub) return null;
        out.push(...sub);
      } else out.push(path);
    }
    return out;
  };
  for (let round = 0; round < 50; round++) {
    const files = await listAll(data.user.id, 0);
    if (!files) return json({ error: 'photo_cleanup_failed' }, 500);
    if (!files.length) break;
    const { error: rmError } = await photos.remove(files.slice(0, 1000));
    if (rmError) return json({ error: 'photo_cleanup_failed' }, 500);
  }

  const { error: delError } = await admin.auth.admin.deleteUser(data.user.id);
  if (delError) return json({ error: 'delete_failed' }, 500);

  return json({ ok: true }, 200);
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

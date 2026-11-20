// KisanConnect · weather-alerts
// Runs every 3 hours from pg_cron (see supabase/setup/schedule_weather_alerts.sql).
// For every farm whose owner has a push token: get the forecast for its grid cell
// (cache first), run the same rules as the app, and push NEW alerts only
// (public.alerts_sent remembers what was sent). One notification per farm per run.
//
// Deploy: supabase functions deploy weather-alerts --no-verify-jwt
//         supabase secrets set CRON_SECRET=<same value as in the Vault>
// The function checks the x-cron-secret header itself.
import { createClient } from 'npm:@supabase/supabase-js@2';

import { cropProgress } from '../_shared/crop-calendar.ts';
import type { CropId } from '../_shared/crops-data.ts';
import { diseaseHints, gridCell, localHour, openMeteoUrl, parseOpenMeteo, weatherAlerts, type Forecast } from '../_shared/weather-rules.ts';

const CACHE_OK_MS = 3 * 60 * 60 * 1000;
const EXPO_PUSH = 'https://exp.host/--/api/v2/push/send';

type Farm = { id: string; user_id: string; name: string; lat: number | null; lng: number | null };
type Crop = { farm_id: string; crop_key: CropId; sowing_date: string };
type Note = { id: string; title: string; body: string };

const TEXT = {
  heat: (v: number) => ({ title: `Heatwave: up to ${v}°C`, body: "Irrigate in the evening or early morning and don't spray in the afternoon." }),
  frost: (v: number) => ({ title: `Frost risk: down to ${v}°C`, body: 'A light irrigation the evening before helps protect wheat and young crops.' }),
  'heavy-rain': (v: number) => ({ title: `Heavy rain: about ${v} mm`, body: 'Clear field drains and wait with fertilizer and spraying.' }),
  'strong-wind': (v: number) => ({ title: `Strong wind: gusts up to ${v} km/h`, body: "Don't spray. Tall crops may fall over." }),
  'wheat-yellow-rust': () => ({ title: 'Yellow rust weather for wheat', body: 'Cool and humid days ahead. Check lower leaves for yellow stripes.' }),
  'rice-blast': () => ({ title: 'Rice blast weather', body: 'Warm and very humid days ahead. Look for eye-shaped spots on leaves.' }),
  'cotton-boll-rot': () => ({ title: 'Boll rot weather for cotton', body: 'A long humid spell is coming. Check opening bolls for rot.' }),
} as const;

Deno.serve(async (req) => {
  const secret = Deno.env.get('CRON_SECRET');
  if (!secret || req.headers.get('x-cron-secret') !== secret) return json({ error: 'unauthorized' }, 401);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const now = new Date();

  const { data: tokens, error: tokErr } = await admin.from('push_tokens').select('token, user_id');
  if (tokErr) return json({ error: tokErr.message }, 500);
  const tokensByUser = new Map<string, string[]>();
  for (const t of tokens ?? []) tokensByUser.set(t.user_id, [...(tokensByUser.get(t.user_id) ?? []), t.token]);
  if (tokensByUser.size === 0) return json({ farms: 0, sent: 0 }, 200);

  const { data: farms, error: farmErr } = await admin
    .from('farms')
    .select('id, user_id, name, lat, lng')
    .is('deleted_at', null)
    .not('lat', 'is', null)
    .in('user_id', [...tokensByUser.keys()]);
  if (farmErr) return json({ error: farmErr.message }, 500);

  const { data: crops } = await admin
    .from('crops')
    .select('farm_id, crop_key, sowing_date')
    .is('deleted_at', null)
    .eq('status', 'active')
    .in('farm_id', (farms ?? []).map((f: Farm) => f.id));

  // Group farms by grid cell → one forecast per cell.
  const byCell = new Map<string, { lat: number; lng: number; farms: Farm[] }>();
  for (const f of (farms ?? []) as Farm[]) {
    const cell = gridCell(Number(f.lat), Number(f.lng));
    const entry = byCell.get(cell.key) ?? { lat: cell.lat, lng: cell.lng, farms: [] };
    entry.farms.push(f);
    byCell.set(cell.key, entry);
  }

  const messages: { to: string; title: string; body: string; data: Record<string, string>; sound: 'default' }[] = [];
  let failedCells = 0;

  for (const [key, cell] of byCell) {
    let forecast: Forecast;
    try {
      forecast = await forecastFor(admin, key, cell.lat, cell.lng);
    } catch (e) {
      console.error('forecast failed', key, String(e));
      failedCells++;
      continue;
    }
    const nowHour = localHour(forecast, now);
    const today = nowHour.slice(0, 10);
    const alerts = weatherAlerts(forecast, today);

    for (const farm of cell.farms) {
      const farmCrops = ((crops ?? []) as Crop[])
        .filter((c) => c.farm_id === farm.id)
        .map((c) => ({ c, p: cropProgress(c.crop_key, c.sowing_date, today) }))
        .filter(({ p }) => p.status === 'growing')
        .map(({ c, p }) => ({ crop: c.crop_key, stage: p.stage.key }));
      // Weather alerts only matter when something is growing; disease hints per crop.
      const notes: Note[] = [
        ...(farmCrops.length > 0 ? alerts.map((a) => ({ id: a.id, ...TEXT[a.kind](Math.round(a.value)) })) : []),
        ...diseaseHints(forecast, nowHour, farmCrops).map((h) => ({ id: h.id, ...TEXT[h.ruleId as keyof typeof TEXT](0) })),
      ];
      if (notes.length === 0) continue;

      // Keep only alerts never sent before for this farm (insert … on conflict do nothing).
      const { data: inserted, error } = await admin
        .from('alerts_sent')
        .upsert(notes.map((n) => ({ user_id: farm.user_id, farm_id: farm.id, alert_id: n.id })), { onConflict: 'user_id,farm_id,alert_id', ignoreDuplicates: true })
        .select('alert_id');
      if (error) {
        console.error('alerts_sent failed', farm.id, error.message);
        continue;
      }
      const fresh = notes.filter((n) => (inserted ?? []).some((r: { alert_id: string }) => r.alert_id === n.id));
      if (fresh.length === 0) continue;

      const title = `${farm.name}: ${fresh[0].title}`;
      const body = fresh.length > 1 ? `${fresh[0].body} (+${fresh.length - 1} more in the app)` : fresh[0].body;
      for (const to of tokensByUser.get(farm.user_id) ?? []) {
        messages.push({ to, title, body, sound: 'default', data: { type: 'weather', farmId: farm.id } });
      }
    }
  }

  const { sent, removed } = await sendPush(admin, messages);
  return json({ farms: farms?.length ?? 0, cells: byCell.size, failedCells, sent, removedTokens: removed }, 200);
});

// deno-lint-ignore no-explicit-any
async function forecastFor(admin: any, key: string, lat: number, lng: number): Promise<Forecast> {
  const { data: cached } = await admin.from('weather_cache').select('forecast, fetched_at').eq('cell', key).maybeSingle();
  if (cached && Date.now() - Date.parse(cached.fetched_at) < CACHE_OK_MS) return cached.forecast as Forecast;
  const res = await fetch(openMeteoUrl(lat, lng), { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`open-meteo ${res.status}`);
  const forecast = parseOpenMeteo(await res.json(), new Date().toISOString());
  await admin.from('weather_cache').upsert({ cell: key, lat, lng, forecast, fetched_at: forecast.fetchedAt });
  return forecast;
}

/** Expo push in batches of 100; tokens Expo reports as DeviceNotRegistered are removed. */
// deno-lint-ignore no-explicit-any
async function sendPush(admin: any, messages: { to: string }[]): Promise<{ sent: number; removed: number }> {
  let sent = 0;
  const dead: string[] = [];
  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100);
    const res = await fetch(EXPO_PUSH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(batch),
    });
    if (!res.ok) {
      console.error('expo push failed', res.status, await res.text());
      continue;
    }
    const { data } = (await res.json()) as { data: { status: string; details?: { error?: string } }[] };
    data.forEach((r, k) => {
      if (r.status === 'ok') sent++;
      else if (r.details?.error === 'DeviceNotRegistered') dead.push(batch[k].to);
    });
  }
  if (dead.length > 0) await admin.from('push_tokens').delete().in('token', dead);
  return { sent, removed: dead.length };
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

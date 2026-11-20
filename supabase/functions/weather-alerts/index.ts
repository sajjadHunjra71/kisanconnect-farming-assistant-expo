// KisanConnect · weather-alerts
// Runs every 3 hours from pg_cron (supabase/setup/schedule_weather_alerts.sql).
//  1. Checks Expo receipts of earlier pushes; removes tokens Expo calls DeviceNotRegistered.
//  2. Walks all live farms with a location (pages by id, resumes from a saved cursor if the
//     time budget runs out), gets the forecast per ~11 km cell (same cache as weather-proxy),
//     runs the shared rules and stores NEW alerts in public.alerts (unique per dedupe_key).
//  3. Pushes unsent alerts that are still valid, per the user's kinds + quiet hours. Alerts
//     held during quiet hours go out on the first run after the quiet hours end.
// Auth: x-cron-secret header, checked by the check_cron_secret() RPC against Supabase Vault.
// Deploy: npx supabase functions deploy weather-alerts --use-api   (verify_jwt=false in config.toml)
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

import { normalizePrefs, shouldNotify } from '../_shared/engine/alert-prefs.ts';
import { cropProgress } from '../_shared/engine/crop-calendar.ts';
import { CROP_CALENDARS, type CropId } from '../_shared/engine/crops-data.ts';
import { MET_USER_AGENT, metNorwayUrl, parseMetNorway } from '../_shared/engine/met-norway.ts';
import {
  PK_UTC_OFFSET,
  alertDedupeKey,
  cacheKey,
  diseaseHints,
  gridCell,
  localHour,
  openMeteoUrl,
  parseOpenMeteo,
  weatherAlerts,
  type Forecast,
  type Provider,
} from '../_shared/engine/weather-rules.ts';

const CACHE_OK_MS = 3 * 60 * 60 * 1000;
const TIME_BUDGET_MS = 20_000;
const PAGE = 200;
const CURSOR_KEY = 'weather-alerts:farm-cursor';
const EXPO = 'https://exp.host/--/api/v2/push';

type Farm = { id: string; user_id: string; name: string; lat: number; lng: number };
type Crop = { id: string; farm_id: string; crop_key: CropId; sowing_date: string };
type AlertRow = {
  user_id: string;
  farm_id: string;
  crop_id: string | null;
  kind: string;
  severity: 'warning' | 'danger';
  title: string;
  body: string;
  start_date: string;
  dedupe_key: string;
};

const cropName = (c: string) => CROP_CALENDARS[c as CropId]?.name.en ?? c;
const TEXT: Record<string, (v: number, crop: string) => { title: string; body: string }> = {
  heatwave: (v) => ({ title: `Heatwave: up to ${v}°C for 2 or more days`, body: "Irrigate in the evening or early morning and don't spray in the afternoon." }),
  'heat-stress': (v, c) => ({ title: `Heat stress for ${c}: ${v}°C`, body: "This is a sensitive stage. A light evening irrigation helps; don't spray in the heat." }),
  frost: (v, c) => ({ title: `Frost risk for ${c}: down to ${v}°C`, body: 'A light irrigation the evening before helps protect the crop.' }),
  'heavy-rain': (v) => ({ title: `Heavy rain: about ${v} mm`, body: 'Clear field drains and wait with fertilizer and spraying.' }),
  'strong-wind': (v) => ({ title: `Strong wind: gusts up to ${v} km/h`, body: "Don't spray. Tall crops may fall over." }),
  fog: () => ({ title: 'Fog expected', body: 'Low visibility on the roads. Wait with spraying until it clears.' }),
  'wheat-yellow-rust': () => ({ title: 'Yellow rust weather for wheat', body: 'Cool, humid or rainy days ahead. Check lower leaves for yellow stripes.' }),
  'rice-blast': () => ({ title: 'Rice blast weather', body: 'Several warm, very humid nights ahead. Look for eye-shaped spots on leaves.' }),
  'cotton-boll-rot': () => ({ title: 'Boll rot weather for cotton', body: 'Rain followed by warm, humid hours. Check opening bolls for rot.' }),
};

Deno.serve(async (req) => {
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: ok } = await admin.rpc('check_cron_secret', { p_secret: req.headers.get('x-cron-secret') ?? '' });
  if (ok !== true) return json({ error: 'unauthorized' }, 401);

  const started = Date.now();
  const removedFromReceipts = await checkReceipts(admin);
  const gen = await generateAlerts(admin, started);
  const push = await pushPending(admin);
  return json({ ...gen, ...push, removedTokens: removedFromReceipts + push.removedTokens }, 200);
});

/* ── 2. generate ─────────────────────────────────────────── */

async function generateAlerts(admin: SupabaseClient, started: number) {
  const { data: state } = await admin.from('job_state').select('value').eq('key', CURSOR_KEY).maybeSingle();
  let after: string | null = (state?.value as { after?: string } | null)?.after ?? null;
  let farmsDone = 0;
  let created = 0;
  let failedCells = 0;
  let finished = false;
  const forecasts = new Map<string, Forecast | null>();

  while (Date.now() - started < TIME_BUDGET_MS) {
    let q = admin.from('farms').select('id, user_id, name, lat, lng').is('deleted_at', null).not('lat', 'is', null).order('id').limit(PAGE);
    if (after) q = q.gt('id', after);
    const { data: farms, error } = await q;
    if (error) throw error;
    const page = (farms ?? []) as Farm[];
    if (page.length === 0) {
      finished = true;
      break;
    }
    const { data: crops } = await admin
      .from('crops')
      .select('id, farm_id, crop_key, sowing_date')
      .is('deleted_at', null)
      .eq('status', 'active')
      .in('farm_id', page.map((f) => f.id));

    const rows: AlertRow[] = [];
    for (const farm of page) {
      const cell = gridCell(Number(farm.lat), Number(farm.lng));
      if (!forecasts.has(cell.key)) forecasts.set(cell.key, await forecastFor(admin, cell.key, cell.lat, cell.lng).catch(() => null));
      const forecast = forecasts.get(cell.key);
      if (!forecast) {
        failedCells++;
        continue;
      }
      const nowHour = localHour(forecast, new Date());
      const today = nowHour.slice(0, 10);
      const refs = ((crops ?? []) as Crop[])
        .filter((c) => c.farm_id === farm.id)
        .map((c) => ({ c, p: cropProgress(c.crop_key, c.sowing_date, today) }))
        .filter(({ p }) => p.status === 'growing')
        .map(({ c, p }) => ({ crop: c.crop_key, stage: p.stage.key, cropId: c.id }));

      for (const a of weatherAlerts(forecast, today, refs)) {
        const t = TEXT[a.kind](Math.round(a.value), cropName(a.crop ?? ''));
        rows.push({ user_id: farm.user_id, farm_id: farm.id, crop_id: a.cropId ?? null, kind: a.kind, severity: a.severity, ...t, start_date: a.startDate, dedupe_key: alertDedupeKey(a.kind, farm.id, a.cropId, a.startDate) });
      }
      for (const h of diseaseHints(forecast, nowHour, refs)) {
        const t = TEXT[h.ruleId](0, cropName(h.crop));
        rows.push({ user_id: farm.user_id, farm_id: farm.id, crop_id: h.cropId ?? null, kind: h.ruleId, severity: 'warning', ...t, start_date: h.startDate, dedupe_key: alertDedupeKey(h.ruleId, farm.id, h.cropId, h.startDate) });
      }
    }
    if (rows.length > 0) {
      const { data: ins, error: insErr } = await admin.from('alerts').upsert(rows, { onConflict: 'user_id,dedupe_key', ignoreDuplicates: true }).select('id');
      if (insErr) console.error('alerts insert failed', insErr.code);
      created += ins?.length ?? 0;
    }
    farmsDone += page.length;
    after = page[page.length - 1].id;
    if (page.length < PAGE) {
      finished = true;
      break;
    }
  }

  // Save where we stopped (null = start from the beginning next time).
  await admin.from('job_state').upsert({ key: CURSOR_KEY, value: { after: finished ? null : after }, updated_at: new Date().toISOString() });
  return { farms: farmsDone, cells: forecasts.size, failedCells, alertsCreated: created, finished };
}

async function forecastFor(admin: SupabaseClient, cell: string, lat: number, lng: number): Promise<Forecast> {
  const keys = (['open-meteo', 'met-norway'] as Provider[]).map((p) => cacheKey(cell, p));
  const { data } = await admin.from('weather_cache').select('forecast, fetched_at').in('cache_key', keys).order('fetched_at', { ascending: false }).limit(1);
  const row = data?.[0];
  if (row && Date.now() - Date.parse(row.fetched_at) < CACHE_OK_MS) return row.forecast as Forecast;
  for (const provider of ['open-meteo', 'met-norway'] as Provider[]) {
    try {
      const res =
        provider === 'open-meteo'
          ? await fetch(openMeteoUrl(lat, lng), { signal: AbortSignal.timeout(10_000) })
          : await fetch(metNorwayUrl(lat, lng), { signal: AbortSignal.timeout(10_000), headers: { 'User-Agent': MET_USER_AGENT } });
      if (!res.ok) throw new Error(String(res.status));
      const now = new Date().toISOString();
      const forecast = provider === 'open-meteo' ? parseOpenMeteo(await res.json(), now) : parseMetNorway(await res.json(), now);
      await admin.from('weather_cache').upsert({ cache_key: cacheKey(cell, provider), cell, provider, schema_version: forecast.schemaVersion, forecast, fetched_at: forecast.fetchedAt });
      return forecast;
    } catch {
      console.error('provider failed', provider); // no coordinates in logs
    }
  }
  if (row) return row.forecast as Forecast; // stale is better than nothing for alerts
  throw new Error('no forecast');
}

/* ── 3. push ─────────────────────────────────────────────── */

type Pending = { id: string; user_id: string; farm_id: string; kind: string; title: string; body: string };

async function pushPending(admin: SupabaseClient) {
  const localNow = new Date(Date.now() + PK_UTC_OFFSET * 1000);
  const today = localNow.toISOString().slice(0, 10);
  const hhmm = localNow.toISOString().slice(11, 16);
  const since = new Date(Date.now() - 36 * 3_600_000).toISOString();

  const { data: pending } = await admin
    .from('alerts')
    .select('id, user_id, farm_id, kind, title, body')
    .is('pushed_at', null)
    .gte('start_date', today)
    .gte('created_at', since)
    .order('created_at')
    .limit(1000);
  const alerts = (pending ?? []) as Pending[];
  if (alerts.length === 0) return { pushed: 0, held: 0, removedTokens: 0 };

  const users = [...new Set(alerts.map((a) => a.user_id))];
  const [{ data: tokens }, { data: profiles }, { data: farms }] = await Promise.all([
    admin.from('push_tokens').select('token, user_id').in('user_id', users),
    admin.from('profiles').select('id, notification_prefs').in('id', users),
    admin.from('farms').select('id, name').in('id', [...new Set(alerts.map((a) => a.farm_id))]),
  ]);
  const tokensOf = (u: string) => (tokens ?? []).filter((t: { user_id: string }) => t.user_id === u).map((t: { token: string }) => t.token);
  const prefsOf = (u: string) => normalizePrefs((profiles ?? []).find((p: { id: string }) => p.id === u)?.notification_prefs);
  const farmName = (id: string) => (farms ?? []).find((f: { id: string }) => f.id === id)?.name ?? '';

  // One notification per user + farm, made of the alerts that may be sent now.
  const groups = new Map<string, Pending[]>();
  let held = 0;
  for (const a of alerts) {
    if (tokensOf(a.user_id).length === 0) continue; // in-app inbox only
    const decision = shouldNotify(a.kind, prefsOf(a.user_id), hhmm);
    if (decision === 'hold') held++;
    if (decision !== 'send') continue;
    const k = `${a.user_id}:${a.farm_id}`;
    groups.set(k, [...(groups.get(k) ?? []), a]);
  }

  type Msg = { to: string; title: string; body: string; sound: 'default'; data: Record<string, string> };
  const messages: { msg: Msg; alertIds: string[] }[] = [];
  for (const group of groups.values()) {
    const first = group[0];
    const body = group.length > 1 ? `${first.body} (+${group.length - 1} more in the app)` : first.body;
    for (const to of tokensOf(first.user_id)) {
      messages.push({
        msg: { to, title: `${farmName(first.farm_id)}: ${first.title}`, body, sound: 'default', data: { type: 'weather', farmId: first.farm_id } },
        alertIds: group.map((a) => a.id),
      });
    }
  }

  let pushed = 0;
  const dead: string[] = [];
  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100);
    const res = await fetch(`${EXPO}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(batch.map((b) => b.msg)),
    });
    if (!res.ok) {
      console.error('expo push failed', res.status);
      continue;
    }
    const { data } = (await res.json()) as { data: { status: string; id?: string; details?: { error?: string } }[] };
    const tickets: { ticket_id: string; token: string }[] = [];
    for (let k = 0; k < data.length; k++) {
      const r = data[k];
      const b = batch[k];
      if (r.status === 'ok' && r.id) {
        pushed++;
        tickets.push({ ticket_id: r.id, token: b.msg.to });
        await admin.from('alerts').update({ pushed_at: new Date().toISOString(), push_ticket_id: r.id }).in('id', b.alertIds).is('pushed_at', null);
      } else if (r.details?.error === 'DeviceNotRegistered') {
        dead.push(b.msg.to);
      }
    }
    if (tickets.length) await admin.from('push_tickets').upsert(tickets, { onConflict: 'ticket_id', ignoreDuplicates: true });
  }
  if (dead.length) await admin.from('push_tokens').delete().in('token', dead);
  return { pushed, held, removedTokens: dead.length };
}

/* ── 1. receipts ─────────────────────────────────────────── */

async function checkReceipts(admin: SupabaseClient): Promise<number> {
  const before = new Date(Date.now() - 15 * 60_000).toISOString(); // Expo needs a few minutes
  const { data: tickets } = await admin.from('push_tickets').select('ticket_id, token').is('checked_at', null).lt('created_at', before).limit(900);
  if (!tickets?.length) return 0;
  const dead = new Set<string>();
  for (let i = 0; i < tickets.length; i += 300) {
    const chunk = tickets.slice(i, i + 300) as { ticket_id: string; token: string }[];
    const res = await fetch(`${EXPO}/getReceipts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ ids: chunk.map((t) => t.ticket_id) }),
    });
    if (!res.ok) continue;
    const { data } = (await res.json()) as { data: Record<string, { status: string; details?: { error?: string } }> };
    for (const t of chunk) if (data[t.ticket_id]?.details?.error === 'DeviceNotRegistered') dead.add(t.token);
    await admin.from('push_tickets').update({ checked_at: new Date().toISOString() }).in('ticket_id', chunk.map((t) => t.ticket_id));
  }
  if (dead.size) await admin.from('push_tokens').delete().in('token', [...dead]);
  return dead.size;
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

// KisanConnect · weather-proxy
// POST { lat, lng } → { forecast, cached, stale } for the ~11 km grid cell around the point.
// Open-Meteo is called at most once an hour per cell (cache in public.weather_cache);
// only the cell centre is sent to Open-Meteo, never the farm's own point.
// Deploy: supabase functions deploy weather-proxy   (JWT verification stays on: signed-in users only)
import { createClient } from 'npm:@supabase/supabase-js@2';

import { gridCell, openMeteoUrl, parseOpenMeteo, type Forecast } from '../_shared/weather-rules.ts';

const FRESH_MS = 60 * 60 * 1000; // 1 hour
const STALE_OK_MS = 24 * 60 * 60 * 1000; // serve up to a day old if Open-Meteo is down
const TIMEOUT_MS = 10_000;

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
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
  const { data: auth, error: authError } = await userClient.auth.getUser();
  if (authError || !auth.user) return json({ error: 'unauthorized' }, 401);

  let lat: number, lng: number;
  try {
    const body = await req.json();
    lat = Number(body?.lat);
    lng = Number(body?.lng);
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  // Pakistan and a margin around it.
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 23 || lat > 38 || lng < 60 || lng > 78) {
    return json({ error: 'out_of_area' }, 400);
  }

  const cell = gridCell(lat, lng);
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: cached } = await admin.from('weather_cache').select('forecast, fetched_at').eq('cell', cell.key).maybeSingle();
  const age = cached ? Date.now() - Date.parse(cached.fetched_at) : Infinity;
  if (cached && age < FRESH_MS) return json({ forecast: cached.forecast, cached: true, stale: false }, 200);

  try {
    const forecast = await fetchForecast(cell.lat, cell.lng);
    await admin.from('weather_cache').upsert({ cell: cell.key, lat: cell.lat, lng: cell.lng, forecast, fetched_at: forecast.fetchedAt });
    return json({ forecast, cached: false, stale: false }, 200);
  } catch (e) {
    console.error('open-meteo failed', cell.key, String(e));
    if (cached && age < STALE_OK_MS) return json({ forecast: cached.forecast, cached: true, stale: true }, 200);
    return json({ error: 'upstream_unavailable' }, 503);
  }
});

async function fetchForecast(lat: number, lng: number): Promise<Forecast> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(openMeteoUrl(lat, lng), { signal: ctrl.signal });
    if (!res.ok) throw new Error(`open-meteo ${res.status}`);
    return parseOpenMeteo(await res.json(), new Date().toISOString());
  } finally {
    clearTimeout(timer);
  }
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

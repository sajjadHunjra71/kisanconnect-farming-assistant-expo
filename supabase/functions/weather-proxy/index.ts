// KisanConnect · weather-proxy
// POST { lat, lng } → { forecast, cached, stale } for the ~11 km grid cell around the point.
// Cache: public.weather_cache, key = cell + provider + schema version, fresh for 1 hour.
// Providers: Open-Meteo, then MET Norway if Open-Meteo fails; a stale copy is served if both fail.
// Each user may trigger at most NEW_FETCH_LIMIT provider fetches per hour (cache hits are free).
// Only the cell centre is sent to providers. Coordinates are never logged.
// Deploy: npx supabase functions deploy weather-proxy --use-api   (verify_jwt=false: the user is checked below)
import { createClient } from 'npm:@supabase/supabase-js@2';

import { MET_USER_AGENT, metNorwayUrl, parseMetNorway } from '../_shared/engine/met-norway.ts';
import { cacheKey, gridCell, inPakistanBox, openMeteoUrl, parseOpenMeteo, type Forecast, type Provider } from '../_shared/engine/weather-rules.ts';

const FRESH_MS = 60 * 60 * 1000;
const TIMEOUT_MS = 10_000;
const NEW_FETCH_LIMIT = 30;

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
  if (!inPakistanBox(lat, lng)) return json({ error: 'out_of_area' }, 400);

  const cell = gridCell(lat, lng);
  const keys: Record<Provider, string> = { 'open-meteo': cacheKey(cell.key, 'open-meteo'), 'met-norway': cacheKey(cell.key, 'met-norway') };
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { data: rows } = await admin.from('weather_cache').select('provider, forecast, fetched_at').in('cache_key', Object.values(keys));
  const cached = (rows ?? []) as { provider: Provider; forecast: Forecast; fetched_at: string }[];
  const fresh = (p: Provider) => cached.find((r) => r.provider === p && Date.now() - Date.parse(r.fetched_at) < FRESH_MS);
  const hit = fresh('open-meteo') ?? fresh('met-norway');
  if (hit) return json({ forecast: hit.forecast, cached: true, stale: false }, 200);
  const newest = [...cached].sort((a, b) => Date.parse(b.fetched_at) - Date.parse(a.fetched_at))[0];

  // Cache miss → counts toward this user's hourly limit.
  const { data: allowed } = await admin.rpc('bump_rate_limit', { p_user: auth.user.id, p_bucket: 'weather-fetch', p_limit: NEW_FETCH_LIMIT });
  if (allowed === false) {
    if (newest) return json({ forecast: newest.forecast, cached: true, stale: true }, 200);
    return json({ error: 'rate_limited' }, 429);
  }

  for (const provider of ['open-meteo', 'met-norway'] as Provider[]) {
    try {
      const forecast = await fetchForecast(provider, cell.lat, cell.lng);
      await admin.from('weather_cache').upsert({
        cache_key: keys[provider],
        cell: cell.key,
        provider,
        schema_version: forecast.schemaVersion,
        forecast,
        fetched_at: forecast.fetchedAt,
      });
      return json({ forecast, cached: false, stale: false }, 200);
    } catch (e) {
      console.error('provider failed', provider, e instanceof Error ? e.name : 'error'); // no coordinates in logs
    }
  }
  if (newest) return json({ forecast: newest.forecast, cached: true, stale: true }, 200);
  return json({ error: 'upstream_unavailable' }, 503);
});

async function fetchForecast(provider: Provider, lat: number, lng: number): Promise<Forecast> {
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  const now = new Date().toISOString();
  if (provider === 'open-meteo') {
    const res = await fetch(openMeteoUrl(lat, lng), { signal });
    if (!res.ok) throw new Error(`open-meteo ${res.status}`);
    return parseOpenMeteo(await res.json(), now);
  }
  const res = await fetch(metNorwayUrl(lat, lng), { signal, headers: { 'User-Agent': MET_USER_AGENT, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`met-norway ${res.status}`);
  return parseMetNorway(await res.json(), now);
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

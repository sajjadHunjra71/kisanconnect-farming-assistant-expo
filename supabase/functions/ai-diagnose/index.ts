// KisanConnect · ai-diagnose — cloud "second opinion" for a leaf scan.
//
// POST { scan_id } (nothing else is trusted from the phone).
//  1. Caller: valid JWT (auth.getUser), confirmed email, AI consent at the current version.
//  2. Scan: loaded with the CALLER's JWT, so RLS proves ownership. Photo must be at
//     scan-photos/<uid>/<scan_id>.jpg, ≤ 1.5 MB, real JPEG (magic bytes).
//  3. Quota: use_ai_quota → per-user daily cap AND shared global budget (Pacific day).
//     No quota / Gemini busy (429/503) → 202 { status: "waiting" }; units are refunded
//     when Gemini fails before answering.
//  4. Context sent to Gemini: crop, growth stage, district, 7-day weather summary from the
//     Phase 3 cache, on-device top-3. Never the user's name, email, GPS or farm name.
//  5. Gemini JSON mode with responseSchema (id enum = this crop's KB ids + "unknown"),
//     Zod shape check + engine sanitizer (dose filter, caps). One retry (one more global
//     unit), then final_status "failed".
//  6. Server-only columns written with the service role; ai_events gets one row
//     (no photo, no prompt).
//
// Secrets: GEMINI_API_KEY, GEMINI_MODEL (stable non-preview Flash / Flash-Lite id),
//          optional AI_DAILY_BUDGET (default 200), AI_SCANS_PER_USER (default 10).
// Deploy:  npx supabase functions deploy ai-diagnose --use-api   (verify_jwt=false; checked in code)
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@4';

import { cropProgress } from '../_shared/engine/crop-calendar.ts';
import type { CropId } from '../_shared/engine/crops-data.ts';
import {
  AI_CONSENT_VERSION,
  DEFAULT_MODEL_THRESHOLD,
  DIAGNOSIS_SYSTEM,
  buildDiagnosisPrompt,
  combineResults,
  diagnosisResponseSchema,
  sanitizeDiagnosis,
  weatherSummary7d,
  type AiDiagnosis,
  type ModelTop,
  type WeatherSummary,
} from '../_shared/engine/scan-diagnosis.ts';
import { cacheKey, gridCell, localHour, type Forecast, type Provider } from '../_shared/engine/weather-rules.ts';

const MAX_PHOTO_BYTES = 1.5 * 1024 * 1024;
const GEMINI_TIMEOUT_MS = 30_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/** Loose shape check before the engine's own sanitizer. */
const AnswerShape = z.object({
  status: z.string(),
  possible_causes: z.array(z.object({ id: z.string(), likelihood: z.string(), visible_signs: z.string().optional() }).passthrough()),
  questions_to_confirm: z.array(z.string()).optional(),
  next_steps: z.array(z.string()).optional(),
  explain: z.string().optional(),
  needs_expert: z.boolean().optional(),
});

type ScanRow = {
  id: string;
  user_id: string;
  farm_id: string | null;
  crop_id: string | null;
  crop_key: CropId;
  photo_path: string | null;
  model_result: { top?: ModelTop; threshold?: number } | null;
  checked_at: string | null;
  deleted_at: string | null;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'unauthorized' }, 401);
  const url = Deno.env.get('SUPABASE_URL')!;
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
  const { data: auth, error: authError } = await userClient.auth.getUser();
  const user = auth?.user;
  if (authError || !user) return json({ error: 'unauthorized' }, 401);
  if (!user.email_confirmed_at) return json({ error: 'email_not_confirmed' }, 403);

  let scanId = '';
  try {
    scanId = String((await req.json())?.scan_id ?? '');
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  if (!UUID.test(scanId)) return json({ error: 'bad_request' }, 400);

  // Consent (own profile row, read with the caller's JWT).
  const { data: profile } = await userClient.from('profiles').select('ai_consent_version').eq('id', user.id).maybeSingle();
  if (!profile || (profile.ai_consent_version ?? 0) < AI_CONSENT_VERSION) return json({ error: 'consent_required' }, 403);

  // The scan, through RLS: if it isn't the caller's, it simply isn't found.
  const { data: scan } = await userClient
    .from('scans')
    .select('id, user_id, farm_id, crop_id, crop_key, photo_path, model_result, checked_at, deleted_at')
    .eq('id', scanId)
    .maybeSingle<ScanRow>();
  if (!scan || scan.deleted_at) return json({ error: 'not_found' }, 404);
  if (scan.checked_at) return json({ status: 'checked', already: true }, 200);
  const expectedPath = `${user.id}/${scan.id}.jpg`;
  if (scan.photo_path !== expectedPath) return json({ error: 'photo_missing' }, 409);

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // Photo: downloaded here, never taken from the request.
  const { data: blob, error: dlError } = await admin.storage.from('scan-photos').download(expectedPath);
  if (dlError || !blob) return json({ error: 'photo_missing' }, 409);
  if (blob.size > MAX_PHOTO_BYTES) return json({ error: 'photo_too_large' }, 413);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (!(bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)) return json({ error: 'not_jpeg' }, 415);

  // Quota: per-user cap + shared daily budget, in one call.
  const userLimit = Number(Deno.env.get('AI_SCANS_PER_USER') ?? 10);
  const budget = Number(Deno.env.get('AI_DAILY_BUDGET') ?? 200);
  const { data: quota, error: qError } = await admin.rpc('use_ai_quota', { p_user: user.id, p_kind: 'scan', p_user_limit: userLimit, p_global_limit: budget });
  if (qError) return json({ error: 'quota_error' }, 500);
  if (quota !== 'ok') return json({ status: 'waiting', reason: quota }, 202);

  const context = await loadContext(userClient, admin, scan);
  const model = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.5-flash';
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) {
    await admin.rpc('refund_ai_quota', { p_user: user.id, p_kind: 'scan', p_global_units: 1, p_user_unit: true });
    return json({ error: 'not_configured' }, 500);
  }

  const started = Date.now();
  let globalUnits = 1;
  let diagnosis: AiDiagnosis | null = null;
  let meta: { modelVersion?: string; tokens?: number; requestId?: string } = {};

  for (let attempt = 0; attempt < 2 && !diagnosis; attempt++) {
    if (attempt === 1) {
      const { data: more } = await admin.rpc('use_ai_budget', { p_global_limit: budget });
      if (more !== true) break;
      globalUnits++;
    }
    const res = await callGemini(apiKey, model, scan.crop_key, context, bytes);
    meta = res.meta;
    if (res.kind === 'busy' || res.kind === 'network') {
      // Gemini didn't answer: give everything back, the phone tries again later.
      await admin.rpc('refund_ai_quota', { p_user: user.id, p_kind: 'scan', p_global_units: globalUnits, p_user_unit: true });
      await logEvent(admin, user.id, model, meta, Date.now() - started, res.kind === 'busy' ? 'rate_limited' : 'error');
      return json({ status: 'waiting', reason: res.kind === 'busy' ? 'gemini_busy' : 'gemini_unreachable' }, 202);
    }
    if (res.kind === 'answer') diagnosis = res.diagnosis;
  }

  const modelTop = scan.model_result?.top ?? null;
  const threshold = scan.model_result?.threshold ?? DEFAULT_MODEL_THRESHOLD;
  const now = new Date().toISOString();
  const update = diagnosis
    ? (() => {
        const c = combineResults(modelTop, diagnosis, threshold);
        return {
          ai_result: { ...diagnosis, model, model_version: meta.modelVersion ?? null },
          final_status: c.status === 'offline' ? 'unclear' : c.status,
          top_disease_id: c.topId,
          needs_expert_ai: c.needsExpert,
          checked_at: now,
        };
      })()
    : { ai_result: { error: 'invalid_answer', model }, final_status: 'failed', top_disease_id: null, needs_expert_ai: true, checked_at: now };

  const { error: upError } = await admin.from('scans').update(update).eq('id', scan.id).eq('user_id', user.id);
  await logEvent(admin, user.id, model, meta, Date.now() - started, diagnosis ? (globalUnits > 1 ? 'retry_ok' : 'ok') : 'invalid');
  if (upError) return json({ error: 'save_failed' }, 500);
  return json({ status: 'checked', final_status: update.final_status }, 200);
});

/* ── context (no personal data) ─────────────────────────── */

async function loadContext(userClient: SupabaseClient, admin: SupabaseClient, scan: ScanRow) {
  let stage: string | null = null;
  let district: string | null = null;
  let weather: WeatherSummary | null = null;
  if (scan.crop_id) {
    const { data: crop } = await userClient.from('crops').select('sowing_date').eq('id', scan.crop_id).maybeSingle();
    if (crop?.sowing_date) {
      const p = cropProgress(scan.crop_key, crop.sowing_date, localHour({ utcOffsetSeconds: 18000 }, new Date()).slice(0, 10));
      stage = p.status === 'planned' ? 'not sown yet' : p.stage.key;
    }
  }
  if (scan.farm_id) {
    const { data: farm } = await userClient.from('farms').select('district, lat, lng').eq('id', scan.farm_id).maybeSingle();
    district = farm?.district ?? null;
    if (farm?.lat != null && farm?.lng != null) {
      const cell = gridCell(Number(farm.lat), Number(farm.lng));
      const keys = (['open-meteo', 'met-norway'] as Provider[]).map((p) => cacheKey(cell.key, p));
      const { data: rows } = await admin.from('weather_cache').select('forecast, fetched_at').in('cache_key', keys).order('fetched_at', { ascending: false }).limit(1);
      const f = rows?.[0]?.forecast as Forecast | undefined;
      if (f) weather = weatherSummary7d(f, localHour(f, new Date()).slice(0, 10));
    }
  }
  return { stage, district, weather, modelTop: scan.model_result?.top ?? null };
}

/* ── Gemini ─────────────────────────────────────────────── */

type GeminiResult =
  | { kind: 'answer'; diagnosis: AiDiagnosis; meta: Meta }
  | { kind: 'invalid'; meta: Meta }
  | { kind: 'busy'; meta: Meta }
  | { kind: 'network'; meta: Meta };
type Meta = { modelVersion?: string; tokens?: number; requestId?: string };

async function callGemini(
  apiKey: string,
  model: string,
  crop: CropId,
  ctx: { stage: string | null; district: string | null; weather: WeatherSummary | null; modelTop: ModelTop | null },
  photo: Uint8Array,
): Promise<GeminiResult> {
  const body = {
    systemInstruction: { parts: [{ text: DIAGNOSIS_SYSTEM }] },
    contents: [
      {
        role: 'user',
        parts: [
          { text: buildDiagnosisPrompt({ crop, ...ctx }) },
          { inline_data: { mime_type: 'image/jpeg', data: toBase64(photo) } },
        ],
      },
    ],
    generationConfig: { responseMimeType: 'application/json', responseSchema: diagnosisResponseSchema(crop), temperature: 0.2, maxOutputTokens: 1024 },
  };
  let res: Response;
  try {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
    });
  } catch {
    return { kind: 'network', meta: {} };
  }
  if (res.status === 429 || res.status === 503) return { kind: 'busy', meta: {} };
  if (!res.ok) {
    console.error('gemini error', res.status); // no prompt / photo in logs
    return { kind: res.status >= 500 ? 'network' : 'invalid', meta: {} };
  }
  const out = (await res.json().catch(() => null)) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    usageMetadata?: { totalTokenCount?: number };
    modelVersion?: string;
    responseId?: string;
  } | null;
  const meta: Meta = { modelVersion: out?.modelVersion, tokens: out?.usageMetadata?.totalTokenCount, requestId: out?.responseId };
  const text = out?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return { kind: 'invalid', meta };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { kind: 'invalid', meta };
  }
  if (!AnswerShape.safeParse(parsed).success) return { kind: 'invalid', meta };
  const diagnosis = sanitizeDiagnosis(parsed, crop);
  return diagnosis ? { kind: 'answer', diagnosis, meta } : { kind: 'invalid', meta };
}

async function logEvent(admin: SupabaseClient, userId: string, model: string, meta: Meta, latency: number, status: string) {
  await admin.from('ai_events').insert({
    user_id: userId,
    kind: 'scan',
    model,
    model_version: meta.modelVersion ?? null,
    latency_ms: latency,
    status,
    tokens: meta.tokens ?? null,
    request_id: meta.requestId ?? null,
  });
}

function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

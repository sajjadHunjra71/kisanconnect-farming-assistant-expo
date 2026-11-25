// KisanConnect · ai-diagnose — cloud "second opinion" for a leaf scan.
//
// POST { scan_id } (nothing else is trusted from the phone).
//  1. Caller: valid JWT (auth.getUser), confirmed email, AI consent at the current version.
//  2. Scan: loaded with the CALLER's JWT, so RLS proves ownership. Photo must be at
//     scan-photos/<uid>/<scan_id>.jpg, ≤ 1.5 MB, real JPEG (magic bytes).
//  3. Quota: use_ai_quota → per-user daily cap AND shared global budget (Pacific day).
//     No quota → 202 { status: "waiting" }.
//  4. Context sent to the cloud model: crop, growth stage, district, 7-day weather summary
//     from the Phase 3 cache, on-device top-3. Never the user's name, email, GPS or farm name.
//  5. Cloud model: Groq (OpenAI-compatible chat completions, vision model, JSON mode). The
//     photo goes as a base64 data URL (≤ 1.5 MB JPEG, well under Groq's 20 MB request
//     limit; already resized on the phone). The JSON format is described in the system
//     prompt; Zod shape check + engine sanitizer (id allow-list, dose filter, caps).
//     Groq busy (429 / 498 / 503) or down (5xx / network): retried with backoff inside this
//     call, then 202 waiting with all units refunded.
//     Unusable answer: one more try (one more global unit), then final_status "unclear"
//     with "take a clearer photo" steps. Groq rejecting the request itself → "failed".
//     Setup errors (no key, 401, 403, 404, model / key / organization codes) never fail a
//     scan: units refunded, 202 waiting (reason "ai_unavailable").
//     Every non-answer keeps a short code in ai_result.reason / ai_events.status.
//     A "failed" scan may be checked again ("Try again").
//  6. Server-only columns written with the service role; ai_events gets one row
//     (no photo, no prompt).
//
// History: this used Google Gemini until 2026-11-25; replaced by Groq because the
// Gemini free tier was not available for the project.
//
// Secrets: GROQ_API_KEY; optional GROQ_MODEL (default below; must be a Groq vision model),
//          AI_DAILY_BUDGET (default 200), AI_SCANS_PER_USER (default 10).
// Deploy:  npx supabase functions deploy ai-diagnose --use-api   (verify_jwt=false; checked in code)
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@4';

import { cropProgress } from '../_shared/engine/crop-calendar.ts';
import type { CropId } from '../_shared/engine/crops-data.ts';
import {
  AI_CONSENT_VERSION,
  DIAGNOSIS_SYSTEM,
  buildDiagnosisPrompt,
  classifyAiError,
  clearerPhotoDiagnosis,
  combineResults,
  isModelOutputReason,
  parseModelJson,
  retryDelayMs,
  sanitizeModelResult,
  sanitizeDiagnosis,
  weatherSummary7d,
  type AiDiagnosis,
  type ModelTop,
  type WeatherSummary,
} from '../_shared/engine/scan-diagnosis.ts';
import { cacheKey, gridCell, localHour, type Forecast, type Provider } from '../_shared/engine/weather-rules.ts';

const MAX_PHOTO_BYTES = 1.5 * 1024 * 1024;
const AI_TIMEOUT_MS = 25_000; // × up to 3 tries, inside the Edge Function wall-clock limit
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
/** Groq's production vision model (2026-11; Llama 4 Scout was shut down 2026-07-17). */
const DEFAULT_GROQ_MODEL = 'qwen/qwen3.8-27b';
/** Tries per call when Groq is busy or down (with backoff), before telling the phone to wait. */
const BUSY_TRIES = 3;
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
  final_status: string | null;
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
    .select('id, user_id, farm_id, crop_id, crop_key, photo_path, model_result, checked_at, final_status, deleted_at')
    .eq('id', scanId)
    .maybeSingle<ScanRow>();
  if (!scan || scan.deleted_at) return json({ error: 'not_found' }, 404);
  // A finished check is final, except a failed one: "Try again" may run it once more (quota applies).
  if (scan.checked_at && scan.final_status !== 'failed') return json({ status: 'checked', already: true }, 200);
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
  const model = Deno.env.get('GROQ_MODEL') || DEFAULT_GROQ_MODEL;
  const apiKey = Deno.env.get('GROQ_API_KEY');
  const started = Date.now();
  if (!apiKey) {
    // Not set up yet: same as any setup error — the scan waits, nothing is used up.
    await admin.rpc('refund_ai_quota', { p_user: user.id, p_kind: 'scan', p_global_units: 1, p_user_unit: true });
    await logEvent(admin, user.id, model, {}, 0, 'setup_error:no_api_key');
    return json({ status: 'waiting', reason: 'ai_unavailable', detail: 'no_api_key' }, 202);
  }

  let globalUnits = 1;
  let diagnosis: AiDiagnosis | null = null;
  let meta: { modelVersion?: string; tokens?: number; requestId?: string } = {};
  let failReason = 'invalid';

  for (let attempt = 0; attempt < 2 && !diagnosis; attempt++) {
    if (attempt === 1) {
      const { data: more } = await admin.rpc('use_ai_budget', { p_global_limit: budget });
      if (more !== true) break;
      globalUnits++;
    }
    const res = await callModel(apiKey, model, scan.crop_key, context, bytes);
    meta = res.meta;
    if (res.kind === 'busy' || res.kind === 'network') {
      // Groq didn't answer even after retries: give everything back, the phone tries later.
      await admin.rpc('refund_ai_quota', { p_user: user.id, p_kind: 'scan', p_global_units: globalUnits, p_user_unit: true });
      await logEvent(admin, user.id, model, meta, Date.now() - started, `${res.kind === 'busy' ? 'rate_limited' : 'error'}:${res.reason}`);
      return json({ status: 'waiting', reason: res.kind === 'busy' ? 'ai_busy' : 'ai_unreachable', detail: res.reason }, 202);
    }
    if (res.kind === 'setup') {
      // Key / model / organization misconfigured on our side: not the farmer's photo. Refund,
      // keep the scan waiting (not "failed"), and record the error code for whoever fixes it.
      await admin.rpc('refund_ai_quota', { p_user: user.id, p_kind: 'scan', p_global_units: globalUnits, p_user_unit: true });
      await logEvent(admin, user.id, model, meta, Date.now() - started, `setup_error:${res.reason}`);
      return json({ status: 'waiting', reason: 'ai_unavailable', detail: res.reason }, 202);
    }
    if (res.kind === 'answer') diagnosis = res.diagnosis;
    else failReason = res.reason;
  }

  // model_result comes from the phone: only allow-listed ids / clamped numbers are used.
  const { top: modelTop, threshold } = sanitizeModelResult(scan.model_result, scan.crop_key);
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
    : isModelOutputReason(failReason)
      ? // The model answered twice but not usably: an honest "unclear" with what to do next.
        { ai_result: { ...clearerPhotoDiagnosis(), model, reason: failReason }, final_status: 'unclear', top_disease_id: null, needs_expert_ai: true, checked_at: now }
      : // Groq rejected our request (not a setup error): failed, with a short reason code.
        { ai_result: { error: 'invalid_answer', reason: failReason, model }, final_status: 'failed', top_disease_id: null, needs_expert_ai: true, checked_at: now };

  const { error: upError } = await admin.from('scans').update(update).eq('id', scan.id).eq('user_id', user.id);
  await logEvent(admin, user.id, model, meta, Date.now() - started, diagnosis ? (globalUnits > 1 ? 'retry_ok' : 'ok') : `invalid:${failReason}`);
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
  return { stage, district, weather, modelTop: sanitizeModelResult(scan.model_result, scan.crop_key).top };
}

/* ── Cloud model (Groq) ─────────────────────────────────── */

type ModelResult =
  | { kind: 'answer'; diagnosis: AiDiagnosis; meta: Meta }
  | { kind: 'invalid'; reason: string; meta: Meta }
  | { kind: 'setup'; reason: string; meta: Meta }
  | { kind: 'busy'; reason: string; meta: Meta }
  | { kind: 'network'; reason: string; meta: Meta };
type Meta = { modelVersion?: string; tokens?: number; requestId?: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function callModel(
  apiKey: string,
  model: string,
  crop: CropId,
  ctx: { stage: string | null; district: string | null; weather: WeatherSummary | null; modelTop: ModelTop | null },
  photo: Uint8Array,
): Promise<ModelResult> {
  const body = JSON.stringify({
    model,
    messages: [
      { role: 'system', content: DIAGNOSIS_SYSTEM },
      {
        role: 'user',
        content: [
          { type: 'text', text: buildDiagnosisPrompt({ crop, ...ctx }) },
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${toBase64(photo)}` } },
        ],
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.2,
    max_completion_tokens: 2048,
  });

  // Busy / down: a few tries with backoff (Groq's retry-after when given).
  let last: ModelResult = { kind: 'network', reason: 'not_called', meta: {} };
  let retryAfter: string | null = null;
  for (let attempt = 0; attempt < BUSY_TRIES; attempt++) {
    if (attempt > 0) await sleep(retryDelayMs(attempt - 1, retryAfter));
    retryAfter = null;
    let res: Response;
    try {
      res = await fetch(GROQ_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body,
        signal: AbortSignal.timeout(AI_TIMEOUT_MS),
      });
    } catch {
      last = { kind: 'network', reason: 'network', meta: {} };
      continue;
    }
    if (!res.ok) {
      retryAfter = res.headers.get('retry-after');
      const e = classifyAiError(res.status, await res.json().catch(() => null));
      console.error('model error', e.reason); // status / type / code only: no prompt, photo or key
      if (e.kind === 'busy') {
        last = { kind: 'busy', reason: e.reason, meta: {} };
        continue;
      }
      if (e.kind === 'server') {
        last = { kind: 'network', reason: e.reason, meta: {} };
        continue;
      }
      if (e.kind === 'output') return { kind: 'invalid', reason: 'unprocessable', meta: {} };
      return { kind: e.kind, reason: e.reason, meta: {} };
    }
    const out = (await res.json().catch(() => null)) as {
      id?: string;
      model?: string;
      choices?: { message?: { content?: string | null } }[];
      usage?: { total_tokens?: number };
    } | null;
    const meta: Meta = { modelVersion: out?.model ?? model, tokens: out?.usage?.total_tokens, requestId: out?.id ?? res.headers.get('x-request-id') ?? undefined };
    const text = out?.choices?.[0]?.message?.content;
    if (!text) return { kind: 'invalid', reason: 'empty_answer', meta };
    const parsed = parseModelJson(text);
    if (parsed === null) return { kind: 'invalid', reason: 'not_json', meta };
    if (!AnswerShape.safeParse(parsed).success) return { kind: 'invalid', reason: 'bad_shape', meta };
    const diagnosis = sanitizeDiagnosis(parsed, crop);
    return diagnosis ? { kind: 'answer', diagnosis, meta } : { kind: 'invalid', reason: 'unusable_answer', meta };
  }
  return last;
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

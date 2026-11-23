/**
 * Leaf scans on the phone.
 *
 * Create: photo prepared + quality checked → (dev build: on-device model) → scan row saved
 * locally (synced by the Phase 2 outbox) → local queue entry.
 *
 * Queue (runScanQueue, one scan at a time, from the sync manager when online):
 *   row on server → upload photo to scan-photos/<uid>/<scanId>.jpg (upsert:false,
 *   "already exists" = done) → outbox update sets photo_path → push → ai-diagnose →
 *   pull the server's answer → "Your leaf check is ready" notification.
 * Only while AI consent still holds. 202 "waiting" (no quota / Gemini busy) stops the
 * queue until the next sync; the scan just stays "Waiting for online check".
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import * as Crypto from 'expo-crypto';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { Repos, ScanRecord, ScanServerFields } from '@/db';
import { AI_CONSENT_VERSION, combineResults, kbIdsForCrop, type AiDiagnosis, type CropId, type QualityResult } from '@/engine';

import { useDataVersion } from '@/store/data-version';

import { diseaseModel } from './model';
import { deleteLocalScanPhoto, localScanPhoto } from './photo';

export const MAX_CHECK_ATTEMPTS = 3;

export function hasAiConsent(profile: { ai_consent_version?: number | null } | null | undefined): boolean {
  return (profile?.ai_consent_version ?? 0) >= AI_CONSENT_VERSION;
}

export function newScanId(): string {
  return Crypto.randomUUID();
}

/** Save a scan whose photo was prepared at documents/scans/<owner>/<scanId>.jpg. */
export async function createScan(input: {
  repos: Repos;
  owner: string;
  tempId: string;
  photoUri: string;
  farmId: string | null;
  cropId: string | null;
  cropKey: CropId;
  quality: QualityResult & { overridden?: boolean };
  cloudAllowed: boolean;
}): Promise<ScanRecord> {
  const model = diseaseModel();
  let model_result: Record<string, unknown> | null = null;
  let model_version: string | null = null;
  if (model.available) {
    try {
      const p = await model.classify(input.photoUri, input.cropKey);
      model_result = { top: p.top.slice(0, 3), threshold: p.threshold };
      model_version = p.version;
    } catch {
      // model failed: the cloud check still runs
    }
  }

  const scan = await input.repos.scansRepo.create({
    farm_id: input.farmId,
    crop_id: input.cropId,
    crop_key: input.cropKey,
    quality: { ...input.quality },
    model_result,
    model_version,
  });

  // The photo was saved under a temporary id; give it the scan's id.
  const temp = localScanPhoto(input.owner, input.tempId);
  const final = localScanPhoto(input.owner, scan.id);
  if (temp.exists && temp.uri !== final.uri) await temp.move(final);

  await input.repos.scanQueue.put({
    scan_id: scan.id,
    local_path: final.uri,
    uploaded: false,
    check_state: input.cloudAllowed ? 'pending_upload' : 'device_only',
    attempts: 0,
    last_error: null,
    notified: false,
    created_at: new Date().toISOString(),
  });

  if (input.repos.kind === 'sample') void demoCheck(input.repos, scan.id, input.cropKey);
  return scan;
}

/** Soft-delete a scan and remove its photo (phone + storage when possible). */
export async function deleteScan(repos: Repos, owner: string, scan: ScanRecord, supabase: SupabaseClient | null) {
  await repos.scansRepo.remove(scan.id);
  await repos.scanQueue.remove(scan.id);
  deleteLocalScanPhoto(owner, scan.id);
  if (supabase && scan.photo_path) {
    // Best effort: the daily scan-cleanup function removes anything missed (offline etc.).
    await supabase.storage.from('scan-photos').remove([scan.photo_path]).catch(() => undefined);
  }
}

/** Try a failed / waiting scan again. */
export async function retryScan(repos: Repos, scanId: string) {
  const s = await repos.scanQueue.get(scanId);
  if (!s) return;
  await repos.scanQueue.update(scanId, { check_state: s.uploaded ? 'waiting_check' : 'pending_upload', attempts: 0, last_error: null });
}

/* ───────────────────────── queue ───────────────────────── */

export type QueueDeps = {
  repos: Repos;
  userId: string;
  supabase: SupabaseClient;
  consentOk: boolean;
  /** Push local changes now (the sync engine's push). */
  push: () => Promise<unknown>;
  /** Pull server changes now (to receive the AI result). */
  pull: () => Promise<unknown>;
};

/** Upload photos and run cloud checks, one scan at a time. Returns how many were checked. */
export async function runScanQueue(d: QueueDeps): Promise<number> {
  let checked = 0;
  for (const state of await d.repos.scanQueue.list()) {
    if (state.check_state === 'checked' || state.check_state === 'device_only' || state.check_state === 'failed') continue;
    const row = await d.repos.scansRepo.get(state.scan_id);
    if (!row) {
      await d.repos.scanQueue.remove(state.scan_id);
      continue;
    }
    if (row.checked_at) {
      await d.repos.scanQueue.update(row.id, { check_state: 'checked' });
      await notifyReady(d.repos, row.id);
      continue;
    }
    if (!d.consentOk) break; // nothing leaves the phone without consent
    if (row.version === 0) continue; // the row itself isn't on the server yet

    if (!state.uploaded) {
      const path = `${d.userId}/${row.id}.jpg`;
      const file = localScanPhoto(d.userId, row.id);
      if (!file.exists) {
        await d.repos.scanQueue.update(row.id, { check_state: 'failed', last_error: 'photo_missing' });
        continue;
      }
      const { error } = await d.supabase.storage.from('scan-photos').upload(path, await file.bytes(), { contentType: 'image/jpeg', upsert: false });
      if (error && !/exists|duplicate/i.test(error.message)) break; // offline etc.: try next sync
      await d.repos.scansRepo.update(row.id, { photo_path: path });
      await d.repos.scanQueue.update(row.id, { uploaded: true, check_state: 'waiting_check' });
      await d.push();
    }

    const res = await d.supabase.functions.invoke<{ status?: string; reason?: string }>('ai-diagnose', { body: { scan_id: row.id } });
    if (!res.error) {
      if (res.data?.status === 'waiting') {
        await d.repos.scanQueue.update(row.id, { check_state: 'waiting_check', last_error: res.data.reason ?? null });
        break; // no quota / Gemini busy: stop for now
      }
      await d.pull();
      await d.repos.scanQueue.update(row.id, { check_state: 'checked', last_error: null });
      await notifyReady(d.repos, row.id);
      checked++;
      continue;
    }
    const status = (res.error as { context?: { status?: number } }).context?.status;
    if (status === 409) {
      await d.repos.scanQueue.update(row.id, { uploaded: false, check_state: 'pending_upload' });
      continue;
    }
    if (status === 404) {
      await d.repos.scanQueue.remove(row.id);
      continue;
    }
    if (status === 403 || status === undefined || status >= 500) break; // consent / offline / server: later
    const attempts = state.attempts + 1;
    await d.repos.scanQueue.update(row.id, {
      attempts,
      last_error: `http_${status}`,
      check_state: attempts >= MAX_CHECK_ATTEMPTS ? 'failed' : 'waiting_check',
    });
  }
  return checked;
}

async function notifyReady(repos: Repos, scanId: string) {
  const s = await repos.scanQueue.get(scanId);
  if (!s || s.notified) return;
  await repos.scanQueue.update(scanId, { notified: true });
  if (Platform.OS === 'web') return;
  try {
    if ((await Notifications.getPermissionsAsync()).status !== 'granted') return;
    await Notifications.scheduleNotificationAsync({
      content: { title: 'Your leaf check is ready', body: 'Open KisanConnect to see the result.', data: { type: 'scan', scanId } },
      trigger: null,
    });
  } catch {
    // notifications unavailable: the result is still in the app
  }
}

/* ───────────────────────── demo mode ───────────────────────── */

/** Demo mode: a sample "cloud" answer after a short delay, clearly marked as sample data. */
async function demoCheck(repos: Repos, scanId: string, crop: CropId) {
  await new Promise((r) => setTimeout(r, 1200));
  const ids = kbIdsForCrop(crop).filter((id) => !id.endsWith('-healthy'));
  const diagnosis: AiDiagnosis = {
    status: 'ok',
    possible_causes: [
      { id: ids[0], likelihood: 'high', visible_signs: 'Sample result: signs typical of this disease on the leaf.' },
      ...(ids[1] ? [{ id: ids[1], likelihood: 'low' as const, visible_signs: null }] : []),
    ],
    questions_to_confirm: ['Is it on many plants or only a few?', 'Did it start after cool, humid or rainy days?'],
    next_steps: ['Check 10 plants in different parts of the field.', 'Ask an agriculture expert to confirm before doing anything else.'],
    explain: 'This is SAMPLE data in demo mode, not a real check of your photo.',
    needs_expert: true,
  };
  const c = combineResults(null, diagnosis);
  const fields: ScanServerFields = {
    ai_result: { ...diagnosis, model: 'sample' },
    final_status: c.status === 'offline' ? 'unclear' : c.status,
    top_disease_id: c.topId,
    needs_expert_ai: c.needsExpert,
    checked_at: new Date().toISOString(),
  };
  await repos.demoApplyScanResult?.(scanId, fields);
  await repos.scanQueue.update(scanId, { check_state: 'checked' });
  useDataVersion.getState().bump();
}

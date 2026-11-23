/**
 * Runs sync for the signed-in user. Triggers: start, app foreground, network back,
 * pull-to-refresh / "Sync now" (push + pull), and ~1.5 s after a local write (push only).
 * Single-flight: one run at a time; a request during a run is queued (push < full).
 */
import NetInfo from '@react-native-community/netinfo';
import { AppState } from 'react-native';

import { closeRepos, deleteUserDatabase, openRepos, type Repos } from '@/db';
import { onLocalWrite } from '@/db/events';
import { supabase } from '@/lib/supabase';
import { clearForecasts } from '@/features/weather/weather-service';
import { useDataVersion } from '@/store/data-version';
import { useSyncStore } from '@/store/sync-store';

import { showLocalAlerts } from '@/features/notifications/local-alerts';
import { clearScanPhotos } from '@/features/scan/photo';
import { hasAiConsent, runScanQueue } from '@/features/scan/scan-service';
import type { AlertsLocal } from '@/db/alerts-local';

import { syncAlerts } from './alerts-sync';
import { classifyError } from './errors';
import { pull, push } from './engine';
import { createSyncLocal, type SyncLocal } from './local';
import { createSupabaseAlertsTransport } from './supabase-alerts';
import { createSupabaseTransport } from './supabase-transport';
import type { SyncTransport } from './transport';

type Mode = 'push' | 'full';
type Stop = 'retry' | 'auth' | 'error' | null;

const PUSH_DEBOUNCE_MS = 1500;
const RETRY_MIN_MS = 2000;
const RETRY_MAX_MS = 5 * 60_000;

let active: { userId: string; local: SyncLocal; transport: SyncTransport; alerts: AlertsLocal; repos: Repos; unsubs: (() => void)[] } | null = null;
let running: Promise<void> | null = null;
let queued: Mode | null = null;
let online = true;
let lastStop: Stop = null;
let backoffMs = 0;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let userSignOut = false;

const store = () => useSyncStore.getState();

function clearTimers() {
  if (pushTimer) clearTimeout(pushTimer);
  if (retryTimer) clearTimeout(retryTimer);
  pushTimer = retryTimer = null;
}

async function refreshStats() {
  const a = active;
  if (!a) return;
  const { pending, failed } = await a.local.stats();
  if (a !== active) return;
  const status = running && store().status === 'syncing' ? 'syncing'
    : !online ? 'offline'
    : failed.length > 0 || lastStop === 'auth' || lastStop === 'error' ? 'error'
    : pending > 0 ? 'saved-locally'
    : 'synced';
  store().set({
    pending,
    failed: failed.map((e) => ({ opId: e.op_id, table: e.tbl, rowId: e.row_id, error: e.last_error })),
    status,
  });
}

function scheduleRetry() {
  backoffMs = Math.min(backoffMs ? backoffMs * 2 : RETRY_MIN_MS, RETRY_MAX_MS);
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = setTimeout(() => void requestSync('full'), backoffMs);
}

async function runOnce(mode: Mode) {
  const a = active;
  if (!a) return;
  if (!online) {
    store().set({ status: 'offline' });
    return;
  }
  store().set({ status: 'syncing' });
  const deps = { transport: a.transport, local: a.local };
  try {
    const pr = await push(deps);
    if (a !== active) return;
    store().addConflicts(pr.conflicts);
    if (pr.stopped) {
      lastStop = pr.stopped;
      store().set({ lastError: pr.error });
      if (pr.stopped === 'retry') scheduleRetry();
      return;
    }
    if (mode === 'full') {
      await pull(deps);
      if (a !== active) return;
      await syncAlerts(createSupabaseAlertsTransport(supabase!), a.alerts);
      // Loaded lazily: auth-store imports this module (avoids a require cycle).
      const { useAuthStore } = await import('@/store/auth-store');
      await showLocalAlerts(a.alerts, useAuthStore.getState().profile?.notification_prefs).catch(() => 0);
      // Leaf scans: upload photos and run cloud checks, one at a time.
      if (a.repos) {
        await runScanQueue({
          repos: a.repos,
          userId: a.userId,
          supabase: supabase!,
          consentOk: hasAiConsent(useAuthStore.getState().profile),
          push: () => push(deps),
          pull: () => pull(deps),
        }).catch(() => 0);
      }
    }
    if (a !== active) return;
    lastStop = null;
    backoffMs = 0;
    store().set({ lastError: null, lastSyncedAt: new Date().toISOString() });
  } catch (e) {
    if (a !== active) return;
    const err = classifyError(e);
    lastStop = err.kind === 'permanent' ? 'error' : err.kind;
    store().set({ lastError: err.message });
    if (err.kind === 'retry') scheduleRetry();
  } finally {
    if (a === active) {
      store().set({ status: online ? 'synced' : 'offline' }); // recomputed by refreshStats
      useDataVersion.getState().bump();
    }
    await refreshStats().catch(() => undefined);
  }
}

/** Run a sync now (or after the current one). Resolves when it's done. */
export function requestSync(mode: Mode = 'full'): Promise<void> {
  if (!active) return Promise.resolve();
  if (running) {
    queued = queued === 'full' || mode === 'full' ? 'full' : 'push';
    return running;
  }
  running = (async () => {
    let next: Mode | null = mode;
    while (next && active) {
      queued = null;
      await runOnce(next);
      next = queued;
    }
  })().finally(() => {
    running = null;
  });
  return running;
}

function schedulePush() {
  void refreshStats().catch(() => undefined);
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => void requestSync('push'), PUSH_DEBOUNCE_MS);
}

/** Open the user's database and start syncing. Safe to call repeatedly. */
export async function startSync(userId: string): Promise<void> {
  if (active?.userId === userId || !supabase) return;
  await stopSync();
  const repos = await openRepos(userId);
  if (!repos.store) return;

  const appState = AppState.addEventListener('change', (s) => {
    if (s === 'active') void requestSync('full');
  });
  const unsubs = [
    onLocalWrite(schedulePush),
    () => appState.remove(),
    NetInfo.addEventListener((state) => {
      const now = state.isConnected !== false && state.isInternetReachable !== false;
      const wasOnline = online;
      online = now;
      if (now && !wasOnline) void requestSync('full');
      else void refreshStats().catch(() => undefined);
    }),
  ];
  active = { userId, local: createSyncLocal(repos.store, userId), transport: createSupabaseTransport(supabase), alerts: repos.alertsLocal, repos, unsubs };
  if (store().sessionLoss?.userId === userId) store().set({ sessionLoss: null });
  await refreshStats();
  void requestSync('full');
}

/** Stop syncing and close the database (the file is kept). Returns unsent change count. */
export async function stopSync(): Promise<number> {
  const a = active;
  if (!a) return 0;
  clearTimers();
  a.unsubs.forEach((u) => u());
  await running?.catch(() => undefined);
  const { pending, failed } = await a.local.stats().catch(() => ({ pending: 0, failed: [] }));
  active = null;
  lastStop = null;
  backoffMs = 0;
  await closeRepos();
  store().reset();
  return pending + failed.length;
}

export async function pendingCount(): Promise<number> {
  if (!active) return 0;
  const { pending, failed } = await active.local.stats();
  return pending + failed.length;
}

export async function discardFailed(): Promise<void> {
  if (!active) return;
  await active.local.discardFailed();
  await refreshStats();
  void requestSync('full');
}

/* ── sign-out rules ─────────────────────────────────────────── */

/** Called by auth-service right before a user-pressed sign-out / account deletion. */
export function beginUserSignOut() {
  userSignOut = true;
}

/** After a user-pressed sign-out: close and delete that user's local file. */
export async function finishUserSignOut(userId: string): Promise<void> {
  try {
    await stopSync();
    await deleteUserDatabase(userId);
    await clearForecasts(userId);
    try {
      clearScanPhotos(userId);
    } catch {
      // no photo folder
    }
    if (store().sessionLoss?.userId === userId) store().set({ sessionLoss: null });
  } finally {
    userSignOut = false;
  }
}

export function cancelUserSignOut() {
  userSignOut = false;
}

/**
 * Auth state says "signed out". If the user didn't ask for it (expired / revoked
 * session), keep the file and remember how many changes are waiting.
 */
export async function handleSignedOut(): Promise<void> {
  if (userSignOut) return;
  const userId = active?.userId;
  const count = await stopSync();
  if (userId && count > 0) store().set({ sessionLoss: { userId, count } });
}

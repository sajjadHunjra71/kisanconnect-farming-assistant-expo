/**
 * Local data layer. Signed-in users on iOS/Android get a per-user SQLite file
 * (`kisan-<userId>.db`); demo mode and web get in-memory sample data.
 */
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

import { createRepos } from './repo-core';
import { createSampleRepos } from './sample-repos';
import type { Repos } from './types';

export * from './types';
export type { AlertRecord, AlertsLocal } from './alerts-local';
export type { ScanCheckState, ScanLocalState, ScanQueue } from './scan-queue';
export { NotFoundError } from './repo-core';
export { ValidationError } from './validate';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let current: { key: string; repos: Promise<Repos>; close: () => Promise<void> } | null = null;

export function dbFileName(userId: string): string {
  if (!UUID_RE.test(userId)) throw new Error('Invalid user id for database file');
  return `kisan-${userId.toLowerCase()}.db`;
}

async function openSqlite(userId: string): Promise<{ repos: Repos; close: () => Promise<void> }> {
  const SQLite = await import('expo-sqlite');
  const { createSqliteStore, migrate } = await import('./sqlite-store');
  const { createSqliteAlerts } = await import('./sqlite-alerts');
  const { createSqliteScanQueue } = await import('./sqlite-scan-queue');
  const db = await SQLite.openDatabaseAsync(dbFileName(userId));
  await migrate(db);
  const store = createSqliteStore(db);
  const repos = createRepos(store, { userId, newId: () => Crypto.randomUUID(), emitWrites: true });
  return { repos: { kind: 'sqlite', store, userId, alertsLocal: createSqliteAlerts(db), scanQueue: createSqliteScanQueue(db), ...repos }, close: () => db.closeAsync() };
}

/** Repos for the signed-in user (null = demo). Reuses the open database for the same user. */
export function openRepos(userId: string | null): Promise<Repos> {
  const key = userId && Platform.OS !== 'web' ? userId : 'sample';
  if (current?.key === key) return current.repos;
  void closeRepos();
  if (key === 'sample') {
    current = { key, repos: Promise.resolve(createSampleRepos()), close: async () => undefined };
  } else {
    const opened = openSqlite(key);
    current = {
      key,
      repos: opened.then((o) => o.repos),
      // Waits for an in-flight open, so a quick sign-out never leaks the handle.
      close: () => opened.then((o) => o.close()).catch(() => undefined),
    };
  }
  return current.repos;
}

/** Close the current user's database (call on sign-out). */
export async function closeRepos(): Promise<void> {
  const prev = current;
  current = null;
  await prev?.close();
}

/** Close (if open) and delete a user's local database file. Used on sign-out and account deletion. */
export async function deleteUserDatabase(userId: string): Promise<void> {
  if (current?.key === userId) await closeRepos();
  if (Platform.OS === 'web') return;
  const SQLite = await import('expo-sqlite');
  try {
    await SQLite.deleteDatabaseAsync(dbFileName(userId));
  } catch {
    // No file yet (never opened) — nothing to delete.
  }
}

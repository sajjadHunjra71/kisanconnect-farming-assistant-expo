/**
 * Sync error classes:
 *   retry     – network down, timeouts, 5xx, 503 / paused project, 429. Back off and try
 *               again later; the op's attempt counter is NOT increased.
 *   auth      – no session / expired JWT. Stop until the user is signed in again.
 *   permanent – the server rejected the data (4xx, check 23514, RLS 42501, FK 23503…).
 *               attempts++; after 5 the op is marked failed.
 */
export type SyncErrorKind = 'retry' | 'permanent' | 'auth';

export class SyncError extends Error {
  constructor(
    readonly kind: SyncErrorKind,
    message: string,
    readonly code?: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'SyncError';
  }
}

const PERMANENT_CODES = new Set(['23514', '42501', '23503', '23505', '23502', '22P02', '22001', '22003', '22007', '42703', 'PGRST204']);
const AUTH_CODES = new Set(['PGRST301', 'PGRST302', 'PGRST303']);

type ErrorLike = { status?: number; code?: string; message?: string; name?: string };

export function classifyError(e: unknown): SyncError {
  if (e instanceof SyncError) return e;
  const err = (typeof e === 'object' && e !== null ? e : { message: String(e) }) as ErrorLike;
  const message = err.message ?? 'Unknown sync error';
  const { status, code } = err;

  if (status === 401 || (code && AUTH_CODES.has(code))) return new SyncError('auth', message, code, status);
  if (code && PERMANENT_CODES.has(code)) return new SyncError('permanent', message, code, status);
  if (status === undefined || status === 0) {
    // fetch() failures, aborted requests, timeouts.
    return new SyncError('retry', message, code, status);
  }
  if (status >= 500 || status === 408 || status === 429) return new SyncError('retry', message, code, status);
  if (status >= 400) return new SyncError('permanent', message, code, status);
  return new SyncError('retry', message, code, status);
}

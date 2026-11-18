import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, processLock, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { env, isBackendConfigured } from '@/config/env';

/**
 * Single Supabase client. `null` until EXPO_PUBLIC_SUPABASE_URL / ANON_KEY are set in .env,
 * in which case the app runs in "demo mode" with sample data.
 * The anon key is public by design; all data access is protected by Row Level Security.
 */
export const supabase: SupabaseClient | null = isBackendConfigured
  ? createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: {
        ...(Platform.OS !== 'web' ? { storage: AsyncStorage } : {}),
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        flowType: 'pkce',
        lock: processLock,
      },
    })
  : null;

// Refresh tokens only while the app is in the foreground (Supabase RN guidance).
if (supabase && Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') void supabase.auth.startAutoRefresh();
    else void supabase.auth.stopAutoRefresh();
  });
}

export function requireSupabase(): SupabaseClient {
  if (!supabase) throw new AuthServiceError('not_configured');
  return supabase;
}

export class AuthServiceError extends Error {
  constructor(public code: AuthErrorCode) {
    super(code);
  }
}

export type AuthErrorCode =
  | 'not_configured'
  | 'invalid_credentials'
  | 'email_not_confirmed'
  | 'user_exists'
  | 'weak_password'
  | 'rate_limited'
  | 'network'
  | 'cancelled'
  | 'unknown';

import type { AuthError } from '@supabase/supabase-js';
import { makeRedirectUri } from 'expo-auth-session';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { AuthServiceError, requireSupabase, type AuthErrorCode } from '@/lib/supabase';
import { unregisterWeatherPush } from '@/features/notifications/push';
import { beginUserSignOut, cancelUserSignOut, finishUserSignOut } from '@/sync/sync-manager';

WebBrowser.maybeCompleteAuthSession();

/** Deep link the auth emails and Google return to. Works in Expo Go (exp://) and builds (kisanconnect://). */
export const authRedirectUrl = (path: 'auth/callback' | 'auth/reset' = 'auth/callback') =>
  makeRedirectUri({ scheme: 'kisanconnect', path });

function mapError(error: AuthError | Error | null | undefined): AuthServiceError {
  if (!error) return new AuthServiceError('unknown');
  const code = 'code' in error ? (error.code as string | undefined) : undefined;
  const msg = error.message.toLowerCase();
  let mapped: AuthErrorCode = 'unknown';
  if (code === 'invalid_credentials' || msg.includes('invalid login')) mapped = 'invalid_credentials';
  else if (code === 'email_not_confirmed') mapped = 'email_not_confirmed';
  else if (code === 'user_already_exists' || code === 'email_exists') mapped = 'user_exists';
  else if (code === 'weak_password') mapped = 'weak_password';
  else if (code?.startsWith('over_') || msg.includes('rate limit')) mapped = 'rate_limited';
  else if (msg.includes('network') || msg.includes('fetch')) mapped = 'network';
  return new AuthServiceError(mapped);
}

export async function signInWithEmail(email: string, password: string) {
  const { error } = await requireSupabase().auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw mapError(error);
}

/** Returns true when the user must confirm their email before signing in. */
export async function signUpWithEmail(fullName: string, email: string, password: string): Promise<boolean> {
  const { data, error } = await requireSupabase().auth.signUp({
    email: email.trim(),
    password,
    options: { data: { full_name: fullName.trim() }, emailRedirectTo: authRedirectUrl() },
  });
  if (error) throw mapError(error);
  // Supabase returns a user with no identities when the email is already registered.
  if (data.user && data.user.identities?.length === 0) throw new AuthServiceError('user_exists');
  return !data.session;
}

export async function sendPasswordReset(email: string) {
  const { error } = await requireSupabase().auth.resetPasswordForEmail(email.trim(), { redirectTo: authRedirectUrl('auth/reset') });
  if (error) throw mapError(error);
}

export async function updatePassword(password: string) {
  const { error } = await requireSupabase().auth.updateUser({ password });
  if (error) throw mapError(error);
}

const GOOGLE_REDIRECT = 'kisanconnect://auth/callback';

/** Browser-based Google sign-in (no native SDK, so it works in Expo Go and without an Xcode build). */
export async function signInWithGoogle() {
  const supabase = requireSupabase();
  // Always return to the app's own scheme. The in-app auth browser (ASWebAuthenticationSession / Custom Tabs)
  // catches kisanconnect:// itself, so this also works inside Expo Go, whose exp://<LAN-IP> addresses
  // Supabase's redirect allow-list does not accept.
  const redirectTo = Platform.OS === 'web' ? authRedirectUrl() : GOOGLE_REDIRECT;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true, queryParams: { prompt: 'select_account' } },
  });
  if (error || !data.url) throw mapError(error);

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') throw new AuthServiceError('cancelled');
  await exchangeFromUrl(result.url);
}

/** Completes PKCE sign-in from a redirect URL (Google, email confirmation, password reset). */
export async function exchangeFromUrl(url: string) {
  const { queryParams } = Linking.parse(url);
  const code = typeof queryParams?.code === 'string' ? queryParams.code : undefined;
  if (!code) throw new AuthServiceError(queryParams?.error ? 'cancelled' : 'unknown');
  await exchangeCode(code);
}

export async function exchangeCode(code: string) {
  const { error } = await requireSupabase().auth.exchangeCodeForSession(code);
  if (error) throw mapError(error);
}

/**
 * User-pressed sign-out. Check for unsent changes first (see confirmSignOut).
 * Afterwards the user's local database file is closed and deleted.
 */
export async function signOut() {
  const supabase = requireSupabase();
  const userId = (await supabase.auth.getSession()).data.session?.user.id;
  // Stop weather alerts to this phone for this account (needs the session, so before signing out).
  await unregisterWeatherPush();
  beginUserSignOut();
  const { error } = await supabase.auth.signOut();
  if (error) {
    cancelUserSignOut();
    throw mapError(error);
  }
  if (userId) await finishUserSignOut(userId);
  else cancelUserSignOut();
}

export async function deleteAccount() {
  const supabase = requireSupabase();
  const userId = (await supabase.auth.getSession()).data.session?.user.id;
  const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
  if (error) throw mapError(error);
  beginUserSignOut();
  try {
    await supabase.auth.signOut({ scope: 'local' });
  } finally {
    // The account is gone on the server: always wipe this user's local database file.
    if (userId) await finishUserSignOut(userId);
    else cancelUserSignOut();
  }
}

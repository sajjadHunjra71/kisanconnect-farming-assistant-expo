import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';

import { supabase } from '@/lib/supabase';
import { handleSignedOut, startSync } from '@/sync/sync-manager';

export type AuthStatus = 'loading' | 'signedIn' | 'signedOut' | 'demo';

export type Profile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  district: string | null;
  language: string;
  role: 'farmer' | 'expert' | 'admin';
  units: 'acre' | 'kanal' | 'hectare';
  notification_prefs: unknown;
};

type AuthState = {
  status: AuthStatus;
  session: Session | null;
  profile: Profile | null;
  init: () => () => void;
  loadProfile: () => Promise<void>;
};

/**
 * Session lives in Supabase's own storage; this store mirrors it for the UI.
 * "demo" = no Supabase keys in .env, so the app shows sample data without login.
 */
export const useAuthStore = create<AuthState>((set, get) => ({
  status: supabase ? 'loading' : 'demo',
  session: null,
  profile: null,

  init: () => {
    if (!supabase) return () => undefined;
    void supabase.auth.getSession().then(({ data }) => {
      set({ session: data.session, status: data.session ? 'signedIn' : 'signedOut' });
      if (data.session) {
        void get().loadProfile();
        void startSync(data.session.user.id);
      }
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const hadSession = get().session !== null;
      set({ session, status: session ? 'signedIn' : 'signedOut', profile: session ? get().profile : null });
      // Opens this user's local database (no-op if already open). Deferred like the profile fetch.
      if (session) setTimeout(() => void startSync(session.user.id), 0);
      else if (hadSession) setTimeout(() => void handleSignedOut(), 0);
      // Supabase warns against calling its API inside this callback; defer the profile fetch.
      if (session) setTimeout(() => void get().loadProfile(), 0);
    });
    return () => data.subscription.unsubscribe();
  },

  loadProfile: async () => {
    const userId = get().session?.user.id;
    if (!supabase || !userId) return;
    const { data } = await supabase.from('profiles').select('id, full_name, avatar_url, district, language, role, units, notification_prefs').eq('id', userId).maybeSingle();
    if (data) set({ profile: data as Profile });
  },
}));

export const selectDisplayName = (s: AuthState): string | null =>
  s.profile?.full_name ?? (s.session?.user.user_metadata?.full_name as string | undefined) ?? null;

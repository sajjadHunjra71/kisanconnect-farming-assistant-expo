import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';

import { supabase } from '@/lib/supabase';

export type AuthStatus = 'loading' | 'signedIn' | 'signedOut' | 'demo';

export type Profile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  district: string | null;
  language: string;
  role: 'farmer' | 'expert' | 'admin';
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
      if (data.session) void get().loadProfile();
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      set({ session, status: session ? 'signedIn' : 'signedOut', profile: session ? get().profile : null });
      // Supabase warns against calling its API inside this callback; defer the profile fetch.
      if (session) setTimeout(() => void get().loadProfile(), 0);
    });
    return () => data.subscription.unsubscribe();
  },

  loadProfile: async () => {
    const userId = get().session?.user.id;
    if (!supabase || !userId) return;
    const { data } = await supabase.from('profiles').select('id, full_name, avatar_url, district, language, role').eq('id', userId).maybeSingle();
    if (data) set({ profile: data as Profile });
  },
}));

export const selectDisplayName = (s: AuthState): string | null =>
  s.profile?.full_name ?? (s.session?.user.user_metadata?.full_name as string | undefined) ?? null;

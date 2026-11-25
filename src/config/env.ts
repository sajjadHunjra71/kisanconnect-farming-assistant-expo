/**
 * Public runtime config. Only EXPO_PUBLIC_* values are bundled into the app,
 * so never put server secrets (service-role keys, AI API keys) here —
 * those live in Supabase Edge Function secrets.
 */
export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  helplineNumber: process.env.EXPO_PUBLIC_HELPLINE_NUMBER ?? '',
} as const;

export const isBackendConfigured = Boolean(env.supabaseUrl && env.supabaseAnonKey);

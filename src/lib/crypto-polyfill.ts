import * as Crypto from 'expo-crypto';

/**
 * React Native has no WebCrypto. Supabase's PKCE login needs crypto.getRandomValues and
 * crypto.subtle.digest('SHA-256'); without them it falls back to the weaker "plain" challenge.
 * expo-crypto provides both natively (works in Expo Go).
 */
type MinimalCrypto = {
  getRandomValues?: typeof Crypto.getRandomValues;
  subtle?: { digest: (algorithm: string, data: BufferSource) => Promise<ArrayBuffer> };
};

const g = globalThis as unknown as { crypto?: MinimalCrypto };
g.crypto ??= {};
g.crypto.getRandomValues ??= Crypto.getRandomValues;
g.crypto.subtle ??= {
  digest: (algorithm, data) => Crypto.digest(algorithm as Crypto.CryptoDigestAlgorithm, data),
};

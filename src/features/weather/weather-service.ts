/**
 * Forecast for a farm. Signed in: Supabase `weather-proxy` (shared 1 h cache per grid cell
 * on the server). The phone keeps the last forecast per user + farm (AsyncStorage) so it
 * shows offline with its age; it's cleared when that user signs out.
 * Demo mode / no backend: sample forecast.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { gridCell, type Forecast } from '@/engine/weather-rules';
import { supabase } from '@/lib/supabase';
import { sampleForecast } from '@/mocks/sample-forecast';

export const LOCAL_FRESH_MS = 30 * 60 * 1000;
const PREFIX = 'kisanconnect-weather:';
const key = (userId: string, farmId: string) => `${PREFIX}${userId}:${farmId}`;

export type ForecastResult = {
  forecast: Forecast;
  /** 'network' = just fetched; 'cache' = phone copy (offline or fresh enough); 'sample' = demo. */
  source: 'network' | 'cache' | 'sample';
  /** True when we tried the network and failed, so this is the last saved copy. */
  offline: boolean;
};

export class NoForecastError extends Error {}

async function readLocal(k: string): Promise<Forecast | null> {
  try {
    const raw = await AsyncStorage.getItem(k);
    const f = raw ? (JSON.parse(raw) as Forecast) : null;
    return f && f.schemaVersion === 2 ? f : null; // ignore copies from an older app version
  } catch {
    return null;
  }
}

const inflight = new Map<string, Promise<ForecastResult>>();

export function getForecast(
  target: { userId: string | null; farmId: string; lat: number; lng: number },
  opts: { force?: boolean; demo?: boolean } = {},
): Promise<ForecastResult> {
  if (opts.demo || !supabase || !target.userId) return Promise.resolve({ forecast: sampleForecast(), source: 'sample', offline: false });
  const k = key(target.userId, target.farmId);
  const flightKey = `${k}:${opts.force ? 'f' : ''}`;
  const existing = inflight.get(flightKey);
  if (existing) return existing;
  const run = (async (): Promise<ForecastResult> => {
    const local = await readLocal(k);
    if (local && !opts.force && Date.now() - Date.parse(local.fetchedAt) < LOCAL_FRESH_MS) {
      return { forecast: local, source: 'cache', offline: false };
    }
    try {
      // Only the ~11 km cell centre leaves the phone, never the farm's own point.
      const cell = gridCell(target.lat, target.lng);
      const { data, error } = await supabase!.functions.invoke<{ forecast: Forecast }>('weather-proxy', {
        method: 'POST',
        body: { lat: cell.lat, lng: cell.lng },
      });
      if (error || !data?.forecast) throw error ?? new Error('no forecast');
      await AsyncStorage.setItem(k, JSON.stringify(data.forecast)).catch(() => undefined);
      return { forecast: data.forecast, source: 'network', offline: false };
    } catch (e) {
      if (local) return { forecast: local, source: 'cache', offline: true };
      throw new NoForecastError(String(e));
    }
  })().finally(() => inflight.delete(flightKey));
  inflight.set(flightKey, run);
  return run;
}

/** Remove a user's saved forecasts (on sign-out / account deletion). */
export async function clearForecasts(userId: string): Promise<void> {
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(`${PREFIX}${userId}:`));
    if (keys.length) await AsyncStorage.multiRemove(keys);
  } catch {
    // storage unavailable: nothing to clear
  }
}

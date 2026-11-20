/**
 * Forecast for a farm. Signed in: Supabase `weather-proxy` (shared 1 h cache per grid cell),
 * plus a copy on the phone so the last forecast shows offline with its age.
 * Demo mode / no backend: sample forecast.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { gridCell, type Forecast } from '@/engine/weather-rules';
import { supabase } from '@/lib/supabase';
import { sampleForecast } from '@/mocks/sample-forecast';

export const LOCAL_FRESH_MS = 30 * 60 * 1000;
const KEY = (cell: string) => `kisanconnect-weather:${cell}`;

export type ForecastResult = {
  forecast: Forecast;
  /** 'network' = just fetched; 'cache' = phone copy (offline or fresh enough); 'sample' = demo. */
  source: 'network' | 'cache' | 'sample';
  /** True when we tried the network and failed, so this is the last saved copy. */
  offline: boolean;
};

export class NoForecastError extends Error {}

async function readLocal(cell: string): Promise<Forecast | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY(cell));
    return raw ? (JSON.parse(raw) as Forecast) : null;
  } catch {
    return null;
  }
}

const inflight = new Map<string, Promise<ForecastResult>>();

export function getForecast(point: { lat: number; lng: number }, opts: { force?: boolean; demo?: boolean } = {}): Promise<ForecastResult> {
  if (opts.demo || !supabase) return Promise.resolve({ forecast: sampleForecast(), source: 'sample', offline: false });
  const cell = gridCell(point.lat, point.lng);
  const key = `${cell.key}:${opts.force ? 'f' : ''}`;
  const existing = inflight.get(key);
  if (existing) return existing;
  const run = (async (): Promise<ForecastResult> => {
    const local = await readLocal(cell.key);
    if (local && !opts.force && Date.now() - Date.parse(local.fetchedAt) < LOCAL_FRESH_MS) {
      return { forecast: local, source: 'cache', offline: false };
    }
    try {
      const { data, error } = await supabase!.functions.invoke<{ forecast: Forecast }>('weather-proxy', {
        method: 'POST',
        body: { lat: cell.lat, lng: cell.lng },
      });
      if (error || !data?.forecast) throw error ?? new Error('no forecast');
      await AsyncStorage.setItem(KEY(cell.key), JSON.stringify(data.forecast)).catch(() => undefined);
      return { forecast: data.forecast, source: 'network', offline: false };
    } catch (e) {
      if (local) return { forecast: local, source: 'cache', offline: true };
      throw new NoForecastError(String(e));
    }
  })().finally(() => inflight.delete(key));
  inflight.set(key, run);
  return run;
}

import type { Forecast, Num } from '../weather-rules';

type H = Partial<{ tempC: Num; feelsLikeC: Num; humidity: Num; rainProb: Num; precipMm: Num; windKmh: Num; gustKmh: Num; visibilityM: Num; code: Num }>;
type D = Partial<{ maxC: Num; minC: Num; precipMm: Num; et0Mm: Num; code: Num }>;

/** Build a forecast: `days` local dates from `start`, 24 hourly slots each, with overrides. */
export function makeForecast(opts: { start?: string; days?: number; hourly?: (time: string, i: number) => H; daily?: (date: string, i: number) => D }): Forecast {
  const start = opts.start ?? '2026-10-21';
  const days = opts.days ?? 44; // 30 past + 14 ahead of 2026-11-20
  const date: string[] = [];
  for (let i = 0; i < days; i++) date.push(new Date(Date.parse(`${start}T00:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10));
  const time = date.flatMap((d) => Array.from({ length: 24 }, (_, h) => `${d}T${String(h).padStart(2, '0')}:00`));
  const Hs = time.map((t, i) => ({ tempC: 22, feelsLikeC: 22, humidity: 50, rainProb: 0, precipMm: 0, windKmh: 6, gustKmh: 10, visibilityM: 20000, code: 0, ...opts.hourly?.(t, i) }));
  const Ds = date.map((d, i) => ({ maxC: 25, minC: 12, precipMm: 0, et0Mm: 3, code: 0, ...opts.daily?.(d, i) }));
  const col = <T, K extends keyof T>(rows: T[], k: K) => rows.map((r) => r[k]);
  return {
    provider: 'open-meteo',
    schemaVersion: 2,
    lat: 31.5,
    lng: 74.3,
    utcOffsetSeconds: 18000,
    fetchedAt: '2026-11-20T05:00:00.000Z',
    hourly: {
      time,
      tempC: col(Hs, 'tempC'),
      feelsLikeC: col(Hs, 'feelsLikeC'),
      humidity: col(Hs, 'humidity'),
      rainProb: col(Hs, 'rainProb'),
      precipMm: col(Hs, 'precipMm'),
      windKmh: col(Hs, 'windKmh'),
      gustKmh: col(Hs, 'gustKmh'),
      visibilityM: col(Hs, 'visibilityM'),
      code: col(Hs, 'code'),
    },
    daily: { date, maxC: col(Ds, 'maxC'), minC: col(Ds, 'minC'), precipMm: col(Ds, 'precipMm'), et0Mm: col(Ds, 'et0Mm'), code: col(Ds, 'code') },
  };
}

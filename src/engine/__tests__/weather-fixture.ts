import type { Forecast } from '../weather-rules';

/** Build a forecast: `days` local dates from `start`, 24 hourly slots each, with overrides. */
export function makeForecast(opts: {
  start?: string;
  days?: number;
  hourly?: (time: string, i: number) => Partial<{ tempC: number; humidity: number; rainProb: number; precipMm: number; windKmh: number; gustKmh: number; code: number }>;
  daily?: (date: string, i: number) => Partial<{ maxC: number; minC: number; precipMm: number; et0Mm: number; code: number }>;
}): Forecast {
  const start = opts.start ?? '2026-11-13';
  const days = opts.days ?? 14;
  const date: string[] = [];
  for (let i = 0; i < days; i++) date.push(new Date(Date.parse(`${start}T00:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10));
  const time = date.flatMap((d) => Array.from({ length: 24 }, (_, h) => `${d}T${String(h).padStart(2, '0')}:00`));
  const H = time.map((t, i) => ({ tempC: 22, humidity: 50, rainProb: 0, precipMm: 0, windKmh: 5, gustKmh: 10, code: 0, ...opts.hourly?.(t, i) }));
  const D = date.map((d, i) => ({ maxC: 25, minC: 12, precipMm: 0, et0Mm: 3, code: 0, ...opts.daily?.(d, i) }));
  return {
    lat: 31.5,
    lng: 74.3,
    utcOffsetSeconds: 18000,
    fetchedAt: '2026-11-20T05:00:00.000Z',
    current: { time: '2026-11-20T10:00', tempC: 22, feelsLikeC: 21, humidity: 50, windKmh: 5, gustKmh: 10, precipMm: 0, code: 1, isDay: true },
    hourly: {
      time,
      tempC: H.map((x) => x.tempC),
      humidity: H.map((x) => x.humidity),
      rainProb: H.map((x) => x.rainProb),
      precipMm: H.map((x) => x.precipMm),
      windKmh: H.map((x) => x.windKmh),
      gustKmh: H.map((x) => x.gustKmh),
      code: H.map((x) => x.code),
    },
    daily: {
      date,
      maxC: D.map((x) => x.maxC),
      minC: D.map((x) => x.minC),
      precipMm: D.map((x) => x.precipMm),
      rainProbMax: D.map(() => 0),
      et0Mm: D.map((x) => x.et0Mm),
      windMaxKmh: D.map(() => 10),
      code: D.map((x) => x.code),
    },
  };
}

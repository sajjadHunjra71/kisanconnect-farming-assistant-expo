/**
 * SAMPLE forecast for demo mode / web: a believable Punjab winter around "now"
 * (cool foggy mornings, a rain spell tomorrow evening), shaped like a real Open-Meteo forecast.
 */
import { FORECAST_DAYS, FORECAST_SCHEMA_VERSION, PAST_DAYS, PK_UTC_OFFSET, type Forecast } from '@/engine/weather-rules';

export function sampleForecast(now = new Date()): Forecast {
  const local = new Date(now.getTime() + PK_UTC_OFFSET * 1000);
  const today = local.toISOString().slice(0, 10);
  const day0 = Date.parse(`${today}T00:00:00Z`) - PAST_DAYS * 86_400_000;
  const days = PAST_DAYS + FORECAST_DAYS;
  const date = Array.from({ length: days }, (_, i) => new Date(day0 + i * 86_400_000).toISOString().slice(0, 10));
  const time = date.flatMap((d) => Array.from({ length: 24 }, (_, h) => `${d}T${String(h).padStart(2, '0')}:00`));
  const rainy = (d: number, h: number) => d === PAST_DAYS + 1 && h >= 18 && h <= 23;
  const H = time.map((_, i) => {
    const d = Math.floor(i / 24);
    const h = i % 24;
    const tempC = Math.round((14 + 9 * Math.sin(((h - 9) / 24) * 2 * Math.PI) - (d % 3)) * 10) / 10;
    const fog = h >= 4 && h <= 8 && d % 2 === 0;
    return {
      tempC,
      feelsLikeC: Math.round((tempC - 1) * 10) / 10,
      humidity: fog ? 95 : rainy(d, h) ? 90 : Math.round(70 - 20 * Math.sin(((h - 9) / 24) * 2 * Math.PI)),
      rainProb: rainy(d, h) ? 70 : 5,
      precipMm: rainy(d, h) ? 2 : 0,
      windKmh: h >= 12 && h <= 16 ? 12 : 6,
      gustKmh: h >= 12 && h <= 16 ? 20 : 12,
      visibilityM: fog ? 800 : 15000,
      code: rainy(d, h) ? 63 : fog ? 45 : h >= 10 && h <= 16 ? 1 : 2,
    };
  });
  const day = (k: number) => H.slice(k * 24, k * 24 + 24);
  const col = <K extends keyof (typeof H)[number]>(k: K) => H.map((x) => x[k]);
  return {
    provider: 'open-meteo',
    schemaVersion: FORECAST_SCHEMA_VERSION,
    lat: 31.4,
    lng: 73.1,
    utcOffsetSeconds: PK_UTC_OFFSET,
    fetchedAt: new Date(now.getTime() - 40 * 60_000).toISOString(),
    hourly: {
      time,
      tempC: col('tempC'),
      feelsLikeC: col('feelsLikeC'),
      humidity: col('humidity'),
      precipMm: col('precipMm'),
      rainProb: col('rainProb'),
      windKmh: col('windKmh'),
      gustKmh: col('gustKmh'),
      visibilityM: col('visibilityM'),
      code: col('code'),
    },
    daily: {
      date,
      maxC: date.map((_, k) => Math.max(...day(k).map((x) => x.tempC))),
      minC: date.map((_, k) => Math.min(...day(k).map((x) => x.tempC))),
      precipMm: date.map((_, k) => day(k).reduce((s, x) => s + x.precipMm, 0)),
      et0Mm: date.map((_, k) => (k === PAST_DAYS + 1 ? 1.2 : 2.4)),
      code: date.map((_, k) => (k === PAST_DAYS + 1 ? 63 : k % 2 === 0 ? 45 : 2)),
    },
  };
}

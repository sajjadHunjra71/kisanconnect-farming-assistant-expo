import { MET_USER_AGENT, extraterrestrialRadiation, hargreavesEt0, metNorwayUrl, parseMetNorway, symbolToCode } from '../met-norway';
import { sprayWindow } from '../weather-rules';

const entry = (time: string, t: number, hourly: boolean, extra: Record<string, number> = {}) => ({
  time,
  data: {
    instant: { details: { air_temperature: t, relative_humidity: 70, wind_speed: 2.5, wind_speed_of_gust: 5 } },
    ...(hourly
      ? { next_1_hours: { summary: { symbol_code: 'partlycloudy_day' }, details: { precipitation_amount: extra.p1 ?? 0, probability_of_precipitation: 10 } } }
      : { next_6_hours: { summary: { symbol_code: 'rain' }, details: { precipitation_amount: extra.p6 ?? 0 } } }),
  },
});

describe('MET Norway fallback', () => {
  it('URL uses ≤ 4 decimals; UA has app + repo, no email', () => {
    expect(metNorwayUrl(31.549712, 74.343611)).toBe('https://api.met.no/weatherapi/locationforecast/2.0/complete?lat=31.5497&lon=74.3436');
    expect(MET_USER_AGENT).toMatch(/^KisanConnect\/.+github\.com\//);
    expect(MET_USER_AGENT).not.toMatch(/@/);
  });

  it('Ra and Hargreaves ET0 are in a sensible range for Lahore', () => {
    expect(extraterrestrialRadiation(31.5, 172)).toBeGreaterThan(40); // June
    expect(extraterrestrialRadiation(31.5, 355)).toBeLessThan(20); // December
    const winter = hargreavesEt0(22, 8, 31.5, '2026-12-15');
    const summer = hargreavesEt0(42, 28, 31.5, '2026-06-15');
    expect(winter).toBeGreaterThan(1.5);
    expect(winter).toBeLessThan(3.5);
    expect(summer).toBeGreaterThan(winter * 2);
  });

  it('parses: UTC → Karachi, m/s → km/h, hourly part only, daily totals without double counting', () => {
    const ts = [
      ...Array.from({ length: 30 }, (_, k) => entry(new Date(Date.parse('2026-11-19T19:00:00Z') + k * 3_600_000).toISOString().replace('.000', ''), 10 + (k % 12), true, k === 5 ? { p1: 2 } : {})),
      entry('2026-11-21T01:00:00Z', 9, false, { p6: 6 }),
      entry('2026-11-21T07:00:00Z', 20, false),
      entry('2026-11-21T13:00:00Z', 15, false),
      entry('2026-11-21T19:00:00Z', 11, false),
    ];
    const f = parseMetNorway({ geometry: { coordinates: [74.3, 31.5, 210] }, properties: { timeseries: ts } }, '2026-11-20T00:00:00Z');
    expect(f.provider).toBe('met-norway');
    expect(f.hourly.time[0]).toBe('2026-11-20T00:00'); // 19:00Z + 5 h
    expect(f.hourly.time).toHaveLength(30);
    expect(f.hourly.windKmh[0]).toBe(9); // 2.5 m/s
    expect(f.hourly.visibilityM[0]).toBeNull();
    expect(f.hourly.feelsLikeC[0]).toBeNull();
    const d20 = f.daily.date.indexOf('2026-11-20');
    expect(f.daily.precipMm[d20]).toBe(2);
    expect(f.daily.et0Mm[d20]).not.toBeNull();
    const d21 = f.daily.date.indexOf('2026-11-21');
    expect(f.daily.precipMm[d21]).toBe(6);
    // rules run on it
    expect(sprayWindow(f, '2026-11-20T08:00', 6).length).toBe(6);
  });

  it('symbol codes', () => {
    expect(symbolToCode('clearsky_day')).toBe(0);
    expect(symbolToCode('fog')).toBe(45);
    expect(symbolToCode('heavyrainshowers_night')).toBe(65);
    expect(symbolToCode('rainandthunder')).toBe(95);
    expect(symbolToCode(undefined)).toBeNull();
  });
});

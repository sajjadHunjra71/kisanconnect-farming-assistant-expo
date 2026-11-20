import type { ActivityRecord, CropRecord } from '@/db/types';
import { makeForecast } from '@/engine/__tests__/weather-fixture';
import { sampleForecast } from '@/mocks/sample-forecast';

import { buildAdvisories, dailyForecast, dayHours, spraySlots, weatherNow } from '../build';

const tr = (key: string, params?: Record<string, string | number>) => ({ en: params ? `${key} ${JSON.stringify(params)}` : key });
const sync = { user_id: 'u', version: 1, last_op_id: null, created_at: '', updated_at: '', deleted_at: null };
const crop = (id: string, crop_key: CropRecord['crop_key'], sowing_date: string): CropRecord => ({
  ...sync, id, farm_id: 'f', crop_key, variety: null, sowing_date, area_value: null, area_unit: null, area_acres: null, status: 'active', harvested_on: null,
});
const irrigation = (crop_id: string | null, done_on: string): ActivityRecord => ({
  ...sync, id: `a-${done_on}`, farm_id: 'f', crop_id, type: 'irrigation', done_on, quantity: null, quantity_unit: null, product: null, cost_pkr: null, notes: null, source: 'manual',
});
const base = { nowHour: '2026-11-20T08:00', today: '2026-11-20', cropName: (c: string) => c, hourLabel: (t: string) => t.slice(11, 16) };

describe('weather screen data', () => {
  const f = makeForecast({});

  it('now / day hours / 7 days', () => {
    expect(weatherNow(f, '2026-11-20T10:00')).toMatchObject({ tempC: 22, condition: 'partly-cloudy', et0Mm: 3, source: 'Open-Meteo' });
    const hours = dayHours(f, '2026-11-20');
    expect(hours[0].hour).toBe('06:00');
    expect(hours).toHaveLength(18);
    const days = dailyForecast(f, '2026-11-20', (d, isToday) => ({ en: isToday ? 'Today' : d }));
    expect(days).toHaveLength(7);
    expect(days[0].day.en).toBe('Today');
  });

  it('spray strip skips night hours', () => {
    const slots = spraySlots(f, '2026-11-20T17:00');
    expect(slots.map((s) => s.time.slice(11, 13))).toEqual(['17', '18', '06', '07', '08', '09', '10', '11', '12', '13', '14', '15']);
  });
});

describe('buildAdvisories', () => {
  it('good spray window, irrigation due for wheat, rust risk, frost alert', () => {
    const f = makeForecast({
      hourly: (t) => (t >= '2026-11-20T20:00' && t < '2026-11-21T10:00' ? { tempC: 9, humidity: 92 } : {}),
      daily: (d) => (d === '2026-11-21' ? { minC: 1 } : {}),
    });
    const advice = buildAdvisories({
      ...base,
      forecast: f,
      crops: [crop('w', 'wheat', '2026-10-10')], // day 41 → tillering
      activities: [irrigation('w', '2026-11-08')], // 12 days × 3 mm × 0.75 = 27 mm of 55
      tr,
    });
    expect(advice.map((a) => [a.kind, a.severity])).toEqual([
      ['frost', 'warning'],
      ['disease-risk', 'warning'],
      ['irrigation', 'info'],
      ['spray', 'good'],
    ]);
    expect(advice.find((a) => a.kind === 'spray')?.title.en).toBe('advice.sprayGood.today {"from":"08:00","to":"19:00"}');
    expect(advice.find((a) => a.kind === 'irrigation')?.title.en).toContain('advice.irrigation.ok');
  });

  it('no spray window → warning with the main reason; planned crops get no advice', () => {
    const f = makeForecast({ hourly: () => ({ windKmh: 25 }) });
    const advice = buildAdvisories({ ...base, forecast: f, crops: [crop('r', 'rice', '2026-12-10')], activities: [], tr });
    expect(advice).toEqual([expect.objectContaining({ kind: 'spray', severity: 'warning', body: { en: 'advice.sprayReason.wind' } })]);
  });

  it('works on the sample forecast', () => {
    const f = sampleForecast(new Date('2026-11-20T05:00:00Z'));
    const now = '2026-11-20T10:00';
    expect(weatherNow(f, now).source).toBe('Open-Meteo');
    expect(buildAdvisories({ ...base, nowHour: now, forecast: f, crops: [crop('w', 'wheat', '2026-10-10')], activities: [], tr }).length).toBeGreaterThan(0);
  });
});

describe('advice strings', () => {
  it('every key the builder can produce exists in en.json and ur.json', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { DISEASE_RULES } = require('@/engine/weather-rules') as typeof import('@/engine/weather-rules');
    const keys = [
      'advice.sprayGood.today',
      'advice.sprayGood.tomorrow',
      'advice.sprayGoodBody',
      'advice.sprayNone',
      ...['rain', 'wind', 'heat'].map((r) => `advice.sprayReason.${r}`),
      ...['heat', 'frost', 'heavy-rain', 'strong-wind'].flatMap((k) => [`advice.alert.${k}.title`, `advice.alert.${k}.body`]),
      ...DISEASE_RULES.flatMap((r) => [`advice.disease.${r.id}.title`, `advice.disease.${r.id}.body`]),
      'advice.irrigation.skip.title',
      'advice.irrigation.skip.body',
      'advice.irrigation.due.now',
      'advice.irrigation.due.tomorrow',
      'advice.irrigation.due.soon',
      'advice.irrigation.ok_one',
      'advice.irrigation.ok_other',
      'advice.irrigation.body',
      'weather.today',
    ];
    for (const lang of ['en', 'ur']) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const json = require(`@/i18n/locales/${lang}.json`) as Record<string, unknown>;
      const get = (k: string) => k.split('.').reduce<unknown>((o, p) => (o as Record<string, unknown> | undefined)?.[p], json);
      expect(keys.filter((k) => typeof get(k) !== 'string').map((k) => `${lang}:${k}`)).toEqual([]);
    }
  });
});

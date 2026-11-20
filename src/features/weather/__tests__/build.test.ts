import type { ActivityRecord, CropRecord } from '@/db/types';
import { makeForecast } from '@/engine/__tests__/weather-fixture';
import { DISEASE_RULE_IDS } from '@/engine/weather-rules';
import { sampleForecast } from '@/mocks/sample-forecast';

import { ATTRIBUTION, buildAdvisories, dailyForecast, dayHours, spraySlots, weatherNow } from '../build';

const tr = (key: string, params?: Record<string, string | number>) => ({ en: params ? `${key} ${JSON.stringify(params)}` : key });
const sync = { user_id: 'u', version: 1, last_op_id: null, created_at: '', updated_at: '', deleted_at: null };
const crop = (id: string, crop_key: CropRecord['crop_key'], sowing_date: string): CropRecord => ({
  ...sync, id, farm_id: 'f', crop_key, variety: null, sowing_date, area_value: null, area_unit: null, area_acres: null, status: 'active', harvested_on: null,
});
const irrigation = (crop_id: string | null, done_on: string): ActivityRecord => ({
  ...sync, id: `a-${done_on}`, farm_id: 'f', crop_id, type: 'irrigation', done_on, quantity: null, quantity_unit: null, product: null, cost_pkr: null, notes: null, source: 'manual',
});
const base = { nowHour: '2026-11-20T08:00', today: '2026-11-20', farmId: 'f', soil: 'loam', cropName: (c: string) => c, hourLabel: (t: string) => t.slice(11, 16) };

describe('weather screen data', () => {
  const f = makeForecast({});

  it('now / day hours / 7 days + outlook / attribution', () => {
    expect(weatherNow(f, '2026-11-20T10:00')).toMatchObject({ tempC: 22, condition: 'clear', et0Mm: 3, source: 'Open-Meteo' });
    const hours = dayHours(f, '2026-11-20');
    expect(hours[0].hour).toBe('06:00');
    expect(hours).toHaveLength(18);
    const { days, outlook } = dailyForecast(f, '2026-11-20', (d, isToday) => ({ en: isToday ? 'Today' : d }));
    expect(days).toHaveLength(7);
    expect(days[0].day.en).toBe('Today');
    expect(outlook).toHaveLength(7); // days 8–14
    expect(ATTRIBUTION['open-meteo']).toBe('Weather data by Open-Meteo.com (CC BY 4.0)');
    expect(ATTRIBUTION['met-norway']).toContain('MET Norway');
  });

  it('spray strip: daylight 05–19 only, tri-state', () => {
    const slots = spraySlots(f, '2026-11-20T18:00');
    expect(slots.map((s) => s.time.slice(11, 13))).toEqual(['18', '19', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14']);
    expect(new Set(slots.map((s) => s.status))).toEqual(new Set(['good']));
  });
});

describe('buildAdvisories', () => {
  it('good spray window, irrigation from the last logged irrigation, frost for wheat at heading', () => {
    const f = makeForecast({ daily: (d) => (d === '2026-11-21' ? { minC: 1 } : {}) });
    const advice = buildAdvisories({
      ...base,
      forecast: f,
      crops: [crop('w', 'wheat', '2026-08-25')], // day 87 → heading
      activities: [irrigation('w', '2026-11-12')],
      tr,
    });
    expect(advice.map((a) => [a.kind, a.severity])).toEqual([
      ['frost', 'warning'],
      ['irrigation', 'info'],
      ['spray', 'good'],
    ]);
    expect(advice[0].title.en).toBe('advice.alert.frost.title {"value":1,"crop":"wheat"}');
    expect(advice.find((a) => a.kind === 'spray')?.title.en).toBe('advice.sprayGood.today {"from":"08:00","to":"20:00"}');
  });

  it('no irrigation logged on an older crop → asks to log it (no made-up number), with a button', () => {
    const advice = buildAdvisories({ ...base, forecast: makeForecast({}), crops: [crop('w', 'wheat', '2026-10-01')], activities: [], tr });
    expect(advice.find((a) => a.kind === 'irrigation')).toMatchObject({
      title: { en: 'advice.irrigation.logNeeded.title {"crop":"wheat"}' },
      action: { kind: 'log-irrigation', farmId: 'f', cropId: 'w' },
    });
  });

  it('disease weather links to Scan; rice gets the standing-water rule', () => {
    const f = makeForecast({ start: '2026-11-25', hourly: (t) => (t.slice(11, 13) < '14' ? { tempC: 12, humidity: 90 } : {}) });
    const advice = buildAdvisories({
      ...base,
      nowHour: '2026-12-10T08:00',
      today: '2026-12-10',
      forecast: f,
      crops: [crop('w', 'wheat', '2026-10-25'), crop('r', 'rice', '2026-11-20')], // wheat day 46 → tillering
      activities: [irrigation(null, '2026-12-05')],
      tr,
    });
    expect(advice.find((a) => a.kind === 'disease-risk')).toMatchObject({ action: { kind: 'scan' } });
    expect(advice.find((a) => a.id === 'irrigation:r')?.title.en).toContain('advice.irrigation.rice.title');
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
    expect(buildAdvisories({ ...base, nowHour: now, forecast: f, crops: [crop('w', 'wheat', '2026-11-10')], activities: [], tr }).length).toBeGreaterThan(0);
  });
});

describe('advice strings', () => {
  it('every key the builder can produce exists in en.json and ur.json', () => {
    const keys = [
      'advice.sprayGood.today',
      'advice.sprayGood.tomorrow',
      'advice.sprayGoodBody',
      'advice.sprayNone',
      ...['rain', 'wind', 'gust', 'heat', 'calm', 'dry-air', 'rain-unknown', 'no-data'].map((r) => `advice.sprayReason.${r}`),
      ...['heatwave', 'heat-stress', 'frost', 'heavy-rain', 'strong-wind', 'fog'].flatMap((k) => [`advice.alert.${k}.title`, `advice.alert.${k}.body`]),
      ...DISEASE_RULE_IDS.flatMap((r) => [`advice.disease.${r}.title`, `advice.disease.${r}.body`]),
      ...['rice.title', 'rice.body', 'rice.rain', 'logNeeded.title', 'logNeeded.body', 'limited.title', 'limited.body', 'skip.title', 'skip.body'].map((k) => `advice.irrigation.${k}`),
      ...['due.now', 'due.tomorrow', 'due.soon', 'ok_one', 'ok_other', 'okLater_one', 'okLater_other', 'body'].map((k) => `advice.irrigation.${k}`),
      'advice.logIrrigation',
      'advice.openScan',
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

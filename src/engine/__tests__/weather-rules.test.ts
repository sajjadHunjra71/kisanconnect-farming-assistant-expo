import { cropKc } from '../crop-water';
import {
  conditionFromCode,
  diseaseHints,
  effectiveRain,
  gridCell,
  irrigationAdvice,
  localHour,
  nextSprayWindow,
  openMeteoUrl,
  parseOpenMeteo,
  sprayWindow,
  weatherAlerts,
} from '../weather-rules';
import { makeForecast } from './weather-fixture';

describe('open-meteo', () => {
  it('requests the fields we need, in Pakistan time with past days', () => {
    const url = openMeteoUrl(31.5, 74.3);
    expect(url).toContain('latitude=31.5&longitude=74.3');
    expect(url).toContain('et0_fao_evapotranspiration');
    expect(url).toContain('timezone=Asia%2FKarachi');
    expect(url).toContain('past_days=7');
  });

  it('parses a response and rejects malformed ones', () => {
    const body = {
      latitude: 31.5,
      longitude: 74.3,
      utc_offset_seconds: 18000,
      current: { time: '2026-11-20T10:00', temperature_2m: 21.4, apparent_temperature: 20, relative_humidity_2m: 60, wind_speed_10m: 7, wind_gusts_10m: 15, precipitation: 0, weather_code: 2, is_day: 1 },
      hourly: {
        time: ['2026-11-20T00:00', '2026-11-20T01:00'],
        temperature_2m: [12, null],
        relative_humidity_2m: [80, 82],
        precipitation_probability: [0, 5],
        precipitation: [0, 0],
        weather_code: [0, 45],
        wind_speed_10m: [3, 4],
        wind_gusts_10m: [6, 8],
      },
      daily: {
        time: ['2026-11-20'],
        temperature_2m_max: [24],
        temperature_2m_min: [11],
        precipitation_sum: [0],
        precipitation_probability_max: [5],
        et0_fao_evapotranspiration: [2.1],
        wind_speed_10m_max: [9],
        weather_code: [2],
      },
    };
    const f = parseOpenMeteo(body, '2026-11-20T05:00:00Z');
    expect(f.current).toMatchObject({ tempC: 21.4, isDay: true, code: 2 });
    expect(f.hourly.tempC).toEqual([12, 0]); // nulls become 0
    expect(f.daily.et0Mm).toEqual([2.1]);
    expect(() => parseOpenMeteo({ ...body, hourly: { ...body.hourly, relative_humidity_2m: [1] } }, '')).toThrow('relative_humidity_2m');
    expect(() => parseOpenMeteo(null, '')).toThrow();
  });

  it('snaps farms to a ~11 km grid cell', () => {
    expect(gridCell(31.5497, 74.3436)).toEqual({ key: '31.5_74.3', lat: 31.5, lng: 74.3 });
    expect(gridCell(31.46, 74.26).key).toBe('31.5_74.3');
    expect(gridCell(29.4, 71.68).key).toBe('29.4_71.7');
  });

  it('maps WMO codes', () => {
    expect(conditionFromCode(0, 20)).toBe('clear');
    expect(conditionFromCode(0, 41)).toBe('hot');
    expect(conditionFromCode(2)).toBe('partly-cloudy');
    expect(conditionFromCode(45)).toBe('fog');
    expect(conditionFromCode(63)).toBe('rain');
    expect(conditionFromCode(81)).toBe('rain');
    expect(conditionFromCode(96)).toBe('storm');
  });

  it('local hour uses the forecast offset (PKT = UTC+5)', () => {
    expect(localHour({ utcOffsetSeconds: 18000 }, new Date('2026-11-20T05:30:00Z'))).toBe('2026-11-20T10:00');
  });
});

describe('spray window', () => {
  it('marks rain ahead, wind, heat and night', () => {
    const f = makeForecast({
      hourly: (t) => {
        if (t === '2026-11-20T15:00') return { rainProb: 70 };
        if (t === '2026-11-21T10:00') return { windKmh: 22 };
        if (t === '2026-11-21T13:00') return { tempC: 37 };
        return {};
      },
    });
    const slots = sprayWindow(f, '2026-11-20T08:00', 30);
    const at = (t: string) => slots.find((s) => s.time === t)?.reason;
    expect(at('2026-11-20T08:00')).toBe('ok'); // rain is 7 h away
    expect(at('2026-11-20T09:00')).toBe('rain'); // within 6 h of 15:00
    expect(at('2026-11-20T15:00')).toBe('rain');
    expect(at('2026-11-20T16:00')).toBe('ok');
    expect(at('2026-11-20T22:00')).toBe('dark');
    expect(at('2026-11-21T10:00')).toBe('wind');
    expect(at('2026-11-21T13:00')).toBe('heat');
    expect(nextSprayWindow(slots)).toEqual({ start: '2026-11-20T16:00', end: '2026-11-20T18:00' });
  });

  it('no good window → null', () => {
    const f = makeForecast({ hourly: () => ({ windKmh: 30 }) });
    expect(nextSprayWindow(sprayWindow(f, '2026-11-20T06:00', 48))).toBeNull();
  });
});

describe('alerts', () => {
  it('heat, frost, heavy rain and wind in the next 3 days only', () => {
    const f = makeForecast({
      daily: (d) =>
        d === '2026-11-20' ? { maxC: 41 } : d === '2026-11-21' ? { minC: -1, precipMm: 30 } : d === '2026-11-24' ? { maxC: 46 } : {},
      hourly: (t) => (t === '2026-11-22T14:00' ? { gustKmh: 62 } : {}),
    });
    expect(weatherAlerts(f, '2026-11-20')).toEqual([
      { id: 'heat:2026-11-20', kind: 'heat', severity: 'warning', date: '2026-11-20', value: 41 },
      { id: 'frost:2026-11-21', kind: 'frost', severity: 'danger', date: '2026-11-21', value: -1 },
      { id: 'heavy-rain:2026-11-21', kind: 'heavy-rain', severity: 'warning', date: '2026-11-21', value: 30 },
      { id: 'strong-wind:2026-11-22', kind: 'strong-wind', severity: 'warning', date: '2026-11-22', value: 62 },
    ]);
  });
});

describe('disease hints', () => {
  const coolHumid = makeForecast({ hourly: (t) => (t >= '2026-11-20T18:00' && t < '2026-11-21T12:00' ? { tempC: 11, humidity: 92 } : {}) });

  it('wheat rust when cool + humid for 12+ hours at a susceptible stage', () => {
    expect(diseaseHints(coolHumid, '2026-11-20T10:00', [{ crop: 'wheat', stage: 'tillering' }])).toEqual([
      { id: 'wheat-yellow-rust:2026-11-20', ruleId: 'wheat-yellow-rust', crop: 'wheat', hours: 18, from: '2026-11-20T10:00' },
    ]);
  });

  it('not at germination, not for other crops, not when dry', () => {
    expect(diseaseHints(coolHumid, '2026-11-20T10:00', [{ crop: 'wheat', stage: 'germination' }])).toEqual([]);
    expect(diseaseHints(coolHumid, '2026-11-20T10:00', [{ crop: 'maize', stage: 'growth' }])).toEqual([]);
    expect(diseaseHints(makeForecast({}), '2026-11-20T10:00', [{ crop: 'wheat', stage: 'tillering' }])).toEqual([]);
  });
});

describe('irrigation advice', () => {
  const base = { today: '2026-11-20', kc: 1, rawMm: 30 };

  it('unknown without a last irrigation date', () => {
    expect(irrigationAdvice({ ...base, forecast: makeForecast({}), lastIrrigation: null })).toEqual({ kind: 'unknown', dailyNeedMm: 3 });
  });

  it('counts down from the last irrigation (3 mm/day, 30 mm RAW)', () => {
    // irrigated 6 days ago → 18 mm used → 12 mm left → due in 4 days
    expect(irrigationAdvice({ ...base, forecast: makeForecast({}), lastIrrigation: '2026-11-14' })).toEqual({
      kind: 'ok',
      dailyNeedMm: 3,
      dueInDays: 4,
      depletionMm: 18,
    });
    // irrigated 9 days ago → 27 mm → due tomorrow
    expect(irrigationAdvice({ ...base, forecast: makeForecast({}), lastIrrigation: '2026-11-11' })).toMatchObject({ kind: 'due', dueInDays: 1 });
  });

  it('skip when enough rain is coming', () => {
    const f = makeForecast({ daily: (d) => (d === '2026-11-21' ? { precipMm: 30 } : {}) });
    expect(irrigationAdvice({ ...base, forecast: f, lastIrrigation: '2026-11-13' })).toEqual({ kind: 'skip', dailyNeedMm: 3, rainMm: 30, depletionMm: 21 });
  });

  it('rain since the last irrigation refills the bucket', () => {
    const f = makeForecast({ daily: (d) => (d === '2026-11-18' ? { precipMm: 40 } : {}) });
    expect(irrigationAdvice({ ...base, forecast: f, lastIrrigation: '2026-11-14' })).toMatchObject({ depletionMm: 6 });
  });

  it('effective rain ignores small showers', () => {
    expect(effectiveRain(3)).toBe(0);
    expect(effectiveRain(10)).toBe(8);
  });

  it('Kc by crop stage', () => {
    expect(cropKc('wheat', 'heading')).toBe(1.15);
    expect(cropKc('cotton', 'emergence')).toBe(0.35);
    expect(cropKc('wheat', 'unknown-stage')).toBeCloseTo((0.4 + 0.75 + 1.1 + 1.15 + 0.9 + 0.4) / 6);
  });
});

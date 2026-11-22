import {
  alertDedupeKey,
  cacheKey,
  conditionFromCode,
  diseaseHints,
  effectiveRain,
  gridCell,
  inPakistanBox,
  limitedData,
  localHour,
  nextSprayWindow,
  openMeteoUrl,
  parseOpenMeteo,
  sprayWindow,
  weatherAlerts,
} from '../weather-rules';
import { makeForecast } from './weather-fixture';

describe('open-meteo request and parsing', () => {
  it('asks for the audited fields: 14 days ahead, 30 past, Karachi time, km/h', () => {
    const url = openMeteoUrl(31.5, 74.3);
    for (const f of ['apparent_temperature', 'relative_humidity_2m', 'precipitation_probability', 'wind_gusts_10m', 'visibility', 'weather_code', 'et0_fao_evapotranspiration', 'precipitation_sum']) {
      expect(url).toContain(f);
    }
    expect(url).toContain('current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_gusts_10m');
    expect(url).toContain('forecast_days=14');
    expect(url).toContain('past_days=30');
    expect(url).toContain('timezone=Asia%2FKarachi');
    expect(url).toContain('wind_speed_unit=kmh');
  });

  const body = {
    latitude: 31.5,
    longitude: 74.3,
    utc_offset_seconds: 18000,
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
    daily: { time: ['2026-11-20'], temperature_2m_max: [24], temperature_2m_min: [11], precipitation_sum: [0], et0_fao_evapotranspiration: [2.1], weather_code: [2] },
  };

  it('missing values are null, never 0; missing series are all null', () => {
    const f = parseOpenMeteo(body, '2026-11-20T05:00:00Z');
    expect(f.provider).toBe('open-meteo');
    expect(f.current).toBeNull(); // not sent → null, "now" falls back to hourly
    const withCurrent = parseOpenMeteo({ ...body, current: { time: '2026-11-20T00:15', temperature_2m: 12.4, relative_humidity_2m: 81, weather_code: 45 } }, '');
    expect(withCurrent.current).toEqual({ time: '2026-11-20T00:15', tempC: 12.4, feelsLikeC: null, humidity: 81, precipMm: null, windKmh: null, gustKmh: null, code: 45 });
    expect(f.hourly.tempC).toEqual([12, null]);
    expect(f.hourly.visibilityM).toEqual([null, null]); // not sent
    expect(f.hourly.feelsLikeC).toEqual([null, null]);
    expect(limitedData(f, '2026-11-20T00:00')).toEqual(expect.arrayContaining(['visibilityM']));
  });

  it('rejects malformed bodies', () => {
    expect(() => parseOpenMeteo({ ...body, hourly: { ...body.hourly, relative_humidity_2m: [1] } }, '')).toThrow('relative_humidity_2m');
    expect(() => parseOpenMeteo(null, '')).toThrow();
  });

  it('grid cell, cache key, Pakistan box', () => {
    expect(gridCell(31.5497, 74.3436)).toEqual({ key: '31.5_74.3', lat: 31.5, lng: 74.3 });
    expect(cacheKey('31.5_74.3', 'met-norway')).toBe('31.5_74.3:met-norway:v3');
    expect(inPakistanBox(31.5, 74.3)).toBe(true);
    expect(inPakistanBox(37.6, 74)).toBe(false);
    expect(inPakistanBox(24.86, 59.9)).toBe(false);
  });

  it('WMO codes and local hour', () => {
    expect(conditionFromCode(0, 41)).toBe('hot');
    expect(conditionFromCode(45)).toBe('fog');
    expect(conditionFromCode(81)).toBe('rain');
    expect(conditionFromCode(null)).toBe('partly-cloudy');
    expect(localHour({ utcOffsetSeconds: 18000 }, new Date('2026-11-20T05:30:00Z'))).toBe('2026-11-20T10:00');
  });
});

describe('spray window', () => {
  const at = (slots: ReturnType<typeof sprayWindow>, t: string) => slots.find((s) => s.time === t);

  it('avoid: rain ahead, wind, gusts, heat, outside 05–19', () => {
    const f = makeForecast({
      hourly: (t) => {
        if (t === '2026-11-20T15:00') return { rainProb: 70 };
        if (t === '2026-11-21T10:00') return { windKmh: 18 };
        if (t === '2026-11-21T11:00') return { gustKmh: 30 };
        if (t === '2026-11-21T13:00') return { tempC: 37 };
        return {};
      },
    });
    const s = sprayWindow(f, '2026-11-20T05:00', 40);
    expect(at(s, '2026-11-20T05:00')?.status).toBe('good');
    expect(at(s, '2026-11-20T08:00')?.status).toBe('good'); // rain is 7 h away
    expect(at(s, '2026-11-20T09:00')).toMatchObject({ status: 'avoid', reason: 'rain' });
    expect(at(s, '2026-11-20T19:00')?.status).toBe('good');
    expect(at(s, '2026-11-20T20:00')).toMatchObject({ status: 'avoid', reason: 'dark' });
    expect(at(s, '2026-11-21T10:00')?.reason).toBe('wind');
    expect(at(s, '2026-11-21T11:00')?.reason).toBe('gust');
    expect(at(s, '2026-11-21T13:00')?.reason).toBe('heat');
    expect(nextSprayWindow(s)).toEqual({ start: '2026-11-20T05:00', end: '2026-11-20T08:00' });
  });

  it('caution: calm air, dry air, unknown rain chance', () => {
    const f = makeForecast({
      hourly: (t) => {
        if (t === '2026-11-20T09:00') return { windKmh: 2 };
        if (t === '2026-11-20T10:00') return { humidity: 30 };
        if (t === '2026-11-20T17:00') return { rainProb: null };
        return {};
      },
    });
    const s = sprayWindow(f, '2026-11-20T09:00', 10);
    expect(at(s, '2026-11-20T09:00')).toMatchObject({ status: 'caution', reason: 'calm' });
    expect(at(s, '2026-11-20T10:00')).toMatchObject({ status: 'caution', reason: 'dry-air' });
    // 17:00 rain chance unknown → every slot whose 6 h look-ahead includes it is caution
    expect(at(s, '2026-11-20T10:00')?.reason).toBe('dry-air');
    expect(at(s, '2026-11-20T11:00')).toMatchObject({ status: 'caution', reason: 'rain-unknown' });
    expect(at(s, '2026-11-20T18:00')?.status).toBe('good');
  });
});

describe('alerts', () => {
  const wheatHeading = [{ crop: 'wheat', stage: 'heading', cropId: 'w1' }];

  it('nothing without growing crops', () => {
    expect(weatherAlerts(makeForecast({ daily: () => ({ precipMm: 80 }) }), '2026-11-20', [])).toEqual([]);
  });

  it('heatwave needs ≥ 45 °C on 2+ of the next 3 days', () => {
    const one = makeForecast({ daily: (d) => (d === '2026-11-20' ? { maxC: 46 } : {}) });
    expect(weatherAlerts(one, '2026-11-20', wheatHeading).map((a) => a.kind)).toEqual([]);
    const two = makeForecast({ daily: (d) => (d === '2026-11-20' || d === '2026-11-22' ? { maxC: 46 } : {}) });
    expect(weatherAlerts(two, '2026-11-20', wheatHeading)).toEqual([{ kind: 'heatwave', severity: 'danger', startDate: '2026-11-20', value: 46 }]);
  });

  it('crop heat stress at sensitive stages', () => {
    const f = makeForecast({ daily: (d) => (d === '2026-11-21' ? { maxC: 36 } : {}) });
    expect(weatherAlerts(f, '2026-11-20', [{ crop: 'wheat', stage: 'grain-fill', cropId: 'w' }])).toEqual([
      { kind: 'heat-stress', severity: 'warning', startDate: '2026-11-21', value: 36, crop: 'wheat', cropId: 'w' },
    ]);
    expect(weatherAlerts(f, '2026-11-20', [{ crop: 'wheat', stage: 'tillering' }])).toEqual([]);
    expect(weatherAlerts(f, '2026-11-20', [{ crop: 'rice', stage: 'panicle' }]).map((a) => a.kind)).toEqual(['heat-stress']);
    expect(weatherAlerts(f, '2026-11-20', [{ crop: 'cotton', stage: 'flowering' }])).toEqual([]); // needs ≥ 42
  });

  it('frost only for sugarcane, maize, and wheat at heading; ≤ 0 is severe', () => {
    const f = makeForecast({ daily: (d) => (d === '2026-11-21' ? { minC: 1 } : d === '2026-11-22' ? { minC: -1 } : {}) });
    expect(weatherAlerts(f, '2026-11-20', wheatHeading)).toEqual([{ kind: 'frost', severity: 'warning', startDate: '2026-11-21', value: 1, crop: 'wheat', cropId: 'w1' }]);
    expect(weatherAlerts(f, '2026-11-20', [{ crop: 'wheat', stage: 'tillering' }])).toEqual([]);
    expect(weatherAlerts(f, '2026-11-20', [{ crop: 'cotton', stage: 'squaring' }])).toEqual([]);
    const severe = makeForecast({ daily: (d) => (d === '2026-11-21' ? { minC: -1 } : {}) });
    expect(weatherAlerts(severe, '2026-11-20', [{ crop: 'maize', stage: 'growth' }])[0]).toMatchObject({ kind: 'frost', severity: 'danger' });
  });

  it('heavy rain ≥ 35 mm, gusts ≥ 50 km/h', () => {
    const f = makeForecast({
      daily: (d) => (d === '2026-11-20' ? { precipMm: 34 } : d === '2026-11-21' ? { precipMm: 40 } : {}),
      hourly: (t) => (t === '2026-11-22T14:00' ? { gustKmh: 55 } : {}),
    });
    expect(weatherAlerts(f, '2026-11-20', wheatHeading)).toEqual([
      { kind: 'heavy-rain', severity: 'warning', startDate: '2026-11-21', value: 40 },
      { kind: 'strong-wind', severity: 'warning', startDate: '2026-11-22', value: 55 },
    ]);
  });

  it('fog from visibility (dense < 200 m), else humid calm nights', () => {
    const vis = makeForecast({ hourly: (t) => (t === '2026-11-21T06:00' ? { visibilityM: 150 } : {}) });
    expect(weatherAlerts(vis, '2026-11-20', wheatHeading)).toEqual([{ kind: 'fog', severity: 'danger', startDate: '2026-11-21', value: 150 }]);
    const humid = makeForecast({
      hourly: (t) => ({ visibilityM: null, ...(t >= '2026-11-20T02:00' && t <= '2026-11-20T05:00' ? { humidity: 98, windKmh: 2 } : {}) }),
    });
    expect(weatherAlerts(humid, '2026-11-20', wheatHeading)).toEqual([{ kind: 'fog', severity: 'warning', startDate: '2026-11-20', value: 0 }]);
  });

  it('dedupe key = kind:farm:crop:start date', () => {
    expect(alertDedupeKey('frost', 'f1', 'c1', '2026-11-21')).toBe('frost:f1:c1:2026-11-21');
    expect(alertDedupeKey('fog', 'f1', null, '2026-11-21')).toBe('fog:f1:-:2026-11-21');
  });
});

describe('disease hints', () => {
  it('wheat yellow rust: Dec–Mar, tillering→heading, cool + humid 12 h or rain on 2 days', () => {
    const humid = (start: string) =>
      makeForecast({ start, hourly: (t) => (t.slice(11, 13) >= '00' && t.slice(11, 13) < '14' ? { tempC: 12, humidity: 90 } : {}) });
    const dec = humid('2026-11-25');
    expect(diseaseHints(dec, '2026-12-10T00:00', [{ crop: 'wheat', stage: 'tillering', cropId: 'w' }])).toEqual([
      { ruleId: 'wheat-yellow-rust', crop: 'wheat', cropId: 'w', startDate: '2026-12-10', evidence: 42 },
    ]);
    expect(diseaseHints(dec, '2026-12-10T00:00', [{ crop: 'wheat', stage: 'grain-fill' }])).toEqual([]);
    const nov = humid('2026-10-21');
    expect(diseaseHints(nov, '2026-11-20T00:00', [{ crop: 'wheat', stage: 'tillering' }])).toEqual([]); // not the season
    const rainy = makeForecast({ start: '2026-11-25', hourly: (t) => (t === '2026-12-10T08:00' || t === '2026-12-11T08:00' ? { precipMm: 1 } : {}) });
    expect(diseaseHints(rainy, '2026-12-10T00:00', [{ crop: 'wheat', stage: 'jointing' }]).map((h) => h.ruleId)).toEqual(['wheat-yellow-rust']);
  });

  it('rice blast: 3+ humid nights at 20–28 °C', () => {
    const nights = (n: number) =>
      makeForecast({
        hourly: (t) => {
          const hr = Number(t.slice(11, 13));
          const day = Number(t.slice(8, 10));
          const night = hr >= 20 || hr <= 5;
          const nightOf = hr >= 20 ? day : day - 1;
          return night && nightOf >= 20 && nightOf < 20 + n ? { tempC: 24, humidity: 95 } : {};
        },
      });
    expect(diseaseHints(nights(3), '2026-11-20T10:00', [{ crop: 'rice', stage: 'panicle' }]).map((h) => h.ruleId)).toEqual(['rice-blast']);
    expect(diseaseHints(nights(2), '2026-11-20T10:00', [{ crop: 'rice', stage: 'panicle' }])).toEqual([]);
    expect(diseaseHints(nights(3), '2026-11-20T10:00', [{ crop: 'rice', stage: 'maturity' }])).toEqual([]);
  });

  it('cotton boll rot: rain, then 12 h humid at 25–35 °C, after flowering', () => {
    const f = makeForecast({
      hourly: (t) => (t === '2026-11-20T12:00' ? { precipMm: 4 } : t > '2026-11-20T12:00' && t <= '2026-11-21T02:00' ? { tempC: 28, humidity: 90 } : {}),
    });
    expect(diseaseHints(f, '2026-11-20T10:00', [{ crop: 'cotton', stage: 'boll-opening' }]).map((h) => h.ruleId)).toEqual(['cotton-boll-rot']);
    expect(diseaseHints(f, '2026-11-20T10:00', [{ crop: 'cotton', stage: 'squaring' }])).toEqual([]);
    const noRain = makeForecast({ hourly: () => ({ tempC: 28, humidity: 90 }) });
    expect(diseaseHints(noRain, '2026-11-20T10:00', [{ crop: 'cotton', stage: 'boll-opening' }])).toEqual([]);
  });

  it('effective rain ignores days under 5 mm', () => {
    expect(effectiveRain(4.9)).toBe(0);
    expect(effectiveRain(10)).toBe(8);
    expect(effectiveRain(null)).toBe(0);
  });
});

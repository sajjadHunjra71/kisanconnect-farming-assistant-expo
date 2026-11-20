/**
 * Weather rules (pure TypeScript, NO imports).
 *
 * This one file is shared by the app and the Supabase Edge Functions:
 * `npm run sync-shared` copies it to supabase/functions/_shared/weather-rules.ts
 * and a unit test fails if the copy is out of date. Keep it import-free so the
 * same text runs in React Native and in Deno.
 *
 * Thresholds are INDICATIVE, taken from general agri-extension spray and
 * disease guidance; they are not official advice.
 */

/* ───────────────────────── forecast model ───────────────────────── */

export type WxCondition = 'clear' | 'partly-cloudy' | 'cloudy' | 'rain' | 'storm' | 'fog' | 'hot';

export type Forecast = {
  lat: number;
  lng: number;
  /** Seconds east of UTC for the forecast's local time (Pakistan: 18000). */
  utcOffsetSeconds: number;
  fetchedAt: string; // ISO instant
  current: {
    time: string; // local 'YYYY-MM-DDTHH:mm'
    tempC: number;
    feelsLikeC: number;
    humidity: number;
    windKmh: number;
    gustKmh: number;
    precipMm: number;
    code: number;
    isDay: boolean;
  };
  /** Hourly, local time 'YYYY-MM-DDTHH:00'. Includes past days (for the water balance). */
  hourly: {
    time: string[];
    tempC: number[];
    humidity: number[];
    rainProb: number[];
    precipMm: number[];
    windKmh: number[];
    gustKmh: number[];
    code: number[];
  };
  /** Daily, local date 'YYYY-MM-DD'. Includes past days. */
  daily: {
    date: string[];
    maxC: number[];
    minC: number[];
    precipMm: number[];
    rainProbMax: number[];
    et0Mm: number[];
    windMaxKmh: number[];
    code: number[];
  };
};

export const PAST_DAYS = 7;
export const FORECAST_DAYS = 7;

const HOURLY = 'temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_gusts_10m';
const DAILY =
  'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,et0_fao_evapotranspiration,wind_speed_10m_max';
const CURRENT = 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,is_day';

/** Open-Meteo forecast URL (no key needed). Wind in km/h, local Pakistan time. */
export function openMeteoUrl(lat: number, lng: number): string {
  const q = [
    `latitude=${lat}`,
    `longitude=${lng}`,
    `current=${CURRENT}`,
    `hourly=${HOURLY}`,
    `daily=${DAILY}`,
    'timezone=Asia%2FKarachi',
    `past_days=${PAST_DAYS}`,
    `forecast_days=${FORECAST_DAYS}`,
    'wind_speed_unit=kmh',
  ];
  return `https://api.open-meteo.com/v1/forecast?${q.join('&')}`;
}

/**
 * ~11 km grid cell (0.1°). Farms in the same cell share one cached forecast,
 * and only the cell centre (never the farm's exact point) is sent to the provider.
 */
export function gridCell(lat: number, lng: number): { key: string; lat: number; lng: number } {
  const r = (v: number) => Math.round(v * 10) / 10;
  const cLat = r(lat);
  const cLng = r(lng);
  return { key: `${cLat.toFixed(1)}_${cLng.toFixed(1)}`, lat: cLat, lng: cLng };
}

type Json = Record<string, unknown>;
const nums = (o: Json, k: string, len: number): number[] => {
  const v = o[k];
  if (!Array.isArray(v) || v.length !== len) throw new Error(`open-meteo: bad ${k}`);
  return v.map((x) => (typeof x === 'number' && Number.isFinite(x) ? x : 0));
};
const strs = (o: Json, k: string): string[] => {
  const v = o[k];
  if (!Array.isArray(v) || v.some((x) => typeof x !== 'string')) throw new Error(`open-meteo: bad ${k}`);
  return v as string[];
};
const num = (o: Json, k: string): number => (typeof o[k] === 'number' ? (o[k] as number) : 0);

/** Validate and reshape an Open-Meteo JSON response. Throws on a malformed body. */
export function parseOpenMeteo(body: unknown, fetchedAt: string): Forecast {
  if (!body || typeof body !== 'object') throw new Error('open-meteo: empty body');
  const b = body as Json;
  const h = (b.hourly ?? {}) as Json;
  const d = (b.daily ?? {}) as Json;
  const c = (b.current ?? {}) as Json;
  const time = strs(h, 'time');
  const date = strs(d, 'time');
  const n = time.length;
  const m = date.length;
  if (n === 0 || m === 0) throw new Error('open-meteo: no data');
  return {
    lat: num(b, 'latitude'),
    lng: num(b, 'longitude'),
    utcOffsetSeconds: num(b, 'utc_offset_seconds'),
    fetchedAt,
    current: {
      time: typeof c.time === 'string' ? c.time : time[0],
      tempC: num(c, 'temperature_2m'),
      feelsLikeC: num(c, 'apparent_temperature'),
      humidity: num(c, 'relative_humidity_2m'),
      windKmh: num(c, 'wind_speed_10m'),
      gustKmh: num(c, 'wind_gusts_10m'),
      precipMm: num(c, 'precipitation'),
      code: num(c, 'weather_code'),
      isDay: num(c, 'is_day') === 1,
    },
    hourly: {
      time,
      tempC: nums(h, 'temperature_2m', n),
      humidity: nums(h, 'relative_humidity_2m', n),
      rainProb: nums(h, 'precipitation_probability', n),
      precipMm: nums(h, 'precipitation', n),
      windKmh: nums(h, 'wind_speed_10m', n),
      gustKmh: nums(h, 'wind_gusts_10m', n),
      code: nums(h, 'weather_code', n),
    },
    daily: {
      date,
      maxC: nums(d, 'temperature_2m_max', m),
      minC: nums(d, 'temperature_2m_min', m),
      precipMm: nums(d, 'precipitation_sum', m),
      rainProbMax: nums(d, 'precipitation_probability_max', m),
      et0Mm: nums(d, 'et0_fao_evapotranspiration', m),
      windMaxKmh: nums(d, 'wind_speed_10m_max', m),
      code: nums(d, 'weather_code', m),
    },
  };
}

/** WMO weather code → our condition. Very hot clear hours show as 'hot'. */
export function conditionFromCode(code: number, tempC?: number): WxCondition {
  if (code >= 95) return 'storm';
  if (code === 45 || code === 48) return 'fog';
  if ((code >= 51 && code <= 67) || (code >= 71 && code <= 86)) return 'rain';
  if (code === 3) return 'cloudy';
  if (code === 1 || code === 2) return 'partly-cloudy';
  return tempC !== undefined && tempC >= 38 ? 'hot' : 'clear';
}

/** Local 'YYYY-MM-DDTHH:00' for an instant, in the forecast's time zone. */
export function localHour(forecast: Pick<Forecast, 'utcOffsetSeconds'>, now: Date): string {
  return new Date(now.getTime() + forecast.utcOffsetSeconds * 1000).toISOString().slice(0, 13) + ':00';
}

/** Index of the first hourly slot at/after `hour` (local). -1 if past the data. */
export function hourIndex(forecast: Forecast, hour: string): number {
  return forecast.hourly.time.findIndex((t) => t >= hour);
}

/** Whole hours between two local 'YYYY-MM-DDTHH:mm' strings (b − a). */
function hoursBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}:00Z`) - Date.parse(`${a}:00Z`)) / 3_600_000);
}

/** Forecast age in minutes. */
export function ageMinutes(forecast: Pick<Forecast, 'fetchedAt'>, now: Date): number {
  return Math.max(0, Math.round((now.getTime() - Date.parse(forecast.fetchedAt)) / 60_000));
}

/* ───────────────────────── spray window ───────────────────────── */

export const SPRAY_RULES = {
  /** Avoid when rain probability within the next `rainLookaheadHours` exceeds this (%). */
  maxRainProb: 40,
  rainLookaheadHours: 6,
  /** Drift risk above this wind speed (km/h). */
  maxWindKmh: 15,
  /** Evaporation / leaf burn risk above this temperature (°C). */
  maxTempC: 35,
  /** Only daylight working hours count as spray slots. */
  firstHour: 6,
  lastHour: 18,
} as const;

export type SprayReason = 'ok' | 'rain' | 'wind' | 'heat' | 'dark';
export type SpraySlot = { time: string; ok: boolean; reason: SprayReason };

/** Good/avoid slots for the next `hours` hours from `nowHour` (local). */
export function sprayWindow(forecast: Forecast, nowHour: string, hours = 48): SpraySlot[] {
  const h = forecast.hourly;
  const start = hourIndex(forecast, nowHour);
  if (start < 0) return [];
  const out: SpraySlot[] = [];
  for (let i = start; i < Math.min(h.time.length, start + hours); i++) {
    const hourOfDay = Number(h.time[i].slice(11, 13));
    let reason: SprayReason = 'ok';
    const ahead = h.rainProb.slice(i, i + SPRAY_RULES.rainLookaheadHours + 1);
    if (hourOfDay < SPRAY_RULES.firstHour || hourOfDay > SPRAY_RULES.lastHour) reason = 'dark';
    else if (h.precipMm[i] > 0 || Math.max(...ahead) > SPRAY_RULES.maxRainProb) reason = 'rain';
    else if (h.windKmh[i] > SPRAY_RULES.maxWindKmh || h.gustKmh[i] > SPRAY_RULES.maxWindKmh * 2) reason = 'wind';
    else if (h.tempC[i] > SPRAY_RULES.maxTempC) reason = 'heat';
    out.push({ time: h.time[i], ok: reason === 'ok', reason });
  }
  return out;
}

/** First run of ≥2 good hours, as { start, end } local times (end = last good hour). */
export function nextSprayWindow(slots: SpraySlot[]): { start: string; end: string } | null {
  for (let i = 0; i < slots.length; i++) {
    if (!slots[i].ok) continue;
    let j = i;
    while (j + 1 < slots.length && slots[j + 1].ok) j++;
    if (j > i) return { start: slots[i].time, end: slots[j].time };
    i = j;
  }
  return null;
}

/* ───────────────────────── alerts ───────────────────────── */

export const ALERT_RULES = {
  heatC: 40,
  severeHeatC: 44,
  frostC: 2,
  heavyRainMm: 25,
  strongGustKmh: 50,
  lookaheadDays: 3,
} as const;

export type AlertKind = 'heat' | 'frost' | 'heavy-rain' | 'strong-wind';
export type WeatherAlert = {
  /** Stable id (kind + local date) so the same alert is sent only once. */
  id: string;
  kind: AlertKind;
  severity: 'warning' | 'danger';
  date: string;
  value: number;
};

/** Heat, frost, heavy rain and strong wind in the next 3 days (from `today`, local). */
export function weatherAlerts(forecast: Forecast, today: string): WeatherAlert[] {
  const d = forecast.daily;
  const out: WeatherAlert[] = [];
  const first = d.date.findIndex((x) => x >= today);
  if (first < 0) return out;
  for (let i = first; i < Math.min(d.date.length, first + ALERT_RULES.lookaheadDays); i++) {
    const date = d.date[i];
    if (d.maxC[i] >= ALERT_RULES.heatC) {
      out.push({ id: `heat:${date}`, kind: 'heat', severity: d.maxC[i] >= ALERT_RULES.severeHeatC ? 'danger' : 'warning', date, value: d.maxC[i] });
    }
    if (d.minC[i] <= ALERT_RULES.frostC) {
      out.push({ id: `frost:${date}`, kind: 'frost', severity: d.minC[i] <= 0 ? 'danger' : 'warning', date, value: d.minC[i] });
    }
    if (d.precipMm[i] >= ALERT_RULES.heavyRainMm) {
      out.push({ id: `heavy-rain:${date}`, kind: 'heavy-rain', severity: d.precipMm[i] >= 50 ? 'danger' : 'warning', date, value: d.precipMm[i] });
    }
    const gust = maxGustOnDate(forecast, date);
    if (gust >= ALERT_RULES.strongGustKmh) {
      out.push({ id: `strong-wind:${date}`, kind: 'strong-wind', severity: gust >= 75 ? 'danger' : 'warning', date, value: gust });
    }
  }
  return out;
}

function maxGustOnDate(forecast: Forecast, date: string): number {
  let max = 0;
  forecast.hourly.time.forEach((t, i) => {
    if (t.startsWith(date)) max = Math.max(max, forecast.hourly.gustKmh[i]);
  });
  return max;
}

/* ───────────────────────── disease-risk hints ───────────────────────── */

export type DiseaseRule = {
  id: string;
  crop: string; // crop key
  /** Only these growth stages (stage keys); empty = any stage. */
  stages: string[];
  minC: number;
  maxC: number;
  minHumidity: number;
  /** Hours in the next `windowHours` that must match. */
  minHours: number;
};

export const DISEASE_WINDOW_HOURS = 72;

/** Indicative "conditions favour X" rules. */
export const DISEASE_RULES: DiseaseRule[] = [
  // Yellow (stripe) rust: cool and humid; leaf wetness from dew/fog.
  { id: 'wheat-yellow-rust', crop: 'wheat', stages: ['tillering', 'jointing', 'heading', 'grain-fill'], minC: 7, maxC: 18, minHumidity: 85, minHours: 12 },
  // Rice blast: warm, very humid nights.
  { id: 'rice-blast', crop: 'rice', stages: ['tillering', 'panicle'], minC: 20, maxC: 30, minHumidity: 90, minHours: 12 },
  // Cotton boll rot: long humid, rainy spells while bolls open.
  { id: 'cotton-boll-rot', crop: 'cotton', stages: ['boll-opening'], minC: 24, maxC: 35, minHumidity: 85, minHours: 18 },
];

export type DiseaseHint = { id: string; ruleId: string; crop: string; hours: number; from: string };

/** Which disease rules match the next 72 h for these active crops (crop key + stage key). */
export function diseaseHints(forecast: Forecast, nowHour: string, crops: { crop: string; stage: string }[]): DiseaseHint[] {
  const h = forecast.hourly;
  const start = hourIndex(forecast, nowHour);
  if (start < 0) return [];
  const end = Math.min(h.time.length, start + DISEASE_WINDOW_HOURS);
  const out: DiseaseHint[] = [];
  for (const rule of DISEASE_RULES) {
    if (!crops.some((c) => c.crop === rule.crop && (rule.stages.length === 0 || rule.stages.includes(c.stage)))) continue;
    let hours = 0;
    for (let i = start; i < end; i++) {
      if (h.tempC[i] >= rule.minC && h.tempC[i] <= rule.maxC && h.humidity[i] >= rule.minHumidity) hours++;
    }
    if (hours >= rule.minHours) out.push({ id: `${rule.id}:${h.time[start].slice(0, 10)}`, ruleId: rule.id, crop: rule.crop, hours, from: h.time[start] });
  }
  return out;
}

/* ───────────────────────── irrigation water balance ───────────────────────── */

/** Effective rainfall (mm) from a day's rain: small showers mostly evaporate. */
export function effectiveRain(mm: number): number {
  return mm >= 5 ? Math.round(mm * 0.8 * 10) / 10 : 0;
}

export type IrrigationAdvice =
  | { kind: 'unknown'; dailyNeedMm: number }
  | { kind: 'skip'; dailyNeedMm: number; rainMm: number; depletionMm: number }
  | { kind: 'due' | 'ok'; dailyNeedMm: number; dueInDays: number; depletionMm: number };

/**
 * FAO-56 style bucket: since the last irrigation the root zone loses ET0 × Kc
 * per day and gains effective rain. Irrigation is due when the loss reaches
 * `rawMm` (readily available water). Days before the forecast's data use
 * today's need. `kc`/`rawMm` come from the crop and stage.
 */
export function irrigationAdvice(input: {
  forecast: Forecast;
  today: string;
  kc: number;
  rawMm: number;
  lastIrrigation: string | null;
}): IrrigationAdvice {
  const d = input.forecast.daily;
  const ti = d.date.indexOf(input.today);
  const et0Today = ti >= 0 ? d.et0Mm[ti] : (d.et0Mm[d.et0Mm.length - 1] ?? 0);
  const dailyNeedMm = Math.round(et0Today * input.kc * 10) / 10;
  if (!input.lastIrrigation || ti < 0) return { kind: 'unknown', dailyNeedMm };

  // Depletion from the day after the last irrigation up to and including today.
  let depletion = 0;
  const daysSince = Math.max(0, hoursBetween(`${input.lastIrrigation}T00:00`, `${input.today}T00:00`) / 24);
  const firstWithData = d.date.findIndex((x) => x > input.lastIrrigation!);
  const missingDays = firstWithData < 0 ? daysSince : Math.max(0, daysSince - (ti - firstWithData + 1));
  depletion += missingDays * dailyNeedMm;
  for (let i = Math.max(0, firstWithData); firstWithData >= 0 && i <= ti; i++) {
    depletion = Math.max(0, depletion + d.et0Mm[i] * input.kc - effectiveRain(d.precipMm[i]));
  }
  depletion = Math.round(depletion * 10) / 10;

  // Rain in the next 3 days that would cover what's needed.
  const rainNext = d.precipMm.slice(ti + 1, ti + 4).reduce((s, x) => s + effectiveRain(x), 0);
  if (depletion >= input.rawMm * 0.6 && rainNext >= depletion) {
    return { kind: 'skip', dailyNeedMm, rainMm: Math.round(d.precipMm.slice(ti + 1, ti + 4).reduce((s, x) => s + x, 0)), depletionMm: depletion };
  }

  // Project forward with the forecast until depletion reaches RAW.
  let dueInDays = 0;
  let projected = depletion;
  for (let i = ti + 1; projected < input.rawMm; i++) {
    const et = i < d.date.length ? d.et0Mm[i] * input.kc : dailyNeedMm;
    const rain = i < d.date.length ? effectiveRain(d.precipMm[i]) : 0;
    projected = Math.max(0, projected + et - rain);
    dueInDays++;
    if (dueInDays > 30) break;
  }
  return { kind: dueInDays <= 2 ? 'due' : 'ok', dailyNeedMm, dueInDays, depletionMm: depletion };
}

/**
 * Weather rules (pure TypeScript, relative imports only).
 *
 * Shared by the app and the Supabase Edge Functions: `npm run sync-engine` copies
 * src/engine to supabase/functions/_shared/engine (a test fails if it's stale).
 *
 * Missing provider values are `null` (JSON has no `undefined`), never 0, and the
 * rules treat them as "limited data". Thresholds are INDICATIVE, from general
 * agri-extension guidance; they are not official advice.
 */

/* ───────────────────────── forecast model ───────────────────────── */

export type WxCondition = 'clear' | 'partly-cloudy' | 'cloudy' | 'rain' | 'storm' | 'fog' | 'hot';
export type Num = number | null;
export type Provider = 'open-meteo' | 'met-norway';

/** Bump when the Forecast shape changes (part of the server cache key). */
export const FORECAST_SCHEMA_VERSION = 2;

export type Forecast = {
  provider: Provider;
  schemaVersion: number;
  lat: number;
  lng: number;
  /** Seconds east of UTC for the local times below (Pakistan: 18000). */
  utcOffsetSeconds: number;
  fetchedAt: string; // ISO instant
  /** Hourly, local time 'YYYY-MM-DDTHH:00', consecutive hours. Includes past days. */
  hourly: {
    time: string[];
    tempC: Num[];
    feelsLikeC: Num[];
    humidity: Num[];
    precipMm: Num[];
    rainProb: Num[];
    windKmh: Num[];
    gustKmh: Num[];
    visibilityM: Num[];
    code: Num[];
  };
  /** Daily, local date 'YYYY-MM-DD'. Includes past days (for the water balance). */
  daily: {
    date: string[];
    maxC: Num[];
    minC: Num[];
    precipMm: Num[];
    et0Mm: Num[];
    code: Num[];
  };
};

export const PAST_DAYS = 30;
export const FORECAST_DAYS = 14;
/** Days 1–7 are the forecast; 8–14 are shown as "Outlook (less certain)". */
export const CONFIDENT_DAYS = 7;
export const PK_UTC_OFFSET = 18000;

const HOURLY =
  'temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,precipitation_probability,wind_speed_10m,wind_gusts_10m,visibility,weather_code';
const DAILY = 'temperature_2m_max,temperature_2m_min,precipitation_sum,et0_fao_evapotranspiration,weather_code';

/** Open-Meteo forecast URL (no key). Wind in km/h, local Pakistan time. */
export function openMeteoUrl(lat: number, lng: number): string {
  const q = [
    `latitude=${lat}`,
    `longitude=${lng}`,
    `hourly=${HOURLY}`,
    `daily=${DAILY}`,
    'timezone=Asia%2FKarachi',
    `past_days=${PAST_DAYS}`,
    `forecast_days=${FORECAST_DAYS}`,
    'wind_speed_unit=kmh',
  ];
  return `https://api.open-meteo.com/v1/forecast?${q.join('&')}`;
}

/** Pakistan bounding box (with a small margin). */
export function inPakistanBox(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= 23 && lat <= 37.5 && lng >= 60 && lng <= 78;
}

/**
 * ~11 km grid cell (0.1°). Farms in the same cell share one cached forecast and
 * only the cell centre (never the farm's exact point) is sent to the provider.
 */
export function gridCell(lat: number, lng: number): { key: string; lat: number; lng: number } {
  const r = (v: number) => Math.round(v * 10) / 10;
  const cLat = r(lat);
  const cLng = r(lng);
  return { key: `${cLat.toFixed(1)}_${cLng.toFixed(1)}`, lat: cLat, lng: cLng };
}

/** Server cache key: cell + provider + schema version. */
export function cacheKey(cell: string, provider: Provider): string {
  return `${cell}:${provider}:v${FORECAST_SCHEMA_VERSION}`;
}

type Json = Record<string, unknown>;
const series = (o: Json, k: string, len: number): Num[] => {
  const v = o[k];
  if (v === undefined) return Array.from({ length: len }, () => null); // provider didn't send it
  if (!Array.isArray(v) || v.length !== len) throw new Error(`open-meteo: bad ${k}`);
  return v.map((x) => (typeof x === 'number' && Number.isFinite(x) ? x : null));
};
const strs = (o: Json, k: string): string[] => {
  const v = o[k];
  if (!Array.isArray(v) || v.some((x) => typeof x !== 'string')) throw new Error(`open-meteo: bad ${k}`);
  return v as string[];
};

/** Validate and reshape an Open-Meteo JSON response. Throws on a malformed body. */
export function parseOpenMeteo(body: unknown, fetchedAt: string): Forecast {
  if (!body || typeof body !== 'object') throw new Error('open-meteo: empty body');
  const b = body as Json;
  const h = (b.hourly ?? {}) as Json;
  const d = (b.daily ?? {}) as Json;
  const time = strs(h, 'time');
  const date = strs(d, 'time');
  const n = time.length;
  const m = date.length;
  if (n === 0 || m === 0) throw new Error('open-meteo: no data');
  return {
    provider: 'open-meteo',
    schemaVersion: FORECAST_SCHEMA_VERSION,
    lat: typeof b.latitude === 'number' ? b.latitude : 0,
    lng: typeof b.longitude === 'number' ? b.longitude : 0,
    utcOffsetSeconds: typeof b.utc_offset_seconds === 'number' ? b.utc_offset_seconds : PK_UTC_OFFSET,
    fetchedAt,
    hourly: {
      time,
      tempC: series(h, 'temperature_2m', n),
      feelsLikeC: series(h, 'apparent_temperature', n),
      humidity: series(h, 'relative_humidity_2m', n),
      precipMm: series(h, 'precipitation', n),
      rainProb: series(h, 'precipitation_probability', n),
      windKmh: series(h, 'wind_speed_10m', n),
      gustKmh: series(h, 'wind_gusts_10m', n),
      visibilityM: series(h, 'visibility', n),
      code: series(h, 'weather_code', n),
    },
    daily: {
      date,
      maxC: series(d, 'temperature_2m_max', m),
      minC: series(d, 'temperature_2m_min', m),
      precipMm: series(d, 'precipitation_sum', m),
      et0Mm: series(d, 'et0_fao_evapotranspiration', m),
      code: series(d, 'weather_code', m),
    },
  };
}

/** Which inputs are missing from the next 48 h / today's ET₀ (shown as "limited data"). */
export function limitedData(f: Forecast, nowHour: string): string[] {
  const start = hourIndex(f, nowHour);
  const missing: string[] = [];
  const check = (name: string, arr: Num[]) => {
    if (start < 0 || arr.slice(start, start + 48).some((x) => x === null)) missing.push(name);
  };
  check('rainProb', f.hourly.rainProb);
  check('windKmh', f.hourly.windKmh);
  check('humidity', f.hourly.humidity);
  check('visibilityM', f.hourly.visibilityM);
  const di = f.daily.date.indexOf(nowHour.slice(0, 10));
  if (di < 0 || f.daily.et0Mm[di] === null) missing.push('et0Mm');
  return missing;
}

/** WMO weather code → our condition. Very hot clear hours show as 'hot'. */
export function conditionFromCode(code: Num, tempC?: Num): WxCondition {
  if (code === null) return 'partly-cloudy';
  if (code >= 95) return 'storm';
  if (code === 45 || code === 48) return 'fog';
  if ((code >= 51 && code <= 67) || (code >= 71 && code <= 86)) return 'rain';
  if (code === 3) return 'cloudy';
  if (code === 1 || code === 2) return 'partly-cloudy';
  return tempC != null && tempC >= 38 ? 'hot' : 'clear';
}

/** Local 'YYYY-MM-DDTHH:00' for an instant, in the forecast's time zone. */
export function localHour(forecast: Pick<Forecast, 'utcOffsetSeconds'>, now: Date): string {
  return new Date(now.getTime() + forecast.utcOffsetSeconds * 1000).toISOString().slice(0, 13) + ':00';
}

/** Index of the first hourly slot at/after `hour` (local). -1 if past the data. */
export function hourIndex(forecast: Forecast, hour: string): number {
  return forecast.hourly.time.findIndex((t) => t >= hour);
}

/** Forecast age in minutes. */
export function ageMinutes(forecast: Pick<Forecast, 'fetchedAt'>, now: Date): number {
  return Math.max(0, Math.round((now.getTime() - Date.parse(forecast.fetchedAt)) / 60_000));
}

/** Older than this, advice that needs fresh data is hidden ("Old forecast"). */
export const OLD_FORECAST_MINUTES = 24 * 60;

const maxOf = (xs: Num[]): Num => (xs.some((x) => x === null) || xs.length === 0 ? null : Math.max(...(xs as number[])));
const hourOf = (t: string) => Number(t.slice(11, 13));
const monthOf = (t: string) => Number(t.slice(5, 7));
const addDaysStr = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/* ───────────────────────── spray window ───────────────────────── */

export const SPRAY_RULES = {
  /** Daylight working hours only. */
  firstHour: 5,
  lastHour: 19,
  /** Avoid when rain probability within the next `rainLookaheadHours` exceeds this (%). */
  maxRainProb: 40,
  rainLookaheadHours: 6,
  maxWindKmh: 15,
  maxGustKmh: 25,
  maxTempC: 35,
  /** Caution: very calm air (inversion, drift hangs) or very dry air (fast evaporation). */
  minWindKmh: 3,
  minHumidity: 40,
} as const;

export type SprayStatus = 'good' | 'caution' | 'avoid';
export type SprayReason = 'ok' | 'dark' | 'rain' | 'wind' | 'gust' | 'heat' | 'calm' | 'dry-air' | 'rain-unknown' | 'no-data';
export type SpraySlot = { time: string; status: SprayStatus; reason: SprayReason };

export function sprayStatusAt(f: Forecast, i: number): { status: SprayStatus; reason: SprayReason } {
  const h = f.hourly;
  const hour = hourOf(h.time[i]);
  if (hour < SPRAY_RULES.firstHour || hour > SPRAY_RULES.lastHour) return { status: 'avoid', reason: 'dark' };
  const wind = h.windKmh[i];
  const temp = h.tempC[i];
  if (wind === null || temp === null) return { status: 'caution', reason: 'no-data' };
  const ahead = h.rainProb.slice(i, i + SPRAY_RULES.rainLookaheadHours + 1);
  const rainAhead = maxOf(ahead);
  if ((h.precipMm[i] ?? 0) > 0 || (rainAhead !== null && rainAhead > SPRAY_RULES.maxRainProb)) return { status: 'avoid', reason: 'rain' };
  if (wind > SPRAY_RULES.maxWindKmh) return { status: 'avoid', reason: 'wind' };
  if ((h.gustKmh[i] ?? 0) > SPRAY_RULES.maxGustKmh) return { status: 'avoid', reason: 'gust' };
  if (temp > SPRAY_RULES.maxTempC) return { status: 'avoid', reason: 'heat' };
  if (rainAhead === null) return { status: 'caution', reason: 'rain-unknown' };
  if (wind < SPRAY_RULES.minWindKmh) return { status: 'caution', reason: 'calm' };
  if (h.humidity[i] !== null && (h.humidity[i] as number) < SPRAY_RULES.minHumidity) return { status: 'caution', reason: 'dry-air' };
  return { status: 'good', reason: 'ok' };
}

/** Slots for the next `hours` hours from `nowHour` (local). */
export function sprayWindow(f: Forecast, nowHour: string, hours = 48): SpraySlot[] {
  const start = hourIndex(f, nowHour);
  if (start < 0) return [];
  const out: SpraySlot[] = [];
  for (let i = start; i < Math.min(f.hourly.time.length, start + hours); i++) out.push({ time: f.hourly.time[i], ...sprayStatusAt(f, i) });
  return out;
}

/** First run of ≥2 good hours, as { start, end } local times (end = last good hour). */
export function nextSprayWindow(slots: SpraySlot[]): { start: string; end: string } | null {
  for (let i = 0; i < slots.length; i++) {
    if (slots[i].status !== 'good') continue;
    let j = i;
    while (j + 1 < slots.length && slots[j + 1].status === 'good') j++;
    if (j > i) return { start: slots[i].time, end: slots[j].time };
    i = j;
  }
  return null;
}

/* ───────────────────────── alerts ───────────────────────── */

export const ALERT_RULES = {
  lookaheadDays: 3,
  heatwaveC: 45,
  heatwaveDays: 2,
  /** Crop heat stress at sensitive stages (max temperature). */
  heatStress: [
    { crop: 'wheat', stages: ['grain-fill'], aboveC: 34 },
    { crop: 'rice', stages: ['panicle'], aboveC: 35 }, // flowering
    { crop: 'cotton', stages: ['flowering'], atLeastC: 42 },
  ] as { crop: string; stages: string[]; aboveC?: number; atLeastC?: number }[],
  /** Frost: only these crops/stages. Empty stages = any stage. */
  frostCrops: [
    { crop: 'sugarcane', stages: [] },
    { crop: 'maize', stages: [] },
    { crop: 'wheat', stages: ['heading'] }, // heading/flowering
  ] as { crop: string; stages: string[] }[],
  frostCautionC: 2,
  frostSevereC: 0,
  heavyRainMm: 35,
  strongGustKmh: 50,
  fogVisibilityM: 1000,
  denseFogVisibilityM: 200,
  /** Fallback when visibility is missing: very humid, calm night hours. */
  fogHumidity: 97,
  fogMaxWindKmh: 5,
  fogMinHours: 3,
} as const;

export type AlertKind = 'heatwave' | 'heat-stress' | 'frost' | 'heavy-rain' | 'strong-wind' | 'fog';
export type CropRef = { crop: string; stage: string; cropId?: string };

export type WeatherAlert = {
  kind: AlertKind;
  severity: 'warning' | 'danger';
  /** Local date the event starts. */
  startDate: string;
  value: number;
  /** Crop-specific alerts (heat stress, frost). */
  crop?: string;
  cropId?: string;
};

/** Dedupe key used by the server so the same alert is stored/sent once. */
export function alertDedupeKey(kind: string, farmId: string, cropId: string | null | undefined, startDate: string): string {
  return `${kind}:${farmId}:${cropId ?? '-'}:${startDate}`;
}

/** Alerts for the next 3 days. Farm-wide ones need at least one growing crop. */
export function weatherAlerts(f: Forecast, today: string, crops: CropRef[]): WeatherAlert[] {
  if (crops.length === 0) return [];
  const d = f.daily;
  const first = d.date.findIndex((x) => x >= today);
  if (first < 0) return [];
  const idx: number[] = [];
  for (let i = first; i < Math.min(d.date.length, first + ALERT_RULES.lookaheadDays); i++) idx.push(i);
  const out: WeatherAlert[] = [];

  // Heatwave: max ≥ 45 °C on 2+ of the next 3 days.
  const hot = idx.filter((i) => (d.maxC[i] ?? -99) >= ALERT_RULES.heatwaveC);
  if (hot.length >= ALERT_RULES.heatwaveDays) {
    out.push({ kind: 'heatwave', severity: 'danger', startDate: d.date[hot[0]], value: Math.max(...hot.map((i) => d.maxC[i] as number)) });
  }

  for (const c of crops) {
    // Crop heat stress.
    const rule = ALERT_RULES.heatStress.find((r) => r.crop === c.crop && r.stages.includes(c.stage));
    if (rule) {
      const day = idx.find((i) => {
        const t = d.maxC[i];
        return t !== null && (rule.aboveC !== undefined ? t > rule.aboveC : t >= (rule.atLeastC as number));
      });
      if (day !== undefined) out.push({ kind: 'heat-stress', severity: 'warning', startDate: d.date[day], value: d.maxC[day] as number, crop: c.crop, cropId: c.cropId });
    }
    // Frost.
    const frost = ALERT_RULES.frostCrops.find((r) => r.crop === c.crop && (r.stages.length === 0 || r.stages.includes(c.stage)));
    if (frost) {
      const day = idx.find((i) => d.minC[i] !== null && (d.minC[i] as number) <= ALERT_RULES.frostCautionC);
      if (day !== undefined) {
        const v = d.minC[day] as number;
        out.push({ kind: 'frost', severity: v <= ALERT_RULES.frostSevereC ? 'danger' : 'warning', startDate: d.date[day], value: v, crop: c.crop, cropId: c.cropId });
      }
    }
  }

  // Heavy rain.
  const wet = idx.find((i) => (d.precipMm[i] ?? 0) >= ALERT_RULES.heavyRainMm);
  if (wet !== undefined) out.push({ kind: 'heavy-rain', severity: (d.precipMm[wet] as number) >= 70 ? 'danger' : 'warning', startDate: d.date[wet], value: d.precipMm[wet] as number });

  // Strong wind (gusts) and fog, from hourly data on those dates.
  const dates = idx.map((i) => d.date[i]);
  for (const date of dates) {
    const hrs = f.hourly.time.map((t, i) => ({ t, i })).filter(({ t }) => t.startsWith(date));
    const gust = Math.max(0, ...hrs.map(({ i }) => f.hourly.gustKmh[i] ?? 0));
    if (gust >= ALERT_RULES.strongGustKmh && !out.some((a) => a.kind === 'strong-wind')) {
      out.push({ kind: 'strong-wind', severity: gust >= 75 ? 'danger' : 'warning', startDate: date, value: gust });
    }
    if (!out.some((a) => a.kind === 'fog')) {
      const fog = fogOnDate(f, hrs.map(({ i }) => i));
      if (fog) out.push({ kind: 'fog', severity: fog.dense ? 'danger' : 'warning', startDate: date, value: fog.visibility ?? 0 });
    }
  }
  return out;
}

function fogOnDate(f: Forecast, hours: number[]): { dense: boolean; visibility: number | null } | null {
  const h = f.hourly;
  const vis = hours.map((i) => h.visibilityM[i]).filter((v): v is number => v !== null);
  if (vis.length > 0) {
    const min = Math.min(...vis);
    if (min < ALERT_RULES.fogVisibilityM) return { dense: min < ALERT_RULES.denseFogVisibilityM, visibility: Math.round(min) };
    if (vis.length === hours.length) return null;
  }
  // Fallback: very humid, calm night hours (visibility missing).
  const night = hours.filter((i) => {
    const hr = hourOf(h.time[i]);
    return (hr >= 20 || hr <= 8) && h.visibilityM[i] === null;
  });
  const foggy = night.filter((i) => (h.humidity[i] ?? 0) >= ALERT_RULES.fogHumidity && h.windKmh[i] !== null && (h.windKmh[i] as number) < ALERT_RULES.fogMaxWindKmh);
  return foggy.length >= ALERT_RULES.fogMinHours ? { dense: false, visibility: null } : null;
}

/* ───────────────────────── disease-risk hints ───────────────────────── */
// No weather rule for cotton leaf curl virus: it's spread by whitefly, not weather.

export type DiseaseRuleId = 'wheat-yellow-rust' | 'rice-blast' | 'cotton-boll-rot';
export type DiseaseHint = { ruleId: DiseaseRuleId; crop: string; cropId?: string; startDate: string; evidence: number };

export const DISEASE_RULES = {
  'wheat-yellow-rust': { crop: 'wheat', stages: ['tillering', 'jointing', 'heading'], months: [12, 1, 2, 3], minC: 10, maxC: 20, minHumidity: 85, minHours: 12, rainDays: 2, windowHours: 72 },
  'rice-blast': { crop: 'rice', stages: ['tillering', 'panicle'], nightMinC: 20, nightMaxC: 28, minHumidity: 90, nights: 3, windowDays: 5 },
  'cotton-boll-rot': { crop: 'cotton', stages: ['boll-opening'], minC: 25, maxC: 35, minHumidity: 85, minHoursAfterRain: 12, windowHours: 72 },
} as const;

export const DISEASE_RULE_IDS = Object.keys(DISEASE_RULES) as DiseaseRuleId[];

/** "Weather favours X" hints for active crops at susceptible stages. */
export function diseaseHints(f: Forecast, nowHour: string, crops: CropRef[]): DiseaseHint[] {
  const h = f.hourly;
  const start = hourIndex(f, nowHour);
  if (start < 0) return [];
  const today = h.time[start].slice(0, 10);
  const out: DiseaseHint[] = [];

  for (const c of crops) {
    if (c.crop === 'wheat' && DISEASE_RULES['wheat-yellow-rust'].stages.includes(c.stage as never)) {
      const r = DISEASE_RULES['wheat-yellow-rust'];
      if (!(r.months as readonly number[]).includes(monthOf(today))) continue;
      const end = Math.min(h.time.length, start + r.windowHours);
      let hours = 0;
      const rainDays = new Set<string>();
      for (let i = start; i < end; i++) {
        const t = h.tempC[i];
        const rh = h.humidity[i];
        if (t !== null && rh !== null && t >= r.minC && t <= r.maxC && rh > r.minHumidity) hours++;
        if ((h.precipMm[i] ?? 0) > 0) rainDays.add(h.time[i].slice(0, 10));
      }
      if (hours >= r.minHours || rainDays.size >= r.rainDays) out.push({ ruleId: 'wheat-yellow-rust', crop: c.crop, cropId: c.cropId, startDate: today, evidence: hours });
    }

    if (c.crop === 'rice' && DISEASE_RULES['rice-blast'].stages.includes(c.stage as never)) {
      const r = DISEASE_RULES['rice-blast'];
      let nights = 0;
      for (let k = 0; k < r.windowDays; k++) {
        const date = addDaysStr(today, k);
        const next = addDaysStr(today, k + 1);
        // Night = 20:00 that day to 05:00 next day.
        const idx = h.time.map((t, i) => ({ t, i })).filter(({ t }) => (t.startsWith(date) && hourOf(t) >= 20) || (t.startsWith(next) && hourOf(t) <= 5));
        if (idx.length < 6) continue;
        const ok = idx.filter(({ i }) => {
          const t = h.tempC[i];
          const rh = h.humidity[i];
          return t !== null && rh !== null && t >= r.nightMinC && t <= r.nightMaxC && rh > r.minHumidity;
        });
        if (ok.length >= idx.length / 2) nights++;
      }
      if (nights >= r.nights) out.push({ ruleId: 'rice-blast', crop: c.crop, cropId: c.cropId, startDate: today, evidence: nights });
    }

    if (c.crop === 'cotton' && DISEASE_RULES['cotton-boll-rot'].stages.includes(c.stage as never)) {
      const r = DISEASE_RULES['cotton-boll-rot'];
      const end = Math.min(h.time.length, start + r.windowHours);
      const firstRain = h.precipMm.findIndex((p, i) => i >= start && i < end && (p ?? 0) > 0);
      if (firstRain >= 0) {
        let hours = 0;
        for (let i = firstRain + 1; i < end; i++) {
          const t = h.tempC[i];
          const rh = h.humidity[i];
          if (t !== null && rh !== null && t >= r.minC && t <= r.maxC && rh > r.minHumidity) hours++;
        }
        if (hours >= r.minHoursAfterRain) out.push({ ruleId: 'cotton-boll-rot', crop: c.crop, cropId: c.cropId, startDate: today, evidence: hours });
      }
    }
  }
  return out;
}

/** Effective rainfall (mm): 80% of a day's rain, days under 5 mm ignored. */
export function effectiveRain(mm: Num): number {
  return mm !== null && mm >= 5 ? Math.round(mm * 0.8 * 10) / 10 : 0;
}

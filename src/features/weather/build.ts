/**
 * Turn a Forecast + the farm's crops into what the screens show (pure; text comes
 * from the `tr` function so it can be tested without i18n).
 */
import type { ActivityRecord, CropRecord } from '@/db/types';
import { cropProgress } from '@/engine/crop-calendar';
import { irrigationAdvice } from '@/engine/crop-water';
import type { CropId } from '@/engine/crops-data';
import {
  CONFIDENT_DAYS,
  conditionFromCode,
  diseaseHints,
  nextSprayWindow,
  sprayWindow,
  weatherAlerts,
  type Forecast,
  type Provider,
  type SpraySlot,
} from '@/engine/weather-rules';
import type { Localized } from '@/hooks/use-localized';
import type { Advisory, AdvisoryKind, DailyForecast, HourlyForecast, Severity, WeatherNow } from '@/types/domain';

export type Tr = (key: string, params?: Record<string, string | number>) => Localized;

export const ATTRIBUTION: Record<Provider, string> = {
  'open-meteo': 'Weather data by Open-Meteo.com (CC BY 4.0)',
  'met-norway': 'Weather data by MET Norway (CC BY 4.0)',
};
const SOURCE: Record<Provider, string> = { 'open-meteo': 'Open-Meteo', 'met-norway': 'MET Norway' };

/**
 * Conditions now: Open-Meteo's 15-minute `current` block when it's present and recent,
 * otherwise the hourly value for this hour.
 */
export function weatherNow(f: Forecast, nowHour: string): WeatherNow {
  const h = f.hourly;
  const i = Math.max(0, h.time.indexOf(nowHour));
  const di = f.daily.date.indexOf(nowHour.slice(0, 10));
  const c = f.current && f.current.tempC !== null && hoursApart(f.current.time, nowHour) <= 1 ? f.current : null;
  const t = c?.tempC ?? h.tempC[i] ?? 0;
  const pick = (cur: number | null | undefined, hourly: number | null) => cur ?? hourly ?? 0;
  return {
    tempC: Math.round(t),
    feelsLikeC: Math.round(pick(c?.feelsLikeC, h.feelsLikeC[i]) || t),
    condition: conditionFromCode(c?.code ?? h.code[i], t),
    humidity: Math.round(pick(c?.humidity, h.humidity[i])),
    windKmh: Math.round(pick(c?.windKmh, h.windKmh[i])),
    rainChance: Math.round(h.rainProb[i] ?? 0),
    et0Mm: di >= 0 && f.daily.et0Mm[di] !== null ? Math.round((f.daily.et0Mm[di] as number) * 10) / 10 : 0,
    updatedAt: f.fetchedAt,
    source: SOURCE[f.provider],
  };
}

function hoursApart(a: string, b: string): number {
  return Math.abs(Date.parse(`${a.slice(0, 16)}:00Z`) - Date.parse(`${b.slice(0, 16)}:00Z`)) / 3_600_000;
}

/** The next 24 hours from now (crosses midnight), for the hourly strip. */
export function next24Hours(f: Forecast, nowHour: string): HourlyForecast[] {
  const start = f.hourly.time.findIndex((t) => t >= nowHour);
  if (start < 0) return [];
  const out: HourlyForecast[] = [];
  for (let i = start; i < Math.min(f.hourly.time.length, start + 24); i++) {
    const temp = f.hourly.tempC[i];
    if (temp === null) continue;
    out.push({ hour: f.hourly.time[i].slice(11, 16), tempC: Math.round(temp), condition: conditionFromCode(f.hourly.code[i], temp), rainChance: Math.round(f.hourly.rainProb[i] ?? 0) });
  }
  return out;
}

/** Today's hours from 06:00 to 23:00 for the day slider (hours without a temperature are skipped). */
export function dayHours(f: Forecast, today: string): HourlyForecast[] {
  const out: HourlyForecast[] = [];
  f.hourly.time.forEach((t, i) => {
    const temp = f.hourly.tempC[i];
    if (!t.startsWith(today) || Number(t.slice(11, 13)) < 6 || temp === null) return;
    out.push({ hour: t.slice(11, 16), tempC: Math.round(temp), condition: conditionFromCode(f.hourly.code[i], temp), rainChance: Math.round(f.hourly.rainProb[i] ?? 0) });
  });
  return out;
}

/** Days from today: the first 7 as the forecast, days 8–14 as a less certain outlook. */
export function dailyForecast(
  f: Forecast,
  today: string,
  dayName: (date: string, isToday: boolean) => Localized,
): { days: DailyForecast[]; outlook: DailyForecast[] } {
  const d = f.daily;
  const first = d.date.indexOf(today);
  if (first < 0) return { days: [], outlook: [] };
  const rows: DailyForecast[] = [];
  for (let i = first; i < d.date.length; i++) {
    const max = d.maxC[i];
    const min = d.minC[i];
    if (max === null || min === null) continue;
    rows.push({ day: dayName(d.date[i], i === first), minC: Math.round(min), maxC: Math.round(max), condition: conditionFromCode(d.code[i], max), rainMm: Math.round(d.precipMm[i] ?? 0) });
  }
  return { days: rows.slice(0, CONFIDENT_DAYS), outlook: rows.slice(CONFIDENT_DAYS, 14) };
}

/** Daylight spray slots for the strip (next 12 working hours). */
export function spraySlots(f: Forecast, nowHour: string): SpraySlot[] {
  return sprayWindow(f, nowHour, 48)
    .filter((s) => s.reason !== 'dark')
    .slice(0, 12);
}

const SEVERITY_ORDER: Record<Severity, number> = { danger: 0, warning: 1, info: 2, good: 3 };
const ALERT_ADVISORY_KIND: Record<string, AdvisoryKind> = {
  heatwave: 'heat',
  'heat-stress': 'heat',
  frost: 'frost',
  'heavy-rain': 'rain',
  'strong-wind': 'wind',
  fog: 'fog',
};

export function buildAdvisories(input: {
  forecast: Forecast;
  nowHour: string;
  today: string;
  farmId: string;
  soil: string | null;
  crops: CropRecord[];
  activities: ActivityRecord[];
  tr: Tr;
  cropName: (crop: CropId) => string;
  hourLabel: (localTime: string) => string;
}): Advisory[] {
  const { forecast: f, nowHour, today, tr } = input;
  const src = SOURCE[f.provider];
  const out: Advisory[] = [];

  // Spray window
  const slots = sprayWindow(f, nowHour, 48);
  const win = nextSprayWindow(slots);
  if (win) {
    const day = win.start.slice(0, 10) === today ? 'today' : 'tomorrow';
    out.push({
      id: 'spray',
      kind: 'spray',
      severity: 'good',
      title: tr(`advice.sprayGood.${day}`, { from: input.hourLabel(win.start), to: input.hourLabel(addHour(win.end)) }),
      body: tr('advice.sprayGoodBody'),
      source: `${src} · spray rules`,
    });
  } else {
    const reasons = slots.filter((s) => s.status !== 'good' && s.reason !== 'dark').map((s) => s.reason);
    const count = (r: string) => reasons.filter((x) => x === r).length;
    const main = (['rain', 'wind', 'gust', 'heat', 'calm', 'dry-air', 'rain-unknown', 'no-data'] as const).reduce((a, b) => (count(b) > count(a) ? b : a), 'rain');
    out.push({ id: 'spray', kind: 'spray', severity: 'warning', title: tr('advice.sprayNone'), body: tr(`advice.sprayReason.${main}`), source: `${src} · spray rules` });
  }

  const growing = input.crops
    .filter((c) => c.status === 'active' && !c.deleted_at)
    .map((c) => ({ c, p: cropProgress(c.crop_key, c.sowing_date, today) }))
    .filter(({ p }) => p.status === 'growing');
  const refs = growing.map(({ c, p }) => ({ crop: c.crop_key, stage: p.stage.key, cropId: c.id }));
  const nameOf = (cropId?: string) => {
    const c = input.crops.find((x) => x.id === cropId);
    return c ? input.cropName(c.crop_key) + (c.variety ? ` (${c.variety})` : '') : '';
  };

  // Weather alerts
  for (const a of weatherAlerts(f, today, refs)) {
    out.push({
      id: `${a.kind}:${a.cropId ?? '-'}:${a.startDate}`,
      kind: ALERT_ADVISORY_KIND[a.kind],
      severity: a.severity,
      title: tr(`advice.alert.${a.kind}.title`, { value: Math.round(a.value), crop: nameOf(a.cropId) }),
      body: tr(`advice.alert.${a.kind}.body`, { value: Math.round(a.value), crop: nameOf(a.cropId) }),
      source: src,
    });
  }

  // Disease weather → link to Scan
  for (const h of diseaseHints(f, nowHour, refs)) {
    out.push({
      id: `${h.ruleId}:${h.cropId ?? '-'}:${h.startDate}`,
      kind: 'disease-risk',
      severity: 'warning',
      title: tr(`advice.disease.${h.ruleId}.title`),
      body: tr(`advice.disease.${h.ruleId}.body`),
      source: 'Disease-weather rules (indicative)',
      action: { kind: 'scan', cropId: h.cropId },
    });
  }

  // Irrigation per growing crop
  for (const { c } of growing) {
    const last = input.activities
      .filter((a) => a.type === 'irrigation' && !a.deleted_at && (a.crop_id === c.id || a.crop_id === null) && a.done_on >= c.sowing_date && a.done_on <= today)
      .reduce<string | null>((m, a) => (m === null || a.done_on > m ? a.done_on : m), null);
    const advice = irrigationAdvice({ forecast: f, today, crop: c.crop_key, sowingDate: c.sowing_date, soil: input.soil, lastIrrigation: last });
    const crop = nameOf(c.id);
    const id = `irrigation:${c.id}`;
    const source = 'FAO-56 water balance';
    switch (advice.kind) {
      case 'rice':
        out.push({ id, kind: 'irrigation', severity: 'info', title: tr('advice.irrigation.rice.title', { crop }), body: tr(advice.rainMm >= 20 ? 'advice.irrigation.rice.rain' : 'advice.irrigation.rice.body', { mm: advice.rainMm }), source });
        break;
      case 'log-needed':
        out.push({
          id,
          kind: 'irrigation',
          severity: 'info',
          title: tr('advice.irrigation.logNeeded.title', { crop }),
          body: tr('advice.irrigation.logNeeded.body'),
          source,
          action: { kind: 'log-irrigation', farmId: input.farmId, cropId: c.id },
        });
        break;
      case 'limited':
        out.push({ id, kind: 'irrigation', severity: 'info', title: tr('advice.irrigation.limited.title', { crop }), body: tr('advice.irrigation.limited.body'), source });
        break;
      case 'skip':
        out.push({ id, kind: 'irrigation', severity: 'good', title: tr('advice.irrigation.skip.title', { crop }), body: tr('advice.irrigation.skip.body', { mm: advice.rainMm, need: advice.dailyNeedMm }), source });
        break;
      case 'due': {
        const when = advice.dueInDays === 0 ? 'now' : advice.dueInDays === 1 ? 'tomorrow' : 'soon';
        out.push({ id, kind: 'irrigation', severity: 'warning', title: tr(`advice.irrigation.due.${when}`, { crop, count: advice.dueInDays }), body: tr('advice.irrigation.body', { need: advice.dailyNeedMm, used: advice.deficitMm, raw: advice.rawMm }), source });
        break;
      }
      case 'ok':
        out.push({
          id,
          kind: 'irrigation',
          severity: 'info',
          title: tr(advice.beyondForecast ? 'advice.irrigation.okLater' : 'advice.irrigation.ok', { crop, count: advice.dueInDays }),
          body: tr('advice.irrigation.body', { need: advice.dailyNeedMm, used: advice.deficitMm, raw: advice.rawMm }),
          source,
        });
        break;
    }
  }

  return out.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

function addHour(t: string): string {
  return new Date(Date.parse(`${t}:00Z`) + 3_600_000).toISOString().slice(0, 16);
}

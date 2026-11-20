/**
 * Turn a Forecast + the farm's crops into what the screens show (pure; text comes
 * from the `tr` function so it can be tested without i18n).
 */
import type { ActivityRecord, CropRecord } from '@/db/types';
import type { CropId } from '@/engine/crops-data';
import { cropProgress } from '@/engine/crop-calendar';
import { RAW_MM, cropKc } from '@/engine/crop-water';
import {
  conditionFromCode,
  diseaseHints,
  irrigationAdvice,
  nextSprayWindow,
  sprayWindow,
  weatherAlerts,
  type Forecast,
  type SpraySlot,
} from '@/engine/weather-rules';
import type { Localized } from '@/hooks/use-localized';
import type { Advisory, DailyForecast, HourlyForecast, Severity, WeatherNow } from '@/types/domain';

export type Tr = (key: string, params?: Record<string, string | number>) => Localized;

export function weatherNow(f: Forecast, nowHour: string): WeatherNow {
  const i = Math.max(0, f.hourly.time.indexOf(nowHour));
  const di = f.daily.date.indexOf(nowHour.slice(0, 10));
  return {
    tempC: Math.round(f.current.tempC),
    feelsLikeC: Math.round(f.current.feelsLikeC),
    condition: conditionFromCode(f.current.code, f.current.tempC),
    humidity: Math.round(f.current.humidity),
    windKmh: Math.round(f.current.windKmh),
    rainChance: Math.round(f.hourly.rainProb[i] ?? 0),
    et0Mm: di >= 0 ? Math.round(f.daily.et0Mm[di] * 10) / 10 : 0,
    updatedAt: f.fetchedAt,
    source: 'Open-Meteo',
  };
}

/** Today's hours from 06:00 to 23:00 for the day slider. */
export function dayHours(f: Forecast, today: string): HourlyForecast[] {
  const out: HourlyForecast[] = [];
  f.hourly.time.forEach((t, i) => {
    if (!t.startsWith(today) || Number(t.slice(11, 13)) < 6) return;
    out.push({ hour: t.slice(11, 16), tempC: Math.round(f.hourly.tempC[i]), condition: conditionFromCode(f.hourly.code[i], f.hourly.tempC[i]), rainChance: Math.round(f.hourly.rainProb[i]) });
  });
  return out;
}

/** 7 days from today. `dayName` turns a date into "Today"/"Thu"/… in the app language. */
export function dailyForecast(f: Forecast, today: string, dayName: (date: string, isToday: boolean) => Localized): DailyForecast[] {
  const d = f.daily;
  const first = d.date.indexOf(today);
  if (first < 0) return [];
  return d.date.slice(first, first + 7).map((date, k) => {
    const i = first + k;
    return { day: dayName(date, k === 0), minC: Math.round(d.minC[i]), maxC: Math.round(d.maxC[i]), condition: conditionFromCode(d.code[i], d.maxC[i]), rainMm: Math.round(d.precipMm[i]) };
  });
}

/** Daylight spray slots for the strip (next 12 working hours). */
export function spraySlots(f: Forecast, nowHour: string): SpraySlot[] {
  return sprayWindow(f, nowHour, 48)
    .filter((s) => s.reason !== 'dark')
    .slice(0, 12);
}

const SEVERITY_ORDER: Record<Severity, number> = { danger: 0, warning: 1, info: 2, good: 3 };

export function buildAdvisories(input: {
  forecast: Forecast;
  nowHour: string;
  today: string;
  crops: CropRecord[];
  activities: ActivityRecord[];
  tr: Tr;
  cropName: (crop: CropId) => string;
  hourLabel: (localTime: string) => string;
}): Advisory[] {
  const { forecast: f, nowHour, today, tr } = input;
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
      source: 'Open-Meteo · spray rules',
    });
  } else {
    const reasons = slots.filter((s) => !s.ok && s.reason !== 'dark').map((s) => s.reason);
    const main = (['rain', 'wind', 'heat'] as const).reduce((a, b) => (reasons.filter((r) => r === b).length > reasons.filter((r) => r === a).length ? b : a), 'rain');
    out.push({ id: 'spray', kind: 'spray', severity: 'warning', title: tr('advice.sprayNone'), body: tr(`advice.sprayReason.${main}`), source: 'Open-Meteo · spray rules' });
  }

  // Weather alerts
  for (const a of weatherAlerts(f, today)) {
    const kind = a.kind === 'heavy-rain' ? 'rain' : a.kind === 'strong-wind' ? 'wind' : a.kind;
    out.push({
      id: a.id,
      kind,
      severity: a.severity,
      title: tr(`advice.alert.${a.kind}.title`, { value: Math.round(a.value), day: a.date === today ? 'today' : a.date }),
      body: tr(`advice.alert.${a.kind}.body`, { value: Math.round(a.value) }),
      source: 'Open-Meteo',
    });
  }

  // Disease risk + irrigation per active, growing crop
  const growing = input.crops
    .filter((c) => c.status === 'active' && !c.deleted_at)
    .map((c) => ({ c, p: cropProgress(c.crop_key, c.sowing_date, today) }))
    .filter(({ p }) => p.status === 'growing');

  for (const h of diseaseHints(f, nowHour, growing.map(({ c, p }) => ({ crop: c.crop_key, stage: p.stage.key })))) {
    out.push({
      id: h.id,
      kind: 'disease-risk',
      severity: 'warning',
      title: tr(`advice.disease.${h.ruleId}.title`),
      body: tr(`advice.disease.${h.ruleId}.body`, { hours: h.hours }),
      source: 'Disease-risk rules (indicative)',
    });
  }

  for (const { c, p } of growing) {
    const last = input.activities
      .filter((a) => a.type === 'irrigation' && !a.deleted_at && (a.crop_id === c.id || a.crop_id === null) && a.done_on >= c.sowing_date && a.done_on <= today)
      .reduce<string | null>((m, a) => (m === null || a.done_on > m ? a.done_on : m), null);
    // No irrigation logged yet: count from sowing (the pre-sowing "rauni" irrigation).
    const advice = irrigationAdvice({ forecast: f, today, kc: cropKc(c.crop_key, p.stage.key), rawMm: RAW_MM[c.crop_key], lastIrrigation: last ?? c.sowing_date });
    const crop = input.cropName(c.crop_key) + (c.variety ? ` (${c.variety})` : '');
    const need = advice.dailyNeedMm;
    if (advice.kind === 'skip') {
      out.push({ id: `irrigation:${c.id}`, kind: 'irrigation', severity: 'good', title: tr('advice.irrigation.skip.title', { crop }), body: tr('advice.irrigation.skip.body', { mm: advice.rainMm, need }), source: 'FAO-56 water balance' });
    } else if (advice.kind === 'due') {
      const when = advice.dueInDays === 0 ? 'now' : advice.dueInDays === 1 ? 'tomorrow' : 'soon';
      out.push({ id: `irrigation:${c.id}`, kind: 'irrigation', severity: 'warning', title: tr(`advice.irrigation.due.${when}`, { crop, count: advice.dueInDays }), body: tr('advice.irrigation.body', { need, used: advice.depletionMm }), source: 'FAO-56 water balance' });
    } else if (advice.kind === 'ok') {
      out.push({ id: `irrigation:${c.id}`, kind: 'irrigation', severity: 'info', title: tr('advice.irrigation.ok', { crop, count: advice.dueInDays }), body: tr('advice.irrigation.body', { need, used: advice.depletionMm }), source: 'FAO-56 water balance' });
    }
  }

  return out.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

function addHour(t: string): string {
  return new Date(Date.parse(`${t}:00Z`) + 3_600_000).toISOString().slice(0, 16);
}

import { useCallback, useEffect, useMemo, useState } from 'react';

import { CROP_CALENDARS, districtByName, localHour, type CropId } from '@/engine';
import { useRepoQuery } from '@/features/farm/hooks';
import type { Localized } from '@/hooks/use-localized';
import i18n from '@/i18n';
import { useSettingsStore } from '@/store/settings-store';

import { buildAdvisories, dailyForecast, dayHours, spraySlots, weatherNow, type Tr } from './build';
import { getForecast, type ForecastResult } from './weather-service';

/** Same text in both app languages (for Localized fields). */
// Keys are built at runtime (advice.alert.<kind>…), so use an untyped t; the locale test checks the files match.
const tAny = (key: string, opts: Record<string, unknown>) => (i18n.t as unknown as (k: string, o: Record<string, unknown>) => string)(key, opts);
const tr: Tr = (key, params) => ({ en: tAny(key, { ...params, lng: 'en' }), ur: tAny(key, { ...params, lng: 'ur' }) });

function dayName(date: string, isToday: boolean): Localized {
  if (isToday) return tr('weather.today');
  const d = new Date(`${date}T12:00:00Z`);
  const w = (loc: string) => {
    try {
      return d.toLocaleDateString(loc, { weekday: 'short', timeZone: 'UTC' });
    } catch {
      return date.slice(5);
    }
  };
  return { en: w('en-GB'), ur: w('ur-PK') };
}

/** Forecast + advice for the selected farm (sample forecast in demo mode). */
export function useFarmWeather() {
  const language = useSettingsStore((s) => s.language);
  const selectedFarmId = useSettingsStore((s) => s.selectedFarmId);
  const { data, isSample, loading: farmLoading } = useRepoQuery(
    async (repos) => {
      const farms = (await repos.farmsRepo.list()).sort((a, b) => a.created_at.localeCompare(b.created_at));
      const farm = farms.find((f) => f.id === selectedFarmId) ?? farms[0] ?? null;
      const [crops, activities] = farm ? await Promise.all([repos.cropsRepo.list({ farmId: farm.id }), repos.activitiesRepo.list({ farmId: farm.id })]) : [[], []];
      return { farm, crops, activities };
    },
    [selectedFarmId],
  );
  const farm = data?.farm ?? null;
  const point = useMemo(() => {
    if (!farm) return null;
    if (farm.lat != null && farm.lng != null) return { lat: farm.lat, lng: farm.lng };
    const d = districtByName(farm.district);
    return d ? { lat: d.lat, lng: d.lng } : null;
  }, [farm]);

  const [result, setResult] = useState<ForecastResult | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (force = false) => {
      if (!point && !isSample) return;
      setLoading(true);
      try {
        setResult(await getForecast(point ?? { lat: 31.4, lng: 73.1 }, { force, demo: isSample }));
        setError(false);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    },
    [point, isSample],
  );

  useEffect(() => {
    if (!farmLoading) void load();
  }, [load, farmLoading]);

  const view = useMemo(() => {
    if (!result) return null;
    const f = result.forecast;
    const nowHour = localHour(f, new Date());
    const today = nowHour.slice(0, 10);
    return {
      now: weatherNow(f, nowHour),
      hours: dayHours(f, today),
      nowIndex: Math.max(0, dayHours(f, today).findIndex((h) => h.hour === nowHour.slice(11, 16))),
      daily: dailyForecast(f, today, dayName),
      spray: spraySlots(f, nowHour),
      advisories: buildAdvisories({
        forecast: f,
        nowHour,
        today,
        crops: data?.crops ?? [],
        activities: data?.activities ?? [],
        tr,
        cropName: (c: CropId) => (language === 'ur' ? (CROP_CALENDARS[c].name.ur ?? CROP_CALENDARS[c].name.en) : CROP_CALENDARS[c].name.en),
        hourLabel: (time) => time.slice(11, 16),
      }),
    };
  }, [result, data, language]);

  return {
    farm,
    isSample,
    noFarm: !farmLoading && !farm && !isSample,
    noLocation: !!farm && !point && !isSample,
    result,
    view,
    loading: loading || farmLoading,
    error: error && !result,
    refresh: () => load(true),
  };
}

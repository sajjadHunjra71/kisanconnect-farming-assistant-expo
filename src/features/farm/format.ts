import type { TFunction } from 'i18next';

import { districtByName, parseLocalDate, toLocalDate } from '@/engine';
import type { LanguageCode } from '@/i18n/languages';

/** "12.5 acre" / "16 kanal" — numbers kept as entered (max 3 dp). */
export function formatArea(t: TFunction, value: number, unit: 'acre' | 'kanal' | 'hectare'): string {
  return `${Number(value.toFixed(3))} ${t(`farm.unitShort.${unit}`)}`;
}

/** District stored in English; show the Urdu name when the app is in Urdu. */
export function districtLabel(name: string | null, language: LanguageCode, fallback: string): string {
  if (!name) return fallback;
  const d = districtByName(name);
  return d && language === 'ur' ? d.ur : (d?.en ?? name);
}

/** "12 Nov 2026" for a local 'YYYY-MM-DD' date. */
export function formatDate(date: string, language: LanguageCode): string {
  const d = parseLocalDate(date);
  try {
    return d.toLocaleDateString(language === 'ur' ? 'ur-PK' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return date;
  }
}

/** An ISO instant (e.g. created_at) as the phone's local calendar day. */
export function localDay(iso: string): string {
  return toLocalDate(new Date(iso));
}

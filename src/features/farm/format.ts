import type { TFunction } from 'i18next';

import { districtByName } from '@/engine';
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

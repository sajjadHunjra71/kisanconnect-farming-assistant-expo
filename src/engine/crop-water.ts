/**
 * Crop coefficients (Kc) per growth stage and readily available water (RAW) per crop,
 * rounded from FAO-56 tables (Allen et al. 1998, tables 12 and 22) for typical Punjab
 * conditions. INDICATIVE only: soil type, irrigation method and variety change them.
 */
import { CROP_CALENDARS, type CropId } from './crops-data';

export const STAGE_KC: Record<CropId, Record<string, number>> = {
  wheat: { germination: 0.4, tillering: 0.75, jointing: 1.1, heading: 1.15, 'grain-fill': 0.9, maturity: 0.4 },
  rice: { nursery: 1.05, tillering: 1.1, panicle: 1.2, maturity: 0.9 },
  cotton: { emergence: 0.35, squaring: 0.75, flowering: 1.15, 'boll-opening': 0.7 },
  sugarcane: { growth: 1.0 },
  maize: { growth: 0.9 },
};

/** Readily available water before stress, mm (root depth × available water × p). */
export const RAW_MM: Record<CropId, number> = {
  wheat: 55,
  rice: 25, // kept flooded: short interval between irrigations
  cotton: 70,
  sugarcane: 65,
  maize: 50,
};

export function cropKc(crop: CropId, stageKey: string): number {
  return STAGE_KC[crop][stageKey] ?? CROP_CALENDARS[crop].stages.reduce((s, st) => s + (STAGE_KC[crop][st.key] ?? 1), 0) / CROP_CALENDARS[crop].stages.length;
}

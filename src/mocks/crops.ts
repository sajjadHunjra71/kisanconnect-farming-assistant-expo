import type { CropDefinition, CropId } from '@/types/domain';

/**
 * Crop calendars. Stage day ranges are indicative placeholders for UI work;
 * they will be replaced with values sourced from Punjab Agriculture Department advisories.
 */
export const CROPS: Record<CropId, CropDefinition> = {
  wheat: {
    id: 'wheat',
    name: { en: 'Wheat', ur: 'گندم' },
    icon: 'barley',
    seasonDays: 150,
    stages: [
      { key: 'germination', name: { en: 'Germination', ur: 'اگاؤ' }, startDay: 0, endDay: 20 },
      { key: 'tillering', name: { en: 'Tillering', ur: 'شاخیں نکلنا' }, startDay: 21, endDay: 55 },
      { key: 'jointing', name: { en: 'Jointing', ur: 'گانٹھیں بننا' }, startDay: 56, endDay: 80 },
      { key: 'heading', name: { en: 'Heading', ur: 'سٹے نکلنا' }, startDay: 81, endDay: 105 },
      { key: 'grain-fill', name: { en: 'Grain filling', ur: 'دانہ بھرنا' }, startDay: 106, endDay: 135 },
      { key: 'maturity', name: { en: 'Maturity', ur: 'پکائی' }, startDay: 136, endDay: 150 },
    ],
  },
  rice: {
    id: 'rice',
    name: { en: 'Rice', ur: 'چاول' },
    icon: 'rice',
    seasonDays: 130,
    stages: [
      { key: 'nursery', name: { en: 'Nursery', ur: 'پنیری' }, startDay: 0, endDay: 30 },
      { key: 'tillering', name: { en: 'Tillering', ur: 'شاخیں نکلنا' }, startDay: 31, endDay: 65 },
      { key: 'panicle', name: { en: 'Panicle initiation', ur: 'سٹہ بننا' }, startDay: 66, endDay: 95 },
      { key: 'maturity', name: { en: 'Maturity', ur: 'پکائی' }, startDay: 96, endDay: 130 },
    ],
  },
  cotton: {
    id: 'cotton',
    name: { en: 'Cotton', ur: 'کپاس' },
    icon: 'flower-poppy',
    seasonDays: 170,
    stages: [
      { key: 'emergence', name: { en: 'Emergence', ur: 'اگاؤ' }, startDay: 0, endDay: 25 },
      { key: 'squaring', name: { en: 'Squaring', ur: 'ڈوڈی بننا' }, startDay: 26, endDay: 60 },
      { key: 'flowering', name: { en: 'Flowering', ur: 'پھول آنا' }, startDay: 61, endDay: 110 },
      { key: 'boll-opening', name: { en: 'Boll opening', ur: 'ٹینڈے کھلنا' }, startDay: 111, endDay: 170 },
    ],
  },
  sugarcane: {
    id: 'sugarcane',
    name: { en: 'Sugarcane', ur: 'گنا' },
    icon: 'grass',
    seasonDays: 330,
    stages: [{ key: 'growth', name: { en: 'Growth', ur: 'بڑھوتری' }, startDay: 0, endDay: 330 }],
  },
  maize: {
    id: 'maize',
    name: { en: 'Maize', ur: 'مکئی' },
    icon: 'corn',
    seasonDays: 110,
    stages: [{ key: 'growth', name: { en: 'Growth', ur: 'بڑھوتری' }, startDay: 0, endDay: 110 }],
  },
};

export const PRIMARY_CROPS: CropId[] = ['wheat', 'rice', 'cotton', 'sugarcane', 'maize'];

export function daysSince(iso: string, now = new Date()): number {
  const ms = now.getTime() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

export function currentStage(cropId: CropId, sowingDate: string) {
  const crop = CROPS[cropId];
  const day = daysSince(sowingDate);
  const stage = crop.stages.find((s) => day >= s.startDay && day <= s.endDay) ?? crop.stages[crop.stages.length - 1];
  return { day, stage, progress: Math.min(1, day / crop.seasonDays) };
}

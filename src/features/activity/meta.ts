import type { IconName } from '@/components/ui';
import type { ActivityType } from '@/db';
import type { Palette } from '@/theme/colors';

export const ACTIVITY_META: Record<ActivityType, { icon: IconName; tone: keyof Pick<Palette, 'primarySoft' | 'accentSoft' | 'infoSoft' | 'dangerSoft' | 'surfaceAlt'> }> = {
  irrigation: { icon: 'water-outline', tone: 'infoSoft' },
  fertilizer: { icon: 'sack', tone: 'accentSoft' },
  spray: { icon: 'spray', tone: 'dangerSoft' },
  harvest: { icon: 'basket-outline', tone: 'accentSoft' },
  sowing: { icon: 'seed-outline', tone: 'primarySoft' },
  other: { icon: 'dots-horizontal-circle-outline', tone: 'surfaceAlt' },
};

import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Text } from '@/components/ui';
import { useDirection } from '@/hooks/use-direction';
import { useTheme } from '@/theme';
import type { Likelihood } from '@/types/domain';

const LEVELS: Likelihood[] = ['low', 'medium', 'high'];

/** Three-step band instead of a fake-precise percentage. */
export function LikelihoodMeter({ value }: { value: Likelihood }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { row } = useDirection();
  const idx = LEVELS.indexOf(value);
  const color = value === 'high' ? colors.danger : value === 'medium' ? colors.warning : colors.inkSubtle;

  return (
    <View style={{ flexDirection: row, alignItems: 'center', gap: 8 }}>
      <View style={{ flexDirection: row, gap: 3 }}>
        {LEVELS.map((l, i) => (
          <View key={l} style={{ width: 18, height: 6, borderRadius: 3, backgroundColor: i <= idx ? color : colors.border }} />
        ))}
      </View>
      <Text variant="caption" style={{ color }}>
        {t('scan.likelihoodLabel', { level: t(`scan.likelihood.${value}`) })}
      </Text>
    </View>
  );
}

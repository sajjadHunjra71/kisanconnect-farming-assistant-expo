import { View } from 'react-native';

import { Icon, PressableScale, Text } from '@/components/ui';
import { useDirection } from '@/hooks/use-direction';
import { useLocalized } from '@/hooks/use-localized';
import { CROPS } from '@/mocks/crops';
import { useTheme } from '@/theme';
import type { CropId } from '@/types/domain';

type Props = { crops: CropId[]; value: CropId; onChange: (id: CropId) => void };

/** Big picture tiles — readable without much text. */
export function CropPicker({ crops, value, onChange }: Props) {
  const { colors, radius, spacing } = useTheme();
  const { row } = useDirection();
  const l = useLocalized();

  return (
    <View style={{ flexDirection: row, flexWrap: 'wrap', gap: spacing.sm }}>
      {crops.map((id) => {
        const crop = CROPS[id];
        const active = id === value;
        return (
          <PressableScale
            key={id}
            onPress={() => onChange(id)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={l(crop.name)}
            style={{
              width: 96,
              paddingVertical: spacing.md,
              alignItems: 'center',
              gap: 6,
              borderRadius: radius.lg,
              borderWidth: 2,
              borderColor: active ? colors.primary : colors.border,
              backgroundColor: active ? colors.primarySoft : colors.surface,
            }}>
            <Icon name={crop.icon} size={30} color={active ? 'primary' : 'inkMuted'} />
            <Text variant="label" color={active ? 'primary' : 'ink'}>
              {l(crop.name)}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

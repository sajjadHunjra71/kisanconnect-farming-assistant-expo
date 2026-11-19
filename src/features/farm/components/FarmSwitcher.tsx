import { ScrollView } from 'react-native';

import { Chip } from '@/components/ui';
import type { FarmRecord } from '@/db';
import { useDirection } from '@/hooks/use-direction';
import { useTheme } from '@/theme';

/** Horizontal chips to pick a farm when the user has more than one. */
export function FarmSwitcher({ farms, selectedId, onSelect }: { farms: FarmRecord[]; selectedId: string; onSelect: (id: string) => void }) {
  const { spacing } = useTheme();
  const { row } = useDirection();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: row, gap: spacing.sm }}>
      {farms.map((f) => (
        <Chip key={f.id} label={f.name} icon="barn" selected={f.id === selectedId} onPress={() => onSelect(f.id)} />
      ))}
    </ScrollView>
  );
}

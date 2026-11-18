import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Avatar, IconButton, Icon, Text } from '@/components/ui';
import { useDirection } from '@/hooks/use-direction';

type Props = { name: string; location: string };

export function GreetingHeader({ name, location }: Props) {
  const { t } = useTranslation();
  const { row } = useDirection();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? t('home.greetingMorning') : hour < 17 ? t('home.greetingAfternoon') : t('home.greetingEvening');

  return (
    <View style={{ flexDirection: row, alignItems: 'center', gap: 12 }}>
      <Avatar name={name} />
      <View style={{ flex: 1 }}>
        <Text variant="caption" color="inkMuted">
          {greeting}
        </Text>
        <Text variant="h3" numberOfLines={1}>
          {name.split(' ')[0]}
        </Text>
        <View style={{ flexDirection: row, alignItems: 'center', gap: 4 }}>
          <Icon name="map-marker-outline" size={14} color="inkSubtle" />
          <Text variant="caption" color="inkSubtle">
            {location}
          </Text>
        </View>
      </View>
      <IconButton icon="bell-outline" accessibilityLabel="Notifications" onPress={() => router.push('/settings')} />
    </View>
  );
}

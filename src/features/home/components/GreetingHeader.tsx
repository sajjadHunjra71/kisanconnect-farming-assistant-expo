import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Avatar, IconButton, Icon, Text } from '@/components/ui';
import { useDirection } from '@/hooks/use-direction';
import { useTheme } from '@/theme';

type Props = { name: string; location: string; unread?: number };

export function GreetingHeader({ name, location, unread = 0 }: Props) {
  const { colors } = useTheme();
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
      <View>
        <IconButton
          icon={unread > 0 ? 'bell-badge-outline' : 'bell-outline'}
          accessibilityLabel={unread > 0 ? t('alerts.bellA11y', { count: unread }) : t('alerts.bellA11yNone')}
          onPress={() => router.push('/alerts')}
        />
        {unread > 0 ? (
          <View
            pointerEvents="none"
            style={{ position: 'absolute', top: -2, end: -2, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' }}>
            <Text variant="caption" latin style={{ color: colors.onHero, fontSize: 11, lineHeight: 14 }}>
              {unread > 9 ? '9+' : unread}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

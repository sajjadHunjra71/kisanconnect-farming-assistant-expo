import { router } from 'expo-router';
import Constants from 'expo-constants';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Card, Divider, ListRow, Screen, ScreenHeader, SectionHeader, SegmentedControl, Text, Toggle } from '@/components/ui';
import { LanguagePicker } from '@/features/settings/components';
import { useSettingsStore, type ThemeMode, type Units } from '@/store/settings-store';
import { useTheme } from '@/theme';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const { themeMode, setThemeMode, units, setUnits, notifications, toggleNotification, resetOnboarding } = useSettingsStore();

  const notifRows = [
    { key: 'weather', label: t('settings.notifWeather'), icon: 'weather-lightning-rainy' },
    { key: 'reminders', label: t('settings.notifReminders'), icon: 'calendar-check-outline' },
    { key: 'mandi', label: t('settings.notifMandi'), icon: 'chart-line-variant' },
    { key: 'expert', label: t('settings.notifExpert'), icon: 'account-tie-outline' },
  ] as const;

  return (
    <Screen header={<ScreenHeader back title={t('settings.title')} large={false} />}>
      <View style={{ gap: spacing.md }}>
        <SectionHeader title={t('settings.language')} />
        <Text variant="caption" color="inkMuted">
          {t('settings.languageBody')}
        </Text>
        <LanguagePicker />
      </View>

      <View style={{ gap: spacing.md }}>
        <SectionHeader title={t('settings.appearance')} />
        <SegmentedControl<ThemeMode>
          value={themeMode}
          onChange={setThemeMode}
          options={[
            { value: 'system', label: t('settings.themeSystem') },
            { value: 'light', label: t('settings.themeLight') },
            { value: 'dark', label: t('settings.themeDark') },
          ]}
        />
      </View>

      <View style={{ gap: spacing.md }}>
        <SectionHeader title={t('settings.units')} />
        <SegmentedControl<Units>
          value={units}
          onChange={setUnits}
          options={[
            { value: 'acre', label: t('settings.unitAcre') },
            { value: 'kanal', label: t('settings.unitKanal') },
            { value: 'hectare', label: t('settings.unitHectare') },
          ]}
        />
      </View>

      <View style={{ gap: spacing.md }}>
        <SectionHeader title={t('settings.notifications')} />
        <Card style={{ paddingVertical: spacing.xs }}>
          {notifRows.map((n, i) => (
            <View key={n.key}>
              {i > 0 ? <Divider inset={52} /> : null}
              <ListRow
                icon={n.icon}
                title={n.label}
                trailing={<Toggle value={notifications[n.key]} onValueChange={() => toggleNotification(n.key)} accessibilityLabel={n.label} />}
              />
            </View>
          ))}
        </Card>
      </View>

      <View style={{ gap: spacing.md }}>
        <SectionHeader title={t('settings.account')} />
        <Card style={{ paddingVertical: spacing.xs }}>
          <ListRow icon="shield-lock-outline" title={t('settings.privacy')} onPress={() => undefined} />
          <Divider inset={52} />
          <ListRow icon="information-outline" title={t('settings.about')} onPress={() => undefined} />
          <Divider inset={52} />
          <ListRow
            icon="replay"
            title={t('settings.replayOnboarding')}
            onPress={() => {
              resetOnboarding();
              router.replace('/welcome');
            }}
          />
          <Divider inset={52} />
          <ListRow icon="logout" title={t('settings.signOut')} onPress={() => undefined} chevron={false} />
          <Divider inset={52} />
          <ListRow icon="delete-outline" iconTone="dangerSoft" title={t('settings.deleteAccount')} destructive onPress={() => undefined} chevron={false} />
        </Card>
      </View>

      <Text variant="caption" color="inkSubtle" align="center">
        {t('settings.version', { version: Constants.expoConfig?.version ?? '1.0.0' })}
      </Text>
    </Screen>
  );
}

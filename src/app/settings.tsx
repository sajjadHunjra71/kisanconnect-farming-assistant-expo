import { router } from 'expo-router';
import Constants from 'expo-constants';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, View } from 'react-native';

import { Card, Divider, FormError, ListRow, Screen, ScreenHeader, SectionHeader, SegmentedControl, Text, Toggle } from '@/components/ui';
import { deleteAccount, signOut } from '@/features/auth/auth-service';
import { ExportUnavailableError, exportMyData } from '@/features/export/export-data';
import { useRepos } from '@/features/farm/hooks';
import { hasAiConsent } from '@/features/scan/scan-service';
import { supabase } from '@/lib/supabase';
import { sampleUser } from '@/mocks/sample-data';
import { useAuthAction } from '@/features/auth/use-auth-action';
import { LanguagePicker } from '@/features/settings/components';
import { confirmSignOut } from '@/features/sync/confirm-sign-out';
import { SyncSettingsSection } from '@/features/sync/components';
import { AlertPrefsSection } from '@/features/notifications/AlertPrefsSection';
import { useAuthStore } from '@/store/auth-store';
import { useSettingsStore, type ThemeMode, type Units } from '@/store/settings-store';
import { useTheme } from '@/theme';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const { spacing, colors } = useTheme();
  const status = useAuthStore((s) => s.status);
  const email = useAuthStore((s) => s.session?.user.email ?? null);
  const { run, error } = useAuthAction();
  const [busy, setBusy] = useState<'signOut' | 'delete' | 'export' | null>(null);
  const repos = useRepos();
  const profile = useAuthStore((s) => s.profile);
  const language = useSettingsStore((s) => s.language);
  const defaultUnits = useSettingsStore((s) => s.units);

  const withdrawAi = () =>
    Alert.alert(t('scan.consent.withdrawTitle'), t('scan.consent.withdrawBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('scan.consent.withdraw'),
        style: 'destructive',
        onPress: async () => {
          const uid = useAuthStore.getState().session?.user.id;
          if (!supabase || !uid) return;
          const { error: e } = await supabase.from('profiles').update({ ai_consent_at: null, ai_consent_version: null }).eq('id', uid);
          if (e) Alert.alert(t('scan.consent.needOnline'));
          else {
            await useAuthStore.getState().loadProfile();
            Alert.alert(t('scan.consent.withdrawn'));
          }
        },
      },
    ]);

  const doExport = async () => {
    if (!repos) return;
    setBusy('export');
    try {
      const exportProfile =
        repos.kind === 'sample'
          ? { email: sampleUser.email, full_name: sampleUser.name, district: null, language, units: defaultUnits }
          : { email, full_name: profile?.full_name ?? null, district: profile?.district ?? null, language: profile?.language ?? language, units: profile?.units ?? defaultUnits };
      await exportMyData(repos, exportProfile, t('settings.exportTitle'));
    } catch (e) {
      Alert.alert(e instanceof ExportUnavailableError ? t('settings.exportUnavailable') : t('settings.exportFailed'));
    } finally {
      setBusy(null);
    }
  };
  const signedIn = status === 'signedIn';

  const doSignOut = async () => {
    if (!(await confirmSignOut(t))) return;
    setBusy('signOut');
    const ok = await run(async () => {
      await signOut();
      return true;
    });
    setBusy(null);
    if (ok) router.replace('/welcome');
  };

  const doDelete = () =>
    Alert.alert(t('settings.deleteTitle'), t('settings.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.deleteConfirm'),
        style: 'destructive',
        onPress: async () => {
          setBusy('delete');
          const ok = await run(async () => {
            await deleteAccount();
            return true;
          });
          setBusy(null);
          if (ok) {
            resetOnboarding();
            router.replace('/welcome');
          }
        },
      },
    ]);

  const spinner = <ActivityIndicator color={colors.primary} />;
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

      {signedIn ? <AlertPrefsSection /> : null}

      {signedIn ? <SyncSettingsSection /> : null}

      <View style={{ gap: spacing.md }}>
        <SectionHeader title={t('settings.account')} />
        <FormError message={error} />
        <Card style={{ paddingVertical: spacing.xs }}>
          <ListRow
            icon={signedIn ? 'account-circle-outline' : 'account-off-outline'}
            title={signedIn && email ? t('settings.signedInAs', { email }) : t('settings.demoMode')}
            chevron={false}
          />
          <Divider inset={52} />
          <ListRow
            icon="database-export-outline"
            title={t('settings.exportData')}
            subtitle={t('settings.exportDataBody')}
            onPress={busy || !repos ? undefined : () => void doExport()}
            chevron={false}
            trailing={busy === 'export' ? spinner : undefined}
          />
          <Divider inset={52} />
          <ListRow icon="shield-lock-outline" title={t('settings.privacy')} onPress={() => undefined} />
          <Divider inset={52} />
          <ListRow icon="information-outline" title={t('settings.about')} subtitle={t('settings.dataSources')} onPress={() => router.push('/about')} />
          {signedIn && hasAiConsent(profile) ? (
            <>
              <Divider inset={52} />
              <ListRow icon="robot-off-outline" title={t('scan.consent.withdraw')} subtitle={t('settings.aiConsentOn')} onPress={withdrawAi} chevron={false} />
            </>
          ) : null}
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
          {signedIn ? (
            <>
              <ListRow icon="logout" title={t('settings.signOut')} onPress={busy ? undefined : () => void doSignOut()} chevron={false} trailing={busy === 'signOut' ? spinner : undefined} />
              <Divider inset={52} />
              <ListRow
                icon="delete-outline"
                iconTone="dangerSoft"
                title={t('settings.deleteAccount')}
                destructive
                onPress={busy ? undefined : doDelete}
                chevron={false}
                trailing={busy === 'delete' ? spinner : undefined}
              />
            </>
          ) : (
            <ListRow icon="login" title={t('settings.signIn')} onPress={() => router.push('/sign-in')} />
          )}
        </Card>
      </View>

      <Text variant="caption" color="inkSubtle" align="center">
        {t('settings.version', { version: Constants.expoConfig?.version ?? '1.0.0' })}
      </Text>
    </Screen>
  );
}

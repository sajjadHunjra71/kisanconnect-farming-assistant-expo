import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button, Card, FormError, ListRow, Screen, ScreenHeader, Text, Toggle } from '@/components/ui';
import { AI_CONSENT_VERSION, isCropId, type CropId } from '@/engine';
import { useRepos } from '@/features/farm/hooks';
import { localScanPhoto } from '@/features/scan/photo';
import { createScan } from '@/features/scan/scan-service';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth-store';
import { requestSync } from '@/sync/sync-manager';
import { useTheme } from '@/theme';

/** Shown before the first online check. The scan waiting behind it is saved either way. */
export default function ScanConsentScreen() {
  const p = useLocalSearchParams<{ tempId?: string; farmId?: string; cropId?: string; cropKey?: string; quality?: string }>();
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const repos = useRepos();
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  const loadProfile = useAuthStore((s) => s.loadProfile);
  const [adult, setAdult] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const finish = async (cloudAllowed: boolean) => {
    if (!repos || !userId || !p.tempId) return router.back();
    const cropKey: CropId = p.cropKey && isCropId(p.cropKey) ? p.cropKey : 'wheat';
    const photo = localScanPhoto(userId, p.tempId);
    const scan = await createScan({
      repos,
      owner: userId,
      tempId: p.tempId,
      photoUri: photo.uri,
      farmId: p.farmId || null,
      cropId: p.cropId || null,
      cropKey,
      // quality was checked on the Scan screen before this one
      quality: parseQuality(p.quality),
      cloudAllowed,
    });
    void requestSync('full');
    router.replace({ pathname: '/scan/[id]', params: { id: scan.id } });
  };

  const agree = async () => {
    if (!supabase || !userId) return;
    setBusy(true);
    setError(null);
    const { error: e } = await supabase.from('profiles').update({ ai_consent_at: new Date().toISOString(), ai_consent_version: AI_CONSENT_VERSION }).eq('id', userId);
    if (e) {
      setBusy(false);
      return setError(t('scan.consent.needOnline'));
    }
    await loadProfile();
    await finish(true);
  };

  return (
    <Screen header={<ScreenHeader back title={t('scan.consent.title')} large={false} />}>
      <Card style={{ gap: spacing.md }}>
        {[t('scan.consent.body1'), t('scan.consent.body2'), t('scan.consent.body3'), t('scan.consent.body4')].map((line) => (
          <Text key={line} variant="body">
            {line}
          </Text>
        ))}
      </Card>
      <Card style={{ paddingVertical: spacing.xs }}>
        <ListRow title={t('scan.consent.adult')} chevron={false} trailing={<Toggle value={adult} onValueChange={setAdult} accessibilityLabel={t('scan.consent.adult')} />} />
      </Card>
      <FormError message={error} />
      <View style={{ gap: spacing.sm }}>
        <Button label={t('scan.consent.agree')} icon="check" onPress={() => void agree()} disabled={!adult || busy} loading={busy} />
        <Button label={t('scan.consent.notNow')} variant="ghost" onPress={() => void finish(false)} disabled={busy} />
      </View>
    </Screen>
  );
}

function parseQuality(raw: string | undefined) {
  try {
    const q = JSON.parse(raw ?? '');
    if (q && typeof q === 'object') return q;
  } catch {
    // fall through
  }
  return { blurVariance: 0, brightness: 0, leafRatio: 0, blocks: [], warnings: [] };
}

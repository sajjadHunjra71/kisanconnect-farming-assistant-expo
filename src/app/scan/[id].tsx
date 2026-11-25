import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Linking, View } from 'react-native';

import { Badge, Button, Card, Divider, Screen, ScreenHeader, SectionHeader, Text, type BadgeTone } from '@/components/ui';
import { CROP_CALENDARS, UNKNOWN_ID, combineResults, kbEntry, type AiDiagnosis, type ModelTop, type ShownStatus } from '@/engine';
import { formatDate, localDay } from '@/features/farm/format';
import { useRepoQuery } from '@/features/farm/hooks';
import { BulletList, LikelihoodMeter } from '@/features/scan/components';
import { localScanPhoto } from '@/features/scan/photo';
import { deleteScan, hasAiConsent, retryScan } from '@/features/scan/scan-service';
import { useLocalized } from '@/hooks/use-localized';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth-store';
import { useDataVersion } from '@/store/data-version';
import { useSettingsStore } from '@/store/settings-store';
import { requestSync } from '@/sync/sync-manager';
import { useTheme } from '@/theme';

const TONE: Record<ShownStatus, BadgeTone> = { likely: 'warning', possible: 'info', unclear: 'neutral', not_crop: 'neutral', failed: 'danger', offline: 'neutral' };

/** One scan: status, causes, questions, next steps, official advice, share / ask expert / delete. */
export default function ScanResultScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { spacing, radius } = useTheme();
  const l = useLocalized();
  const language = useSettingsStore((s) => s.language);
  const owner = useAuthStore((s) => (s.status === 'signedIn' ? (s.session?.user.id ?? 'demo') : 'demo'));
  const [busy, setBusy] = useState(false);

  const { data, repos, isSample } = useRepoQuery(async (r) => ({ scan: await r.scansRepo.get(id), state: await r.scanQueue.get(id) }), [id]);
  const scan = data?.scan;
  if (!scan) return <Screen header={<ScreenHeader back title={t('scan.resultTitle')} large={false} />}>{null}</Screen>;

  const ai = (scan.ai_result && !('error' in scan.ai_result) ? scan.ai_result : null) as (AiDiagnosis & { model?: string }) | null;
  const modelTop = ((scan.model_result as { top?: ModelTop } | null)?.top ?? null) as ModelTop | null;
  const shown: ShownStatus | null = scan.final_status ?? (modelTop ? combineResults(modelTop, null).status : null);
  const topId = scan.top_disease_id ?? (modelTop ? combineResults(modelTop, null).topId : null);
  const top = kbEntry(topId);
  const state = data?.state?.check_state;
  // A failed check that "Try again" sent back to the queue shows as waiting, not failed.
  const retrying = scan.final_status === 'failed' && (state === 'waiting_check' || state === 'pending_upload');
  // Dev builds: the code from the failing step, to debug the cloud check.
  const devError = __DEV__
    ? [data?.state?.last_error, (scan.ai_result as { error?: string; reason?: string } | null)?.error, (scan.ai_result as { reason?: string } | null)?.reason].filter(Boolean).join(' · ')
    : '';
  const photo = localScanPhoto(owner, scan.id);
  const cropName = l(CROP_CALENDARS[scan.crop_key].name);

  const causeName = (cid: string) => (cid === UNKNOWN_ID ? t('scan.unknownCause') : kbEntry(cid) ? l(kbEntry(cid)!.name) : cid);

  const shareWhatsApp = () => {
    const lines = [
      `KisanConnect leaf check (${cropName}): ${top ? l(top.name) : t(`scan.status.${shown ?? 'unclear'}`)}`,
      t('scan.disclaimer'),
      top?.chemical_control ? `${top.chemical_control.source_name}: ${top.chemical_control.source_url}` : t('scan.chemicalNone'),
    ];
    void Linking.openURL(`https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`);
  };

  const sharePhoto = async () => {
    if (photo.exists && (await Sharing.isAvailableAsync())) await Sharing.shareAsync(photo.uri, { mimeType: 'image/jpeg', UTI: 'public.jpeg' });
  };

  const askExpert = async () => {
    if (!repos) return;
    await repos.scansRepo.update(scan.id, { ask_expert: true });
  };

  const retry = async () => {
    if (!repos) return;
    // Consent changed (or was withdrawn): ask again first; the consent screen comes back here.
    if (!isSample && owner !== 'demo' && !hasAiConsent(useAuthStore.getState().profile)) {
      router.push('/scan/consent');
      return;
    }
    setBusy(true);
    await retryScan(repos, scan.id);
    await requestSync('full');
    useDataVersion.getState().bump();
    setBusy(false);
  };

  const confirmDelete = () =>
    Alert.alert(t('scan.deleteTitle'), t('scan.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('scan.delete'),
        style: 'destructive',
        onPress: async () => {
          if (!repos) return;
          await deleteScan(repos, owner, scan, isSample ? null : supabase);
          router.back();
        },
      },
    ]);

  return (
    <Screen header={<ScreenHeader back title={cropName} subtitle={formatDate(localDay(scan.created_at), language)} large={false} />}>
      {photo.exists ? <Image source={{ uri: photo.uri }} style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: radius.lg }} contentFit="cover" /> : null}

      {isSample && scan.checked_at ? <Badge label={t('scan.sampleResult')} tone="accent" icon="flask-outline" /> : null}

      {(!scan.checked_at || retrying) && state ? (
        <Card tone={state === 'failed' ? 'dangerSoft' : 'surfaceAlt'} style={{ gap: spacing.sm }}>
          <Text variant="title">{t(`scan.state.${state}`)}</Text>
          <Text variant="body" color="inkMuted">
            {state === 'failed' ? t('scan.failedBody') : state === 'device_only' ? t('scan.deviceOnlyBody') : t('scan.waitingBody')}
          </Text>
          {devError ? (
            <Text variant="caption" color="inkSubtle">
              {devError}
            </Text>
          ) : null}
          {state === 'failed' || (state === 'waiting_check' && !retrying) ? <Button label={t('scan.tryAgain')} icon="refresh" variant="secondary" onPress={() => void retry()} loading={busy} /> : null}
        </Card>
      ) : null}

      {shown && !retrying ? (
        <Card elevated style={{ gap: spacing.sm }}>
          <Badge label={t(`scan.status.${shown}`)} tone={TONE[shown]} />
          {shown === 'not_crop' ? (
            <Text variant="body">{t('scan.notCropBody')}</Text>
          ) : top ? (
            <Text variant="h2">{l(top.name)}</Text>
          ) : null}
          {shown === 'failed' && devError ? (
            <Text variant="caption" color="inkSubtle">
              {devError}
            </Text>
          ) : null}
          {shown === 'failed' ? <Button label={t('scan.tryAgain')} icon="refresh" variant="secondary" onPress={() => void retry()} loading={busy} /> : null}
        </Card>
      ) : null}

      {ai && ai.possible_causes.length > 0 ? (
        <View style={{ gap: spacing.sm }}>
          <SectionHeader title={t('scan.causes')} />
          {ai.possible_causes.map((c) => (
            <Card key={c.id} style={{ gap: spacing.xs }}>
              <Text variant="title">{causeName(c.id)}</Text>
              <LikelihoodMeter value={c.likelihood} />
              {c.visible_signs ? (
                <Text variant="body" color="inkMuted">
                  {c.visible_signs}
                </Text>
              ) : null}
            </Card>
          ))}
        </View>
      ) : null}

      {ai && ai.questions_to_confirm.length > 0 ? (
        <View style={{ gap: spacing.sm }}>
          <SectionHeader title={t('scan.checks')} />
          <Card>
            <BulletList items={ai.questions_to_confirm} />
          </Card>
        </View>
      ) : null}

      {ai && ai.next_steps.length > 0 ? (
        <View style={{ gap: spacing.sm }}>
          <SectionHeader title={t('scan.nextSteps')} />
          <Card>
            <BulletList items={ai.next_steps} numbered />
          </Card>
        </View>
      ) : null}

      {top && top.kind !== 'healthy' ? (
        <View style={{ gap: spacing.sm }}>
          <SectionHeader title={t('scan.advice')} />
          <Card style={{ gap: spacing.sm }}>
            <Text variant="label">{t('scan.symptoms')}</Text>
            <BulletList items={top.symptoms} />
            <Divider />
            <Text variant="label">{t('scan.cultural')}</Text>
            <BulletList items={top.cultural_control} />
            <Divider />
            <Text variant="label">{t('scan.chemical')}</Text>
            {top.chemical_control ? (
              <>
                <Text variant="body">{top.chemical_control.text}</Text>
                <Text variant="caption" color="inkSubtle">
                  {t('scan.source', { name: top.chemical_control.source_name, date: top.chemical_control.verified_on })}
                </Text>
              </>
            ) : (
              <Text variant="body" color="inkMuted">
                {t('scan.chemicalNone')}
              </Text>
            )}
            {!top.reviewed ? (
              <Text variant="caption" color="inkSubtle">
                {t('scan.notReviewed')}
              </Text>
            ) : null}
          </Card>
        </View>
      ) : null}

      <Card tone="warningSoft">
        <Text variant="body">{t('scan.disclaimer')}</Text>
      </Card>

      <View style={{ gap: spacing.sm }}>
        <Button
          label={scan.ask_expert ? t('scan.askedExpert') : t('scan.askExpert')}
          icon="account-tie-outline"
          variant={scan.final_status === 'unclear' || scan.needs_expert_ai ? 'primary' : 'secondary'}
          onPress={() => void askExpert()}
          disabled={scan.ask_expert}
        />
        <Button label={t('scan.share')} icon="whatsapp" variant="secondary" onPress={shareWhatsApp} />
        {photo.exists ? <Button label={t('scan.shareSheet')} icon="share-variant-outline" variant="secondary" onPress={() => void sharePhoto()} /> : null}
        <Button label={t('scan.scanAgain')} icon="camera-outline" variant="ghost" onPress={() => router.replace('/(tabs)/scan')} />
      </View>

      <View style={{ gap: 2 }}>
        {scan.checked_at ? (
          <Text variant="caption" color="inkSubtle">
            {t('scan.checkedAt', { date: formatDate(localDay(scan.checked_at), language) })} · {ai?.model === 'sample' ? t('scan.sampleResult') : t('scan.cloudModel')}
          </Text>
        ) : null}
        {scan.model_version ? (
          <Text variant="caption" color="inkSubtle">
            {t('scan.modelVersion', { version: scan.model_version })}
          </Text>
        ) : null}
      </View>

      <Button label={t('scan.delete')} icon="delete-outline" variant="danger" onPress={confirmDelete} />
    </Screen>
  );
}

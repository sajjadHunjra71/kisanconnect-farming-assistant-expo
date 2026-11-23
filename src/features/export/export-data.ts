import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import type { Repos } from '@/db';

import { buildExport, exportFileName, type ExportProfile } from './build-export';

export class ExportUnavailableError extends Error {}

/** Build the export from the local database, save it in the cache folder and open the share sheet. */
export async function exportMyData(repos: Repos, profile: ExportProfile, dialogTitle: string): Promise<void> {
  const [farms, crops, activities, scans] = await Promise.all([repos.farmsRepo.list(), repos.cropsRepo.list(), repos.activitiesRepo.list(), repos.scansRepo.list()]);
  const json = JSON.stringify(buildExport({ profile, farms, crops, activities, scans }), null, 2);
  const name = exportFileName();

  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }

  if (!(await Sharing.isAvailableAsync())) throw new ExportUnavailableError();
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.write(json);
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json', dialogTitle });
}

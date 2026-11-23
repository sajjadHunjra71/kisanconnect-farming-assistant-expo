/**
 * Leaf photo: pick → apply orientation + re-encode (EXIF/GPS gone) → 1024 px long side →
 * JPEG quality stepped down until ≤ 400 KB → saved at documents/scans/<owner>/<scanId>.jpg.
 * Quality check runs on a 224×224 copy decoded with jpeg-js.
 */
import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import jpeg from 'jpeg-js';

import { checkLeafPhoto, type QualityResult } from '@/engine';

export const MAX_PHOTO_BYTES = 400 * 1024;
const LONG_SIDE = 1024;
const QUALITIES = [0.8, 0.7, 0.6, 0.5, 0.4];

export type PickResult = { uri: string } | { cancelled: true } | { denied: true };

export async function pickLeafPhoto(source: 'camera' | 'library'): Promise<PickResult> {
  const perm = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return { denied: true };
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], exif: false, quality: 1, allowsEditing: false };
  const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled || !res.assets?.[0]) return { cancelled: true };
  return { uri: res.assets[0].uri };
}

function scanDir(owner: string): Directory {
  const dir = new Directory(Paths.document, 'scans', owner);
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

/** Resize + re-encode into the scan folder; returns the saved file's uri and size. */
export async function prepareLeafPhoto(uri: string, owner: string, scanId: string): Promise<{ uri: string; bytes: number }> {
  const ctx = ImageManipulator.manipulate(uri);
  const probe = await ctx.renderAsync();
  const landscape = probe.width >= probe.height;
  const needsResize = Math.max(probe.width, probe.height) > LONG_SIDE;
  const img = needsResize ? await ImageManipulator.manipulate(uri).resize(landscape ? { width: LONG_SIDE } : { height: LONG_SIDE }).renderAsync() : probe;

  let saved: { uri: string } | null = null;
  let size = Infinity;
  for (const q of QUALITIES) {
    saved = await img.saveAsync({ compress: q, format: SaveFormat.JPEG });
    size = new File(saved.uri).size ?? Infinity;
    if (size <= MAX_PHOTO_BYTES) break;
  }
  if (!saved) throw new Error('photo: could not encode');
  const dest = new File(scanDir(owner), `${scanId}.jpg`);
  if (dest.exists) dest.delete();
  await new File(saved.uri).move(dest);
  return { uri: dest.uri, bytes: size };
}

/** Quality numbers from a 224×224 decode of the prepared photo. */
export async function photoQuality(uri: string): Promise<QualityResult> {
  const small = await (await ImageManipulator.manipulate(uri).resize({ width: 224, height: 224 }).renderAsync()).saveAsync({
    compress: 0.9,
    format: SaveFormat.JPEG,
    base64: true,
  });
  const bytes = base64ToBytes(small.base64 ?? '');
  const decoded = jpeg.decode(bytes, { useTArray: true, formatAsRGBA: true });
  return checkLeafPhoto(decoded.data, decoded.width, decoded.height);
}

export function localScanPhoto(owner: string, scanId: string): File {
  return new File(Paths.document, 'scans', owner, `${scanId}.jpg`);
}

export function deleteLocalScanPhoto(owner: string, scanId: string) {
  const f = localScanPhoto(owner, scanId);
  if (f.exists) f.delete();
}

/** Sign-out / account deletion: remove this user's whole photo folder. */
export function clearScanPhotos(owner: string) {
  const dir = new Directory(Paths.document, 'scans', owner);
  if (dir.exists) dir.delete();
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

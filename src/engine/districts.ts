/**
 * The 41 districts of Punjab (incl. Murree, Talagang, Kot Addu, Wazirabad and Taunsa, created 2022–23) with an approximate centre point
 * (district headquarters, 2 dp). Aliases cover common spellings from geocoders.
 */
export type District = { key: string; en: string; ur: string; lat: number; lng: number; aliases?: string[] };

export const PUNJAB_DISTRICTS: District[] = [
  { key: 'attock', en: 'Attock', ur: 'اٹک', lat: 33.77, lng: 72.36, aliases: ['Campbellpur'] },
  { key: 'bahawalnagar', en: 'Bahawalnagar', ur: 'بہاولنگر', lat: 29.99, lng: 73.25, aliases: ['Bahawal Nagar'] },
  { key: 'bahawalpur', en: 'Bahawalpur', ur: 'بہاولپور', lat: 29.4, lng: 71.68 },
  { key: 'bhakkar', en: 'Bhakkar', ur: 'بھکر', lat: 31.63, lng: 71.07, aliases: ['Bhakar'] },
  { key: 'chakwal', en: 'Chakwal', ur: 'چکوال', lat: 32.93, lng: 72.86 },
  { key: 'chiniot', en: 'Chiniot', ur: 'چنیوٹ', lat: 31.72, lng: 72.98 },
  { key: 'dera-ghazi-khan', en: 'Dera Ghazi Khan', ur: 'ڈیرہ غازی خان', lat: 30.05, lng: 70.63, aliases: ['DG Khan', 'D.G. Khan', 'D G Khan', 'Dera Ghazi'] },
  { key: 'faisalabad', en: 'Faisalabad', ur: 'فیصل آباد', lat: 31.42, lng: 73.08, aliases: ['Lyallpur'] },
  { key: 'gujranwala', en: 'Gujranwala', ur: 'گوجرانوالہ', lat: 32.16, lng: 74.19 },
  { key: 'gujrat', en: 'Gujrat', ur: 'گجرات', lat: 32.57, lng: 74.08 },
  { key: 'hafizabad', en: 'Hafizabad', ur: 'حافظ آباد', lat: 32.07, lng: 73.69, aliases: ['Hafiz Abad'] },
  { key: 'jhang', en: 'Jhang', ur: 'جھنگ', lat: 31.27, lng: 72.32 },
  { key: 'jhelum', en: 'Jhelum', ur: 'جہلم', lat: 32.94, lng: 73.73 },
  { key: 'kasur', en: 'Kasur', ur: 'قصور', lat: 31.12, lng: 74.45, aliases: ['Qasur'] },
  { key: 'khanewal', en: 'Khanewal', ur: 'خانیوال', lat: 30.3, lng: 71.93 },
  { key: 'khushab', en: 'Khushab', ur: 'خوشاب', lat: 32.3, lng: 72.35 },
  { key: 'kot-addu', en: 'Kot Addu', ur: 'کوٹ ادو', lat: 30.47, lng: 70.97, aliases: ['Kotaddu'] },
  { key: 'lahore', en: 'Lahore', ur: 'لاہور', lat: 31.55, lng: 74.34 },
  { key: 'layyah', en: 'Layyah', ur: 'لیہ', lat: 30.96, lng: 70.94, aliases: ['Leiah', 'Layya'] },
  { key: 'lodhran', en: 'Lodhran', ur: 'لودھراں', lat: 29.54, lng: 71.63 },
  { key: 'mandi-bahauddin', en: 'Mandi Bahauddin', ur: 'منڈی بہاؤالدین', lat: 32.59, lng: 73.49, aliases: ['Mandi Bahaudin', 'Mandi Baha ud Din', 'M.B. Din'] },
  { key: 'mianwali', en: 'Mianwali', ur: 'میانوالی', lat: 32.58, lng: 71.54 },
  { key: 'multan', en: 'Multan', ur: 'ملتان', lat: 30.2, lng: 71.47 },
  { key: 'murree', en: 'Murree', ur: 'مری', lat: 33.91, lng: 73.39, aliases: ['Mari'] },
  { key: 'muzaffargarh', en: 'Muzaffargarh', ur: 'مظفر گڑھ', lat: 30.07, lng: 71.19, aliases: ['Muzafargarh', 'Muzaffar Garh'] },
  { key: 'nankana-sahib', en: 'Nankana Sahib', ur: 'ننکانہ صاحب', lat: 31.45, lng: 73.71, aliases: ['Nankana'] },
  { key: 'narowal', en: 'Narowal', ur: 'نارووال', lat: 32.1, lng: 74.87 },
  { key: 'okara', en: 'Okara', ur: 'اوکاڑہ', lat: 30.81, lng: 73.45 },
  { key: 'pakpattan', en: 'Pakpattan', ur: 'پاکپتن', lat: 30.34, lng: 73.39, aliases: ['Pak Pattan'] },
  { key: 'rahim-yar-khan', en: 'Rahim Yar Khan', ur: 'رحیم یار خان', lat: 28.42, lng: 70.3, aliases: ['Rahimyar Khan', 'R.Y. Khan', 'RY Khan'] },
  { key: 'rajanpur', en: 'Rajanpur', ur: 'راجن پور', lat: 29.1, lng: 70.33, aliases: ['Rajan Pur'] },
  { key: 'rawalpindi', en: 'Rawalpindi', ur: 'راولپنڈی', lat: 33.6, lng: 73.04, aliases: ['Pindi'] },
  { key: 'sahiwal', en: 'Sahiwal', ur: 'ساہیوال', lat: 30.66, lng: 73.11, aliases: ['Montgomery'] },
  { key: 'sargodha', en: 'Sargodha', ur: 'سرگودھا', lat: 32.08, lng: 72.67 },
  { key: 'sheikhupura', en: 'Sheikhupura', ur: 'شیخوپورہ', lat: 31.71, lng: 73.99, aliases: ['Shekhupura', 'Sheikhupur'] },
  { key: 'sialkot', en: 'Sialkot', ur: 'سیالکوٹ', lat: 32.49, lng: 74.53 },
  { key: 'talagang', en: 'Talagang', ur: 'تلہ گنگ', lat: 32.93, lng: 72.42 },
  { key: 'taunsa', en: 'Taunsa', ur: 'تونسہ', lat: 30.7, lng: 70.65, aliases: ['Taunsa Sharif'] },
  { key: 'toba-tek-singh', en: 'Toba Tek Singh', ur: 'ٹوبہ ٹیک سنگھ', lat: 30.97, lng: 72.48, aliases: ['Toba'] },
  { key: 'vehari', en: 'Vehari', ur: 'وہاڑی', lat: 30.04, lng: 72.35, aliases: ['Vihari'] },
  { key: 'wazirabad', en: 'Wazirabad', ur: 'وزیر آباد', lat: 32.44, lng: 74.12, aliases: ['Wazir Abad'] },
];

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/\b(district|division|tehsil|city|cantt|cantonment)\b/g, '')
    .replace(/[^a-z]/g, '');

const INDEX = new Map<string, District>();
for (const d of PUNJAB_DISTRICTS) for (const name of [d.en, ...(d.aliases ?? [])]) INDEX.set(norm(name), d);

export function districtByName(name: string | null | undefined): District | null {
  return name ? (INDEX.get(norm(name)) ?? null) : null;
}

/** Rough distance in km (equirectangular; fine at this scale). */
function km(aLat: number, aLng: number, bLat: number, bLng: number) {
  const x = ((bLng - aLng) * Math.PI) / 180 * Math.cos((((aLat + bLat) / 2) * Math.PI) / 180);
  const y = ((bLat - aLat) * Math.PI) / 180;
  return Math.sqrt(x * x + y * y) * 6371;
}

/**
 * Map a reverse-geocode result to one of our districts: try the names first
 * (subregion, city, district, region), then the nearest centre within 60 km.
 */
export function matchDistrict(
  place: { subregion?: string | null; city?: string | null; district?: string | null; region?: string | null },
  coords?: { lat: number; lng: number },
): District | null {
  for (const n of [place.subregion, place.city, place.district, place.region]) {
    const d = districtByName(n);
    if (d) return d;
  }
  if (!coords) return null;
  let best: District | null = null;
  let bestKm = 60;
  for (const d of PUNJAB_DISTRICTS) {
    const dist = km(coords.lat, coords.lng, d.lat, d.lng);
    if (dist < bestKm) {
      best = d;
      bestKm = dist;
    }
  }
  return best;
}

export function searchDistricts(query: string): District[] {
  const q = query.trim().toLowerCase();
  if (!q) return PUNJAB_DISTRICTS;
  return PUNJAB_DISTRICTS.filter(
    (d) => d.en.toLowerCase().includes(q) || d.ur.includes(query.trim()) || (d.aliases ?? []).some((a) => a.toLowerCase().includes(q)),
  );
}

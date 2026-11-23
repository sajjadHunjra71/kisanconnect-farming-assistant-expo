/**
 * Dose filter for AI free text (pure). The AI must never give treatments: any text that
 * looks like an amount + unit, a rate ("per acre"), or names a spray / product /
 * chemical is replaced by "See advice below" (the official knowledge-base advice).
 * Every AI string is also trimmed and length-capped.
 */

export const REPLACEMENT = 'See advice below';
export const MAX_AI_TEXT = 300;

/** amount + unit: "250 ml", "2.5kg", "1 litre", "20 g", "0.1%", "500 ppm", "2 bags"… */
const AMOUNT_UNIT =
  /\b\d+(?:[.,]\d+)?\s*(?:-|to|–)?\s*\d*(?:[.,]\d+)?\s*(?:ml|millilit(?:er|re)s?|l|lit(?:er|re)s?|ltr|g|gm|gms|grams?|kg|kilos?|kilograms?|mg|oz|ounces?|%|percent|ppm|cc|tablets?|sachets?|packets?|bags?|bottles?|tola|maunds?|mann)\b|\d+(?:[.,]\d+)?\s*%/i;

/** rates: "per acre", "/acre", "per kanal", "per hectare", "per litre of water" */
const RATE = /\b(?:per|\/)\s*(?:acre|kanal|hectare|ha|litre|liter|l|gallon|tank|knapsack|plant)\b|\bper\s+\d/i;

/** treatment words and common active ingredients / product types */
const CHEMICAL = new RegExp(
  '\\b(?:' +
    [
      'spray(?:s|ing|ed)?',
      'fungicides?',
      'insecticides?',
      'pesticides?',
      'bactericides?',
      'herbicides?',
      'weedicides?',
      'acaricides?',
      'chemicals?',
      'dose|dosage',
      'drench(?:ing)?',
      'seed treatment',
      // common active ingredients (not exhaustive; the amount/rate rules catch the rest)
      'imidacloprid',
      'acetamiprid',
      'thiamethoxam',
      'dinotefuran',
      'flonicamid',
      'pyriproxyfen',
      'buprofezin',
      'diafenthiuron',
      'spirotetramat',
      'chlorpyrifos',
      'cypermethrin',
      'lambda[- ]?cyhalothrin',
      'bifenthrin',
      'deltamethrin',
      'emamectin',
      'abamectin',
      'chlorantraniliprole',
      'spinetoram',
      'lufenuron',
      'mancozeb',
      'copper(?: oxychloride| hydroxide| sulphate| sulfate)?',
      'carbendazim',
      'thiophanate',
      'tebuconazole',
      'propiconazole',
      'hexaconazole',
      'difenoconazole',
      'azoxystrobin',
      'trifloxystrobin',
      'pyraclostrobin',
      'tricyclazole',
      'isoprothiolane',
      'kasugamycin',
      'streptomycin',
      'validamycin',
      'sulphur|sulfur',
      'glyphosate',
      'urea',
      'dap',
    ].join('|') +
    ')\\b',
  'i',
);

export function looksLikeTreatment(text: string): boolean {
  return AMOUNT_UNIT.test(text) || RATE.test(text) || CHEMICAL.test(text);
}

/** Trim, cap and filter one AI string. Empty/missing → null. */
export function filterAiText(text: unknown, max = MAX_AI_TEXT): string | null {
  if (typeof text !== 'string') return null;
  const t = text.replace(/\s+/g, ' ').trim();
  if (!t) return null;
  if (looksLikeTreatment(t)) return REPLACEMENT;
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

/** Filter a list: drop empties, cap count, collapse repeated "See advice below". */
export function filterAiList(items: unknown, maxItems = 5, maxLen = MAX_AI_TEXT): string[] {
  if (!Array.isArray(items)) return [];
  const out: string[] = [];
  for (const item of items) {
    const f = filterAiText(item, maxLen);
    if (!f || (f === REPLACEMENT && out.includes(REPLACEMENT))) continue;
    out.push(f);
    if (out.length >= maxItems) break;
  }
  return out;
}

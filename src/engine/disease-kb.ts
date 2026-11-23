/**
 * Crop disease knowledge base (pure data + lookups; shared with the Edge Functions).
 *
 * Names shown in the app always come from here, never from the AI.
 *
 * chemical_control: ONLY text quoted word-for-word from a Punjab Agriculture Department,
 * PARC or university advisory, with the source URL and the date it was checked. When no
 * official source has been checked yet it is null, and the app says "Ask an expert or
 * your local agriculture office". Never write doses here from memory.
 *
 * symptoms / cultural_control: general, non-chemical field guidance (what to look for,
 * clean seed, resistant varieties, field hygiene). `reviewed` is false until an agri
 * expert has checked the entry.
 */
import type { CropId } from './crops-data';

export type KbKind = 'disease' | 'pest' | 'virus' | 'healthy';

export type ChemicalControl = {
  /** Quoted exactly from the source. */
  text: string;
  source_name: string;
  source_url: string;
  /** 'YYYY-MM-DD' the quote was checked against the source. */
  verified_on: string;
};

export type KbEntry = {
  id: string;
  crop: CropId;
  kind: KbKind;
  name: { en: string; ur?: string };
  symptoms: string[];
  cultural_control: string[];
  chemical_control: ChemicalControl | null;
  /** One of the on-device model's classes (others are only for the cloud check). */
  model_class: boolean;
  reviewed: boolean;
};

/** Shared "can't tell" class (model and cloud): blurry, not a leaf, too far, etc. */
export const UNCLEAR_ID = 'unclear';
/** Cloud answer id that isn't in the KB. */
export const UNKNOWN_ID = 'unknown';

export const DISEASE_KB: KbEntry[] = [
  // ── wheat ──
  {
    id: 'wheat-yellow-rust',
    crop: 'wheat',
    kind: 'disease',
    name: { en: 'Yellow (stripe) rust', ur: 'پیلی کنگی' },
    symptoms: ['Yellow-orange powdery pustules in stripes along the leaf veins.', 'Powder rubs off on fingers.', 'Starts in patches, spreads in cool, humid weather.'],
    cultural_control: ['Grow rust-resistant varieties recommended for your district.', 'Sow on time; avoid very late sowing.', 'Avoid too much nitrogen.', 'Check the field every week from tillering in cool, humid weather.'],
    chemical_control: null,
    model_class: true,
    reviewed: false,
  },
  {
    id: 'wheat-brown-rust',
    crop: 'wheat',
    kind: 'disease',
    name: { en: 'Brown (leaf) rust', ur: 'بھوری کنگی' },
    symptoms: ['Small round orange-brown pustules scattered on the upper leaf surface.', 'Not in stripes (unlike yellow rust).'],
    cultural_control: ['Grow resistant varieties.', 'Timely sowing.', 'Remove volunteer wheat plants near the field.'],
    chemical_control: null,
    model_class: true,
    reviewed: false,
  },
  {
    id: 'wheat-stem-rust',
    crop: 'wheat',
    kind: 'disease',
    name: { en: 'Stem (black) rust', ur: 'کالی کنگی' },
    symptoms: ['Long reddish-brown pustules on stems and leaf sheaths, turning black later.', 'Stems may break in strong cases.'],
    cultural_control: ['Grow resistant varieties.', 'Timely sowing so the crop matures before hot weather.'],
    chemical_control: null,
    model_class: false,
    reviewed: false,
  },
  {
    id: 'wheat-septoria',
    crop: 'wheat',
    kind: 'disease',
    name: { en: 'Septoria / leaf blotch' },
    symptoms: ['Pale to brown blotches on lower leaves, often with tiny black dots inside.', 'Moves up the plant after rain.'],
    cultural_control: ['Use clean, certified seed.', 'Rotate crops; do not grow wheat after wheat if possible.', 'Bury or remove infected stubble.'],
    chemical_control: null,
    model_class: true,
    reviewed: false,
  },
  {
    id: 'wheat-healthy',
    crop: 'wheat',
    kind: 'healthy',
    name: { en: 'Healthy wheat leaf', ur: 'صحت مند گندم' },
    symptoms: ['Even green colour, no spots, stripes or powder.'],
    cultural_control: ['Keep checking every week, especially in cool, humid weather.'],
    chemical_control: null,
    model_class: true,
    reviewed: false,
  },

  // ── rice ──
  {
    id: 'rice-blast',
    crop: 'rice',
    kind: 'disease',
    name: { en: 'Rice blast', ur: 'بلاسٹ' },
    symptoms: ['Eye- or diamond-shaped spots with grey centres and brown edges on leaves.', 'Neck of the panicle can turn black and break (neck blast).'],
    cultural_control: ['Grow tolerant varieties.', 'Avoid too much nitrogen; give it in parts, not all at once.', 'Keep proper water in the field; avoid drought stress.', 'Remove infected straw and weeds on bunds.'],
    chemical_control: null,
    model_class: true,
    reviewed: false,
  },
  {
    id: 'rice-brown-spot',
    crop: 'rice',
    kind: 'disease',
    name: { en: 'Brown spot' },
    symptoms: ['Small oval brown spots with a grey or yellow halo on leaves.', 'Often worse in weak, nutrient-poor fields.'],
    cultural_control: ['Use clean seed.', 'Balanced fertiliser, including potash.', 'Keep water management right.'],
    chemical_control: null,
    model_class: true,
    reviewed: false,
  },
  {
    id: 'rice-bacterial-leaf-blight',
    crop: 'rice',
    kind: 'disease',
    name: { en: 'Bacterial leaf blight' },
    symptoms: ['Leaf edges turn yellow then greyish-white from the tip downwards, with wavy margins.', 'Milky drops on young lesions in the morning.'],
    cultural_control: ['Grow tolerant varieties.', 'Avoid too much nitrogen.', 'Do not let water flow from an infected field into others.', 'Remove infected stubble and weeds.'],
    chemical_control: null,
    model_class: true,
    reviewed: false,
  },
  {
    id: 'rice-healthy',
    crop: 'rice',
    kind: 'healthy',
    name: { en: 'Healthy rice leaf' },
    symptoms: ['Even green colour, no spots or yellow edges.'],
    cultural_control: ['Keep checking every week, especially in warm, humid weather.'],
    chemical_control: null,
    model_class: true,
    reviewed: false,
  },

  // ── cotton ──
  {
    id: 'cotton-leaf-curl-virus',
    crop: 'cotton',
    kind: 'virus',
    name: { en: 'Cotton leaf curl virus (CLCuV)', ur: 'پتہ مروڑ وائرس' },
    symptoms: ['Leaves curl upwards or downwards, veins thicken and darken.', 'Small leaf-like growths (enations) under the leaf.', 'Plants stay short; spread by whitefly.'],
    cultural_control: ['Grow tolerant varieties recommended for your district.', 'Sow at the recommended time.', 'Remove and destroy badly infected plants early.', 'Keep weeds that host whitefly under control.'],
    chemical_control: null,
    model_class: true,
    reviewed: false,
  },
  {
    id: 'cotton-bacterial-blight',
    crop: 'cotton',
    kind: 'disease',
    name: { en: 'Bacterial blight' },
    symptoms: ['Angular, water-soaked spots between the veins that turn brown-black.', 'Black streaks along veins; can spread to bolls.'],
    cultural_control: ['Use clean, delinted seed.', 'Avoid overhead watering and working in wet fields.', 'Remove infected crop debris after harvest.'],
    chemical_control: null,
    model_class: true,
    reviewed: false,
  },
  {
    id: 'cotton-leaf-spot',
    crop: 'cotton',
    kind: 'disease',
    name: { en: 'Leaf spot' },
    symptoms: ['Round brown spots, often with rings or a darker edge, mostly on older leaves.'],
    cultural_control: ['Balanced fertiliser, especially potash.', 'Avoid water stress.', 'Remove fallen infected leaves.'],
    chemical_control: null,
    model_class: true,
    reviewed: false,
  },
  {
    id: 'cotton-healthy',
    crop: 'cotton',
    kind: 'healthy',
    name: { en: 'Healthy cotton leaf' },
    symptoms: ['Flat, even green leaf without curling or spots.'],
    cultural_control: ['Check undersides of leaves for whitefly and jassid every week.'],
    chemical_control: null,
    model_class: true,
    reviewed: false,
  },

  // ── sugarcane (cloud check only) ──
  {
    id: 'sugarcane-red-rot',
    crop: 'sugarcane',
    kind: 'disease',
    name: { en: 'Red rot' },
    symptoms: ['Leaves dry from the top; split cane shows red tissue with white patches and a sour smell.'],
    cultural_control: ['Plant healthy setts from disease-free fields.', 'Grow tolerant varieties.', 'Uproot and destroy infected clumps; avoid ratoon from infected fields.'],
    chemical_control: null,
    model_class: false,
    reviewed: false,
  },
  {
    id: 'sugarcane-smut',
    crop: 'sugarcane',
    kind: 'disease',
    name: { en: 'Whip smut' },
    symptoms: ['A long black whip-like structure grows from the top of the cane.'],
    cultural_control: ['Plant disease-free setts.', 'Remove whips carefully in a bag before they burst and destroy them.', 'Avoid ratoon from infected fields.'],
    chemical_control: null,
    model_class: false,
    reviewed: false,
  },
  {
    id: 'sugarcane-healthy',
    crop: 'sugarcane',
    kind: 'healthy',
    name: { en: 'Healthy sugarcane' },
    symptoms: ['Green leaves without drying tops, stripes or black whips.'],
    cultural_control: ['Keep checking regularly.'],
    chemical_control: null,
    model_class: false,
    reviewed: false,
  },

  // ── maize (cloud check only) ──
  {
    id: 'maize-leaf-blight',
    crop: 'maize',
    kind: 'disease',
    name: { en: 'Maize leaf blight' },
    symptoms: ['Long cigar-shaped grey-green to tan lesions on leaves, starting on lower leaves.'],
    cultural_control: ['Grow tolerant hybrids.', 'Rotate crops.', 'Bury infected residue.'],
    chemical_control: null,
    model_class: false,
    reviewed: false,
  },
  {
    id: 'maize-fall-armyworm',
    crop: 'maize',
    kind: 'pest',
    name: { en: 'Fall armyworm damage' },
    symptoms: ['Ragged holes and "windowpane" feeding on young leaves.', 'Sawdust-like frass in the whorl; caterpillars with a Y mark on the head.'],
    cultural_control: ['Check whorls of young plants twice a week.', 'Hand-pick egg masses and larvae in small fields.', 'Timely sowing; avoid staggered sowing next to infested fields.'],
    chemical_control: null,
    model_class: false,
    reviewed: false,
  },
  {
    id: 'maize-healthy',
    crop: 'maize',
    kind: 'healthy',
    name: { en: 'Healthy maize leaf' },
    symptoms: ['Green leaves without lesions or feeding holes.'],
    cultural_control: ['Check young plants twice a week for armyworm.'],
    chemical_control: null,
    model_class: false,
    reviewed: false,
  },
];

const BY_ID = new Map(DISEASE_KB.map((e) => [e.id, e]));

export function kbEntry(id: string | null | undefined): KbEntry | null {
  return id ? (BY_ID.get(id) ?? null) : null;
}

/** KB ids for one crop (cloud answer enum, before adding "unknown"). */
export function kbIdsForCrop(crop: CropId): string[] {
  return DISEASE_KB.filter((e) => e.crop === crop).map((e) => e.id);
}

/** On-device model classes for one crop (+ the shared unclear class). */
export function modelClassesForCrop(crop: CropId): string[] {
  return [...DISEASE_KB.filter((e) => e.crop === crop && e.model_class).map((e) => e.id), UNCLEAR_ID];
}

export function isHealthyId(id: string | null | undefined): boolean {
  return kbEntry(id)?.kind === 'healthy';
}

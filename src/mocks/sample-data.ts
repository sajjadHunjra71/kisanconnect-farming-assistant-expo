/**
 * SAMPLE DATA FOR UI DEVELOPMENT ONLY.
 * Every screen that reads from here shows a "Sample data" badge.
 * These are replaced by Supabase / Open-Meteo / AI results in later phases.
 */
import type {
  Advisory,
  ChatMessage,
  DailyForecast,
  ExpertQuestion,
  Farm,
  FarmTask,
  HourlyForecast,
  MandiPrice,
  ScanResult,
  WeatherNow,
} from '@/types/domain';

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

export const sampleUser = { name: 'Muhammad Aslam', email: 'farmer@example.com' };

export const sampleFarm: Farm = {
  id: 'farm-1',
  name: { en: 'Home farm', ur: 'گھر والا کھیت' },
  district: { en: 'Faisalabad', ur: 'فیصل آباد' },
  areaAcres: 12.5,
  soil: { en: 'Loam', ur: 'میرا زمین' },
  crops: [
    { id: 'fc-1', cropId: 'wheat', variety: 'Akbar-2019', sowingDate: daysAgo(38), areaAcres: 8 },
    { id: 'fc-2', cropId: 'sugarcane', variety: 'CPF-249', sowingDate: daysAgo(210), areaAcres: 4.5 },
  ],
};

export const sampleWeatherNow: WeatherNow = {
  tempC: 24,
  feelsLikeC: 23,
  condition: 'partly-cloudy',
  humidity: 62,
  windKmh: 9,
  rainChance: 20,
  et0Mm: 2.4,
  updatedAt: new Date(Date.now() - 40 * 60_000).toISOString(),
  source: 'Open-Meteo',
};

export const sampleHourly: HourlyForecast[] = [
  { hour: '10:00', tempC: 22, condition: 'partly-cloudy', rainChance: 10 },
  { hour: '12:00', tempC: 25, condition: 'clear', rainChance: 5 },
  { hour: '14:00', tempC: 26, condition: 'clear', rainChance: 5 },
  { hour: '16:00', tempC: 24, condition: 'partly-cloudy', rainChance: 15 },
  { hour: '18:00', tempC: 20, condition: 'cloudy', rainChance: 35 },
  { hour: '20:00', tempC: 17, condition: 'rain', rainChance: 60 },
  { hour: '22:00', tempC: 15, condition: 'rain', rainChance: 55 },
];

/** Hour-by-hour sample for today (06:00 to 23:00), used by the day slider on the Weather screen. */
export const sampleDayHours: HourlyForecast[] = [
  [6, 12, 'fog', 5], [7, 13, 'fog', 5], [8, 15, 'partly-cloudy', 5], [9, 18, 'partly-cloudy', 5],
  [10, 21, 'clear', 5], [11, 23, 'clear', 5], [12, 25, 'clear', 5], [13, 26, 'clear', 5],
  [14, 26, 'clear', 10], [15, 25, 'partly-cloudy', 15], [16, 24, 'partly-cloudy', 20], [17, 22, 'cloudy', 30],
  [18, 20, 'cloudy', 40], [19, 18, 'rain', 60], [20, 17, 'rain', 65], [21, 16, 'rain', 55],
  [22, 15, 'cloudy', 30], [23, 14, 'cloudy', 20],
].map(([h, tempC, condition, rainChance]) => ({
  hour: `${String(h).padStart(2, '0')}:00`,
  tempC: tempC as number,
  condition: condition as HourlyForecast['condition'],
  rainChance: rainChance as number,
}));

export const sampleDaily: DailyForecast[] = [
  { day: { en: 'Today', ur: 'آج' }, minC: 13, maxC: 26, condition: 'partly-cloudy', rainMm: 2 },
  { day: { en: 'Thu', ur: 'جمعرات' }, minC: 12, maxC: 22, condition: 'rain', rainMm: 9 },
  { day: { en: 'Fri', ur: 'جمعہ' }, minC: 11, maxC: 21, condition: 'cloudy', rainMm: 1 },
  { day: { en: 'Sat', ur: 'ہفتہ' }, minC: 10, maxC: 23, condition: 'clear', rainMm: 0 },
  { day: { en: 'Sun', ur: 'اتوار' }, minC: 9, maxC: 24, condition: 'clear', rainMm: 0 },
  { day: { en: 'Mon', ur: 'پیر' }, minC: 8, maxC: 22, condition: 'fog', rainMm: 0 },
  { day: { en: 'Tue', ur: 'منگل' }, minC: 9, maxC: 23, condition: 'partly-cloudy', rainMm: 0 },
];

export const sampleAdvisories: Advisory[] = [
  {
    id: 'adv-spray',
    kind: 'spray',
    severity: 'warning',
    title: { en: 'Spray before 4 PM today', ur: 'آج شام 4 بجے سے پہلے سپرے کریں' },
    body: { en: 'Rain is likely after 6 PM. Spray now so it has time to dry on the leaves.', ur: 'شام 6 بجے کے بعد بارش کا امکان ہے۔ ابھی سپرے کریں تاکہ پتوں پر خشک ہو جائے۔' },
    source: 'Spray rules · Open-Meteo',
  },
  {
    id: 'adv-irrigation',
    kind: 'irrigation',
    severity: 'good',
    title: { en: 'Skip irrigation this week', ur: 'اس ہفتے پانی نہ لگائیں' },
    body: { en: 'About 12 mm of rain is expected by Friday, enough for wheat at tillering.', ur: 'جمعہ تک تقریباً 12 ملی میٹر بارش متوقع ہے، جو شاخیں نکلنے کے مرحلے میں گندم کے لیے کافی ہے۔' },
    source: 'FAO-56 water balance',
  },
  {
    id: 'adv-rust',
    kind: 'disease-risk',
    severity: 'danger',
    title: { en: 'Yellow rust risk is rising', ur: 'پیلی کنگی کا خطرہ بڑھ رہا ہے' },
    body: { en: 'Cool nights and high humidity favour yellow rust. Check lower leaves for yellow stripes.', ur: 'ٹھنڈی راتیں اور زیادہ نمی پیلی کنگی کے لیے سازگار ہیں۔ نچلے پتوں پر پیلی دھاریاں چیک کریں۔' },
    source: 'Disease-risk rules',
  },
];

export const sampleTasks: FarmTask[] = [
  { id: 't1', icon: 'spray', title: { en: 'Weed spray in wheat', ur: 'گندم میں جڑی بوٹی مار سپرے' }, detail: { en: 'Field 1 · 8 acres', ur: 'کھیت 1 · 8 ایکڑ' }, due: { en: 'Today', ur: 'آج' }, done: false },
  { id: 't2', icon: 'sack', title: { en: 'First urea dose', ur: 'یوریا کی پہلی خوراک' }, detail: { en: 'With next irrigation', ur: 'اگلے پانی کے ساتھ' }, due: { en: 'In 4 days', ur: '4 دن میں' }, done: false },
  { id: 't3', icon: 'leaf-circle-outline', title: { en: 'Check for aphids', ur: 'سست تیلے کی جانچ' }, detail: { en: 'Look under 10 leaves', ur: '10 پتوں کے نیچے دیکھیں' }, due: { en: 'This week', ur: 'اس ہفتے' }, done: true },
];

export const sampleScan: ScanResult = {
  id: 'scan-1',
  cropId: 'wheat',
  status: 'likely',
  createdAt: new Date().toISOString(),
  modelVersion: 'leaf-v0 (sample)',
  causes: [
    { id: 'yellow-rust', name: { en: 'Yellow (stripe) rust', ur: 'پیلی کنگی' }, likelihood: 'high', signs: { en: 'Yellow powdery stripes along the leaf veins.', ur: 'پتے کی رگوں کے ساتھ پیلی سفوف نما دھاریاں۔' } },
    { id: 'nitrogen', name: { en: 'Nitrogen deficiency', ur: 'نائٹروجن کی کمی' }, likelihood: 'low', signs: { en: 'Even yellowing starting from leaf tips.', ur: 'پتوں کی نوک سے یکساں پیلا پن۔' } },
  ],
  checks: [
    { en: 'Rub a leaf: rust leaves yellow powder on your finger.', ur: 'پتا رگڑیں: کنگی انگلی پر پیلا سفوف چھوڑتی ہے۔' },
    { en: 'Is it in patches or across the whole field?', ur: 'کیا یہ ٹکڑوں میں ہے یا پورے کھیت میں؟' },
  ],
  nextSteps: [
    { en: 'Mark affected patches and check again in 2 days.', ur: 'متاثرہ حصوں پر نشان لگائیں اور 2 دن بعد دوبارہ دیکھیں۔' },
    { en: 'Follow the official rust advisory for your district.', ur: 'اپنے ضلع کے لیے سرکاری کنگی ایڈوائزری پر عمل کریں۔' },
    { en: 'Ask an expert before buying any spray.', ur: 'کوئی سپرے خریدنے سے پہلے ماہر سے پوچھیں۔' },
  ],
  source: 'Punjab Agriculture Dept. wheat advisory (to be linked)',
};

export const sampleChat: ChatMessage[] = [
  { id: 'm1', role: 'farmer', text: { en: 'Why are my wheat leaves turning yellow?', ur: 'میری گندم کے پتے پیلے کیوں ہو رہے ہیں؟' } },
  {
    id: 'm2',
    role: 'assistant',
    text: {
      en: 'Your wheat is about 38 days old (tillering). Yellowing now is usually from nitrogen deficiency, waterlogging after rain, or early yellow rust. Is the yellow even across the leaf, or in stripes?',
      ur: 'آپ کی گندم تقریباً 38 دن کی ہے (شاخیں نکلنے کا مرحلہ)۔ اس وقت پیلا پن عموماً نائٹروجن کی کمی، بارش کے بعد پانی کھڑا ہونے، یا ابتدائی پیلی کنگی سے ہوتا ہے۔ کیا پیلا پن پورے پتے پر یکساں ہے یا دھاریوں میں؟',
    },
    sources: ['Wheat production guide · Punjab Agriculture Dept.'],
  },
];

export const sampleMandi: MandiPrice[] = [
  { id: 'p1', cropId: 'wheat', market: { en: 'Faisalabad', ur: 'فیصل آباد' }, unit: { en: 'per 40 kg', ur: 'فی من' }, min: 3350, max: 3500, avg: 3420, changePct: 1.8, history: [3280, 3300, 3310, 3350, 3340, 3380, 3400, 3420], date: daysAgo(0), source: 'AMIS Punjab (manual upload)' },
  { id: 'p2', cropId: 'rice', market: { en: 'Gujranwala', ur: 'گوجرانوالہ' }, unit: { en: 'per 40 kg', ur: 'فی من' }, min: 5900, max: 6400, avg: 6150, changePct: -0.9, history: [6300, 6280, 6250, 6200, 6220, 6180, 6160, 6150], date: daysAgo(0), source: 'AMIS Punjab (manual upload)' },
  { id: 'p3', cropId: 'cotton', market: { en: 'Multan', ur: 'ملتان' }, unit: { en: 'per 40 kg', ur: 'فی من' }, min: 8200, max: 8650, avg: 8400, changePct: 0.6, history: [8250, 8300, 8280, 8320, 8350, 8360, 8390, 8400], date: daysAgo(1), source: 'AMIS Punjab (manual upload)' },
  { id: 'p4', cropId: 'sugarcane', market: { en: 'Sargodha', ur: 'سرگودھا' }, unit: { en: 'per 40 kg', ur: 'فی من' }, min: 420, max: 450, avg: 435, changePct: 0, history: [430, 432, 435, 433, 435, 436, 435, 435], date: daysAgo(1), source: 'AMIS Punjab (manual upload)' },
  { id: 'p5', cropId: 'maize', market: { en: 'Okara', ur: 'اوکاڑہ' }, unit: { en: 'per 40 kg', ur: 'فی من' }, min: 2300, max: 2480, avg: 2390, changePct: 2.4, history: [2280, 2300, 2310, 2330, 2350, 2360, 2370, 2390], date: daysAgo(2), source: 'AMIS Punjab (manual upload)' },
];

export const sampleQuestions: ExpertQuestion[] = [
  { id: 'q1', cropId: 'wheat', title: { en: 'Yellow stripes on lower leaves', ur: 'نچلے پتوں پر پیلی دھاریاں' }, status: 'answered', askedAt: { en: '2 days ago', ur: '2 دن پہلے' }, expertName: 'Dr. Ayesha Khan', photoCount: 2 },
  { id: 'q2', cropId: 'sugarcane', title: { en: 'Best time for earthing up?', ur: 'مٹی چڑھانے کا بہترین وقت؟' }, status: 'open', askedAt: { en: '5 hours ago', ur: '5 گھنٹے پہلے' }, photoCount: 0 },
];

export const PUNJAB_DISTRICTS: { en: string; ur: string }[] = [
  { en: 'Bahawalpur', ur: 'بہاولپور' },
  { en: 'Faisalabad', ur: 'فیصل آباد' },
  { en: 'Gujranwala', ur: 'گوجرانوالہ' },
  { en: 'Jhang', ur: 'جھنگ' },
  { en: 'Lahore', ur: 'لاہور' },
  { en: 'Multan', ur: 'ملتان' },
  { en: 'Okara', ur: 'اوکاڑہ' },
  { en: 'Rahim Yar Khan', ur: 'رحیم یار خان' },
  { en: 'Sahiwal', ur: 'ساہیوال' },
  { en: 'Sargodha', ur: 'سرگودھا' },
  { en: 'Sheikhupura', ur: 'شیخوپورہ' },
  { en: 'Vehari', ur: 'وہاڑی' },
];

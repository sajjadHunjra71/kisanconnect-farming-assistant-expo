import type { IconName } from '@/components/ui/Icon';
import type { Localized } from '@/hooks/use-localized';

import type { CropId } from '@/engine/crops-data';

export type { CropId };

export type CropStage = {
  key: string;
  name: Localized;
  startDay: number;
  endDay: number;
};

export type CropDefinition = {
  id: CropId;
  name: Localized;
  icon: IconName;
  seasonDays: number;
  stages: CropStage[];
};

export type FarmCrop = {
  id: string;
  cropId: CropId;
  variety: string;
  sowingDate: string; // ISO date
  areaAcres: number;
};

export type Farm = {
  id: string;
  name: Localized;
  district: Localized;
  areaAcres: number;
  soil: Localized;
  crops: FarmCrop[];
};

export type WeatherCondition = 'clear' | 'partly-cloudy' | 'cloudy' | 'rain' | 'storm' | 'fog' | 'hot';

export type WeatherNow = {
  tempC: number;
  feelsLikeC: number;
  condition: WeatherCondition;
  humidity: number;
  windKmh: number;
  rainChance: number;
  et0Mm: number;
  updatedAt: string;
  source: string;
};

export type HourlyForecast = { hour: string; tempC: number; condition: WeatherCondition; rainChance: number };
export type DailyForecast = { day: Localized; minC: number; maxC: number; condition: WeatherCondition; rainMm: number };

export type AdvisoryKind = 'spray' | 'irrigation' | 'disease-risk' | 'heat' | 'frost' | 'rain';
export type Severity = 'good' | 'info' | 'warning' | 'danger';

export type Advisory = {
  id: string;
  kind: AdvisoryKind;
  severity: Severity;
  title: Localized;
  body: Localized;
  source: string;
};

export type FarmTask = {
  id: string;
  icon: IconName;
  title: Localized;
  detail: Localized;
  due: Localized;
  done: boolean;
};

export type Likelihood = 'low' | 'medium' | 'high';

export type ScanResult = {
  id: string;
  cropId: CropId;
  status: 'likely' | 'possible' | 'unclear';
  createdAt: string;
  modelVersion: string;
  causes: { id: string; name: Localized; likelihood: Likelihood; signs: Localized }[];
  checks: Localized[];
  nextSteps: Localized[];
  source: string;
};

export type ChatMessage = {
  id: string;
  role: 'farmer' | 'assistant';
  text: Localized;
  sources?: string[];
};

export type MandiPrice = {
  id: string;
  cropId: CropId;
  market: Localized;
  unit: Localized;
  min: number;
  max: number;
  avg: number;
  changePct: number;
  history: number[];
  date: string;
  source: string;
};

export type ExpertQuestion = {
  id: string;
  cropId: CropId;
  title: Localized;
  status: 'open' | 'answered';
  askedAt: Localized;
  expertName?: string;
  photoCount: number;
};

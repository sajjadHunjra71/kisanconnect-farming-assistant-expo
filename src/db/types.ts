import type { AreaUnit, CropId, QuantityUnit } from '@/engine';

import type { Store } from './store';

export const SYNC_TABLES = ['farms', 'crops', 'activities'] as const;
export type SyncTable = (typeof SYNC_TABLES)[number];

/** Columns every synced row has (mirrors Supabase). */
export type SyncColumns = {
  id: string;
  user_id: string;
  /** Last version seen from the server. 0 = never pushed. */
  version: number;
  last_op_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export const SOIL_TYPES = ['loam', 'clay', 'sandy', 'silt', 'unknown'] as const;
export type SoilType = (typeof SOIL_TYPES)[number];
export const LOCATION_SOURCES = ['gps', 'district'] as const;
export type LocationSource = (typeof LOCATION_SOURCES)[number];
export const CROP_STATUSES = ['active', 'harvested', 'failed'] as const;
export type CropStatus = (typeof CROP_STATUSES)[number];
export const ACTIVITY_TYPES = ['irrigation', 'fertilizer', 'spray', 'harvest', 'sowing', 'other'] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];
export const ACTIVITY_SOURCES = ['manual', 'reminder'] as const;
export type ActivitySource = (typeof ACTIVITY_SOURCES)[number];

export type FarmFields = {
  name: string;
  area_value: number;
  area_unit: AreaUnit;
  district: string | null;
  lat: number | null;
  lng: number | null;
  location_source: LocationSource | null;
  soil_type: SoilType | null;
  notes: string | null;
};
export type FarmRecord = SyncColumns & FarmFields & { area_acres: number };

export type CropFields = {
  farm_id: string;
  crop_key: CropId;
  variety: string | null;
  sowing_date: string;
  area_value: number | null;
  area_unit: AreaUnit | null;
  status: CropStatus;
  harvested_on: string | null;
};
export type CropRecord = SyncColumns & CropFields & { area_acres: number | null };

export type ActivityFields = {
  farm_id: string;
  crop_id: string | null;
  type: ActivityType;
  done_on: string;
  quantity: number | null;
  quantity_unit: QuantityUnit | null;
  product: string | null;
  cost_pkr: number | null;
  notes: string | null;
  source: ActivitySource;
};
export type ActivityRecord = SyncColumns & ActivityFields;

/** What callers pass in: required fields required, nullable ones optional. */
type Input<F> = { [K in keyof F as null extends F[K] ? never : K]: F[K] } & {
  [K in keyof F as null extends F[K] ? K : never]?: F[K];
};
export type FarmInput = Input<FarmFields>;
export type CropInput = Omit<Input<CropFields>, 'status'> & { status?: CropStatus };
export type ActivityInput = Omit<Input<ActivityFields>, 'source'> & { source?: ActivitySource };

export type ListOptions = { farmId?: string; cropId?: string; includeDeleted?: boolean };

export interface Repo<R, I> {
  list(options?: ListOptions): Promise<R[]>;
  get(id: string): Promise<R | null>;
  create(input: I): Promise<R>;
  update(id: string, patch: Partial<I>): Promise<R>;
  /** Soft delete; children are soft-deleted too. */
  remove(id: string): Promise<void>;
}

export type FarmsRepo = Repo<FarmRecord, FarmInput>;
export type CropsRepo = Repo<CropRecord, CropInput>;
export type ActivitiesRepo = Repo<ActivityRecord, ActivityInput>;

export type Repos = {
  kind: 'sqlite' | 'sample';
  /** Set for the signed-in user's SQLite database (used by sync). */
  store?: Store;
  userId?: string;
  farmsRepo: FarmsRepo;
  cropsRepo: CropsRepo;
  activitiesRepo: ActivitiesRepo;
};

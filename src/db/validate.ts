/**
 * Input validation (pure). Mirrors the Supabase check constraints so a row
 * that passes here won't be rejected by the server on push.
 */
import { AREA_UNITS, QUANTITY_UNITS, isCropId, isLocalDate, roundArea, toAcres } from '@/engine';

import {
  ACTIVITY_SOURCES,
  ACTIVITY_TYPES,
  CROP_STATUSES,
  LOCATION_SOURCES,
  SOIL_TYPES,
  type ActivityFields,
  type ActivityInput,
  type CropFields,
  type CropInput,
  type FarmFields,
  type FarmInput,
  type ScanFields,
  type ScanInput,
} from './types';

export class ValidationError extends Error {
  constructor(
    readonly field: string,
    message: string,
  ) {
    super(`${field}: ${message}`);
    this.name = 'ValidationError';
  }
}

const fail = (field: string, message: string): never => {
  throw new ValidationError(field, message);
};

function text(field: string, v: string | null | undefined, max: number, required = false): string | null {
  const t = v == null ? '' : String(v).trim();
  if (!t) return required ? fail(field, 'required') : null;
  if (t.length > max) fail(field, `max ${max} characters`);
  return t;
}

function oneOf<T extends string>(field: string, v: unknown, allowed: readonly T[], required = false): T | null {
  if (v == null || v === '') return required ? fail(field, 'required') : null;
  if (!(allowed as readonly unknown[]).includes(v)) fail(field, `must be one of ${allowed.join(', ')}`);
  return v as T;
}

function num(field: string, v: unknown, opts: { min?: number; max?: number; gt?: number; dp: number; required?: boolean }): number | null {
  if (v == null) return opts.required ? fail(field, 'required') : null;
  if (typeof v !== 'number' || !Number.isFinite(v)) return fail(field, 'must be a number');
  if (opts.gt !== undefined && !(v > opts.gt)) fail(field, `must be more than ${opts.gt}`);
  if (opts.min !== undefined && v < opts.min) fail(field, `must be at least ${opts.min}`);
  if (opts.max !== undefined && v > opts.max) fail(field, `must be at most ${opts.max}`);
  return roundArea(v, opts.dp);
}

function date(field: string, v: string | null | undefined, required = false): string | null {
  if (v == null || v === '') return required ? fail(field, 'required') : null;
  if (!isLocalDate(v)) fail(field, 'must be a YYYY-MM-DD date');
  return v;
}

function pair(a: string, av: unknown, b: string, bv: unknown) {
  if ((av == null) !== (bv == null)) fail(av == null ? a : b, `${a} and ${b} go together`);
}

const MAX_AREA = 9_999_999;

export function validateFarm(input: FarmInput): FarmFields {
  const lat = num('lat', input.lat, { min: -90, max: 90, dp: 2 });
  const lng = num('lng', input.lng, { min: -180, max: 180, dp: 2 });
  pair('lat', lat, 'lng', lng);
  return {
    name: text('name', input.name, 60, true)!,
    area_value: num('area_value', input.area_value, { gt: 0, max: MAX_AREA, dp: 3, required: true })!,
    area_unit: oneOf('area_unit', input.area_unit, AREA_UNITS, true)!,
    district: text('district', input.district, 60),
    lat,
    lng,
    location_source: oneOf('location_source', input.location_source, LOCATION_SOURCES),
    soil_type: oneOf('soil_type', input.soil_type, SOIL_TYPES),
    notes: text('notes', input.notes, 500),
  };
}

export function validateCrop(input: CropInput): CropFields {
  if (!input.farm_id) fail('farm_id', 'required');
  if (!isCropId(String(input.crop_key))) fail('crop_key', 'unknown crop');
  const area_value = num('area_value', input.area_value, { gt: 0, max: MAX_AREA, dp: 3 });
  const area_unit = oneOf('area_unit', input.area_unit, AREA_UNITS);
  pair('area_value', area_value, 'area_unit', area_unit);
  const sowing_date = date('sowing_date', input.sowing_date, true)!;
  const harvested_on = date('harvested_on', input.harvested_on);
  if (harvested_on && harvested_on < sowing_date) fail('harvested_on', 'is before sowing date');
  return {
    farm_id: input.farm_id,
    crop_key: input.crop_key,
    variety: text('variety', input.variety, 60),
    sowing_date,
    area_value,
    area_unit,
    status: oneOf('status', input.status ?? 'active', CROP_STATUSES, true)!,
    harvested_on,
  };
}

export function validateActivity(input: ActivityInput): ActivityFields {
  if (!input.farm_id) fail('farm_id', 'required');
  const quantity = num('quantity', input.quantity, { gt: 0, dp: 3 });
  const quantity_unit = oneOf('quantity_unit', input.quantity_unit, QUANTITY_UNITS);
  pair('quantity', quantity, 'quantity_unit', quantity_unit);
  return {
    farm_id: input.farm_id,
    crop_id: input.crop_id || null,
    type: oneOf('type', input.type, ACTIVITY_TYPES, true)!,
    done_on: date('done_on', input.done_on, true)!,
    quantity,
    quantity_unit,
    product: text('product', input.product, 80),
    cost_pkr: num('cost_pkr', input.cost_pkr, { min: 0, max: 9_999_999_999.99, dp: 2 }),
    notes: text('notes', input.notes, 500),
    source: oneOf('source', input.source ?? 'manual', ACTIVITY_SOURCES, true)!,
  };
}

export function farmAcres(f: Pick<FarmFields, 'area_value' | 'area_unit'>): number {
  return roundArea(toAcres(f.area_value, f.area_unit), 4);
}

export function cropAcres(c: Pick<CropFields, 'area_value' | 'area_unit'>): number | null {
  return c.area_value != null && c.area_unit ? roundArea(toAcres(c.area_value, c.area_unit), 4) : null;
}

const plainObject = (field: string, v: unknown): Record<string, unknown> | null => {
  if (v == null) return null;
  if (typeof v !== 'object' || Array.isArray(v)) return fail(field, 'must be an object');
  if (JSON.stringify(v).length > 4000) fail(field, 'too large');
  return v as Record<string, unknown>;
};

export function validateScan(input: ScanInput): ScanFields {
  if (!isCropId(String(input.crop_key))) fail('crop_key', 'unknown crop');
  if (input.crop_id && !input.farm_id) fail('crop_id', 'needs a farm');
  if (input.photo_path != null && !/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg$/i.test(input.photo_path)) fail('photo_path', 'bad path');
  return {
    farm_id: input.farm_id || null,
    crop_id: input.crop_id || null,
    crop_key: input.crop_key,
    photo_path: input.photo_path ?? null,
    quality: plainObject('quality', input.quality),
    model_result: plainObject('model_result', input.model_result),
    model_version: text('model_version', input.model_version, 60),
    ask_expert: input.ask_expert === true,
  };
}

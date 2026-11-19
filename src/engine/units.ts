/** Area units used in Punjab. Factors match the generated `area_acres` columns in Supabase. */
export const AREA_UNITS = ['acre', 'kanal', 'hectare'] as const;
export type AreaUnit = (typeof AREA_UNITS)[number];

export const ACRES_PER_UNIT: Record<AreaUnit, number> = {
  acre: 1,
  kanal: 1 / 8,
  hectare: 2.4710538,
};

export function isAreaUnit(value: string): value is AreaUnit {
  return (AREA_UNITS as readonly string[]).includes(value);
}

export function toAcres(value: number, unit: AreaUnit): number {
  return value * ACRES_PER_UNIT[unit];
}

export function fromAcres(acres: number, unit: AreaUnit): number {
  return acres / ACRES_PER_UNIT[unit];
}

/** Round for display/storage (server keeps area_value at 3 dp). */
export function roundArea(value: number, dp = 3): number {
  const f = 10 ** dp;
  return Math.round(value * f) / f;
}

export const QUANTITY_UNITS = ['bag', 'kg', 'litre', 'acre-inch', 'maund', 'hour'] as const;
export type QuantityUnit = (typeof QUANTITY_UNITS)[number];

/** 1 maund (mann) = 40 kg in Pakistan. */
export const KG_PER_MAUND = 40;

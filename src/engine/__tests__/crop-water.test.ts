import { ASSUME_SOWING_IRRIGATION_DAYS, irrigationAdvice, kcOnDay, rawMm, rootDepthOnDay } from '../crop-water';
import { makeForecast } from './weather-fixture';

describe('FAO-56 crop water', () => {
  it('Kc: ini, linear through development, mid, linear down in late season', () => {
    expect(kcOnDay('wheat', 10)).toBe(0.4);
    expect(kcOnDay('wheat', 51)).toBeCloseTo(0.4 + (1.15 - 0.4) * 0.5);
    expect(kcOnDay('wheat', 100)).toBe(1.15);
    expect(kcOnDay('wheat', 150)).toBeCloseTo(0.3);
  });

  it('root depth grows to Zr max at mid-season; RAW = p × TAW × Zr by soil', () => {
    expect(rootDepthOnDay('wheat', 0)).toBeCloseTo(0.3);
    expect(rootDepthOnDay('wheat', 120)).toBeCloseTo(1.2);
    expect(rawMm('wheat', 120, 'loam')).toBe(Math.round(0.55 * 150 * 1.2));
    expect(rawMm('wheat', 120, 'sandy')).toBe(Math.round(0.55 * 80 * 1.2));
    expect(rawMm('wheat', 120, null)).toBe(rawMm('wheat', 120, 'loam')); // unknown → loam
    expect(rawMm('cotton', 120, 'clay')).toBe(Math.round(0.65 * 180 * 1.2));
  });
});

describe('irrigationAdvice', () => {
  const base = { today: '2026-11-20', crop: 'wheat' as const, soil: 'loam' };

  it('asks for the last irrigation when none is logged and the crop is older than 20 days', () => {
    expect(ASSUME_SOWING_IRRIGATION_DAYS).toBe(20);
    expect(irrigationAdvice({ ...base, forecast: makeForecast({}), sowingDate: '2026-10-25', lastIrrigation: null })).toEqual({ kind: 'log-needed' });
  });

  it('a newly sown crop counts from sowing', () => {
    const a = irrigationAdvice({ ...base, forecast: makeForecast({}), sowingDate: '2026-11-10', lastIrrigation: null });
    // 10 days × 3 mm × Kc 0.4 = 12 mm; RAW day 10 = 0.55 × 150 × (0.3 + 0.9 × 10/81)
    expect(a).toMatchObject({ kind: 'ok', deficitMm: 12, rawMm: rawMm('wheat', 10, 'loam') });
  });

  it('counts from the last logged irrigation and says when it is due', () => {
    // day 100 (mid season): Kc 1.15, 3 mm ET0 → 3.45 mm/day; RAW = 99 mm
    const a = irrigationAdvice({ ...base, forecast: makeForecast({}), sowingDate: '2026-08-12', lastIrrigation: '2026-10-25' });
    // 26 days since irrigation (Kc rising to 1.15) → 88.9 mm used of 99 mm → due in 3 days
    expect(a).toEqual({ kind: 'ok', dueInDays: 3, deficitMm: 88.9, rawMm: 99, dailyNeedMm: 3.5 });
    const b = irrigationAdvice({ ...base, forecast: makeForecast({}), sowingDate: '2026-08-12', lastIrrigation: '2026-10-21' });
    expect(b).toMatchObject({ kind: 'due', dueInDays: 0 });
    const c = irrigationAdvice({ ...base, forecast: makeForecast({}), sowingDate: '2026-08-12', lastIrrigation: '2026-11-05' });
    expect(c).toMatchObject({ kind: 'ok', beyondForecast: true });
  });

  it('rain since the last irrigation refills; skip when rain is coming', () => {
    const wetPast = makeForecast({ daily: (d) => (d === '2026-11-18' ? { precipMm: 100 } : {}) });
    const a = irrigationAdvice({ ...base, forecast: wetPast, sowingDate: '2026-08-12', lastIrrigation: '2026-11-01' });
    expect(a).toMatchObject({ kind: 'ok', deficitMm: 6.9 }); // only the 2 days after the rain count
    const rainComing = makeForecast({ daily: (d) => (d === '2026-11-21' ? { precipMm: 90 } : {}) });
    expect(irrigationAdvice({ ...base, forecast: rainComing, sowingDate: '2026-08-12', lastIrrigation: '2026-11-01' })).toMatchObject({ kind: 'skip', rainMm: 90 });
  });

  it('limited data: last irrigation older than the past-days window, or missing ET0', () => {
    expect(irrigationAdvice({ ...base, forecast: makeForecast({}), sowingDate: '2026-08-12', lastIrrigation: '2026-09-01' })).toEqual({ kind: 'limited' });
    const noEt0 = makeForecast({ daily: (d) => (d === '2026-11-15' ? { et0Mm: null } : {}) });
    expect(irrigationAdvice({ ...base, forecast: noEt0, sowingDate: '2026-08-12', lastIrrigation: '2026-11-10' })).toEqual({ kind: 'limited' });
  });

  it('rice keeps standing water', () => {
    expect(irrigationAdvice({ ...base, crop: 'rice', forecast: makeForecast({}), sowingDate: '2026-10-01', lastIrrigation: null })).toEqual({ kind: 'rice', rainMm: 0 });
  });
});

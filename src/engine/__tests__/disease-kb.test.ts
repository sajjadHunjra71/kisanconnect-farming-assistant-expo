import { DISEASE_KB, UNCLEAR_ID, isHealthyId, kbEntry, kbIdsForCrop, modelClassesForCrop } from '../disease-kb';

describe('disease knowledge base', () => {
  it('ids are unique and prefixed by their crop', () => {
    const ids = DISEASE_KB.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const e of DISEASE_KB) expect(e.id.startsWith(`${e.crop}-`)).toBe(true);
  });

  it('on-device model classes match the plan (incl. healthy + shared unclear)', () => {
    expect(modelClassesForCrop('wheat')).toEqual(['wheat-yellow-rust', 'wheat-brown-rust', 'wheat-septoria', 'wheat-healthy', UNCLEAR_ID]);
    expect(modelClassesForCrop('rice')).toEqual(['rice-blast', 'rice-brown-spot', 'rice-bacterial-leaf-blight', 'rice-healthy', UNCLEAR_ID]);
    expect(modelClassesForCrop('cotton')).toEqual(['cotton-leaf-curl-virus', 'cotton-bacterial-blight', 'cotton-leaf-spot', 'cotton-healthy', UNCLEAR_ID]);
    expect(modelClassesForCrop('maize')).toEqual([UNCLEAR_ID]); // cloud check only
  });

  it('cloud-only entries exist for stem rust, sugarcane and maize', () => {
    expect(kbIdsForCrop('wheat')).toContain('wheat-stem-rust');
    expect(kbIdsForCrop('sugarcane')).toEqual(expect.arrayContaining(['sugarcane-red-rot', 'sugarcane-smut']));
    expect(kbIdsForCrop('maize')).toEqual(expect.arrayContaining(['maize-leaf-blight', 'maize-fall-armyworm']));
  });

  it('every crop has a healthy entry; healthy detection', () => {
    for (const crop of ['wheat', 'rice', 'cotton', 'sugarcane', 'maize'] as const) expect(kbIdsForCrop(crop)).toContain(`${crop}-healthy`);
    expect(isHealthyId('rice-healthy')).toBe(true);
    expect(isHealthyId('rice-blast')).toBe(false);
    expect(kbEntry('nope')).toBeNull();
  });

  it('chemical control is only ever an official quote with source URL + verified date', () => {
    for (const e of DISEASE_KB) {
      if (e.chemical_control === null) continue;
      expect(e.chemical_control.source_url).toMatch(/^https:\/\//);
      expect(e.chemical_control.verified_on).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(e.chemical_control.text.length).toBeGreaterThan(0);
      expect(e.chemical_control.source_name).toMatch(/Agriculture|PARC|Universit|Research/i);
    }
  });

  it('non-chemical guidance has no doses or product names', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { looksLikeTreatment } = require('../dose-filter') as typeof import('../dose-filter');
    for (const e of DISEASE_KB) for (const line of [...e.symptoms, ...e.cultural_control]) expect([e.id, line, looksLikeTreatment(line)]).toEqual([e.id, line, false]);
  });
});

import { makeForecast } from './weather-fixture';
import { buildDiagnosisPrompt, combineResults, DIAGNOSIS_SYSTEM, sanitizeDiagnosis, weatherSummary7d, type AiDiagnosis } from '../scan-diagnosis';
import { REPLACEMENT } from '../dose-filter';

const ai = (over: Partial<AiDiagnosis> = {}): AiDiagnosis => ({
  status: 'ok',
  possible_causes: [{ id: 'wheat-yellow-rust', likelihood: 'high', visible_signs: 'stripes' }],
  questions_to_confirm: [],
  next_steps: [],
  explain: null,
  needs_expert: false,
  ...over,
});

describe('cloud answer contract', () => {
  it('the prompt limits ids to the crop KB + unknown and asks for the JSON format', () => {
    const p = buildDiagnosisPrompt({ crop: 'wheat', stage: null, district: null, weather: null, modelTop: null });
    const ids = p.match(/Allowed ids: (.*)\./)![1];
    expect(ids).toContain('wheat-yellow-rust');
    expect(ids).toContain('unknown');
    expect(ids).not.toContain('rice-blast');
    expect(DIAGNOSIS_SYSTEM).toContain('"possible_causes"');
    expect(DIAGNOSIS_SYSTEM).toContain('ONE JSON object');
  });

  it('sanitizes: unknown ids, sorted by likelihood, deduped, dose-filtered, capped', () => {
    const out = sanitizeDiagnosis(
      {
        status: 'ok',
        possible_causes: [
          { id: 'wheat-septoria', likelihood: 'low', visible_signs: 'blotches' },
          { id: 'rice-blast', likelihood: 'medium', visible_signs: 'x' },
          { id: 'wheat-yellow-rust', likelihood: 'high', visible_signs: 'Spray propiconazole 200 ml per acre' },
          { id: 'wheat-yellow-rust', likelihood: 'low', visible_signs: 'dup' },
        ],
        questions_to_confirm: ['Is the powder yellow?'],
        next_steps: ['Apply fungicide now', 'Check 10 plants'],
        explain: 'Looks like rust.',
        needs_expert: 'yes',
      },
      'wheat',
    );
    expect(out).toEqual({
      status: 'ok',
      possible_causes: [
        { id: 'wheat-yellow-rust', likelihood: 'high', visible_signs: REPLACEMENT },
        { id: 'unknown', likelihood: 'medium', visible_signs: 'x' },
        { id: 'wheat-septoria', likelihood: 'low', visible_signs: 'blotches' },
      ],
      questions_to_confirm: ['Is the powder yellow?'],
      next_steps: [REPLACEMENT, 'Check 10 plants'],
      explain: 'Looks like rust.',
      needs_expert: false,
    });
  });

  it('wrong shape → null (caller retries)', () => {
    expect(sanitizeDiagnosis(null, 'wheat')).toBeNull();
    expect(sanitizeDiagnosis({ status: 'maybe', possible_causes: [] }, 'wheat')).toBeNull();
    expect(sanitizeDiagnosis({ status: 'ok' }, 'wheat')).toBeNull();
  });

  it('prompt has no personal data, only crop context', () => {
    const p = buildDiagnosisPrompt({ crop: 'wheat', stage: 'tillering', district: 'Faisalabad', weather: null, modelTop: [{ id: 'wheat-yellow-rust', p: 0.91 }] });
    expect(p).toContain('Crop: wheat.');
    expect(p).toContain('wheat-yellow-rust 91%');
    expect(p).toContain('wheat-healthy = Healthy wheat leaf');
    expect(p).not.toMatch(/@|lat|lng|farm name/i);
  });

  it('7-day weather summary', () => {
    const f = makeForecast({ daily: (d) => (d === '2026-11-18' ? { precipMm: 6 } : {}) });
    expect(weatherSummary7d(f, '2026-11-20')).toEqual({ days: 7, avgMaxC: 25, avgMinC: 12, rainMm: 6, rainyDays: 1, avgHumidity: 50 });
  });
});

describe('combining model + cloud', () => {
  const model = (id: string, p: number) => [{ id, p }, { id: 'wheat-healthy', p: 1 - p }];
  it('both agree with a confident model → likely', () => {
    expect(combineResults(model('wheat-yellow-rust', 0.9), ai())).toEqual({ status: 'likely', topId: 'wheat-yellow-rust', needsExpert: false });
  });
  it('disagree or weak model → unclear, expert highlighted', () => {
    expect(combineResults(model('wheat-septoria', 0.9), ai()).status).toBe('unclear');
    expect(combineResults(model('wheat-yellow-rust', 0.5), ai())).toMatchObject({ status: 'unclear', needsExpert: true });
  });
  it('cloud only: high → possible (confirm with expert), medium/low → unclear', () => {
    expect(combineResults(null, ai())).toEqual({ status: 'possible', topId: 'wheat-yellow-rust', needsExpert: true });
    expect(combineResults(null, ai({ possible_causes: [{ id: 'wheat-yellow-rust', likelihood: 'medium', visible_signs: null }] })).status).toBe('unclear');
  });
  it('cloud unclear / unknown / not_crop', () => {
    expect(combineResults(null, ai({ status: 'unclear' })).status).toBe('unclear');
    expect(combineResults(null, ai({ possible_causes: [{ id: 'unknown', likelihood: 'high', visible_signs: null }] }))).toEqual({ status: 'unclear', topId: null, needsExpert: true });
    expect(combineResults(model('wheat-yellow-rust', 0.99), ai({ status: 'not_crop' })).status).toBe('not_crop');
  });
  it('model only (offline) → offline check, confirm when online', () => {
    expect(combineResults(model('wheat-yellow-rust', 0.9), null)).toEqual({ status: 'offline', topId: 'wheat-yellow-rust', needsExpert: false });
    expect(combineResults(model('wheat-yellow-rust', 0.6), null)).toEqual({ status: 'offline', topId: null, needsExpert: true });
    expect(combineResults(null, null).status).toBe('unclear');
  });
});

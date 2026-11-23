import { REPLACEMENT, filterAiList, filterAiText, looksLikeTreatment } from '../dose-filter';

describe('dose filter', () => {
  it.each([
    'Apply 250 ml per acre',
    'Use 2.5kg in 100 litres of water',
    'mix 20 g/ 10 l',
    'a 0.1% solution',
    'Spray tebuconazole now',
    'Use a fungicide as soon as possible',
    'apply Mancozeb or copper oxychloride',
    'two bags per acre',
    '500 ppm',
    'Give 1 bag urea',
    'Lambda-cyhalothrin works well',
  ])('replaces %s', (text) => {
    expect(looksLikeTreatment(text)).toBe(true);
    expect(filterAiText(text)).toBe(REPLACEMENT);
  });

  it.each([
    'Check 10 plants in different parts of the field',
    'Look at the underside of the leaves for small white insects',
    'Remove badly affected leaves and keep them out of the field',
    'Ask an agriculture expert to confirm',
    'Yellow stripes along the veins on 3 leaves',
  ])('keeps %s', (text) => {
    expect(filterAiText(text)).toBe(text);
  });

  it('trims, caps length, handles junk', () => {
    expect(filterAiText('  many   spaces  ')).toBe('many spaces');
    expect(filterAiText('a'.repeat(400), 50)).toHaveLength(50);
    expect(filterAiText(42)).toBeNull();
    expect(filterAiText('   ')).toBeNull();
  });

  it('lists: caps count, drops empties, collapses repeated replacements', () => {
    expect(filterAiList(['Spray X', 'Use 2 kg', 'Check leaves', '', 7, 'Ask expert', 'a', 'b'], 4)).toEqual([REPLACEMENT, 'Check leaves', 'Ask expert', 'a']);
    expect(filterAiList('nope')).toEqual([]);
  });
});

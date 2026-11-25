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

  it.each([
    ['spelled-out amount', 'Mix two litres in the tank'],
    ['half a bottle', 'Use half a bottle on the field'],
    ['Urdu script', 'دوائی کا سپرے کریں'],
    ['Urdu digits + unit', '۲۵۰ ملی لیٹر'],
    ['Hindi script', 'दवा छिड़कें'],
    ['zero-width split word', 'spr\u200bay the crop now'],
    ['full-width amount', 'Use ２５０ｍｌ'],
    ['styled letters', 'Use a 𝐟𝐮𝐧𝐠𝐢𝐜𝐢𝐝𝐞 today'],
  ])('blocks %s', (_name, text) => {
    expect(filterAiText(text)).toBe(REPLACEMENT);
  });

  it.each(['Rain on 2 days — check again in a week.', 'Leaves 5–7 cm long, 25°C “typical” signs', 'Check one or two plants in each corner'])(
    'still keeps normal English: %s',
    (text) => {
      expect(filterAiText(text)).toBe(text);
    },
  );
});

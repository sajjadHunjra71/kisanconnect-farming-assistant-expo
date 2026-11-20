import { DEFAULT_NOTIFICATION_PREFS, inQuietHours, normalizePrefs, prefKindFor, shouldNotify } from '../alert-prefs';

describe('notification prefs', () => {
  it('quiet hours across midnight (22:00–06:00)', () => {
    const q = { start: '22:00', end: '06:00' };
    expect(inQuietHours('23:30', q)).toBe(true);
    expect(inQuietHours('02:00', q)).toBe(true);
    expect(inQuietHours('06:00', q)).toBe(false);
    expect(inQuietHours('21:59', q)).toBe(false);
    expect(inQuietHours('13:00', { start: '12:00', end: '14:00' })).toBe(true);
    expect(inQuietHours('13:00', { start: '08:00', end: '08:00' })).toBe(false);
  });

  it('normalizes junk to defaults', () => {
    expect(normalizePrefs(null)).toEqual(DEFAULT_NOTIFICATION_PREFS);
    expect(normalizePrefs({ kinds: { fog: false, frost: 'no' }, quiet_hours: { start: '25:00', end: '07:30' } })).toEqual({
      kinds: { ...DEFAULT_NOTIFICATION_PREFS.kinds, fog: false },
      quiet_hours: { start: '22:00', end: '07:30' },
    });
  });

  it('send / hold during quiet hours / off when the kind is switched off', () => {
    const prefs = normalizePrefs({ kinds: { fog: false } });
    expect(shouldNotify('frost', prefs, '10:00')).toBe('send');
    expect(shouldNotify('frost', prefs, '23:00')).toBe('hold');
    expect(shouldNotify('fog', prefs, '10:00')).toBe('off');
    expect(prefKindFor('wheat-yellow-rust')).toBe('disease');
    expect(shouldNotify('rice-blast', prefs, '10:00')).toBe('send');
  });
});

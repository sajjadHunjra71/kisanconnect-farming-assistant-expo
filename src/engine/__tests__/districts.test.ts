import { PUNJAB_DISTRICTS, districtByName, matchDistrict, searchDistricts } from '../districts';

describe('districts', () => {
  it('has 36 unique districts', () => {
    expect(PUNJAB_DISTRICTS).toHaveLength(36);
    expect(new Set(PUNJAB_DISTRICTS.map((d) => d.key)).size).toBe(36);
  });

  it('matches spelling variants', () => {
    expect(districtByName('D.G. Khan')?.key).toBe('dera-ghazi-khan');
    expect(districtByName('Faisalabad District')?.key).toBe('faisalabad');
    expect(districtByName('Leiah')?.key).toBe('layyah');
    expect(districtByName('Mandi Bahaudin')?.key).toBe('mandi-bahauddin');
    expect(districtByName('Karachi')).toBeNull();
  });

  it('uses geocoder fields in order, then the nearest centre', () => {
    expect(matchDistrict({ subregion: 'Unknown', city: 'Sahiwal', region: 'Punjab' })?.key).toBe('sahiwal');
    expect(matchDistrict({ city: 'Gojra' }, { lat: 31.15, lng: 72.68 })?.key).toBe('toba-tek-singh');
    expect(matchDistrict({ city: 'Karachi' }, { lat: 24.86, lng: 67.01 })).toBeNull();
  });

  it('searches by English, Urdu and alias', () => {
    expect(searchDistricts('lah').map((d) => d.key)).toEqual(['lahore']);
    expect(searchDistricts('ملتان').map((d) => d.key)).toEqual(['multan']);
    expect(searchDistricts('lyallpur').map((d) => d.key)).toEqual(['faisalabad']);
  });
});

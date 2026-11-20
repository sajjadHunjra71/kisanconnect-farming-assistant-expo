import { PUNJAB_DISTRICTS, districtByName, matchDistrict, searchDistricts } from '../districts';

describe('districts', () => {
  it('has 41 unique districts in alphabetical order', () => {
    expect(PUNJAB_DISTRICTS).toHaveLength(41);
    expect(new Set(PUNJAB_DISTRICTS.map((d) => d.key)).size).toBe(41);
    expect(PUNJAB_DISTRICTS.map((d) => d.en)).toEqual([...PUNJAB_DISTRICTS.map((d) => d.en)].sort());
  });

  it('matches spelling variants', () => {
    expect(districtByName('D.G. Khan')?.key).toBe('dera-ghazi-khan');
    expect(districtByName('Faisalabad District')?.key).toBe('faisalabad');
    expect(districtByName('Leiah')?.key).toBe('layyah');
    expect(districtByName('Mandi Bahaudin')?.key).toBe('mandi-bahauddin');
    expect(districtByName('Karachi')).toBeNull();
    expect(districtByName('Taunsa Sharif')?.key).toBe('taunsa');
    expect(districtByName('Murree')?.key).toBe('murree');
  });

  it('uses geocoder fields in order, then the nearest centre', () => {
    expect(matchDistrict({ subregion: 'Unknown', city: 'Sahiwal', region: 'Punjab' })?.key).toBe('sahiwal');
    expect(matchDistrict({ city: 'Gojra' }, { lat: 31.15, lng: 72.68 })?.key).toBe('toba-tek-singh');
    expect(matchDistrict({ city: 'Karachi' }, { lat: 24.86, lng: 67.01 })).toBeNull();
    expect(matchDistrict({ city: 'Bhiwal' }, { lat: 33.9, lng: 73.4 })?.key).toBe('murree');
  });

  it('searches by English, Urdu and alias', () => {
    expect(searchDistricts('lah').map((d) => d.key)).toEqual(['lahore']);
    expect(searchDistricts('ملتان').map((d) => d.key)).toEqual(['multan']);
    expect(searchDistricts('lyallpur').map((d) => d.key)).toEqual(['faisalabad']);
  });
});

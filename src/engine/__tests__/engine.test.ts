import { CROP_CALENDARS, CROP_KEYS } from '../crops-data';
import { cropProgress, expectedHarvestDate } from '../crop-calendar';
import { addDays, daysBetween, isLocalDate, parseLocalDate, toLocalDate } from '../dates';
import { fromAcres, roundArea, toAcres } from '../units';

describe('dates', () => {
  it('parses YYYY-MM-DD as a local calendar day', () => {
    const d = parseLocalDate('2026-03-08');
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 2, 8, 0]);
    expect(toLocalDate(d)).toBe('2026-03-08');
  });

  it('validates real dates only', () => {
    expect(isLocalDate('2026-02-28')).toBe(true);
    expect(isLocalDate('2026-02-30')).toBe(false);
    expect(isLocalDate('2026-2-3')).toBe(false);
  });

  it('counts calendar days across month/year ends', () => {
    expect(daysBetween('2026-11-10', '2026-11-20')).toBe(10);
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
    expect(daysBetween('2026-11-20', '2026-11-10')).toBe(-10);
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
  });
});

describe('units', () => {
  it('converts to acres like the server', () => {
    expect(toAcres(16, 'kanal')).toBe(2);
    expect(toAcres(3, 'acre')).toBe(3);
    expect(roundArea(toAcres(1, 'hectare'), 4)).toBe(2.4711);
    expect(roundArea(fromAcres(2, 'kanal'))).toBe(16);
  });
});

describe('crop calendar', () => {
  it('has varieties and contiguous stages for every crop', () => {
    for (const key of CROP_KEYS) {
      const c = CROP_CALENDARS[key];
      expect(c.indicative).toBe(true);
      expect(c.varieties.length).toBeGreaterThan(0);
      expect(c.stages[0].startDay).toBe(0);
      expect(c.stages[c.stages.length - 1].endDay).toBe(c.seasonDays);
      c.stages.slice(1).forEach((s, i) => expect(s.startDay).toBe(c.stages[i].endDay + 1));
    }
  });

  it('day 0 is the sowing day', () => {
    const p = cropProgress('wheat', '2026-11-20', '2026-11-20');
    expect(p).toMatchObject({ status: 'growing', day: 0, stageIndex: 0 });
  });

  it('finds the current stage', () => {
    const p = cropProgress('wheat', '2026-11-01', '2027-01-10'); // day 70
    expect(p.status).toBe('growing');
    expect(p.day).toBe(70);
    expect(p.stage.key).toBe('jointing');
    if (p.status === 'growing') expect(p.daysLeftInStage).toBe(10);
  });

  it('future sowing date is planned', () => {
    const p = cropProgress('rice', '2026-12-01', '2026-11-20');
    expect(p).toMatchObject({ status: 'planned', daysUntil: 11, progress: 0, day: 0 });
  });

  it('past the season is completed', () => {
    const p = cropProgress('maize', '2026-01-01', '2026-11-20');
    expect(p).toMatchObject({ status: 'completed', progress: 1 });
    expect(p.stage.key).toBe('growth');
  });

  it('last season day is still growing', () => {
    expect(cropProgress('maize', '2026-01-01', addDays('2026-01-01', 110)).status).toBe('growing');
    expect(expectedHarvestDate('maize', '2026-01-01')).toBe('2026-04-21');
  });
});

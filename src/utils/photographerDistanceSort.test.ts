import { describe, expect, it } from 'vitest';
import { comparePhotographerDistance, photographerDistanceMiles } from './photographerDistanceSort';

describe('photographer distance sorting', () => {
  it('sorts numeric strings nearest first, missing/failed results last with name ties', () => {
    const rows = [{ name: 'Zed', distance: undefined }, { name: 'Lee', distance: '3.5' },
      { name: 'Ben', distance: 3.5 }, { name: 'Amy', distance: NaN }, { name: 'Near', distance: 0 },
      { name: 'Error', distance: 'failed' }, { name: 'Far', distance: 12 }];
    expect(rows.sort(comparePhotographerDistance).map(row => row.name)).toEqual(['Near', 'Ben', 'Lee', 'Far', 'Amy', 'Error', 'Zed']);
  });
  it.each([undefined, null, '', '   ', Infinity, NaN, -1, 'failed', false])('rejects unknown mileage %s', value => {
    expect(photographerDistanceMiles(value)).toBeUndefined();
  });
});

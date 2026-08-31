import { describe, expect, it } from 'vitest';
import type { ShootData } from '@/types/shoots';
import { buildWeatherLocationQuery } from './shootDetailsModalHelpers';

describe('buildWeatherLocationQuery address fallbacks', () => {
  it('builds the complete address from legacy top-level fields', () => {
    const shoot = {
      location: {
        address: '',
        city: '',
        state: '',
        zip: '',
        fullAddress: '',
      },
      address: '9137 Lakelandlley Court',
      city: 'Springfield',
      state: 'VA',
      zip: '22153',
    } as unknown as ShootData;

    expect(buildWeatherLocationQuery(shoot)).toBe(
      '9137 Lakelandlley Court, Springfield, VA 22153',
    );
  });

  it('preserves the addressLine and combined city/state/ZIP fallback', () => {
    const shoot = {
      location: {
        address: '',
        city: '',
        state: '',
        zip: '',
        fullAddress: '',
      },
      addressLine: '20828 Cross Timber Drive',
      cityStateZip: 'Ashburn, VA 20147',
    } as unknown as ShootData;

    expect(buildWeatherLocationQuery(shoot)).toBe(
      '20828 Cross Timber Drive, Ashburn, VA 20147',
    );
  });

  it('merges mixed structured city and combined regional fields without duplication', () => {
    const shoot = {
      location: {
        address: '',
        city: '',
        state: '',
        zip: '',
        fullAddress: '',
      },
      address: '9137 Lakelandlley Court',
      city: 'Springfield',
      cityStateZip: 'Springfield, VA 22153',
    } as unknown as ShootData;

    expect(buildWeatherLocationQuery(shoot)).toBe(
      '9137 Lakelandlley Court, Springfield, VA 22153',
    );
  });
});

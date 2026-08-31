import { describe, expect, it } from 'vitest';
import type { ShootData } from '@/types/shoots';
import {
  buildWeatherLocationQuery,
  getShootDetailsAddressTitle,
  getShootStreetAddress,
} from './shootDetailsModalHelpers';

describe('shoot details street address', () => {
  it('preserves VA at the start of Valley in a structured street address', () => {
    const shoot = {
      location: {
        address: '9137 Lakeland Valley Court',
        city: 'Springfield',
        state: 'VA',
        zip: '22153',
        fullAddress: '9137 Lakeland Valley Court, Springfield, VA 22153',
      },
    } as ShootData;

    expect(getShootStreetAddress(shoot)).toBe('9137 Lakeland Valley Court');
    expect(getShootDetailsAddressTitle(shoot)).toBe('9137 Lakeland Valley Court');
  });

  it('removes only exact trailing locality segments from a full-address fallback', () => {
    const shoot = {
      location: {
        address: '',
        city: 'Springfield',
        state: 'VA',
        zip: '22153',
        fullAddress: '9137 Lakeland Valley Court, Springfield, VA 22153',
      },
    } as ShootData;

    expect(getShootStreetAddress(shoot)).toBe('9137 Lakeland Valley Court');
  });

  it('supports the legacy comma before ZIP without changing street substrings', () => {
    const shoot = {
      location: {
        address: '',
        city: 'Springfield',
        state: 'VA',
        zip: '22153',
        fullAddress: '725 Savannah Avenue, Springfield, VA, 22153',
      },
    } as ShootData;

    expect(getShootStreetAddress(shoot)).toBe('725 Savannah Avenue');
  });

  it('escapes punctuation in locality names before matching the suffix', () => {
    const shoot = {
      location: {
        address: '',
        city: 'St. Louis',
        state: 'MO',
        zip: '63101',
        fullAddress: '12 Valley View, St. Louis, MO 63101',
      },
    } as ShootData;

    expect(getShootStreetAddress(shoot)).toBe('12 Valley View');
  });

  it('does not strip a locality word unless it is a comma-delimited suffix', () => {
    const shoot = {
      location: {
        address: '',
        city: 'Springfield',
        state: '',
        zip: '',
        fullAddress: '123 Springfield',
      },
    } as ShootData;

    expect(getShootStreetAddress(shoot)).toBe('123 Springfield');
  });
});

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
      address: '9137 Lakeland Valley Court',
      city: 'Springfield',
      state: 'VA',
      zip: '22153',
    } as unknown as ShootData;

    expect(buildWeatherLocationQuery(shoot)).toBe(
      '9137 Lakeland Valley Court, Springfield, VA 22153',
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
      address: '9137 Lakeland Valley Court',
      city: 'Springfield',
      cityStateZip: 'Springfield, VA 22153',
    } as unknown as ShootData;

    expect(buildWeatherLocationQuery(shoot)).toBe(
      '9137 Lakeland Valley Court, Springfield, VA 22153',
    );
  });
});

import { describe, expect, it } from 'vitest';
import {
  formatUnitLabel,
  streetContainsUnit,
  streetWithAptSuite,
} from './shootAddressDisplay';

describe('shootAddressDisplay', () => {
  it('matches complete unit labels without truncating apartment or hyphenated units', () => {
    expect(streetContainsUnit('10 Main St Apartment 103', 'Apartment 103')).toBe(true);
    expect(streetContainsUnit('10 Main St Apt 1-A', '1')).toBe(false);
    expect(formatUnitLabel('# 12')).toBe('# 12');
    expect(formatUnitLabel('Unity')).toBe('Unit Unity');
  });
  it('appends Unit when aptSuite is missing from the street', () => {
    expect(streetWithAptSuite('15 Rainflower Path', { aptSuite: '103' })).toBe(
      '15 Rainflower Path, Unit 103',
    );
  });

  it('reads apt_suite snake_case', () => {
    expect(streetWithAptSuite('900 N Stafford Street', { apt_suite: '1819' })).toBe(
      '900 N Stafford Street, Unit 1819',
    );
  });

  it('does not double a hash unit already on the street', () => {
    expect(streetWithAptSuite('6636 Washington Blvd #93', { aptSuite: '93' })).toBe(
      '6636 Washington Blvd #93',
    );
  });

  it('does not double a Unit word already on the street', () => {
    expect(streetWithAptSuite('12800 Middlebrook Road Unit 206', { aptSuite: '206' })).toBe(
      '12800 Middlebrook Road Unit 206',
    );
  });

  it('keeps a prelabeled aptSuite value', () => {
    expect(formatUnitLabel('Unit 4')).toBe('Unit 4');
    expect(streetWithAptSuite('10 Monroe St', { aptSuite: 'Unit 4' })).toBe(
      '10 Monroe St, Unit 4',
    );
  });

  it('detects suite/apt designators', () => {
    expect(streetContainsUnit('11815 Breton Court Apt 103', '103')).toBe(true);
    expect(streetContainsUnit('11815 Breton Court', '103')).toBe(false);
  });
});

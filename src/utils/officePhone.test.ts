import { describe, expect, it } from 'vitest';
import {
  brandedTourOfficePhone,
  readOfficePhone,
  readShowOfficePhoneOnTour,
} from './officePhone';

describe('office phone', () => {
  it('reads the locked API key and treats a missing tour flag as shown', () => {
    expect(readOfficePhone({ office_phone: ' 202-555-0100 ' })).toBe('202-555-0100');
    expect(readOfficePhone({})).toBe('');
    expect(readShowOfficePhoneOnTour({ office_phone: '202-555-0100' })).toBe(true);
    expect(readShowOfficePhoneOnTour({ show_office_phone_on_tour: false })).toBe(false);
    expect(readShowOfficePhoneOnTour({ show_office_phone_on_tour: '0' })).toBe(false);
  });

  it('shows a tour number only when it is present and not explicitly hidden', () => {
    expect(brandedTourOfficePhone({ office_phone: '202-555-0199' })).toBe('202-555-0199');
    expect(brandedTourOfficePhone({ office_phone: '202-555-0199', show_office_phone_on_tour: true })).toBe('202-555-0199');
    expect(brandedTourOfficePhone({ office_phone: '202-555-0199', show_office_phone_on_tour: false })).toBe('');
    expect(brandedTourOfficePhone({ show_office_phone_on_tour: true })).toBe('');
  });
});

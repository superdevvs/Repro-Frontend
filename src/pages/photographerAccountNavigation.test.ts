import { describe, expect, it } from 'vitest';
import { photographerSettingsDestination, resolvePhotographerAccountTab } from './photographerAccountNavigation';

describe('photographer account navigation', () => {
  it.each([
    ['', 'work'], ['tab=profile', 'personal'], ['tab=account', 'security'],
    ['tab=preferences', 'work'], ['tab=notifications', 'notifications'],
    ['tab=equipment', 'equipments'], ['tab=unknown', 'work'],
  ])('opens the matching account section from Settings (%s)', (search, tab) => {
    expect(photographerSettingsDestination(new URLSearchParams(search))).toBe(`/photographer-account?tab=${tab}`);
  });

  it('preserves the recipient and verification context of existing equipment links', () => {
    const destination = photographerSettingsDestination(new URLSearchParams('tab=personal&verify=equipment&photographer_id=42'));
    expect(destination).toBe('/photographer-account?tab=equipments&verify=equipment&photographer_id=42');
  });

  it('opens Profile for missing or unsupported profile sections', () => {
    expect(resolvePhotographerAccountTab(new URLSearchParams())).toBe('personal');
    expect(resolvePhotographerAccountTab(new URLSearchParams('tab=unknown'))).toBe('personal');
  });
});

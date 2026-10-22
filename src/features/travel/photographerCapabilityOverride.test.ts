import { describe, expect, it } from 'vitest';
import { canConfirmTravelException, canConfirmWorkingHoursException } from './useTravelSaveConfirmation';
import { canConfirmForceSave } from './useForceSaveConfirmation';
import type { TravelFeasibility } from './types';

describe('photographer capability remains non-overridable', () => {
  const response: TravelFeasibility = {
    enabled: true, status: 'conflict', available: false, reason_codes: ['photographer_category_capability_missing'],
    transitions: [], alternatives: [], can_override: true, confirmation_version: 'fixture',
    can_force_save: true, force_save_confirmation_version: 'fixture', can_override_working_hours: true,
    working_hours_confirmation_version: 'fixture', policy_version: 'fixture', schedule_version: 'fixture',
  };
  it('rejects malformed override permissions for a capability failure in every confirmation lane', () => {
    expect(canConfirmTravelException(response, false)).toBe(false);
    expect(canConfirmForceSave(response, { shoot_id: 1, action_mode: 'update' }, false)).toBe(false);
    expect(canConfirmWorkingHoursException({ ...response, reason_codes: [...response.reason_codes, 'outside_working_hours'] },
      { shoot_id: 1, action_mode: 'update' }, false)).toBe(false);
  });
  it('allows deliberate location and radius exceptions when the server grants them', () => {
    expect(canConfirmTravelException({ ...response, reason_codes: ['outside_service_radius'] }, false)).toBe(true);
    expect(canConfirmTravelException({ ...response, reason_codes: ['service_radius_unverified'] }, false)).toBe(true);
    expect(canConfirmTravelException({ ...response, reason_codes: ['outside_service_radius'] }, true)).toBe(false);
  });
});

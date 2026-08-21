import { describe, expect, it } from 'vitest';

import { canUseProtectedAvailabilityRoutes } from './schedulingModel';

describe('client booking availability route policy', () => {
  it('never permits clients or anonymous callers to use protected availability routes', () => {
    expect(canUseProtectedAvailabilityRoutes(null)).toBe(false);
    expect(canUseProtectedAvailabilityRoutes(undefined)).toBe(false);
    expect(canUseProtectedAvailabilityRoutes({ role: 'client' })).toBe(false);
    expect(canUseProtectedAvailabilityRoutes({ role: 'CLIENT' })).toBe(false);
  });

  it.each(['admin', 'superadmin', 'editing_manager', 'photographer', 'editor'])(
    'retains protected availability-management access for %s',
    (role) => {
      expect(canUseProtectedAvailabilityRoutes({ role })).toBe(true);
    },
  );
});

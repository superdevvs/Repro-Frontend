import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { transformShootFromApi } from '@/context/shootNormalization';
import { hasRestrictedSalesRepRole } from '@/utils/shootManagementAccess';
import { useShootDetailsController } from './useShootDetailsController';

afterEach(cleanup);

describe('secondary office roles grant booking controls independently of production', () => {
  it.each(['admin', 'editing-manager', 'super_admin'])('does not demote a secondary %s role when sales is also present', role => {
    expect(hasRestrictedSalesRepRole({ role: 'editor', secondary_roles: [role, 'sales_rep'] })).toBe(false);
  });

  it.each(['editor', 'photographer', 'client'])('uses the server booking grant for primary %s without adding admin controls', role => {
    const shoot = transformShootFromApi({ id: 5866, status: 'scheduled', workflow_status: 'scheduled', canManageBooking: true });
    const { result } = renderHook(() => useShootDetailsController({ authRole: role, shoot,
      editorUser: { role, secondary_roles: ['admin', 'sales_rep'] } }));
    expect(result.current.roleFlags.isAdmin).toBe(false);
    expect(result.current.roleFlags.isRep).toBe(false);
    expect(result.current.capabilities.canAdminEdit).toBe(true);
    expect(result.current.capabilities.canFinalise).toBe(false);
  });

  it('keeps an explicit server booking denial authoritative for a secondary office role', () => {
    const shoot = transformShootFromApi({ id: 5866, status: 'scheduled', canManageBooking: false });
    const { result } = renderHook(() => useShootDetailsController({ authRole: 'editor', shoot,
      editorUser: { role: 'editor', secondary_roles: ['admin', 'sales_rep'] } }));
    expect(result.current.capabilities.canAdminEdit).toBe(false);
  });
});

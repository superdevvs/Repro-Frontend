import { describe, expect, it } from 'vitest';
import { canSendShootManualNotification, getShootDetailsCapabilities } from './shootDetailsCapabilities';
import type { ShootData } from '@/types/shoots';
import { hasRestrictedSalesRepRole } from '@/utils/shootManagementAccess';
const roles = { isAdmin:false, isAdminOrRep:true, isClient:false, isEditor:false,
  isEditingManager:false, isPhotographer:false, isRep:true };
const capabilities = (shoot: Partial<ShootData>) => getShootDetailsCapabilities({
  shoot: {id:'fixture',status:'scheduled',...shoot} as ShootData,
  currentUserRole:'salesRep',roleFlags:roles,
});
describe('Rep management controls', () => {
  it.each(['isEditor', 'isPhotographer', 'isClient'] as const)('keeps Notify for a rep whose primary role is %s', primaryFlag => {
    expect(canSendShootManualNotification({ ...roles, [primaryFlag]: true })).toBe(true);
    expect(canSendShootManualNotification({ ...roles, isRep: false, [primaryFlag]: true })).toBe(false);
  });
  it.each(['isAdmin', 'isEditingManager'] as const)('preserves Notify for %s without a rep role', staffFlag => {
    expect(canSendShootManualNotification({ ...roles, isRep: false, [staffFlag]: true })).toBe(true);
  });
  it('allows direct booking edits and cancellation, not production actions', () => {
    const result = capabilities({canManageBooking:true,canManageShootActions:true});
    expect(result.canAdminEdit).toBe(true);
    expect(result.canDirectHold).toBe(true);
    expect(result.canCancelShoot).toBe(true);
    expect(result.cancelActionLabel).toBe('Cancel shoot');
    expect(result.canRequestCancellation).toBe(false);
    expect(result.canFinalise).toBe(false);
    expect(result.canSendToEditing).toBe(false);
    expect(result.canApproveEditingReview).toBe(false);
  });
  it('honors explicit denied edit and management permissions', () => {
    const result=capabilities({canManageBooking:false,canManageShootActions:false});
    expect(result.canAdminEdit).toBe(false);
    expect(result.canDirectHold).toBe(false);
  });
  it('keeps booking hold controls for an editor with a secondary rep role', () => {
    const result = getShootDetailsCapabilities({
      shoot: {id:'fixture',status:'scheduled',canManageShootActions:true} as ShootData,
      currentUserRole:'editor',roleFlags:{...roles,isEditor:true},
    });
    expect(result.canDirectHold).toBe(true);
    expect(result.canSendToEditing).toBe(false);
  });
  it('does not expose cancellation or deletion of delivered shoots', () => {
    const result=capabilities({status:'delivered',canManageBooking:false,canManageShootActions:true});
    expect(result.canAdminEdit).toBe(false);
    expect(result.canCancelShoot).toBe(false);
  });
  it.each(['admin', 'superadmin', 'editing_manager'])('preserves delivered-shoot staff controls for %s with an additional rep role', role => {
    const result = getShootDetailsCapabilities({
      shoot: { id: 'fixture', status: 'delivered', canManageBooking: true } as ShootData,
      currentUserRole: role,
      roleFlags: { ...roles, isAdmin: true, isEditingManager: role === 'editing_manager',
        isRep: hasRestrictedSalesRepRole({ role, secondary_roles: ['sales_rep'] }) },
    });
    expect(result.canAdminEdit).toBe(true);
  });
});

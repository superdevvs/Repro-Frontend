import { describe, expect, it } from 'vitest';
import { getShootDetailsCapabilities } from './shootDetailsCapabilities';
import type { ShootData } from '@/types/shoots';
const roles = { isAdmin:false, isAdminOrRep:true, isClient:false, isEditor:false,
  isEditingManager:false, isPhotographer:false, isRep:true };
const capabilities = (shoot: Partial<ShootData>) => getShootDetailsCapabilities({
  shoot: {id:'fixture',status:'scheduled',...shoot} as ShootData,
  currentUserRole:'salesRep',roleFlags:roles,
});
describe('Rep management controls', () => {
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
});

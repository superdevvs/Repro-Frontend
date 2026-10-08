import { describe, expect, it } from 'vitest';
import type { ShootData } from '@/types/shoots';
import { getShootDetailsCapabilities } from './shootDetailsCapabilities';

const capabilitiesFor = (role: string) => getShootDetailsCapabilities({
  shoot: {
    id: 86,
    status: 'scheduled',
    workflowStatus: 'scheduled',
    rawPhotoCount: 0,
    editedPhotoCount: 29,
  } as unknown as ShootData,
  currentUserRole: role,
  roleFlags: {
    isAdmin: ['admin', 'superadmin', 'editing_manager'].includes(role),
    isAdminOrRep: ['admin', 'superadmin', 'editing_manager', 'rep'].includes(role),
    isEditingManager: role === 'editing_manager',
    isRep: role === 'rep',
    isPhotographer: role === 'photographer',
    isEditor: role === 'editor',
    isClient: role === 'client',
  },
});

describe('scheduled shoot with directly uploaded edits', () => {
  it('offers Finalize to delivery roles without requiring raw submission or editing', () => {
    for (const role of ['admin', 'superadmin', 'editing_manager']) {
      const capabilities = capabilitiesFor(role);

      expect(capabilities.canFinalise).toBe(true);
      expect(capabilities.canFastForwardFinalise).toBe(false);
      expect(capabilities.canSendToEditing).toBe(false);
    }
  });

  it('keeps the delivery action hidden for other roles', () => {
    for (const role of ['client', 'rep', 'photographer', 'editor']) {
      expect(capabilitiesFor(role).canFinalise).toBe(false);
    }
  });
});

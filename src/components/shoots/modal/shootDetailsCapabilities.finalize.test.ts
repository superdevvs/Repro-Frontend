import { describe, expect, it } from 'vitest';
import type { ShootData } from '@/types/shoots';
import { getShootDetailsCapabilities } from './shootDetailsCapabilities';

const capabilitiesFor = (role: string, editedPhotoCount = 29, status = 'scheduled', canFinalizeDelivery?: boolean) => getShootDetailsCapabilities({
  shoot: {
    id: 86,
    status,
    workflowStatus: status,
    rawPhotoCount: 0,
    editedPhotoCount,
    canFinalizeNoMedia: false,
    canFinalizeDelivery,
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
  it('shows supplemental delivery only when the server finds outstanding delivery work', () => {
    for (const role of ['admin', 'superadmin', 'editing_manager']) {
      expect(capabilitiesFor(role, 32, 'delivered', true).canFinalise).toBe(true);
      expect(capabilitiesFor(role, 32, 'delivered', false).canFinalise).toBe(false);
      expect(capabilitiesFor(role, 32, 'delivered').canFinalise).toBe(false);
      expect(capabilitiesFor(role, 32, 'ready', false).canFinalise).toBe(false);
      expect(capabilitiesFor(role, 32, 'cancelled').canFinalise).toBe(false);
    }
    for (const role of ['client', 'rep', 'photographer', 'editor']) {
      expect(capabilitiesFor(role, 32, 'delivered', true).canFinalise).toBe(false);
    }
  });
  it('offers Finalize to delivery roles without requiring raw submission or editing', () => {
    for (const role of ['admin', 'superadmin', 'editing_manager']) {
      const capabilities = capabilitiesFor(role);

      expect(capabilities.canFinalise).toBe(true);
      expect(capabilities.canFastForwardFinalise).toBe(false);
      expect(capabilities.canSendToEditing).toBe(role === 'editing_manager');
    }
  });

  it('keeps the delivery action hidden for other roles', () => {
    for (const role of ['client', 'rep', 'photographer', 'editor']) {
      expect(capabilitiesFor(role).canFinalise).toBe(false);
    }
  });
  it('keeps delivery review reachable for a Scheduled provider-only shoot with no uploaded files', () => {
    for (const role of ['admin', 'superadmin', 'editing_manager']) {
      expect(capabilitiesFor(role, 0).canFinalise).toBe(true);
      expect(capabilitiesFor(role, 0).canFastForwardFinalise).toBe(false);
    }
  });
});

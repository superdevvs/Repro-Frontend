import { describe, expect, it } from 'vitest';

import type { ShootData } from '@/types/shoots';
import { getShootDetailsCapabilities } from './shootDetailsCapabilities';
import type { ShootDetailsRoleFlags } from './shootDetailsTypes';

type TestRole = 'client' | 'photographer' | 'editor' | 'editing_manager' | 'admin';

const flagsFor = (role: TestRole): ShootDetailsRoleFlags => ({
  isEditingManager: role === 'editing_manager',
  isAdmin: role === 'admin' || role === 'editing_manager',
  isRep: false,
  isAdminOrRep: role === 'admin' || role === 'editing_manager',
  isPhotographer: role === 'photographer',
  isEditor: role === 'editor',
  isClient: role === 'client',
});

const capabilitiesFor = (
  shoot: Partial<ShootData>,
  role: TestRole,
) => getShootDetailsCapabilities({
  shoot: { id: 501, ...shoot } as ShootData,
  currentUserRole: role,
  roleFlags: flagsFor(role),
  userId: 42,
});

describe('shoot invoice capability gating', () => {
  it('shows the invoice to an authorized delivered client', () => {
    expect(capabilitiesFor({
      workflowStatus: 'delivered',
      canViewInvoice: true,
    }, 'client').canShowInvoiceButton).toBe(true);
  });

  it('honors a server denial for clients and production roles that cannot view invoices', () => {
    expect(capabilitiesFor({
      workflowStatus: 'delivered',
      can_view_invoice: false,
    }, 'client').canShowInvoiceButton).toBe(false);
    expect(capabilitiesFor({
      workflowStatus: 'delivered',
      canViewInvoice: false,
    }, 'photographer').canShowInvoiceButton).toBe(false);
    expect(capabilitiesFor({
      workflowStatus: 'editing',
      canViewInvoice: false,
    }, 'editor').canShowInvoiceButton).toBe(false);
  });

  it('does not show a client invoice before delivery even if the capability is advertised', () => {
    expect(capabilitiesFor({
      workflowStatus: 'scheduled',
      canViewInvoice: true,
    }, 'client').canShowInvoiceButton).toBe(false);
  });

  it('keeps the compatibility fallback for old backend payloads', () => {
    expect(capabilitiesFor({ workflowStatus: 'delivered' }, 'client').canShowInvoiceButton).toBe(true);
    expect(capabilitiesFor({ workflowStatus: 'scheduled' }, 'client').canShowInvoiceButton).toBe(false);
    expect(capabilitiesFor({ workflowStatus: 'uploaded' }, 'admin').canShowInvoiceButton).toBe(true);
  });
});

describe('shoot no-media finalisation capability gating', () => {
  it('offers finalisation in later workflow states when the server capability allows it', () => {
    for (const workflowStatus of ['uploaded', 'editing', 'ready']) {
      const capabilities = capabilitiesFor({
        workflowStatus,
        rawPhotoCount: 0,
        editedPhotoCount: 0,
        canFinalizeNoMedia: true,
      }, 'admin');

      expect(capabilities.canFinalise).toBe(true);
      expect(capabilities.canFastForwardFinalise).toBe(true);
    }
  });

  it('honors the role-specific server denial for editing managers', () => {
    const capabilities = capabilitiesFor({
      workflowStatus: 'ready',
      rawPhotoCount: 0,
      editedPhotoCount: 0,
      can_finalize_no_media: false,
    }, 'editing_manager');

    expect(capabilities.canFinalise).toBe(false);
    expect(capabilities.canFastForwardFinalise).toBe(false);
  });

  it('keeps ordinary edited-media finalisation available to editing managers', () => {
    expect(capabilitiesFor({
      workflowStatus: 'ready',
      editedPhotoCount: 4,
      canFinalizeNoMedia: false,
    }, 'editing_manager').canFinalise).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';

import type { ShootData } from '@/types/shoots';
import { getShootDetailsCapabilities } from './shootDetailsCapabilities';
import type { ShootDetailsRoleFlags } from './shootDetailsTypes';

const flagsFor = (role: 'client' | 'photographer' | 'editor' | 'admin'): ShootDetailsRoleFlags => ({
  isEditingManager: false,
  isAdmin: role === 'admin',
  isRep: false,
  isAdminOrRep: role === 'admin',
  isPhotographer: role === 'photographer',
  isEditor: role === 'editor',
  isClient: role === 'client',
});

const capabilitiesFor = (
  shoot: Partial<ShootData>,
  role: 'client' | 'photographer' | 'editor' | 'admin',
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

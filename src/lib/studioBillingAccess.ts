import type { StudioAccount } from '@/types/listingStudioClient';
import type { StudioManagedAccount } from '@/types/listingStudioStaff';

/** Financial access follows the account's primary role, never a secondary-role hint. */
export function studioBillingRole(role?: string | null): string {
  const normalized = (role ?? '').trim().toLowerCase().replace(/[_\s-]/g, '');
  return ['rep', 'representative', 'salesrep'].includes(normalized) ? 'salesrep' : normalized;
}

export function canManageStudioBilling(role?: string | null): boolean {
  return ['salesrep', 'superadmin'].includes(studioBillingRole(role));
}

export function isStudioManagedAccount(account: StudioAccount | undefined): account is StudioManagedAccount {
  const value = account as Partial<StudioManagedAccount> | undefined;
  return typeof value?.client?.id === 'string' && typeof value.client.name === 'string'
    && typeof value.client.email === 'string' && typeof value.management?.canPurchase === 'boolean';
}

export const STUDIO_FINANCIAL_QUERY_ROOTS = [
  'studio-client', 'studio-managed-client', 'studio-managed-clients', 'studio-payment-requests',
] as const;

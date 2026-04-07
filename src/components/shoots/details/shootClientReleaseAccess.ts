import type { ShootData } from '@/types/shoots';
import { normalizeShootPaymentSummary } from '@/utils/shootPaymentSummary';

type CanonicalPaymentStatus = 'paid' | 'unpaid' | 'partial' | null;

const resolveBypassPaywall = (shoot: ShootData | null): boolean =>
  Boolean((shoot as any)?.bypassPaywall ?? (shoot as any)?.bypass_paywall);

export interface ShootClientReleaseAccess {
  paymentStatus: CanonicalPaymentStatus;
  isBypassPaywall: boolean;
  isPaidInFull: boolean;
  isClientReleaseLocked: boolean;
  canClientDownload: boolean;
  canClientAccessTours: boolean;
  shouldUseWatermarkedMessaging: boolean;
}

export const getShootClientReleaseAccess = (
  shoot: ShootData | null,
  isClient: boolean,
): ShootClientReleaseAccess => {
  const paymentSummary = shoot ? normalizeShootPaymentSummary(shoot) : null;
  const paymentStatus = paymentSummary?.paymentStatus ?? null;
  const isBypassPaywall = resolveBypassPaywall(shoot);
  const isPaidInFull = paymentStatus === 'paid' || isBypassPaywall;
  const isClientReleaseLocked = Boolean(isClient && shoot && !isPaidInFull);

  return {
    paymentStatus,
    isBypassPaywall,
    isPaidInFull,
    isClientReleaseLocked,
    canClientDownload: !isClientReleaseLocked,
    canClientAccessTours: !isClientReleaseLocked,
    shouldUseWatermarkedMessaging: isClientReleaseLocked,
  };
};

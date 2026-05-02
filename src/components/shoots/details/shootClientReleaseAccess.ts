import type { ShootData } from '@/types/shoots';
import { normalizeShootPaymentSummary } from '@/utils/shootPaymentSummary';
import { getShootServiceItems } from '@/utils/shootServiceItems';

type CanonicalPaymentStatus = 'paid' | 'unpaid' | 'partial' | null;

const resolveBypassPaywall = (shoot: ShootData | null): boolean =>
  Boolean((shoot as any)?.bypassPaywall ?? (shoot as any)?.bypass_paywall);

export interface ShootClientReleaseAccess {
  paymentStatus: CanonicalPaymentStatus;
  isBypassPaywall: boolean;
  isPaidInFull: boolean;
  isClientReleaseLocked: boolean;
  hasUnlockedServiceDownloads: boolean;
  canClientDownload: boolean;
  canClientDownloadWholeShoot: boolean;
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
  const hasUnlockedServiceDownloads = Boolean(
    isClient &&
      shoot &&
      getShootServiceItems(shoot).some((item) =>
        item.isDeliverable &&
        item.isUnlockedForDelivery &&
        ['ready', 'delivered'].includes(String(item.deliveryStatus ?? '').toLowerCase()) &&
        item.workflowStatus !== 'cancelled',
      ),
  );

  return {
    paymentStatus,
    isBypassPaywall,
    isPaidInFull,
    isClientReleaseLocked,
    hasUnlockedServiceDownloads,
    canClientDownload: !isClientReleaseLocked || hasUnlockedServiceDownloads,
    canClientDownloadWholeShoot: !isClientReleaseLocked,
    canClientAccessTours: !isClientReleaseLocked,
    shouldUseWatermarkedMessaging: isClientReleaseLocked,
  };
};

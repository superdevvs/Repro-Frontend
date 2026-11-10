import type { ShootData } from '@/types/shoots';
import { normalizeShootPaymentSummary } from '@/utils/shootPaymentSummary';
import { getShootServiceItems } from '@/utils/shootServiceItems';
import { getShootUnits } from '@/features/shoot-units/shootUnitData';
import { serviceDeliveryComponents, serviceHasReleasedContent } from '@/utils/shootDeliveryProgress';

type CanonicalPaymentStatus = 'paid' | 'unpaid' | 'partial' | null;

const resolveBypassPaywall = (shoot: ShootData | null): boolean =>
  Boolean(shoot?.bypassPaywall ?? shoot?.bypass_paywall);

/** Provider shortcuts must follow the booked tour's own payment and release. */
export const canClientOpenIguide = (shoot: ShootData | null): boolean => {
  if (!shoot || ['cancelled', 'canceled', 'declined'].includes(shoot.workflowStatus ?? shoot.status ?? '')) return false;
  const paid = normalizeShootPaymentSummary(shoot).paymentStatus === 'paid' || resolveBypassPaywall(shoot);
  const items = getShootServiceItems(shoot);
  if (!items.length) return paid;
  return items.some(item => {
    if (!item.isDeliverable || item.isInvoiceAdjustment || (!paid && !item.isUnlockedForDelivery)
      || !/iguide|i[ -]?guide|\b3d\b/i.test(item.name)) return false;
    const components = serviceDeliveryComponents(item);
    return components.some(component => ['tour', 'legacy'].includes(component.kind)
      && component.status === 'delivered' && !component.without_content);
  });
};

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
  const units = getShootUnits(shoot);
  const hasUnlockedServiceDownloads = Boolean(
    isClient &&
      shoot &&
      getShootServiceItems(shoot).some((item) =>
        item.isDeliverable &&
        item.isUnlockedForDelivery &&
        (serviceHasReleasedContent(item) || ['ready', 'delivered'].includes(String(item.deliveryStatus ?? '').toLowerCase())) &&
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
    canClientAccessTours: !isClient || (units.length ? units.some(unit => Number(unit.ready_service_count) > 0) || hasUnlockedServiceDownloads : !isClientReleaseLocked || hasUnlockedServiceDownloads),
    shouldUseWatermarkedMessaging: isClientReleaseLocked,
  };
};

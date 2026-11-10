import type { ShootData } from '@/types/shoots';
import { getShootServiceItems, type NormalizedShootServiceItem } from './shootServiceItems';

export type DeliveryProgressComponent = {
  kind: string; label: string; status: string; without_content?: boolean;
};

export function serviceDeliveryComponents(item: NormalizedShootServiceItem): DeliveryProgressComponent[] {
  if (!item.isDeliverable || item.isInvoiceAdjustment || ['cancelled', 'canceled'].includes(item.workflowStatus ?? '')
    || ['cancelled', 'canceled'].includes(item.deliveryStatus ?? '')) return [];
  const components = item.source.delivery_components;
  if (Array.isArray(components) && components.length) return components.filter(component => component.status !== 'cancelled');
  const delivered = item.deliveryStatus === 'delivered' || !item.deliveryStatus && item.workflowStatus === 'delivered';
  return [{ kind: 'legacy', label: item.name, status: delivered ? 'delivered' : 'pending' }];
}

export const serviceHasReleasedContent = (item: NormalizedShootServiceItem) =>
  serviceDeliveryComponents(item).some(component => component.status === 'delivered' && !component.without_content);

export function getShootDeliveryProgress(shoot: ShootData | null) {
  const services = shoot ? getShootServiceItems(shoot).map(item => ({ item, components: serviceDeliveryComponents(item) }))
    .filter(service => service.components.length > 0) : [];
  const delivered = services.filter(service => service.components.every(component => component.status === 'delivered')).length;
  const hasReleasedContent = services.some(service => serviceHasReleasedContent(service.item));
  const storedPartial = shoot?.deliveryStatus === 'partially_delivered';
  const cancelled = ['cancelled', 'canceled', 'declined'].includes(shoot?.workflowStatus ?? shoot?.status ?? '');
  return {
    services, delivered, total: services.length,
    hasReleasedContent: !cancelled && (hasReleasedContent || storedPartial),
    isDelivering: !cancelled && (storedPartial || hasReleasedContent && delivered < services.length),
  };
}

export function clientServicePaymentText(item: NormalizedShootServiceItem, shootPaid = false, showLineBalance = true) {
  if (shootPaid || item.isUnlockedForDelivery) return item.balanceDue > 0.01 && !shootPaid ? 'Access granted' : 'Paid';
  // Allocations use the service price; order discounts, tax and adjustments
  // belong to the existing invoice balance, not a guessed per-service charge.
  if (!showLineBalance) return item.paidAmount > 0 ? 'Part-paid' : 'Unpaid';
  const dollars = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
  return item.paidAmount > 0 ? `${dollars(item.paidAmount)} paid · ${dollars(item.balanceDue)} due` : `${dollars(item.balanceDue)} due`;
}


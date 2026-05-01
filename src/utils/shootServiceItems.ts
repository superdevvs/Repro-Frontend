import type { ShootData, ShootServiceObject } from '@/types/shoots';

export type NormalizedShootServiceItem = {
  id: string;
  serviceId?: string;
  name: string;
  scheduledAt?: string | null;
  photographerName?: string | null;
  editorName?: string | null;
  workflowStatus?: string | null;
  deliveryStatus?: string | null;
  paymentStatus?: string | null;
  unlockState?: string | null;
  isUnlockedForDelivery: boolean;
  isDeliverable: boolean;
  subtotal: number;
  paidAmount: number;
  balanceDue: number;
  source: ShootServiceObject;
};

const toNumber = (value: unknown, fallback = 0): number => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const toOptionalString = (value: unknown): string | undefined => {
  if (value === null || value === undefined) return undefined;
  const normalized = String(value).trim();
  return normalized ? normalized : undefined;
};

const toBoolean = (value: unknown, fallback = false): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
  }
  return fallback;
};

export const formatServiceItemStatus = (value?: string | null): string => {
  if (!value) return 'Not started';
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

export const getShootServiceItemId = (item: Partial<ShootServiceObject>): string | undefined =>
  toOptionalString(item.shoot_service_id ?? item.shootServiceId);

export const normalizeShootServiceItem = (item: ShootServiceObject): NormalizedShootServiceItem => {
  const price = toNumber(item.price);
  const quantity = Math.max(1, toNumber(item.quantity, 1));
  const subtotal = toNumber(item.subtotal, price * quantity);
  const paidAmount = toNumber(item.paid_amount ?? item.paidAmount);
  const balanceDue = Math.max(toNumber(item.balance_due ?? item.balanceDue, subtotal - paidAmount), 0);
  const paymentStatus = toOptionalString(item.payment_status ?? item.paymentStatus);
  const unlockState = toOptionalString(item.unlock_state ?? item.unlockState);
  const isUnlockedForDelivery = toBoolean(
    item.is_unlocked_for_delivery ?? item.isUnlockedForDelivery,
    paymentStatus === 'paid' || unlockState === 'unlocked' || unlockState === 'admin_unlocked',
  );

  return {
    id: getShootServiceItemId(item) ?? toOptionalString(item.id) ?? item.name,
    serviceId: toOptionalString(item.id),
    name: item.name || 'Service',
    scheduledAt: item.scheduled_at ?? item.scheduledAt ?? null,
    photographerName: item.photographer?.name ?? null,
    editorName: item.editor?.name ?? null,
    workflowStatus: item.workflow_status ?? item.workflowStatus ?? null,
    deliveryStatus: item.delivery_status ?? item.deliveryStatus ?? null,
    paymentStatus: paymentStatus ?? null,
    unlockState: unlockState ?? null,
    isUnlockedForDelivery,
    isDeliverable: toBoolean(item.is_deliverable ?? item.isDeliverable, true),
    subtotal,
    paidAmount,
    balanceDue,
    source: item,
  };
};

export const getShootServiceItems = (shoot?: Pick<ShootData, 'serviceItems' | 'service_items' | 'serviceObjects'> | null): NormalizedShootServiceItem[] => {
  if (!shoot) return [];

  const shootUnlocksDeliveries =
    toBoolean((shoot as any).bypass_paywall ?? (shoot as any).bypassPaywall) ||
    String((shoot as any).payment_status ?? (shoot as any).paymentStatus ?? (shoot as any).payment?.paymentStatus ?? '').toLowerCase() === 'paid';

  const sourceItems =
    Array.isArray(shoot.serviceItems) && shoot.serviceItems.length > 0
      ? shoot.serviceItems
      : Array.isArray(shoot.service_items) && shoot.service_items.length > 0
        ? shoot.service_items
        : Array.isArray(shoot.serviceObjects)
          ? shoot.serviceObjects
          : [];

  return sourceItems
    .filter((item): item is ShootServiceObject => Boolean(item) && typeof item === 'object')
    .map((item) => {
      const normalized = normalizeShootServiceItem(item);

      if (shootUnlocksDeliveries && normalized.isDeliverable && !normalized.isUnlockedForDelivery) {
        return {
          ...normalized,
          isUnlockedForDelivery: true,
          unlockState: normalized.unlockState ?? 'shoot_unlocked',
        };
      }

      return normalized;
    });
};

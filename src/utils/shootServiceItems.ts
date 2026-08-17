import type { ShootServiceObject } from '@/types/shoots';

export type NormalizedShootServiceItem = {
  id: string;
  serviceId?: string;
  shootServiceId?: string;
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
  isInvoiceAdjustment: boolean;
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

export const isInvoiceAdjustmentServiceItem = (value: unknown): boolean => {
  if (!value || typeof value !== 'object') return false;

  const item = value as Record<string, unknown>;
  const flag = item.is_invoice_adjustment ?? item.isInvoiceAdjustment;

  return toBoolean(flag, false) || item.source === 'invoice_adjustment';
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
  const isInvoiceAdjustment = isInvoiceAdjustmentServiceItem(item);
  const price = toNumber(item.price ?? item.unit_amount ?? item.unitAmount);
  const quantity = Math.max(1, toNumber(item.quantity, 1));
  const subtotal = isInvoiceAdjustment
    ? toNumber(item.total_amount ?? item.totalAmount ?? item.subtotal, price * quantity)
    : toNumber(item.subtotal ?? item.total_amount ?? item.totalAmount, price * quantity);
  const paidAmount = toNumber(item.paid_amount ?? item.paidAmount);
  // Invoice adjustments are payable as part of the whole shoot, but they have no
  // real shoot_service_id and therefore must never enter per-service allocation.
  const balanceDue = isInvoiceAdjustment
    ? 0
    : Math.max(toNumber(item.balance_due ?? item.balanceDue, subtotal - paidAmount), 0);
  const paymentStatus = toOptionalString(item.payment_status ?? item.paymentStatus);
  const unlockState = toOptionalString(item.unlock_state ?? item.unlockState);
  const isUnlockedForDelivery = toBoolean(
    item.is_unlocked_for_delivery ?? item.isUnlockedForDelivery,
    paymentStatus === 'paid' || unlockState === 'unlocked' || unlockState === 'admin_unlocked',
  );

  return {
    id: getShootServiceItemId(item) ?? toOptionalString(item.id) ?? item.name,
    serviceId: isInvoiceAdjustment
      ? undefined
      : toOptionalString(item.service_id ?? item.serviceId ?? item.id),
    shootServiceId: getShootServiceItemId(item),
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
    isInvoiceAdjustment,
    subtotal,
    paidAmount,
    balanceDue,
    source: item,
  };
};

type ShootServiceItemsSource = {
  serviceItems?: unknown[] | null;
  service_items?: unknown[] | null;
  serviceObjects?: unknown[] | null;
  bypass_paywall?: unknown;
  bypassPaywall?: unknown;
  payment_status?: unknown;
  paymentStatus?: unknown;
  invoice_adjustments_total?: unknown;
  invoiceAdjustmentsTotal?: unknown;
  payment?: {
    [key: string]: unknown;
    payment_status?: unknown;
    paymentStatus?: unknown;
    invoice_adjustments_total?: unknown;
    invoiceAdjustmentsTotal?: unknown;
  } | null;
};

export const getShootServiceItems = (shoot?: ShootServiceItemsSource | null): NormalizedShootServiceItem[] => {
  if (!shoot) return [];

  const shootUnlocksDeliveries =
    toBoolean(shoot.bypass_paywall ?? shoot.bypassPaywall) ||
    String(shoot.payment_status ?? shoot.paymentStatus ?? shoot.payment?.paymentStatus ?? '').toLowerCase() === 'paid';

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

export const getShootInvoiceAdjustmentTotal = (shoot?: ShootServiceItemsSource | null): number => {
  if (!shoot) return 0;

  const adjustmentRowsTotal = getShootServiceItems(shoot)
    .filter((item) => (
      item.isInvoiceAdjustment
      && toBoolean(item.source.bills_client ?? item.source.billsClient, true)
    ))
    .reduce((total, item) => total + item.subtotal, 0);
  const explicitTotals = [
    shoot.payment?.invoiceAdjustmentsTotal,
    shoot.payment?.invoice_adjustments_total,
    shoot.invoiceAdjustmentsTotal,
    shoot.invoice_adjustments_total,
  ];

  for (const value of explicitTotals) {
    if (value === null || value === undefined || value === '') continue;

    const numeric = Number(value);
    if (Number.isFinite(numeric) && (numeric !== 0 || adjustmentRowsTotal === 0)) {
      return numeric;
    }
  }

  return adjustmentRowsTotal;
};

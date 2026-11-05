import type { ShootAutoDelivery } from '@/types/shoots';

/** Eligibility and management permission come only from the authorized API. */
export function normalizeShootAutoDelivery(value: unknown): ShootAutoDelivery | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const policy = value as Record<string, unknown>;
  if (typeof policy.enabled !== 'boolean' || typeof policy.available !== 'boolean' || typeof policy.can_manage !== 'boolean') return undefined;
  return {
    enabled: policy.enabled,
    available: policy.available,
    can_manage: policy.can_manage,
    ...(typeof policy.reason === 'string' ? { reason: policy.reason } : {}),
  };
}

export function shootAutoDeliveryFields(source: unknown) {
  const record = source && typeof source === 'object' ? source as Record<string, unknown> : {};
  const autoDelivery = normalizeShootAutoDelivery(record.auto_delivery ?? record.autoDelivery);
  return autoDelivery ? { autoDelivery, auto_delivery: autoDelivery } : {};
}

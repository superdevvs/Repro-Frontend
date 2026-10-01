import type { ShootData } from '@/types/shoots';
import { getShootUnits } from '@/features/shoot-units/shootUnitData';
import { isInvoiceAdjustmentServiceItem } from './shootServiceItems';
import { resolveShootDuration } from './shootDuration';

export function getRescheduleDurationEntries(shoot: ShootData) {
  const multiUnit = getShootUnits(shoot).length > 0;
  const rows = (multiUnit ? shoot.service_lines : null) ?? shoot.serviceItems ?? shoot.service_items ?? shoot.serviceObjects ?? shoot.services ?? [];
  const seen = new Set<string>();
  return rows.flatMap(value => {
    if (!value || typeof value !== 'object' || isInvoiceAdjustmentServiceItem(value)) return [];
    const row = value as Record<string, unknown>;
    const id = multiUnit ? row.shoot_service_id ?? row.shootServiceId : row.service_id ?? row.serviceId ?? row.id;
    if (!id || seen.has(String(id))) return [];
    seen.add(String(id));
    return [{ id: String(id), name: `${row.name || row.serviceName || 'Service'}${multiUnit && row.unit_label ? ` · ${row.unit_label}` : ''}`,
      duration: resolveShootDuration(row.duration_minutes), multiUnit }];
  });
}

export function buildRescheduleDurationPayload(shoot: ShootData, changes: Record<string, number>) {
  const entries = getRescheduleDurationEntries(shoot).filter(entry => changes[entry.id] !== undefined);
  if (!entries.length) return {};
  return entries[0].multiUnit
    ? { service_lines: entries.map(entry => ({ shoot_service_id: Number(entry.id), duration_minutes: resolveShootDuration(changes[entry.id]) })) }
    : { services: entries.map(entry => ({ id: Number(entry.id), duration_minutes: resolveShootDuration(changes[entry.id]) })) };
}

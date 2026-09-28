import type { ShootData, ShootServiceObject, ShootUnit } from '@/types/shoots';
import { isInvoiceAdjustmentServiceItem } from '@/utils/shootServiceItems';
import { getServiceUnitId, getShootUnits, getUnitKey } from './shootUnitData';
import { normalizeBookingQuantity } from '@/utils/bookedServiceQuantity';

const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' ? value as Record<string, unknown> : {};
export function allUnitLines(shoot: ShootData): ShootServiceObject[] {
  return (shoot.service_lines ?? shoot.serviceItems ?? shoot.service_items ?? shoot.serviceObjects ?? [])
    .filter(line => !isInvoiceAdjustmentServiceItem(line));
}
const lineId = (line: Record<string, unknown>) => line.shoot_service_id ?? line.shootServiceId;
const serviceId = (line: Record<string, unknown>) => line.service_id ?? line.serviceId ?? line.id;

/** Retain line identity and snapshots; omitted amounts are preserved by the server. */
export function unitLinePayload(value: ShootServiceObject | Record<string, unknown>) {
  const line = record(value);
  return {
    ...(lineId(line) != null ? { shoot_service_id: lineId(line) } : {}),
    ...(line.client_key ? { client_key: line.client_key } : {}),
    shoot_unit_id: getServiceUnitId(line), service_id: serviceId(line), quantity: normalizeBookingQuantity(line.quantity),
    scheduled_at: line.scheduled_at ?? line.scheduledAt ?? null,
    photographer_id: line.photographer_id ?? line.photographerId ?? record(line.photographer).id ?? null,
  };
}

export function unitMetadataPayload(units: ShootUnit[]) {
  return units.map((unit, sort_order) => ({ id: unit.id, client_key: unit.client_key, label: unit.label, kind: unit.kind,
    sqft: unit.sqft, beds: unit.beds, baths: unit.baths, access_notes: unit.access_notes, sort_order }));
}

/** Convert a single-unit legacy editor draft to explicit unit-aware writes. */
export function buildUnitScopedUpdate(shoot: ShootData, activeUnitId: string, input: Record<string, unknown>): Record<string, unknown> {
  const units = getShootUnits(shoot);
  const unit = units.find(item => getUnitKey(item) === activeUnitId);
  if (!unit) throw new Error('This unit no longer exists. Refresh the shoot before saving.');
  const updates: Record<string, unknown> = { ...input, expected_units_revision: shoot.units_revision };
  const incoming = input.service_items ?? input.services;
  if (Array.isArray(incoming)) {
    const existing = allUnitLines(shoot);
    const own = existing.filter(line => getServiceUnitId(line) === activeUnitId);
    const assignments = Array.isArray(input.service_photographers) ? input.service_photographers.map(record) : [];
    updates.service_lines = [
      ...existing.filter(line => getServiceUnitId(line) !== activeUnitId).map(unitLinePayload),
      ...incoming.map(value => {
        const changed = record(value);
        const id = String(serviceId(changed));
        const retained = own.find(line => String(serviceId(record(line))) === id);
        const assignment = assignments.find(item => String(item.service_id) === id);
        return { ...(retained ? unitLinePayload(retained) : { service_id: id, client_key: crypto.randomUUID(), quantity: 1 }),
          ...changed, service_id: id, shoot_unit_id: unit.id, unit_client_key: unit.client_key,
          ...(retained ? { shoot_service_id: lineId(record(retained)) } : {}),
          ...(assignment ? { photographer_id: assignment.photographer_id } : {}),
        };
      }),
    ];
  }
  const details = record(input.propertyDetails ?? input.property_details);
  if (Object.keys(details).length) {
    updates.units = unitMetadataPayload(units.map(item => getUnitKey(item) === activeUnitId ? { ...item,
      sqft: details.sqft === undefined ? item.sqft : Number(details.sqft),
      beds: details.beds === undefined && details.bedrooms === undefined ? item.beds : Number(details.beds ?? details.bedrooms),
      baths: details.baths === undefined && details.bathrooms === undefined ? item.baths : Number(details.baths ?? details.bathrooms),
      access_notes: typeof details.access_notes === 'string' ? details.access_notes : item.access_notes,
    } : item));
    const sharedDetails = { ...details };
    for (const key of ['sqft', 'squareFeet', 'square_feet', 'beds', 'bedrooms', 'bed', 'baths', 'bathrooms', 'bath', 'access_notes']) delete sharedDetails[key];
    updates.propertyDetails = { ...record(shoot.propertyDetails), ...sharedDetails };
    delete updates.property_details;
  }
  delete updates.service_items;
  delete updates.services;
  delete updates.service_photographers;
  return updates;
}

export function filterUnitFiles<T extends { shoot_service_id?: string | number | null; shootServiceId?: string | number | null }>(files: T[], shoot: ShootData, activeUnitId: string | null): T[] {
  if (!getShootUnits(shoot).length) return files;
  const ids = new Set(allUnitLines(shoot).filter(line => getServiceUnitId(line) === activeUnitId).map(line => String(lineId(record(line)))));
  return files.filter(file => {
    const id = file.shoot_service_id ?? file.shootServiceId;
    return id != null && ids.has(String(id));
  });
}

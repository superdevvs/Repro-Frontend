import type { ShootData, ShootServiceObject, ShootUnit } from '@/types/shoots';
import { getShootSchedule } from '@/utils/shootSchedule';

const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' ? value as Record<string, unknown> : {};
const numberOrNull = (value: unknown) => value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? null : Number(value);
export const getUnitKey = (unit: ShootUnit): string => String(unit.id ?? unit.client_key ?? '');
export function normalizeShootUnits(shoot: unknown): ShootUnit[] {
  const data = record(shoot);
  const units = data.units ?? data.shoot_units ?? data.shootUnits;
  return Array.isArray(units) ? units.map(value => {
    const unit = record(value);
    return { ...unit, id: unit.id as string | number | undefined, client_key: unit.client_key as string | undefined,
      label: String(unit.label ?? ''), kind: unit.kind === 'common_area' ? 'common_area' : 'unit',
      sqft: numberOrNull(unit.sqft), beds: numberOrNull(unit.beds ?? unit.bedrooms), baths: numberOrNull(unit.baths ?? unit.bathrooms),
      access_notes: String(unit.access_notes ?? unit.accessNotes ?? '') } satisfies ShootUnit;
  }) : [];
}
export const getShootUnits = normalizeShootUnits;
export function getServiceUnitId(line: unknown): string | null {
  const data = record(line);
  const unit = record(data.unit);
  const id = data.shoot_unit_id ?? data.shootUnitId ?? unit.id ?? data.unit_client_key ?? unit.client_key;
  return id === null || id === undefined || id === '' ? null : String(id);
}
export function getUnitServiceLines(shoot: unknown, unitId: string | null): ShootServiceObject[] {
  const data = record(shoot);
  const lines = data.service_lines ?? data.serviceItems ?? data.service_items ?? data.serviceObjects;
  return Array.isArray(lines) ? lines.filter(line => getServiceUnitId(line) === unitId) : [];
}
/** New work in an existing unit starts at that unit's visit, never another unit's. */
export function getUnitVisitDefaults(shoot: unknown, unitId: string | null) {
  const source = record(shoot);
  const lines = getUnitServiceLines(shoot, unitId);
  const first = lines.find(line => line.scheduled_at || line.scheduledAt) ?? lines[0];
  const scheduledAt = first?.scheduled_at ?? first?.scheduledAt ?? source.scheduled_at ?? source.scheduledAt;
  return {
    ...getShootSchedule({ scheduled_at: scheduledAt, timezone: source.timezone }),
    scheduledAt: typeof scheduledAt === 'string' ? scheduledAt : null,
    photographerId: first?.photographer_id ?? first?.resolved_photographer_id ?? record(first?.photographer).id ?? source.photographer_id ?? record(source.photographer).id,
  };
}
/** Projection is display scope only: mutation callers must use the original full shoot. */
export function projectShootForUnit(shoot: ShootData, unitId: string | null): ShootData {
  if (!normalizeShootUnits(shoot).length) return shoot;
  const lines = getUnitServiceLines(shoot, unitId);
  const unit = normalizeShootUnits(shoot).find(item => getUnitKey(item) === unitId);
  return { ...shoot, serviceItems: lines, service_items: lines, serviceObjects: lines, service_lines: lines,
    services: lines.map(line => String(line.name ?? '')),
    ...(unit ? { propertyDetails: { ...shoot.propertyDetails, sqft: unit.sqft, beds: unit.beds, bedrooms: unit.beds, baths: unit.baths, bathrooms: unit.baths } } : {}) };
}

import { resolveServiceShootDuration } from '@/utils/shootDuration';
import type { TravelPayload } from './types';

export type ForceSaveChange = { label: string; before: string; after: string };
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' ? value as Record<string, unknown> : {};
const rows = (value: unknown): Record<string, unknown>[] => Array.isArray(value) ? value.map(record) : [];
const idOf = (row: Record<string, unknown>) => String(row.service_id ?? row.serviceId ?? row.id ?? '');

/** Read the actual draft and booked snapshots; keep this display data out of requests. */
export function buildForceSaveChanges(source: unknown, payload: TravelPayload | null, catalog: unknown[] = [], people: unknown[] = []): ForceSaveChange[] {
  if (!payload) return [];
  const shoot = record(source);
  const saved = [shoot.serviceItems, shoot.service_items, shoot.serviceObjects, shoot.services].map(rows).find(items => items.length) ?? [];
  const incoming = rows(payload.service_items ?? payload.service_lines ?? payload.services);
  const options = new Map(catalog.map(value => { const item = record(value); return [idOf(item), item]; }));
  const assignments = new Map(rows(payload.service_photographers).map(item => [String(item.service_id), item.photographer_id]));
  const names = new Map(people.map(value => { const person = record(value); return [String(person.id), String(person.name ?? '')]; }));
  const primary = record(shoot.photographer);
  if (primary.id != null && primary.name) names.set(String(primary.id), String(primary.name));
  const proposed = incoming.length ? incoming.map(item => ({ ...options.get(idOf(item)), ...item })) : saved;
  const describe = (items: Record<string, unknown>[]) => items.map(item => {
    const option = options.get(idOf(item));
    const name = String(item.name ?? item.service_name ?? option?.name ?? `Service ${idOf(item)}`);
    const quantity = Math.max(1, Number(item.quantity) || 1);
    const price = item.price ?? record(item.pivot).price;
    return `${name}${quantity > 1 ? ` × ${quantity}` : ''}${price != null && Number.isFinite(Number(price)) ? ` ($${(Number(price) * quantity).toFixed(2)})` : ''}`;
  }).join(', ') || 'No services';
  const duration = (items: Record<string, unknown>[]) => items.reduce((total, item) => total + resolveServiceShootDuration(
    item as Parameters<typeof resolveServiceShootDuration>[0], Number(shoot.sqft ?? record(shoot.propertyDetails ?? shoot.property_details).sqft) || null,
  ), 0);
  const assignees = (items: Record<string, unknown>[], changed: boolean) => [...new Set(items.map(item => {
    const person = record(item.photographer ?? item.resolved_photographer);
    const id = (changed ? assignments.get(idOf(item)) : undefined) ?? item.photographer_id ?? item.resolved_photographer_id
      ?? record(item.pivot).photographer_id ?? person.id ?? payload.photographer_id ?? primary.id;
    return person.name ?? names.get(String(id)) ?? (id != null ? `Photographer ${id}` : 'Unassigned');
  }))].join(', ');
  const changes = [
    { label: 'Services', before: describe(saved), after: describe(proposed) },
    { label: 'Total capture duration', before: `${duration(saved)} min`, after: `${duration(proposed)} min` },
    { label: 'Photographer', before: assignees(saved, false), after: assignees(proposed, true) },
  ];
  return changes.filter(change => change.before !== change.after);
}

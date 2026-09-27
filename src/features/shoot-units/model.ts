import { v4 as uuid } from 'uuid';
import type { ShootUnit } from '@/types/shoots';
import { type ServicePackage, toBackendTime, resolveSelectedServicePrice } from '@/pages/bookShootModel';
import { serviceRequiresPhotographer } from '@/utils/photographerAssignment';
import { getShootSchedule } from '@/utils/shootSchedule';
import { buildShootScheduleTimestamp } from '@/utils/shootScheduleSubmission';
import { getServiceUnitId, getUnitKey, normalizeShootUnits } from './shootUnitData';

export type UnitDraft = ShootUnit & { client_key: string };
export type UnitLineDraft = {
  client_key: string; shoot_service_id?: string | number; unit_client_key: string;
  service_id: string; price?: number; date?: string; time?: string; photographer_id?: string;
  duration_minutes?: number;
};
export type UnitScheduleDefault = { date?: string; time?: string; photographer_id?: string };
export type MultiUnitDraft = {
  enabled: boolean; units: UnitDraft[]; lines: UnitLineDraft[]; activeUnitKey: string;
  defaults: Record<string, UnitScheduleDefault>;
};
export const emptyMultiUnitDraft = (): MultiUnitDraft => ({ enabled: false, units: [], lines: [], activeUnitKey: '', defaults: {} });
export const makeUnitDraft = (seed: Partial<UnitDraft> = {}): UnitDraft => ({ client_key: uuid(), label: '', kind: 'unit', sqft: null, beds: null, baths: null, access_notes: '', ...seed });
export const draftUnitKey = (unit: ShootUnit) => String(unit.client_key ?? unit.id ?? '');
export const unitLineKey = (unitKey: string, serviceId: string) => `${unitKey}:${serviceId}`;
export const linePrice = (line: UnitLineDraft, unit: ShootUnit, catalog: ServicePackage[]) => line.price ?? resolveSelectedServicePrice(catalog.find(service => service.id === line.service_id) ?? { id: line.service_id, name: '', description: '', price: 0 }, unit.sqft);
export function setUnitServices(draft: MultiUnitDraft, unitKey: string, serviceIds: string[]): MultiUnitDraft {
  const retained = draft.lines.filter(line => line.unit_client_key !== unitKey || serviceIds.includes(line.service_id));
  const existing = new Set(retained.filter(line => line.unit_client_key === unitKey).map(line => line.service_id));
  return { ...draft, lines: [...retained, ...[...new Set(serviceIds)].filter(id => !existing.has(id)).map(service_id => ({ client_key: unitLineKey(unitKey, service_id), unit_client_key: unitKey, service_id }))] };
}
export function copyMissingServices(draft: MultiUnitDraft, source: string, targets: string[]): MultiUnitDraft {
  const ids = draft.lines.filter(line => line.unit_client_key === source).map(line => line.service_id);
  const valid = new Set(draft.units.map(draftUnitKey));
  return [...new Set(targets)].filter(key => key !== source && valid.has(key)).reduce((next, key) => setUnitServices(next, key, [...next.lines.filter(line => line.unit_client_key === key).map(line => line.service_id), ...ids]), draft);
}
export function multiUnitErrors(draft: MultiUnitDraft, requireServices = true): Record<string, string[]> {
  if (!draft.enabled) return {};
  const errors: Record<string, string[]> = {};
  const labels = new Map<string, number>();
  draft.units.forEach(u => labels.set(u.label.trim().toLowerCase(), (labels.get(u.label.trim().toLowerCase()) ?? 0) + 1));
  if (!draft.units.length) errors.booking = ['Add at least one unit or common area.'];
  if (draft.lines.length > 3000) errors.booking = ['A booking can contain up to 3,000 service lines.'];
  draft.units.forEach(u => {
    const issues: string[] = [];
    if (!u.label.trim()) issues.push('Unit label is required.');
    if ((labels.get(u.label.trim().toLowerCase()) ?? 0) > 1) issues.push('Unit labels must be unique.');
    if (!u.sqft || u.sqft < 1) issues.push('Square footage is required.');
    if (requireServices && !draft.lines.some(line => line.unit_client_key === u.client_key)) issues.push('Select at least one service.');
    if (issues.length) errors[u.client_key] = issues;
  });
  return errors;
}
export function summarizeUnitServices(draft: MultiUnitDraft, catalog: ServicePackage[]): ServicePackage[] {
  return catalog.flatMap(service => {
    const lines = draft.lines.filter(line => line.service_id === service.id);
    return lines.length ? [{ ...service, pricing_type: 'fixed' as const, sqft_ranges: [], quantity: lines.length,
      description: `${lines.length} unit${lines.length === 1 ? '' : 's'} · separately priced service lines`,
      price: lines.reduce((sum, line) => sum + linePrice(line, draft.units.find(unit => unit.client_key === line.unit_client_key)!, catalog), 0) }] : [];
  });
}
export type ResolvedUnitLine = UnitLineDraft & { scheduled_date: string; start_time: string; photographer_id: string; duration: number; end_time: string };
export function unitServiceDuration(service: ServicePackage, unit: ShootUnit): number {
  const explicit = Number(service.shoot_duration_minutes ?? service.duration_minutes);
  const tier = service.pricing_type === 'variable' && unit.sqft ? service.sqft_ranges?.find(range => unit.sqft! >= range.sqft_from && unit.sqft! <= range.sqft_to) : undefined;
  const duration = explicit > 0 ? explicit : Number(tier?.duration) > 0 ? Number(tier?.duration) : service.booking_duration_defaults?.default_minutes ?? service.booking_duration_default_minutes ?? 120;
  return Math.max(service.booking_duration_defaults?.min_minutes ?? service.booking_duration_min_minutes ?? 60, Math.min(service.booking_duration_defaults?.max_minutes ?? service.booking_duration_max_minutes ?? 240, duration));
}
/** Each photographer gets sequential occupied blocks, never N units at the same instant. */
export function resolveUnitSchedule(draft: MultiUnitDraft, catalog: ServicePackage[], fallback: UnitScheduleDefault): { lines: ResolvedUnitLine[]; errors: string[]; totalMinutes: number } {
  const cursors = new Map<string, number>();
  const occupied = new Map<string, Array<{ start: number; end: number; unitKey: string }>>();
  const errors: string[] = [];
  const lines: ResolvedUnitLine[] = [];
  const hhmm = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  for (const unit of draft.units) for (const line of draft.lines.filter(item => item.unit_client_key === unit.client_key)) {
    const service = catalog.find(item => item.id === line.service_id);
    if (!service) { errors.push(`${unit.label}: service is no longer available.`); continue; }
    const defaults = draft.defaults[line.service_id] ?? {};
    const date = line.date || defaults.date || fallback.date || '';
    const time = toBackendTime(line.time || defaults.time || fallback.time).slice(0, 5);
    const photographerId = line.photographer_id || defaults.photographer_id || fallback.photographer_id || '';
    const required = serviceRequiresPhotographer(service);
    const duration = line.duration_minutes ?? unitServiceDuration(service, unit);
    if (!date || !time) errors.push(`${unit.label} / ${service.name}: choose a date and time.`);
    if (required && !photographerId) errors.push(`${unit.label} / ${service.name}: choose a photographer.`);
    if (required && !(duration > 0)) errors.push(`${unit.label} / ${service.name}: service duration is missing; update the service catalogue.`);
    const key = `${photographerId}:${date}`;
    const [h, m] = time.split(':').map(Number);
    const requested = Number.isFinite(h + m) ? h * 60 + m : 0;
    const explicit = Boolean(line.time);
    const start = required && !explicit ? Math.max(requested, cursors.get(key) ?? 0) : requested;
    const end = start + (required ? duration : 0);
    if (required && end > 1440) errors.push(`${unit.label} / ${service.name}: visit extends past midnight; choose another visit date.`);
    const prior = occupied.get(key) ?? [];
    if (required && prior.some(block => block.unitKey !== unit.client_key && start < block.end && end > block.start)) errors.push(`${unit.label} / ${service.name}: overlaps another unit assigned to this photographer.`);
    if (required) { occupied.set(key, [...prior, { start, end, unitKey: unit.client_key }]); cursors.set(key, Math.max(cursors.get(key) ?? 0, end)); }
    lines.push({ ...line, scheduled_date: date, start_time: hhmm(start), end_time: hhmm(end), photographer_id: required ? photographerId : '', duration: required ? duration : 0 });
  }
  return { lines, errors: [...new Set(errors)], totalMinutes: lines.reduce((sum, line) => sum + line.duration, 0) };
}
export function buildUnitPayload(draft: MultiUnitDraft, resolved: ResolvedUnitLine[], timezone?: string | null) {
  return {
    units: draft.units.map(({ id, client_key, label, kind, sqft, beds, baths, access_notes }, sort_order) => ({ ...(id ? { id } : {}), client_key, label: label.trim(), kind, sqft, beds, baths, access_notes, sort_order })),
    service_lines: resolved.map(line => {
      const unit = draft.units.find(item => item.client_key === line.unit_client_key)!;
      return { ...(line.shoot_service_id ? { shoot_service_id: line.shoot_service_id } : {}), client_key: line.client_key,
        unit_client_key: line.unit_client_key, ...(unit.id ? { shoot_unit_id: unit.id } : {}), service_id: line.service_id,
        scheduled_at: buildShootScheduleTimestamp(line.scheduled_date, line.start_time, timezone), photographer_id: line.photographer_id || null,
        quantity: 1 as const, is_deliverable: true as const };
    }),
  };
}
export function hydrateUnitDraft(value: unknown): MultiUnitDraft {
  const data = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const units = normalizeShootUnits(data).map(unit => ({ ...unit, client_key: unit.client_key || `persisted-${getUnitKey(unit)}` }));
  if (!units.length) return emptyMultiUnitDraft();
  const raw = data.service_lines ?? data.serviceItems ?? data.service_items ?? [];
  const lines = (Array.isArray(raw) ? raw : []).flatMap(value => {
    const line = value as Record<string, unknown>;
    const unit = units.find(item => getUnitKey(item) === getServiceUnitId(line) || item.client_key === getServiceUnitId(line));
    if (!unit) return [];
    const id = String(line.service_id ?? line.serviceId ?? line.id ?? '');
    const schedule = getShootSchedule({ scheduled_at: line.scheduled_at ?? line.scheduledAt, timezone: data.timezone });
    return [{ client_key: String(line.client_key ?? unitLineKey(unit.client_key, id)), unit_client_key: unit.client_key, service_id: id,
      shoot_service_id: (line.shoot_service_id ?? line.shootServiceId) as string | number | undefined,
      ...(line.price !== null && line.price !== undefined ? { price: Number(line.price) } : {}), date: schedule.date || undefined, time: schedule.time || undefined,
      photographer_id: String(line.photographer_id ?? line.resolved_photographer_id ?? ''),
      ...(Number(line.duration_minutes ?? line.duration) > 0 ? { duration_minutes: Number(line.duration_minutes ?? line.duration) } : {}) }];
  });
  return { enabled: true, units, lines, activeUnitKey: units[0].client_key, defaults: {} };
}

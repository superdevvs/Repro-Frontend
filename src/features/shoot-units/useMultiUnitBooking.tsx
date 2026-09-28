import React from 'react';
import type { ShootUnit } from '@/types/shoots';
import { type ServicePackage, type ServiceScheduleMap, toDateInputValue } from '@/pages/bookShootModel';
import { buildUnitPayload, copyMissingServices, draftUnitKey, emptyMultiUnitDraft, linePrice, makeUnitDraft, multiUnitErrors, resolveUnitSchedule, setUnitServices, summarizeUnitServices, type MultiUnitDraft, type UnitLineDraft } from './model';
import { normalizeBookingQuantity } from '@/utils/bookedServiceQuantity';

export function useMultiUnitBooking({ draft, setDraft, catalog, legacyServices, propertySqft, propertyDetails, date, time, photographer, servicePhotographers, serviceSchedules, allowed, clientGroups = [] }: {
  draft: MultiUnitDraft; setDraft: React.Dispatch<React.SetStateAction<MultiUnitDraft>>; catalog: ServicePackage[];
  legacyServices: ServicePackage[]; propertySqft: number | null; propertyDetails: Record<string, unknown> | null;
  date?: Date; time: string; photographer: string; servicePhotographers: Record<string, string>; serviceSchedules: ServiceScheduleMap; allowed: boolean;
  clientGroups?: string[];
}) {
  const [managerOpen, setManagerOpen] = React.useState(false);
  const activeUnit = draft.units.find(unit => unit.client_key === draft.activeUnitKey) ?? draft.units[0];
  const enabled = draft.enabled && allowed;
  const visibleCatalog = catalog.filter(service => !clientGroups.length || (service.service_group_ids?.length ? service.service_group_ids : service.service_groups?.map(group => group.id) ?? []).some(id => clientGroups.includes(String(id))));
  const errors = multiUnitErrors(draft);
  if (clientGroups.length) draft.lines.forEach(line => { if (!visibleCatalog.some(service => service.id === line.service_id)) errors[line.unit_client_key] = [...(errors[line.unit_client_key] ?? []), 'A service is not available for this client. Remove it or choose an available service.']; });
  const propertyErrors = React.useMemo(() => multiUnitErrors(draft, false), [draft]);
  const summaryServices = React.useMemo(() => summarizeUnitServices(draft, catalog), [draft, catalog]);
  const activeServices = React.useMemo(() => activeUnit ? catalog.flatMap(service => {
    const line = draft.lines.find(item => item.unit_client_key === activeUnit.client_key && item.service_id === service.id);
    return line ? [{ ...service, price: linePrice(line, activeUnit, catalog), quantity: normalizeBookingQuantity(line.quantity) }] : [];
  }) : [], [catalog, draft.lines, activeUnit]);
  const scheduleDraft = React.useMemo(() => ({ ...draft, defaults: Object.fromEntries(catalog.map(service => [service.id, { date: serviceSchedules[service.id]?.date, time: serviceSchedules[service.id]?.time, photographer_id: servicePhotographers[service.id] }])) }), [draft, catalog, serviceSchedules, servicePhotographers]);
  const schedule = React.useMemo(() => resolveUnitSchedule(scheduleDraft, catalog, { date: date ? toDateInputValue(date) : '', time, photographer_id: photographer }), [scheduleDraft, catalog, date, time, photographer]);
  const enable = () => {
    const unit = makeUnitDraft({ label: String(propertyDetails?.aptSuite || '1'), sqft: propertySqft, beds: Number(propertyDetails?.bedrooms ?? propertyDetails?.bedRooms ?? 0), baths: Number(propertyDetails?.bathrooms ?? propertyDetails?.bathRooms ?? 0) });
    setDraft(setUnitServices({ ...emptyMultiUnitDraft(), enabled: true, units: [unit], activeUnitKey: unit.client_key }, unit.client_key, legacyServices));
    setManagerOpen(true);
  };
  const changeUnits = (units: ShootUnit[]) => setDraft(current => {
    const next = units.map(unit => ({ ...unit, client_key: unit.client_key ?? `persisted-${unit.id}` }));
    const keys = new Set(next.map(draftUnitKey));
    return { ...current, units: next, activeUnitKey: keys.has(current.activeUnitKey) ? current.activeUnitKey : next[0]?.client_key ?? '', lines: current.lines.filter(line => keys.has(line.unit_client_key)) };
  });
  const updateLine = (key: string, changes: Partial<UnitLineDraft>) => setDraft(current => ({ ...current, lines: current.lines.map(line => line.client_key === key ? { ...line, ...changes } : line) }));
  return { enabled, allowed, draft, setDraft, catalog, visibleCatalog, activeUnit, activeServices, summaryServices, errors, propertyErrors, schedule, managerOpen, setManagerOpen, enable, changeUnits, updateLine,
    setActiveUnit: (key: string) => setDraft(current => ({ ...current, activeUnitKey: key })),
    changeServices: (services: ServicePackage[]) => setDraft(current => setUnitServices(current, current.activeUnitKey || current.units[0]?.client_key, services)),
    copyServices: (targets: string[]) => setDraft(current => copyMissingServices(current, current.activeUnitKey, targets)),
    payload: (timezone?: string | null) => buildUnitPayload(draft, schedule.lines, timezone),
    valid: !Object.keys(errors).length && !schedule.errors.length,
  };
}
export type MultiUnitBookingController = ReturnType<typeof useMultiUnitBooking>;
export const MultiUnitBookingContext = React.createContext<MultiUnitBookingController | null>(null);
export const useBookingUnits = () => React.useContext(MultiUnitBookingContext);

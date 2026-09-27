import { useCallback, useEffect, useRef, useState } from 'react';
import type { ShootData } from '@/types/shoots';
import { transformShootFromApi, type ApiShoot } from '@/context/shootNormalization';
import { useShootUnitScope } from './useShootUnitScope';
import { getUnitKey, getUnitServiceLines, getUnitVisitDefaults, normalizeShootUnits } from './shootUnitData';
import { buildUnitScopedUpdate } from './unitMutations';

/** Keep the full source beside the scoped legacy form so saving cannot detach other units. */
export function useUnitScopedEdit() {
  const [source, setSource] = useState<ShootData>();
  const scope = useShootUnitScope(source);
  const activeUnitId = scope.activeUnitId;
  const projectFetched = useCallback(<T extends ApiShoot,>(raw: T): T => {
    const full = transformShootFromApi(raw);
    setSource(full);
    const units = normalizeShootUnits(full);
    const unit = units.find(item => getUnitKey(item) === activeUnitId) ?? units[0];
    if (!unit) return raw;
    const lines = getUnitServiceLines(raw, getUnitKey(unit));
    const visit = getUnitVisitDefaults(raw, getUnitKey(unit));
    const properties = { ...full.propertyDetails, sqft: unit.sqft, bedrooms: unit.beds, bathrooms: unit.baths, access_notes: unit.access_notes };
    return { ...raw, serviceItems: lines, service_items: lines, service_lines: lines, serviceObjects: lines,
      services: lines.map(line => ({ ...line, id: line.service_id ?? line.serviceId ?? line.id })),
      photographer_id: visit.photographerId,
      ...(visit.scheduledAt ? { scheduled_at: visit.scheduledAt, scheduledAt: visit.scheduledAt, scheduled_date: visit.date, scheduledDate: visit.date, time: visit.time, time_label: visit.time, timeLabel: visit.time } : {}),
      property_details: properties, sqft: unit.sqft, bedrooms: unit.beds, bathrooms: unit.baths } as unknown as T;
  }, [activeUnitId]);
  const buildPayload = (input: Record<string, unknown>) => {
    if (!source || !scope.isMultiUnit || !scope.activeUnitId) return input;
    const payload = buildUnitScopedUpdate(source, scope.activeUnitId, input);
    if (payload.propertyDetails) { payload.property_details = payload.propertyDetails; delete payload.propertyDetails; }
    delete payload.sqft;
    delete payload.bedrooms;
    delete payload.bathrooms;
    // A unit assignment must not replace the parent shoot's shared photographer.
    delete payload.photographer_id;
    delete payload.scheduled_at;
    return payload;
  };
  return { source, activeUnitId: scope.activeUnitId, isMultiUnit: scope.isMultiUnit, projectFetched, buildPayload };
}
export function useUnitEditDirtyTracking(fingerprint: string, loading: boolean, scopeKey: string | null) {
  const baseline = useRef<string | null>(null);
  useEffect(() => { baseline.current = null; }, [scopeKey, loading]);
  useEffect(() => { if (!loading && baseline.current === null) baseline.current = fingerprint; }, [fingerprint, loading, scopeKey]);
  return !loading && baseline.current !== null && baseline.current !== fingerprint;
}

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from 'react';
import type { ShootData, ShootUnit } from '@/types/shoots';
import { getShootUnits, getUnitKey } from './shootUnitData';

const selections = new Map<string, string>();
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
type UnitScope = { shoot?: ShootData; units: ShootUnit[]; unit: ShootUnit | null; activeUnitId: string | null; isMultiUnit: boolean; setActiveUnitId: (id: string) => void };
export const ScopeContext = createContext<UnitScope | null>(null);

export function useUnitSelection(shoot?: ShootData): UnitScope {
  const shootId = String(shoot?.id ?? '');
  const units = useMemo(() => getShootUnits(shoot), [shoot]);
  const getSnapshot = useCallback(() => selections.get(shootId) ?? '', [shootId]);
  const selected = useSyncExternalStore(subscribe, getSnapshot, () => '');
  const unit = units.find(item => getUnitKey(item) === selected) ?? units[0] ?? null;
  const setActiveUnitId = useCallback((id: string) => {
    if (!shootId || !units.some(item => getUnitKey(item) === id)) return;
    selections.set(shootId, id);
    listeners.forEach(listener => listener());
  }, [shootId, units]);
  return useMemo(() => ({ shoot, units, unit, activeUnitId: unit ? getUnitKey(unit) : null, isMultiUnit: units.length > 0, setActiveUnitId }), [shoot, units, unit, setActiveUnitId]);
}

/** Selection is shared across mounted detail panels and retained while moving between tabs. */
export function useShootUnitScope(shoot?: ShootData): UnitScope {
  const context = useContext(ScopeContext);
  const fallback = useUnitSelection(shoot ?? context?.shoot);
  return context && (!shoot || String(context.shoot?.id) === String(shoot.id)) ? context : fallback;
}

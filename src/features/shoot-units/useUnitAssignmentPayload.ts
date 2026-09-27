import { useCallback } from 'react';
import type { ShootData } from '@/types/shoots';
import { useShootUnitScope } from './useShootUnitScope';
import { allUnitLines, unitLinePayload } from './unitMutations';
import { getServiceUnitId } from './shootUnitData';

export function useUnitAssignmentPayload(shoot: ShootData) {
  const scope = useShootUnitScope(shoot);
  const full = scope.shoot ?? shoot;
  return useCallback((field: 'photographer_id' | 'editor_id', value: string) => {
    if (!scope.isMultiUnit) return { [field]: value };
    return { expected_units_revision: full.units_revision, service_lines: allUnitLines(full).map(line => ({ ...unitLinePayload(line),
      ...(getServiceUnitId(line) === scope.activeUnitId && (field === 'photographer_id' ? line.photographer_required !== false : line.requires_editing !== false) ? { [field]: value } : {}),
    })) };
  }, [full, scope.activeUnitId, scope.isMultiUnit]);
}

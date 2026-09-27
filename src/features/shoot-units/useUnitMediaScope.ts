import { useMemo } from 'react';
import type { ShootData } from '@/types/shoots';
import { useShootFiles } from '@/hooks/useShootFiles';
import { useShootUnitScope } from './useShootUnitScope';
import { projectShootForUnit } from './shootUnitData';
import { filterUnitFiles } from './unitMutations';

export function useUnitMediaScope(fullShoot: ShootData) {
  const { activeUnitId } = useShootUnitScope(fullShoot);
  const shoot = useMemo(() => projectShootForUnit(fullShoot, activeUnitId), [fullShoot, activeUnitId]);
  return { shoot, activeUnitId };
}

export function useScopedShootFiles(shoot: ShootData, unitId: string | null, type: Parameters<typeof useShootFiles>[1], options: Parameters<typeof useShootFiles>[2]) {
  const query = useShootFiles(shoot.id, type, options);
  const data = useMemo(() => query.data ? filterUnitFiles(query.data, shoot, unitId) : undefined, [query.data, shoot, unitId]);
  return { ...query, data };
}

import { useMemo } from 'react';
import type { SourceMedia } from '@/services/studioService';
import type { ShootData, ShootUnit } from '@/types/shoots';
import { useShootUnitScope } from './useShootUnitScope';

/** The picker needs only identity and public unit labels; file access remains server-authorized. */
export function useStudioUnitScope(shootId: number | undefined, photos: SourceMedia[]) {
  const scopeShoot = useMemo(() => {
    const units = new Map<string, ShootUnit>();
    photos.forEach(photo => {
      if (photo.shootUnitId != null) units.set(String(photo.shootUnitId), { id: photo.shootUnitId, label: photo.unitLabel || `Unit ${photo.shootUnitId}`, kind: 'unit', sqft: null, beds: null, baths: null });
    });
    return { id: String(shootId ?? ''), units: [...units.values()] } as ShootData;
  }, [shootId, photos]);
  const { activeUnitId, isMultiUnit } = useShootUnitScope(scopeShoot);
  const scopedPhotos = useMemo(() => isMultiUnit ? photos.filter(photo => String(photo.shootUnitId) === activeUnitId) : photos, [photos, isMultiUnit, activeUnitId]);
  return { scopeShoot, scopedPhotos };
}

import type { ShootData } from '@/types/shoots';
import { serviceAllowsPhotographerAssignment } from '@/utils/photographerAssignment';
import { normalizeShootServiceCategoryKey, type ShootPhotographerAssignmentGroup } from '@/utils/shootPhotographerAssignments';
import { deriveServiceCategoryName } from './shootOverviewEditorSupport';
import type { ServiceOption } from './shootOverviewEditorTypes';

type Photographer = ShootData['photographer'];
type Options = {
  shootPhotographer: Photographer; isEditMode: boolean; selectedServiceIds: string[]; servicesList: ServiceOption[];
  perCategoryPhotographers: Record<string, string>; selectedPhotographerId: string;
  groups: ShootPhotographerAssignmentGroup[]; resolvePhotographer: (id?: string | null) => Photographer | null;
};

/** Digital work has its own editor rows and never appears in the photographer roster. */
export function getOverviewPhotographerRows({ shootPhotographer, isEditMode, selectedServiceIds, servicesList,
  perCategoryPhotographers, selectedPhotographerId, groups, resolvePhotographer }: Options) {
  if (!isEditMode || !servicesList.length || !selectedServiceIds.length) {
    if (groups.length) return groups.map(group => ({ key: group.key, name: group.name,
      photographer: resolvePhotographer(String(perCategoryPhotographers[group.key] ?? group.photographer?.id ?? selectedPhotographerId ?? '')) || group.photographer || null }));
    return [{ key: 'photographer', name: 'Photographer',
      photographer: resolvePhotographer(selectedPhotographerId || String(shootPhotographer?.id ?? '')) || shootPhotographer || null }];
  }
  const rows = new Map<string, { key: string; name: string; photographer: Photographer | null }>();
  selectedServiceIds.forEach(id => {
    const service = servicesList.find(option => option.id === id);
    if (!service || !serviceAllowsPhotographerAssignment(service)) return;
    const name = deriveServiceCategoryName(service);
    const key = normalizeShootServiceCategoryKey(name);
    const existing = groups.find(group => group.key === key);
    const selectedId = perCategoryPhotographers[key] ?? existing?.photographer?.id ?? selectedPhotographerId ?? '';
    rows.set(key, { key, name, photographer: selectedId ? resolvePhotographer(String(selectedId)) || existing?.photographer || null : null });
  });
  return Array.from(rows.values());
}

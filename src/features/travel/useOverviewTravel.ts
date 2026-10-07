import type { ShootData } from '@/types/shoots';
import { useShootUnitScope } from '@/features/shoot-units/useShootUnitScope';
import { buildUnitScopedUpdate } from '@/features/shoot-units/unitMutations';
import { applyOverviewServicePayload } from '@/components/shoots/tabs/overview/shootOverviewServicePayload';
import { useTravelFeasibility } from './useTravelFeasibility';
import { shootTravelPayload } from './travelPayload';
import type { TravelPayload } from './types';
import { repTravelChanges } from './repTravelPayload';
import type { ScheduleChange } from './daySchedule';

type Options = Omit<Parameters<typeof applyOverviewServicePayload>[0], 'updates'> & {
  active: boolean; draft: Partial<ShootData>; assignment?: TravelPayload | null; role: string;
  onScheduleChange?: (change: ScheduleChange) => void;
};
export function useOverviewTravel({ active, draft, assignment, role, onScheduleChange, ...options }: Options) {
  const scope = useShootUnitScope(options.shoot);
  let payload: TravelPayload | null = null;
  if (active || assignment) {
    const updates = { ...draft } as unknown as Parameters<typeof applyOverviewServicePayload>[0]['updates'];
    try {
      if (!assignment) applyOverviewServicePayload({ ...options, updates });
      const changes = assignment ?? (scope.isMultiUnit && scope.activeUnitId && scope.shoot
        ? buildUnitScopedUpdate(scope.shoot, scope.activeUnitId, updates as TravelPayload) : updates as TravelPayload);
      const full = scope.shoot ?? options.shoot;
      const assignedRep = !options.isAdmin && ['rep', 'salesrep', 'sales_rep', 'representative'].includes(role.toLowerCase());
      payload = shootTravelPayload(full, assignedRep && !assignment ? repTravelChanges(full, changes) : changes, assignment ? 'assign' : 'update');
    } catch {
      // Incomplete service date fields are validated by the existing editor.
    }
  }
  return useTravelFeasibility({ payload, notificationsSupported: active && !assignment, onScheduleChange: scope.isMultiUnit || assignment ? undefined : onScheduleChange });
}

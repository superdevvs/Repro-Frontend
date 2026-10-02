import { readTravelFeasibility, type TravelFeasibility } from './types';

export type TravelAvailabilityMetadata = {
  hybridTravelEnabled?: boolean;
  travelCheckRequired?: boolean;
  travelStatus?: TravelFeasibility['status'];
  travelFeasibility?: TravelFeasibility;
};
/** Explicit allowlist: never copy private provider or neighboring visit data. */
export function travelAvailabilityMetadata(value: unknown): TravelAvailabilityMetadata {
  const row = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const status = row.travel_status ?? row.travelStatus;
  return {
    hybridTravelEnabled: typeof row.hybrid_travel_enabled === 'boolean' ? row.hybrid_travel_enabled : typeof row.hybridTravelEnabled === 'boolean' ? row.hybridTravelEnabled : undefined,
    travelCheckRequired: typeof row.travel_check_required === 'boolean' ? row.travel_check_required : typeof row.travelCheckRequired === 'boolean' ? row.travelCheckRequired : undefined,
    travelStatus: ['available', 'conflict', 'review_required'].includes(String(status)) ? status as TravelFeasibility['status'] : undefined,
    travelFeasibility: readTravelFeasibility(row.travel_feasibility ?? row.travelFeasibility) ?? undefined,
  };
}

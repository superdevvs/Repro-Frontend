import type { ShootData } from '@/types/shoots';

/** Capture the starting record/version once; live refreshes must not reset a draft. */
export function buildOverviewEditDraft(shoot: ShootData, date: string): Partial<ShootData> {
  return {
    editVersion: shoot.editVersion,
    scheduledDate: date,
    time: shoot.time,
    location: {
      address: shoot.location?.address || '', city: shoot.location?.city || '',
      state: shoot.location?.state || '', zip: shoot.location?.zip || '',
      fullAddress: shoot.location?.fullAddress || '',
    },
    client: shoot.client ? { ...shoot.client } : undefined,
    photographer: shoot.photographer ? { ...shoot.photographer } : undefined,
    payment: shoot.payment ? { ...shoot.payment } : undefined,
  };
}

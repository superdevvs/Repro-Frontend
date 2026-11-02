import { describe, expect, it } from 'vitest';
import { transformShootFromApi } from './shootNormalization';

describe('server scheduling capabilities', () => {
  it('preserves explicit grants and denials through repeated shoot normalization', () => {
    const flags = { canEditAppointment: true, canReassignPhotographer: false, canScheduleShoot: true,
      canApproveReschedule: false, canReviewRequests: true, canRequestReschedule: false };
    const shoot = transformShootFromApi({ id: 5866, ...flags });
    expect(shoot).toMatchObject(flags);
    expect(transformShootFromApi({ id: shoot.id,
      canEditAppointment: shoot.canEditAppointment, canReassignPhotographer: shoot.canReassignPhotographer,
      canScheduleShoot: shoot.canScheduleShoot, canApproveReschedule: shoot.canApproveReschedule,
      canReviewRequests: shoot.canReviewRequests, canRequestReschedule: shoot.canRequestReschedule,
    })).toMatchObject(flags);
  });
  it('leaves absent capabilities unknown instead of inferring a grant', () => {
    expect(transformShootFromApi({ id: 5866 }).canApproveReschedule).toBeUndefined();
    expect(transformShootFromApi({ id: 5866 }).canRequestReschedule).toBeUndefined();
  });
});

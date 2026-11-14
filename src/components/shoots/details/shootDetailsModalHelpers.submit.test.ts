import { describe, expect, it } from 'vitest';
import type { ShootData } from '@/types/shoots';
import { canSubmitRawFromDetails } from './shootDetailsModalHelpers';

describe('raw submission capability', () => {
  const input = { currentUserRole: 'superadmin', isAdmin: true, isEditingManager: false, isPhotographer: false, rawFileCount: 170, normalizedStatus: 'scheduled' };
  it('hides submit raw after server confirmation even when the previous status and count remain visible', () => {
    expect(canSubmitRawFromDetails({ ...input, shoot: { canSubmitRaw: false } as ShootData })).toBe(false);
    expect(canSubmitRawFromDetails({ ...input, shoot: { can_submit_raw: false } as ShootData })).toBe(false);
  });
  it('keeps eligible submission available and supports older responses without capability fields', () => {
    expect(canSubmitRawFromDetails({ ...input, shoot: { canSubmitRaw: true } as ShootData })).toBe(true);
    expect(canSubmitRawFromDetails({ ...input, shoot: {} as ShootData })).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { ShootData } from '@/types/shoots';
import { buildFinalizeRequestBody, isFastForwardFinalise } from './shootFinalize';

const makeShoot = (overrides: Partial<ShootData> & Record<string, unknown> = {}): ShootData =>
  ({
    id: 1,
    status: 'scheduled',
    rawPhotoCount: 0,
    editedPhotoCount: 0,
    ...overrides,
  }) as unknown as ShootData;

describe('isFastForwardFinalise', () => {
  it('is true for a scheduled shoot with no media', () => {
    expect(isFastForwardFinalise(makeShoot({ status: 'scheduled' }))).toBe(true);
  });

  it('treats legacy "booked" status as scheduled', () => {
    expect(isFastForwardFinalise(makeShoot({ status: 'booked' }))).toBe(true);
  });

  it('is true for an on-hold shoot with no media', () => {
    expect(isFastForwardFinalise(makeShoot({ status: 'on_hold' }))).toBe(true);
  });

  it('prefers workflowStatus over status', () => {
    expect(
      isFastForwardFinalise(makeShoot({ status: 'scheduled', workflowStatus: 'uploaded' })),
    ).toBe(false);
  });

  it('is false once raw media exists', () => {
    expect(isFastForwardFinalise(makeShoot({ rawPhotoCount: 3 }))).toBe(false);
  });

  it('is false once edited media exists', () => {
    expect(isFastForwardFinalise(makeShoot({ editedPhotoCount: 2 }))).toBe(false);
  });

  it('is false for uploaded/editing/ready/delivered statuses', () => {
    for (const status of ['uploaded', 'editing', 'ready', 'delivered']) {
      expect(isFastForwardFinalise(makeShoot({ status }))).toBe(false);
    }
  });

  it('handles null safely', () => {
    expect(isFastForwardFinalise(null)).toBe(false);
  });
});

describe('buildFinalizeRequestBody', () => {
  it('sends allow_no_media_delivery for the fast-forward path', () => {
    expect(buildFinalizeRequestBody(makeShoot({ status: 'scheduled' }))).toEqual({
      final_status: 'admin_verified',
      allow_no_media_delivery: true,
    });
  });

  it('omits allow_no_media_delivery for the normal finalize path', () => {
    expect(buildFinalizeRequestBody(makeShoot({ status: 'ready', editedPhotoCount: 5 }))).toEqual({
      final_status: 'admin_verified',
    });
  });

  it('respects a custom final status', () => {
    expect(
      buildFinalizeRequestBody(makeShoot({ status: 'uploaded', rawPhotoCount: 1 }), 'completed'),
    ).toEqual({ final_status: 'completed' });
  });
});

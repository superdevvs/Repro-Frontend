import { describe, expect, it } from 'vitest';
import { ShootData } from '@/types/shoots';
import {
  buildFinalizeRequestBody,
  canFinaliseShoot,
  isFastForwardFinalise,
} from './shootFinalize';

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

  it('honors an explicit server denial over the legacy scheduled fallback', () => {
    expect(
      isFastForwardFinalise(
        makeShoot({ status: 'scheduled', canFinalizeNoMedia: false }),
      ),
    ).toBe(false);
  });

  it('allows zero-media uploaded, editing, and ready shoots when advertised by the server', () => {
    for (const status of ['uploaded', 'editing', 'ready']) {
      expect(
        isFastForwardFinalise(makeShoot({ status, can_finalize_no_media: true })),
      ).toBe(true);
    }
  });

  it('is false once raw media exists', () => {
    expect(isFastForwardFinalise(makeShoot({ rawPhotoCount: 3 }))).toBe(false);
  });

  it('is false once edited media exists', () => {
    expect(isFastForwardFinalise(makeShoot({ editedPhotoCount: 2 }))).toBe(false);
  });

  it('does not infer no-media eligibility for later workflow states on old payloads', () => {
    for (const status of ['uploaded', 'editing', 'ready', 'delivered']) {
      expect(isFastForwardFinalise(makeShoot({ status }))).toBe(false);
    }
  });

  it('rejects a stale capability once media is present', () => {
    expect(
      isFastForwardFinalise(
        makeShoot({ status: 'ready', editedPhotoCount: 1, canFinalizeNoMedia: true }),
      ),
    ).toBe(false);
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

  it('sends allow_no_media_delivery for a capability-approved zero-media ready shoot', () => {
    expect(
      buildFinalizeRequestBody(
        makeShoot({ status: 'ready', canFinalizeNoMedia: true }),
      ),
    ).toEqual({
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

describe('canFinaliseShoot', () => {
  it('supports both capability-approved no-media and ordinary edited-media finalisation', () => {
    expect(
      canFinaliseShoot(makeShoot({ status: 'editing', canFinalizeNoMedia: true })),
    ).toBe(true);
    expect(
      canFinaliseShoot(makeShoot({ status: 'ready', editedPhotoCount: 5 })),
    ).toBe(true);
    expect(
      canFinaliseShoot(makeShoot({ status: 'completed', editedPhotoCount: 5 })),
    ).toBe(true);
  });

  it('rejects raw-only, terminal, and denied no-media shoots', () => {
    expect(
      canFinaliseShoot(
        makeShoot({ status: 'uploaded', rawPhotoCount: 3, canFinalizeNoMedia: true }),
      ),
    ).toBe(false);
    expect(
      canFinaliseShoot(
        makeShoot({ status: 'ready', can_finalize_no_media: false }),
      ),
    ).toBe(false);
    expect(
      canFinaliseShoot(
        makeShoot({ status: 'delivered', editedPhotoCount: 2 }),
      ),
    ).toBe(false);
  });
});

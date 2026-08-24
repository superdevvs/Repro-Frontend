import { describe, expect, it } from 'vitest';
import type { ShootData } from '@/types/shoots';
import {
  BRACKET_MODE_OPTIONS,
  DEFAULT_BRACKET_MODE,
  bracketAppliesToUploadService,
  isUploadServiceFulfilled,
  resolveUploadServiceBracketMode,
  resolveUploadServiceExpectedCount,
} from './uploadBrackets';
import {
  pickNextUploadServiceId,
  resolveExpectedRawCount,
  resolveUploadServiceTargets,
  type UploadServiceTarget,
} from './mediaUploadUtils';

const target = (overrides: Partial<UploadServiceTarget> = {}): UploadServiceTarget => ({
  id: '1',
  label: 'HDR Photography',
  photoCount: 30,
  intakeType: 'photo',
  supportsPhotoIntake: true,
  supportsVideoIntake: false,
  isPhotoService: true,
  usesHdrBrackets: true,
  bracketMode: 5,
  scheduledAt: null,
  order: 0,
  ...overrides,
});

/** A service that is bookable but is not an upload target, such as a floor plan. */
const nonIntakeTarget = (overrides: Partial<UploadServiceTarget> = {}): UploadServiceTarget => target({
  id: '30',
  label: '2D Floor Plan',
  photoCount: null,
  intakeType: 'none',
  supportsPhotoIntake: false,
  supportsVideoIntake: false,
  isPhotoService: false,
  usesHdrBrackets: false,
  bracketMode: null,
  ...overrides,
});

describe('which services bracket', () => {
  it('follows the catalogue flag rather than guessing from the photo count', () => {
    expect(bracketAppliesToUploadService(target({ usesHdrBrackets: true }))).toBe(true);
    expect(bracketAppliesToUploadService(target({ usesHdrBrackets: false }))).toBe(false);
  });

  it('leaves drone photography out even though it is photo work with a photo count', () => {
    // Drone is genuine photo intake with a count of its own, so it stays selectable.
    // The rule this replaced ("a photo service with a positive photo count") treated
    // it as bracketed and multiplied its expected raws by 5.
    const drone = target({
      id: '4',
      label: 'Aerial Drone Photos',
      photoCount: 10,
      usesHdrBrackets: false,
      bracketMode: null,
    });

    expect(bracketAppliesToUploadService(drone)).toBe(false);
    expect(resolveUploadServiceBracketMode(drone)).toBeNull();
    expect(resolveUploadServiceExpectedCount(drone)).toBe(10);
  });

  it('never brackets work that cannot receive photo capture at all', () => {
    // Both halves are required, so a stray catalogue flag on a non-intake row cannot
    // resurrect a bracket size for it.
    expect(bracketAppliesToUploadService(nonIntakeTarget({ usesHdrBrackets: true }))).toBe(false);
    expect(bracketAppliesToUploadService(target({
      intakeType: 'video',
      supportsPhotoIntake: false,
      supportsVideoIntake: true,
      usesHdrBrackets: true,
    }))).toBe(false);
  });

  it('offers only the sizes the product sells', () => {
    expect([...BRACKET_MODE_OPTIONS]).toEqual([3, 5]);
    expect(DEFAULT_BRACKET_MODE).toBe(5);
  });
});

describe('resolving a size for one service', () => {
  it('prefers an explicit override, then the service value, then the default', () => {
    expect(resolveUploadServiceBracketMode(target({ bracketMode: 5 }), 3)).toBe(3);
    expect(resolveUploadServiceBracketMode(target({ bracketMode: 3 }))).toBe(3);
    expect(resolveUploadServiceBracketMode(target({ bracketMode: null }))).toBe(DEFAULT_BRACKET_MODE);
  });

  it('returns null for a service that does not bracket, whatever the override says', () => {
    expect(resolveUploadServiceBracketMode(target({ usesHdrBrackets: false }), 3)).toBeNull();
  });

  it('returns null when the service is not in the payload at all', () => {
    expect(resolveUploadServiceBracketMode(undefined, 5)).toBeNull();
  });
});

describe('expected raw counts per service', () => {
  it('multiplies only bracketed work, by that service own size', () => {
    expect(resolveUploadServiceExpectedCount(target({ photoCount: 30, bracketMode: 5 }))).toBe(150);
    expect(resolveUploadServiceExpectedCount(target({ photoCount: 12, bracketMode: 3 }))).toBe(36);
  });

  it('honours an override over the service size', () => {
    expect(resolveUploadServiceExpectedCount(target({ photoCount: 30, bracketMode: 5 }), 3)).toBe(90);
  });

  it('never multiplies a service that does not bracket', () => {
    const drone = target({ photoCount: 10, usesHdrBrackets: false, bracketMode: null });
    expect(resolveUploadServiceExpectedCount(drone, 5)).toBe(10);
  });

  it('reports zero for work that owes no photos, and null when the count is unset', () => {
    // Zero and null mean different things and must not collapse into each other. A
    // floor plan owes nothing; a variable HDR product owes an unknown amount.
    expect(resolveUploadServiceExpectedCount(nonIntakeTarget(), 5)).toBe(0);
    expect(resolveUploadServiceExpectedCount(target({ photoCount: null }), 5)).toBeNull();
    expect(resolveUploadServiceExpectedCount(target({ photoCount: 0 }), 5)).toBeNull();
  });

  it('treats a service as shot once it holds its own expected count', () => {
    const hdr = target({ photoCount: 30, bracketMode: 5 });
    expect(isUploadServiceFulfilled(hdr, 149)).toBe(false);
    expect(isUploadServiceFulfilled(hdr, 150)).toBe(true);

    // With no count to compare against, "has something" is the only signal there is.
    const unspecified = target({ photoCount: null, usesHdrBrackets: false, bracketMode: null });
    expect(isUploadServiceFulfilled(unspecified, 0)).toBe(false);
    expect(isUploadServiceFulfilled(unspecified, 1)).toBe(true);
  });
});

describe('expected raw count for a whole shoot', () => {
  const shootWithServices = (services: Array<Record<string, unknown>>): ShootData => ({
    id: '1',
    serviceItems: services,
  } as unknown as ShootData);

  it('sums each service at its own size rather than multiplying one shoot total', () => {
    // The requirement's arithmetic: 30 finals at 5x plus 12 finals at 3x is 186,
    // which is not any single product of 42 finals and one bracket size.
    const shoot = shootWithServices([
      {
        id: '28', shoot_service_id: '28', name: 'HDR Photography', photo_count: 30,
        upload_intake_type: 'photo', uses_hdr_brackets: true, effective_bracket_mode: 5,
      },
      {
        id: '29', shoot_service_id: '29', name: 'Twilight Photography', photo_count: 12,
        upload_intake_type: 'photo', uses_hdr_brackets: true, effective_bracket_mode: 3,
      },
      {
        id: '30', shoot_service_id: '30', name: '2D Floor Plan', photo_count: 0,
        upload_intake_type: 'none', uses_hdr_brackets: false, effective_bracket_mode: null,
      },
    ]);

    // The floor plan is not an upload target, so it is not even offered.
    const targets = resolveUploadServiceTargets(shoot, { id: '1', role: 'admin' }, 'raw');
    expect(targets).toHaveLength(2);

    expect(resolveExpectedRawCount(shoot, targets)).toBe(186);
    expect(resolveExpectedRawCount(shoot, targets)).not.toBe(42 * 5);
    expect(resolveExpectedRawCount(shoot, targets)).not.toBe(42 * 3);
  });

  it('reads each service bracket state out of the payload', () => {
    const shoot = shootWithServices([
      {
        id: '28', shoot_service_id: '28', name: 'HDR Photography', photo_count: 30,
        upload_intake_type: 'photo', uses_hdr_brackets: true, effective_bracket_mode: 5,
      },
      {
        id: '4', shoot_service_id: '4', name: 'Aerial Drone Photos', photo_count: 10,
        upload_intake_type: 'photo', uses_hdr_brackets: false, effective_bracket_mode: null,
      },
    ]);

    const targets = resolveUploadServiceTargets(shoot, { id: '1', role: 'admin' }, 'raw');
    const byLabel = new Map(targets.map((entry) => [entry.label, entry]));

    expect(byLabel.get('HDR Photography')?.usesHdrBrackets).toBe(true);
    expect(byLabel.get('HDR Photography')?.bracketMode).toBe(5);
    expect(byLabel.get('Aerial Drone Photos')?.usesHdrBrackets).toBe(false);
    expect(byLabel.get('Aerial Drone Photos')?.bracketMode).toBeNull();

    // 30x5 for the HDR set plus 10 unmultiplied drone frames.
    expect(resolveExpectedRawCount(shoot, targets)).toBe(160);
  });

  it('accepts the 0/1 and "1" shapes a boolean arrives in', () => {
    const shoot = shootWithServices([
      {
        id: '28', shoot_service_id: '28', name: 'Numeric', photo_count: 10,
        upload_intake_type: 'photo', uses_hdr_brackets: 1, effective_bracket_mode: 3,
      },
      {
        id: '29', shoot_service_id: '29', name: 'String', photo_count: 10,
        upload_intake_type: 'photo', uses_hdr_brackets: '1', effective_bracket_mode: 3,
      },
      {
        id: '30', shoot_service_id: '30', name: 'Zero', photo_count: 10,
        upload_intake_type: 'photo', uses_hdr_brackets: 0, effective_bracket_mode: null,
      },
    ]);

    const byLabel = new Map(
      resolveUploadServiceTargets(shoot, { id: '1', role: 'admin' }, 'raw')
        .map((entry) => [entry.label, entry]),
    );

    expect(byLabel.get('Numeric')?.usesHdrBrackets).toBe(true);
    expect(byLabel.get('String')?.usesHdrBrackets).toBe(true);
    expect(byLabel.get('Zero')?.usesHdrBrackets).toBe(false);
  });

  it('applies per-service overrides when the user changes one group', () => {
    const shoot = shootWithServices([
      {
        id: '28', shoot_service_id: '28', name: 'HDR Photography', photo_count: 30,
        upload_intake_type: 'photo', uses_hdr_brackets: true, effective_bracket_mode: 5,
      },
      {
        id: '29', shoot_service_id: '29', name: 'Twilight Photography', photo_count: 12,
        upload_intake_type: 'photo', uses_hdr_brackets: true, effective_bracket_mode: 3,
      },
    ]);
    const targets = resolveUploadServiceTargets(shoot, { id: '1', role: 'admin' }, 'raw');

    // Only the HDR group is moved to 3x: 30x3 + 12x3 = 126.
    expect(resolveExpectedRawCount(shoot, targets, { 28: 3 })).toBe(126);
    // And moving Twilight to 5x instead: 30x5 + 12x5 = 210.
    expect(resolveExpectedRawCount(shoot, targets, { 28: 5, 29: 5 })).toBe(210);
  });

  it('reports nothing rather than a fabricated total when no per-service data exists', () => {
    // The old fallback was expectedFinalCount x 5, which invented a number for every
    // shoot and could not express two services shot at different sizes.
    const shoot = {
      id: '1',
      expectedFinalCount: 30,
      serviceItems: [],
    } as unknown as ShootData;

    expect(resolveExpectedRawCount(shoot, [])).toBe(0);
  });
});

describe('picking the next service to upload to', () => {
  it('measures each service against its own expected count', () => {
    const shoot = {
      id: '1',
      serviceItems: [
        {
          id: '28', shoot_service_id: '28', name: 'HDR Photography', photo_count: 10,
          upload_intake_type: 'photo', uses_hdr_brackets: true, effective_bracket_mode: 3,
        },
        {
          id: '29', shoot_service_id: '29', name: 'Twilight Photography', photo_count: 10,
          upload_intake_type: 'photo', uses_hdr_brackets: true, effective_bracket_mode: 5,
        },
      ],
    } as unknown as ShootData;

    const targets = resolveUploadServiceTargets(shoot, { id: '1', role: 'admin' }, 'raw');

    // HDR owes 10x3 = 30 and already has them, so the next service that still owes
    // files is Twilight, which owes 10x5 = 50.
    expect(pickNextUploadServiceId(targets, { 28: 30, 29: 0 })).toBe('29');

    // With HDR one frame short it wins again, because its own size decides.
    expect(pickNextUploadServiceId(targets, { 28: 29, 29: 0 })).toBe('28');
  });
});

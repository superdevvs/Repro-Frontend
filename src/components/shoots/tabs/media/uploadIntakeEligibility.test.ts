import { describe, expect, it } from 'vitest';
import type { ShootData } from '@/types/shoots';
import {
  isExpectedRawCountExact,
  resolveEligibleUploadServices,
  resolveExpectedRawCount,
  resolveUploadLaneForFile,
  resolveUploadLanesForFiles,
  resolveUploadServiceTargets,
} from './mediaUploadUtils';
import { resolveUploadServiceExpectedCount } from './uploadBrackets';

/**
 * Upload eligibility is capability data, not a name or category pattern.
 *
 * These cover the rule end to end: a booked service reaches the photo raw selector
 * only if it declares `photo` or `photo_video`, reaches the video raw selector only
 * if it declares `video` or `photo_video`, and reaches neither if it declares `none`.
 * Fees, travel, enhancements, floor plans and dedicated 3D tour products stay
 * bookable and stay assignable — they simply stop being upload targets.
 */

type ServiceRow = Record<string, unknown>;

const shootWith = (services: ServiceRow[], extra: Record<string, unknown> = {}): ShootData => ({
  id: '77',
  serviceItems: services,
  ...extra,
} as unknown as ShootData);

const admin = { id: '1', role: 'admin' };

const row = (
  id: string,
  name: string,
  intake: string,
  overrides: ServiceRow = {},
): ServiceRow => ({
  id,
  shoot_service_id: id,
  name,
  upload_intake_type: intake,
  uses_hdr_brackets: false,
  effective_bracket_mode: null,
  photo_count: null,
  ...overrides,
});

const labelsFor = (shoot: ShootData, lanes?: Array<'photo' | 'video'>) =>
  resolveUploadServiceTargets(shoot, admin, 'raw', lanes).map((target) => target.label);

describe('lane derivation', () => {
  it('reads the lane from the MIME type only', () => {
    expect(resolveUploadLaneForFile({ type: 'image/jpeg' })).toBe('photo');
    expect(resolveUploadLaneForFile({ type: 'video/mp4' })).toBe('video');
    // A video-sounding filename is irrelevant; only the type decides.
    expect(resolveUploadLaneForFile({ type: 'image/x-canon-cr2' })).toBe('photo');
    expect(resolveUploadLaneForFile({ type: '' })).toBe('photo');
  });

  it('defaults an empty batch to the photo lane and de-duplicates mixed batches', () => {
    expect(resolveUploadLanesForFiles([])).toEqual(['photo']);
    expect(resolveUploadLanesForFiles([{ type: 'image/jpeg' }, { type: 'image/png' }])).toEqual(['photo']);
    expect(resolveUploadLanesForFiles([{ type: 'video/mp4' }, { type: 'image/jpeg' }]).sort())
      .toEqual(['photo', 'video']);
  });
});

describe('HDR + Floor Plan + Virtual Staging + Drone on one shoot', () => {
  const shoot = shootWith([
    row('106', '10 Exterior HDR Photos', 'photo', {
      photo_count: 10, uses_hdr_brackets: true, effective_bracket_mode: 5,
    }),
    row('107', '2D Floor plans', 'none'),
    row('108', 'Virtual Staging (per image)', 'none'),
    row('109', '10-12 Drone Photos Package', 'photo', { photo_count: 10 }),
  ]);

  it('offers HDR and Drone only', () => {
    expect(labelsFor(shoot)).toEqual(['10 Exterior HDR Photos', '10-12 Drone Photos Package']);
  });

  it('excludes the floor plan and virtual staging for an admin too', () => {
    // Capability is not a permission. An admin is not exempt, because the question is
    // whether the service can receive this media at all.
    const offered = resolveEligibleUploadServices(shoot, admin, 'raw').map((option) => option.label);
    expect(offered).not.toContain('2D Floor plans');
    expect(offered).not.toContain('Virtual Staging (per image)');
  });

  it('reproduces the shoot-77 defect and proves the corrected total', () => {
    const targets = resolveUploadServiceTargets(shoot, admin, 'raw');

    // The live behaviour was 65: HDR contributed a correct 10x5 = 50, then the floor
    // plan, virtual staging and drone rows each contributed 5 because a null
    // photo_count fell through to the pivot quantity of 1 and was multiplied by the
    // default bracket size of 5.
    expect(resolveExpectedRawCount(shoot, targets)).not.toBe(65);

    // Corrected: HDR 10 finals x 5 = 50, Drone 10 finals unbracketed = 10, and the
    // two non-intake rows contribute nothing at all.
    expect(resolveExpectedRawCount(shoot, targets)).toBe(60);

    const byLabel = new Map(targets.map((target) => [target.label, target]));
    expect(resolveUploadServiceExpectedCount(byLabel.get('10 Exterior HDR Photos')!)).toBe(50);
    // Drone contributes its real count, not zero and certainly not 1 x 5.
    expect(resolveUploadServiceExpectedCount(byLabel.get('10-12 Drone Photos Package')!)).toBe(10);
    expect(isExpectedRawCountExact(targets)).toBe(true);
  });
});

describe('a Matterport-only shoot', () => {
  const shoot = shootWith([
    row('80', '3D Matterport w/ 2D Floor plans', 'none'),
  ]);

  it('offers no raw photo target', () => {
    expect(labelsFor(shoot)).toEqual([]);
  });

  it('offers no raw video target either', () => {
    expect(labelsFor(shoot, ['video'])).toEqual([]);
  });

  it('owes no raw files, rather than an unknown amount', () => {
    const targets = resolveUploadServiceTargets(shoot, admin, 'raw');
    expect(resolveExpectedRawCount(shoot, targets)).toBe(0);
  });
});

describe('a bundled HDR + Matterport package', () => {
  // Production proves packages do not expand into component rows, so this single
  // execution row has to supply the photo lane itself. The Matterport portion is
  // still delivered by the dedicated provider workflow and is not a lane here.
  const shoot = shootWith([
    row('89', 'HDR Photos & 3D Matterport', 'photo', {
      photo_count: 30, uses_hdr_brackets: true, effective_bracket_mode: 5,
    }),
    row('90', '3D Matterport w/ 2D Floor plans', 'none'),
  ]);

  it('supplies photo raw intake from the package row', () => {
    expect(labelsFor(shoot)).toEqual(['HDR Photos & 3D Matterport']);
  });

  it('never turns the standalone Matterport row into a lane', () => {
    expect(labelsFor(shoot, ['video'])).toEqual([]);
    expect(labelsFor(shoot, ['photo', 'video'])).toEqual([]);
  });

  it('brackets the package photo work at its own size', () => {
    const [target] = resolveUploadServiceTargets(shoot, admin, 'raw');
    expect(resolveUploadServiceExpectedCount(target)).toBe(150);
  });
});

describe('a photo_video package', () => {
  const shoot = shootWith([
    row('91', 'HDR Photos, Video & Premium iGuide', 'photo_video', {
      photo_count: 30, uses_hdr_brackets: true, effective_bracket_mode: 5,
    }),
  ]);

  it('is eligible for both lanes', () => {
    expect(labelsFor(shoot, ['photo'])).toEqual(['HDR Photos, Video & Premium iGuide']);
    expect(labelsFor(shoot, ['video'])).toEqual(['HDR Photos, Video & Premium iGuide']);
    // And for a mixed batch, because it genuinely covers both.
    expect(labelsFor(shoot, ['photo', 'video'])).toEqual(['HDR Photos, Video & Premium iGuide']);
  });

  it('exposes both capabilities on the target', () => {
    const [target] = resolveUploadServiceTargets(shoot, admin, 'raw');
    expect(target.intakeType).toBe('photo_video');
    expect(target.supportsPhotoIntake).toBe(true);
    expect(target.supportsVideoIntake).toBe(true);
  });
});

describe('single-lane services and mixed batches', () => {
  const shoot = shootWith([
    row('12', 'Walkthrough Video', 'video'),
    row('1', '25 HDR Photos', 'photo', {
      photo_count: 25, uses_hdr_brackets: true, effective_bracket_mode: 5,
    }),
  ]);

  it('keeps each single-lane service in its own lane', () => {
    expect(labelsFor(shoot, ['photo'])).toEqual(['25 HDR Photos']);
    expect(labelsFor(shoot, ['video'])).toEqual(['Walkthrough Video']);
  });

  it('offers nothing for a mixed batch when no service covers both lanes', () => {
    // Matching the backend, a target must support every lane the batch needs.
    expect(labelsFor(shoot, ['photo', 'video'])).toEqual([]);
  });
});

describe('unknown capability', () => {
  it('is not selectable rather than assumed to be photo', () => {
    const shoot = shootWith([
      { id: '5', shoot_service_id: '5', name: 'Some New Service', photo_count: 10 },
      { id: '6', shoot_service_id: '6', name: 'Bogus Capability', upload_intake_type: 'wat' },
    ]);

    // The previous rule admitted anything whose name did not match /video/.
    expect(labelsFor(shoot)).toEqual([]);
  });

  it('never emits a catalogue service id in place of an execution row id', () => {
    // The `services` shape carries the catalogue id in `id`. Submitting that
    // addressed the wrong row, so a row with no resolvable pivot is dropped.
    const shoot = shootWith([
      { id: '999', name: 'No Pivot Row', upload_intake_type: 'photo', photo_count: 10 },
    ]);

    expect(resolveUploadServiceTargets(shoot, admin, 'raw')).toEqual([]);
  });
});

describe('an unconfigured photo count', () => {
  const shoot = shootWith([
    row('87', 'HDR Photos & Video', 'photo_video', {
      photo_count: 0, uses_hdr_brackets: true, effective_bracket_mode: 5,
    }),
  ]);

  it('is still selectable, because it owes photos', () => {
    expect(labelsFor(shoot)).toEqual(['HDR Photos & Video']);
  });

  it('reports no denominator instead of inventing one from booking quantity', () => {
    const [target] = resolveUploadServiceTargets(shoot, admin, 'raw');

    expect(target.photoCount).toBeNull();
    expect(resolveUploadServiceExpectedCount(target)).toBeNull();
    // Not 1 x 5 from the pivot quantity, which is exactly what the old chain produced.
    expect(resolveUploadServiceExpectedCount(target)).not.toBe(5);
  });

  it('marks the shoot aggregate as inexact', () => {
    const targets = resolveUploadServiceTargets(shoot, admin, 'raw');
    expect(isExpectedRawCountExact(targets)).toBe(false);
    // The sum omits the unknown component rather than guessing at it.
    expect(resolveExpectedRawCount(shoot, targets)).toBe(0);
  });
});

describe('independent bracket sizes across services', () => {
  const shoot = shootWith([
    row('28', 'Exterior HDR', 'photo', {
      photo_count: 30, uses_hdr_brackets: true, effective_bracket_mode: 5,
    }),
    row('29', 'Twilight Photos - 10 Photos', 'photo', {
      photo_count: 12, uses_hdr_brackets: true, effective_bracket_mode: 3,
    }),
    row('30', '10-12 Drone Photos Package', 'photo', { photo_count: 10 }),
  ]);

  it('keeps 5x, 3x and non-bracket work independent in one shoot', () => {
    const targets = resolveUploadServiceTargets(shoot, admin, 'raw');
    const byLabel = new Map(targets.map((target) => [target.label, target]));

    expect(byLabel.get('Exterior HDR')?.bracketMode).toBe(5);
    expect(byLabel.get('Twilight Photos - 10 Photos')?.bracketMode).toBe(3);
    expect(byLabel.get('10-12 Drone Photos Package')?.bracketMode).toBeNull();

    expect(resolveUploadServiceExpectedCount(byLabel.get('Exterior HDR')!)).toBe(150);
    expect(resolveUploadServiceExpectedCount(byLabel.get('Twilight Photos - 10 Photos')!)).toBe(36);
    expect(resolveUploadServiceExpectedCount(byLabel.get('10-12 Drone Photos Package')!)).toBe(10);

    // 150 + 36 + 10. No single shoot-wide multiplication produces this.
    expect(resolveExpectedRawCount(shoot, targets)).toBe(196);
  });
});

describe('photographer assignment still applies on top of capability', () => {
  const shoot = shootWith([
    row('106', 'Exterior HDR', 'photo', { photo_count: 10, photographer_id: '7' }),
    row('107', 'Interior HDR', 'photo', { photo_count: 10, photographer_id: '8' }),
    row('108', '2D Floor plans', 'none', { photographer_id: '7' }),
  ]);

  it('gives a photographer only their own eligible rows', () => {
    const targets = resolveUploadServiceTargets(shoot, { id: '7', role: 'photographer' }, 'raw');
    // Their floor-plan assignment is real, but it is not an upload target.
    expect(targets.map((target) => target.label)).toEqual(['Exterior HDR']);
  });
});

describe('the original user story: one photographer, several booked services', () => {
  // The shoot the requirement describes.
  const shoot = shootWith([
    row('101', 'Exterior HDR', 'photo', {
      photo_count: 10, uses_hdr_brackets: true, effective_bracket_mode: 5, photographer_id: '7',
    }),
    row('102', 'Drone Photos', 'photo', { photo_count: 10, photographer_id: '7' }),
    row('103', 'Twilight', 'photo', {
      photo_count: 10, uses_hdr_brackets: true, effective_bracket_mode: 3, photographer_id: '8',
    }),
    row('104', '2D Floor plans', 'none', { photographer_id: '7' }),
    row('105', 'Virtual Staging', 'none', { photographer_id: '7' }),
    row('106', '3D Matterport w/ 2D Floor plans', 'none', { photographer_id: '7' }),
  ]);

  const photographerA = { id: '7', role: 'photographer' };

  it('offers photographer A exactly their two eligible services', () => {
    const labels = resolveUploadServiceTargets(shoot, photographerA, 'raw').map((t) => t.label);

    expect(labels).toEqual(['Exterior HDR', 'Drone Photos']);
    // Another photographer's work, and every non-intake product, stay out.
    expect(labels).not.toContain('Twilight');
    expect(labels).not.toContain('2D Floor plans');
    expect(labels).not.toContain('Virtual Staging');
    expect(labels).not.toContain('3D Matterport w/ 2D Floor plans');
  });

  it('never yields an empty service id for a photographer with eligible work', () => {
    // The selector must not be able to fall back to an unassigned upload: every option
    // it can produce is a real execution row.
    const targets = resolveUploadServiceTargets(shoot, photographerA, 'raw');
    expect(targets.every((target) => target.id !== '')).toBe(true);
    expect(targets.map((target) => target.id)).toEqual(['101', '102']);
  });

  it('keeps each of their services on its own bracket footing', () => {
    const byLabel = new Map(
      resolveUploadServiceTargets(shoot, photographerA, 'raw').map((t) => [t.label, t]),
    );

    expect(byLabel.get('Exterior HDR')?.bracketMode).toBe(5);
    expect(byLabel.get('Exterior HDR')?.usesHdrBrackets).toBe(true);
    // Drone is real photo capture that does not stack exposures.
    expect(byLabel.get('Drone Photos')?.usesHdrBrackets).toBe(false);
    expect(byLabel.get('Drone Photos')?.bracketMode).toBeNull();
  });

  it('gives photographer B only their own service', () => {
    expect(resolveUploadServiceTargets(shoot, { id: '8', role: 'photographer' }, 'raw')
      .map((t) => t.label)).toEqual(['Twilight']);
  });
});

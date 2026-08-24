import { describe, expect, it } from 'vitest';
import {
  resolveExpectedRawCount,
  resolveUploadServiceTargets,
} from '@/components/shoots/tabs/media/mediaUploadUtils';
import { bracketAppliesToUploadService } from '@/components/shoots/tabs/media/uploadBrackets';
import { transformShootFromApi } from './shootNormalization';

/**
 * Normalisation rebuilds every service item from an explicit list of fields, so a
 * field the API sends but this list omits is silently dropped on the way to the UI.
 *
 * That is exactly what happened to the per-service bracket fields: the API returned
 * `uses_hdr_brackets: true` and `effective_bracket_mode: 5`, unit tests of the
 * bracket helpers passed against hand-built targets, and the upload panel still
 * showed every service as non-bracketing because the values never survived
 * normalisation. These tests pin the fields to the normalised shape so the same
 * class of loss cannot return unnoticed.
 */
describe('transformShootFromApi per-service bracket state', () => {
  const apiShoot = () => ({
    id: 27,
    address: '123 Main St',
    services: [
      { id: 1, name: 'HDR Photography', price: 100 },
      { id: 6, name: 'Twilight Photography', price: 100 },
      { id: 4, name: 'Aerial Drone Photos', price: 100 },
    ],
    serviceItems: [
      {
        id: 28,
        service_id: 1,
        shoot_service_id: 28,
        name: 'HDR Photography',
        price: 100,
        quantity: 1,
        photo_count: 30,
        lane: 'photo',
        upload_intake_type: 'photo',
        uses_hdr_brackets: true,
        bracket_mode: 5,
        effective_bracket_mode: 5,
      },
      {
        id: 29,
        service_id: 6,
        shoot_service_id: 29,
        name: 'Twilight Photography',
        price: 100,
        quantity: 1,
        photo_count: 12,
        lane: 'photo',
        upload_intake_type: 'photo',
        uses_hdr_brackets: true,
        bracket_mode: 3,
        effective_bracket_mode: 3,
      },
      {
        id: 4,
        service_id: 4,
        shoot_service_id: 4,
        name: 'Aerial Drone Photos',
        price: 100,
        quantity: 1,
        photo_count: 10,
        lane: 'photo',
        upload_intake_type: 'photo',
        uses_hdr_brackets: false,
        bracket_mode: null,
        effective_bracket_mode: null,
      },
    ],
  });

  it('carries uses_hdr_brackets and the resolved size through to the normalised item', () => {
    const shoot = transformShootFromApi(apiShoot() as never);
    const byName = new Map((shoot.serviceItems ?? []).map((item) => [item.name, item]));

    expect(byName.get('HDR Photography')?.uses_hdr_brackets).toBe(true);
    expect(byName.get('HDR Photography')?.effective_bracket_mode).toBe(5);
    expect(byName.get('Twilight Photography')?.uses_hdr_brackets).toBe(true);
    expect(byName.get('Twilight Photography')?.effective_bracket_mode).toBe(3);

    // An explicit false has to survive rather than being treated as absent.
    expect(byName.get('Aerial Drone Photos')?.uses_hdr_brackets).toBe(false);
    expect(byName.get('Aerial Drone Photos')?.effective_bracket_mode).toBeNull();
  });

  it('produces upload targets the panel can render two different sizes from', () => {
    const shoot = transformShootFromApi(apiShoot() as never);
    const targets = resolveUploadServiceTargets(shoot, { id: '1', role: 'admin' }, 'raw');
    const byLabel = new Map(targets.map((target) => [target.label, target]));

    const hdr = byLabel.get('HDR Photography');
    const twilight = byLabel.get('Twilight Photography');
    const drone = byLabel.get('Aerial Drone Photos');

    expect(hdr?.bracketMode).toBe(5);
    expect(twilight?.bracketMode).toBe(3);
    expect(bracketAppliesToUploadService(hdr!)).toBe(true);
    expect(bracketAppliesToUploadService(twilight!)).toBe(true);
    expect(bracketAppliesToUploadService(drone!)).toBe(false);

    // 30x5 + 12x3 + 10 unmultiplied drone frames.
    expect(resolveExpectedRawCount(shoot, targets)).toBe(196);
  });

  it('accepts the 0/1 shape a boolean arrives in from MySQL', () => {
    const payload = apiShoot();
    payload.serviceItems[0].uses_hdr_brackets = 1 as never;
    payload.serviceItems[2].uses_hdr_brackets = 0 as never;

    const shoot = transformShootFromApi(payload as never);
    const byName = new Map((shoot.serviceItems ?? []).map((item) => [item.name, item]));

    expect(byName.get('HDR Photography')?.uses_hdr_brackets).toBe(true);
    expect(byName.get('Aerial Drone Photos')?.uses_hdr_brackets).toBe(false);
  });

  it('falls back to false rather than undefined when the API omits the field', () => {
    const payload = apiShoot();
    delete (payload.serviceItems[0] as Record<string, unknown>).uses_hdr_brackets;
    delete (payload.serviceItems[0] as Record<string, unknown>).effective_bracket_mode;

    const shoot = transformShootFromApi(payload as never);
    const item = (shoot.serviceItems ?? []).find((entry) => entry.name === 'HDR Photography');

    // An un-migrated backend must read as "does not bracket" rather than crashing
    // or silently defaulting to a size.
    expect(item?.uses_hdr_brackets).toBe(false);
    expect(item?.effective_bracket_mode).toBeNull();
  });
});

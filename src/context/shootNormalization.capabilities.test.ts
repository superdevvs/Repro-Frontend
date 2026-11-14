import { describe, expect, it } from 'vitest';

import { transformShootFromApi } from './shootNormalization';

describe('transformShootFromApi finalisation capabilities', () => {
  describe.each(['can_share_guest', 'canShareGuest'] as const)('guest sharing capability from %s', key => {
    it.each([true, false, undefined])('preserves %s under both aliases', permission => {
      const shoot = transformShootFromApi({ id: 42, [key]: permission });

      expect(shoot.canShareGuest).toBe(permission);
      expect(shoot.can_share_guest).toBe(permission);
    });
  });

  it('keeps guest sharing aliases consistent with the canonical explicit denial', () => {
    const shoot = transformShootFromApi({ id: 42, canShareGuest: false, can_share_guest: true });

    expect(shoot.canShareGuest).toBe(false);
    expect(shoot.can_share_guest).toBe(false);
  });

  it.each([true, false, undefined])('preserves the current delivery action capability (%s)', permission => {
    const shoot = transformShootFromApi({ id: 42, can_finalize_delivery: permission });
    expect(shoot.canFinalizeDelivery).toBe(permission);
    expect(shoot.can_finalize_delivery).toBe(permission);
  });

  it.each([true, false, undefined])('preserves the server video editor context permission (%s)', permission => {
    const shoot = transformShootFromApi({ id: 42, can_view_video_editor_context: permission,
      client: { id: 12, name: 'Video Client' }, company_notes: 'Use client branding.' });
    expect(shoot.canViewVideoEditorContext).toBe(permission);
    expect(shoot.notes).toMatchObject({ companyNotes: 'Use client branding.' });
  });

  it('preserves the role-specific no-media capability under both aliases', () => {
    const shoot = transformShootFromApi({
      id: 42,
      can_finalize_no_media: true,
    });

    expect(shoot.canFinalizeNoMedia).toBe(true);
    expect(shoot.can_finalize_no_media).toBe(true);
  });

  it('keeps an omitted capability undefined for rolling-deployment fallback', () => {
    const shoot = transformShootFromApi({ id: 43 });

    expect(shoot.canFinalizeNoMedia).toBeUndefined();
    expect(shoot.can_finalize_no_media).toBeUndefined();
  });
});

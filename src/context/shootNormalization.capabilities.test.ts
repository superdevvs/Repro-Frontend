import { describe, expect, it } from 'vitest';

import { transformShootFromApi } from './shootNormalization';

describe('transformShootFromApi finalisation capabilities', () => {
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

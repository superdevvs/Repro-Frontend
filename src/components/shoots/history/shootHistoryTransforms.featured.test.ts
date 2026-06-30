// Regression tests for the Shoot History "Featured" tab.
//
// Bug: mapShootApiToShootData in shootHistoryTransforms.ts (the mapper the
// Shoot History hooks actually import) did NOT map any featured fields, so
// operationalData shoots lacked isFeatured/featured_status and
// isFeaturedTabShoot() was always false -> the Featured tab was always empty
// even though the backend's tab=featured scope returned the shoot.
//
// These tests pin the mapping so the regression cannot return, and assert the
// mapped shoot is recognised by the same predicates the tab filter uses.

import { describe, expect, it } from 'vitest';
import { mapShootApiToShootData } from './shootHistoryTransforms';
import { isFeaturedShoot, isFeaturedPendingShoot, isFeaturedTabShoot } from './shootHistoryUtils';

describe('mapShootApiToShootData – featured fields', () => {
  it('maps snake_case featured fields from the API payload', () => {
    const shoot = mapShootApiToShootData({
      id: 30,
      is_featured: true,
      featured_status: 'featured',
      featured_pending: false,
      featured_requested_at: '2026-06-20T10:00:00Z',
    });

    expect(shoot.isFeatured).toBe(true);
    expect(shoot.is_featured).toBe(true);
    expect(shoot.featuredStatus).toBe('featured');
    expect(shoot.featured_status).toBe('featured');
    expect(shoot.featuredRequestedAt).toBe('2026-06-20T10:00:00Z');
  });

  it('maps camelCase featured fields from the API payload', () => {
    const shoot = mapShootApiToShootData({
      id: 31,
      isFeatured: true,
      featuredStatus: 'featured',
    });

    expect(shoot.isFeatured).toBe(true);
    expect(shoot.featuredStatus).toBe('featured');
  });

  it('a featured shoot is recognised by the Featured tab predicates', () => {
    const shoot = mapShootApiToShootData({ id: 30, is_featured: true, featured_status: 'featured' });

    expect(isFeaturedShoot(shoot)).toBe(true);
    expect(isFeaturedTabShoot(shoot)).toBe(true);
  });

  it('a pending shoot is recognised by the Featured tab predicates', () => {
    const shoot = mapShootApiToShootData({
      id: 32,
      is_featured: false,
      featured_pending: true,
      featured_status: 'pending',
    });

    expect(isFeaturedShoot(shoot)).toBe(false);
    expect(isFeaturedPendingShoot(shoot)).toBe(true);
    expect(isFeaturedTabShoot(shoot)).toBe(true);
  });

  it('a non-featured shoot defaults to none and is excluded from the Featured tab', () => {
    const shoot = mapShootApiToShootData({ id: 33 });

    expect(shoot.isFeatured).toBe(false);
    expect(shoot.featuredStatus).toBe('none');
    expect(isFeaturedTabShoot(shoot)).toBe(false);
  });
});

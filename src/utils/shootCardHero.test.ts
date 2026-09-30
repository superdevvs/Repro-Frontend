import { describe, expect, it } from 'vitest';
import {
  isFloorplanLikeHeroFile,
  isFloorplanLikeHeroUrl,
  selectShootCardHeroUrl,
  selectShootCardHeroUrls,
} from './shootCardHero';

describe('shootCardHero selection', () => {
  const floorplanGrid =
    'https://cdn.test/shoots/166/grids/0-5933-keysville-road-keymar-md-united-states-0-6d830b71_grid.jpg';
  const floorplanPreview =
    'https://cdn.test/shoots/166/floorplans/previews/0-5933-keysville-road-keymar-md-united-states-merged-d009ebc8-10623-p1.jpg';
  const exterior =
    'https://cdn.test/shoots/166/grids/5933%20Keysville%20Rd-2847_0116_grid.jpg';
  const snap =
    'https://cdn.test/shoots/145/grids/003_SNAP4206_grid.jpg';

  it('detects CubiCasa-style floorplan grids and /floorplans/ paths', () => {
    expect(isFloorplanLikeHeroUrl(floorplanGrid)).toBe(true);
    expect(isFloorplanLikeHeroUrl(floorplanPreview)).toBe(true);
    expect(isFloorplanLikeHeroUrl(exterior)).toBe(false);
    expect(isFloorplanLikeHeroUrl(snap)).toBe(false);
  });

  it('prefers edited exterior over floorplan hero/previews (Keysville case)', () => {
    expect(
      selectShootCardHeroUrl({
        heroImage: floorplanGrid,
        previewImages: [floorplanGrid, floorplanPreview, exterior, snap],
      }),
    ).toBe(exterior);
  });

  it('keeps floorplan only when no better photo exists', () => {
    expect(
      selectShootCardHeroUrl({
        heroImage: floorplanGrid,
        previewImages: [floorplanGrid],
      }),
    ).toBe(floorplanGrid);
  });

  it('skips media_type floorplan files', () => {
    expect(isFloorplanLikeHeroFile({
      filename: 'cover.jpg',
      media_type: 'floorplan',
    })).toBe(true);
    expect(isFloorplanLikeHeroFile({
      filename: '5933 Keysville Rd-2847_0116.jpg',
      media_type: 'edited',
    })).toBe(false);
  });

  it('returns preferred photos first in the slideshow list', () => {
    expect(
      selectShootCardHeroUrls({
        heroImage: floorplanGrid,
        previewImages: [floorplanGrid, exterior, snap],
      }, { limit: 6 }),
    ).toEqual([exterior, snap]);
  });
});

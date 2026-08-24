/* -------------------------------------------------------------------------
 * Which media-kind tab a file belongs to
 *
 * The tab strip describes media KINDS; the booked service subgroups inside a
 * tab. These tests pin the routing that decides tab membership, because the
 * visibility of a tab is derived purely from whether its bucket has anything in
 * it — a floorplan that leaked into the photo bucket would both pollute Photos
 * and silently hide the Floor Plans tab.
 *
 * `useShootMediaDerivedData` owns the buckets, so it is driven directly rather
 * than rendering the whole media tab.
 * ------------------------------------------------------------------------- */

import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ShootData } from '@/types/shoots';
import type { MediaFile } from '@/hooks/useShootFiles';
import { useShootMediaDerivedData } from './useShootMediaDerivedData';

const shoot = { id: '1', services: ['10 Exterior HDR Photos'] } as unknown as ShootData;

const media = (id: string, overrides: Partial<MediaFile> = {}): MediaFile => ({
  id,
  filename: `${id}.jpg`,
  media_type: 'raw',
  ...overrides,
} as unknown as MediaFile);

const buckets = (rawFiles: MediaFile[], editedFiles: MediaFile[] = [], shootData: ShootData = shoot) =>
  renderHook(() =>
    useShootMediaDerivedData({
      shoot: shootData,
      rawFiles,
      editedFiles,
      displayTab: 'uploaded',
      uploadedMediaTab: 'photos',
      editedMediaTab: 'photos',
      isAdmin: true,
      isPhotographer: false,
      isEditor: false,
      isClient: false,
    }),
  ).result.current;

describe('floorplan media routes to Floor Plans, never Photos', () => {
  it('puts a floorplan in the floorplan bucket and keeps it out of Photos', () => {
    const result = buckets([
      media('photo-1'),
      media('plan-1', { media_type: 'floorplan', filename: 'plan-1.pdf' }),
    ]);

    expect(result.uploadedFloorplans.map((f) => f.id)).toEqual(['plan-1']);
    expect(result.uploadedPhotos.map((f) => f.id)).toEqual(['photo-1']);
  });

  it('leaves the floorplan bucket empty when the shoot has no floorplan media', () => {
    // Drives the "no unnecessary Floor Plans tab" case: the tab is rendered only
    // when this bucket (or the provider link list) has content.
    const result = buckets([media('photo-1'), media('photo-2')]);

    expect(result.uploadedFloorplans).toEqual([]);
    expect(result.iguideFloorplans).toEqual([]);
    expect(result.uploadedPhotos).toHaveLength(2);
  });

  it('routes an iGuide-ingested floorplan to Floor Plans', () => {
    const result = buckets([
      media('ig-plan', {
        media_type: 'floorplan',
        media_source: 'iguide',
        provider_asset_key: 'ig-key-1',
      }),
    ]);

    expect(result.uploadedFloorplans.map((f) => f.id)).toEqual(['ig-plan']);
    expect(result.uploadedPhotos).toEqual([]);
  });

  it('routes a CubiCasa-ingested floorplan to Floor Plans', () => {
    const result = buckets([
      media('cc-plan', {
        media_type: 'floorplan',
        media_source: 'cubicasa',
        provider_asset_key: 'cc-key-1',
      }),
    ]);

    expect(result.uploadedFloorplans.map((f) => f.id)).toEqual(['cc-plan']);
    expect(result.uploadedPhotos).toEqual([]);
  });

  it('separates video, floorplan and photo media into three kinds', () => {
    const result = buckets([
      media('photo-1'),
      media('plan-1', { media_type: 'floorplan' }),
      media('clip-1', { media_type: 'video', filename: 'clip-1.mp4' }),
    ]);

    expect(result.uploadedPhotos.map((f) => f.id)).toEqual(['photo-1']);
    expect(result.uploadedFloorplans.map((f) => f.id)).toEqual(['plan-1']);
    expect(result.uploadedVideos.map((f) => f.id)).toEqual(['clip-1']);
  });

  it('keeps drone and treated raw frames in Photos, so Floor Plans is unaffected', () => {
    // Guards the completed Raw Upload behaviour: a treated frame is still a raw of
    // its booked service and must not be re-routed by the presence of `treatment`.
    const result = buckets([
      media('vs', { treatment: 'virtual_staging' }),
      media('gg', { treatment: 'green_grass' }),
      media('tw', { treatment: 'twilight' }),
      media('drone-raw', { treatment: null }),
    ]);

    expect(result.uploadedPhotos.map((f) => f.id)).toEqual(['vs', 'gg', 'tw', 'drone-raw']);
    expect(result.uploadedFloorplans).toEqual([]);
    expect(result.uploadedVirtualStaging).toEqual([]);
    expect(result.uploadedTwilight).toEqual([]);
  });

  it('routes the edited side the same way', () => {
    const result = buckets([], [
      media('edited-photo'),
      media('edited-plan', { media_type: 'floorplan' }),
    ]);

    expect(result.editedFloorplans.map((f) => f.id)).toEqual(['edited-plan']);
    expect(result.editedPhotos.map((f) => f.id)).toEqual(['edited-photo']);
  });
});

describe('a provider floorplan is not shown twice', () => {
  /**
   * The shoot payload carries the provider's own floorplan list AND the files
   * ingested from it. Once ingested, the link card must disappear or the same
   * floorplan appears as both a grid tile and a link.
   */
  const shootWithIguide = {
    id: '1',
    services: [],
    iguideFloorplans: [
      { url: 'https://iguide.example/a.pdf', filename: 'a.pdf', asset_key: 'key-a' },
      { url: 'https://iguide.example/b.pdf', filename: 'b.pdf', asset_key: 'key-b' },
    ],
  } as unknown as ShootData;

  it('drops a link card whose asset has already been ingested as a file', () => {
    const result = buckets(
      [
        media('ingested-a', {
          media_type: 'floorplan',
          media_source: 'iguide',
          provider_asset_key: 'key-a',
        }),
      ],
      [],
      shootWithIguide,
    );

    expect(result.uploadedFloorplans.map((f) => f.id)).toEqual(['ingested-a']);
    // Only the not-yet-ingested one remains as a link.
    expect(result.iguideFloorplans.map((fp) => fp.asset_key)).toEqual(['key-b']);
  });

  it('matches on the provider source url when no asset key is present', () => {
    const result = buckets(
      [
        media('ingested-b', {
          media_type: 'floorplan',
          media_source: 'iguide',
          provider_source_url: 'https://iguide.example/b.pdf',
        }),
      ],
      [],
      shootWithIguide,
    );

    expect(result.iguideFloorplans.map((fp) => fp.asset_key)).toEqual(['key-a']);
  });

  it('keeps every link card when nothing has been ingested yet', () => {
    const result = buckets([], [], shootWithIguide);
    expect(result.iguideFloorplans).toHaveLength(2);
  });

  it('does not let a CubiCasa file suppress an iGuide link card', () => {
    const result = buckets(
      [
        media('cc', {
          media_type: 'floorplan',
          media_source: 'cubicasa',
          provider_asset_key: 'key-a',
        }),
      ],
      [],
      shootWithIguide,
    );

    // Same key, different provider: the iGuide list is untouched.
    expect(result.iguideFloorplans).toHaveLength(2);
  });
});

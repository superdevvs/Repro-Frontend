import { describe, expect, it } from 'vitest';

import { MEDIA_GRID_SIZES_ATTR, getMediaSrcSet } from './mediaPreviewUtils';
import { type MediaFile } from '@/hooks/useShootFiles';

/**
 * Media tiles used to be served the 300px thumbnail while rendering far larger,
 * so the browser upscaled it and the grid looked soft (A1 item 8, meeting
 * complaint about blurry tiles). The fix is a tuned 600px `grid` rendition
 * (600x400 on a 3:2 frame, Q85, Lanczos + unsharp) offered through
 * `srcSet`/`sizes`.
 *
 * These cover the selection rules rather than the image pipeline: that the grid
 * rendition is offered at 600w, that the 1500px preview is *not* offered (a 2x
 * tile would take it and pull ~400KB into a ~320px slot), that older files
 * without a grid rendition still get a usable candidate list, and that no
 * duplicate URL is emitted at two widths (which would let the browser pick the
 * small file for a large slot).
 */
const buildFile = (overrides: Partial<MediaFile> = {}): MediaFile =>
  ({
    id: 'file-1',
    filename: 'shot-001.jpg',
    ...overrides,
  } as MediaFile);

const parseSrcSet = (srcSet: string): Array<{ url: string; width: string }> =>
  srcSet
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [url, width] = entry.split(/\s+/);
      return { url, width };
    });

describe('getMediaSrcSet', () => {
  it('offers the tuned grid rendition at 600w alongside the thumbnail', () => {
    const srcSet = getMediaSrcSet(
      buildFile({
        thumb_url: 'https://cdn.test/thumb/shot-001.jpg',
        grid_url: 'https://cdn.test/grid/shot-001.jpg',
        web_url: 'https://cdn.test/web/shot-001.jpg',
      } as Partial<MediaFile>),
    );

    expect(parseSrcSet(srcSet)).toEqual([
      { url: 'https://cdn.test/thumb/shot-001.jpg', width: '300w' },
      { url: 'https://cdn.test/grid/shot-001.jpg', width: '600w' },
    ]);
  });

  it('never offers the full web preview to a tile', () => {
    // A 320px slot on a 2x display asks for ~640w. Listing the 1500px preview
    // made that the winning candidate, which is the "thumbnails are too heavy"
    // half of the problem.
    const srcSet = getMediaSrcSet(
      buildFile({
        thumb_url: 'https://cdn.test/thumb/shot-001.jpg',
        grid_url: 'https://cdn.test/grid/shot-001.jpg',
        web_url: 'https://cdn.test/web/shot-001.jpg',
      } as Partial<MediaFile>),
    );

    expect(srcSet).not.toContain('https://cdn.test/web/shot-001.jpg');
  });

  it('falls back to the web rendition for files processed before grid existed', () => {
    const srcSet = getMediaSrcSet(
      buildFile({
        thumb_url: 'https://cdn.test/thumb/legacy.jpg',
        web_url: 'https://cdn.test/web/legacy.jpg',
      } as Partial<MediaFile>),
    );

    // The web rendition stands in for grid: heavier than the tile needs, but
    // sharp, which is the right way round for legacy media.
    expect(parseSrcSet(srcSet)).toEqual([
      { url: 'https://cdn.test/thumb/legacy.jpg', width: '300w' },
      { url: 'https://cdn.test/web/legacy.jpg', width: '600w' },
    ]);
  });

  it('never lists the same URL at two widths', () => {
    const srcSet = getMediaSrcSet(
      buildFile({
        thumb_url: 'https://cdn.test/only/shot.jpg',
      } as Partial<MediaFile>),
    );

    const urls = parseSrcSet(srcSet).map((entry) => entry.url);

    expect(new Set(urls).size).toBe(urls.length);
  });

  it('returns an empty string when no rendition is resolvable', () => {
    expect(getMediaSrcSet(buildFile())).toBe('');
  });

  it('describes the grid columns so the browser can choose before layout', () => {
    // Without a sizes hint the browser assumes 100vw and pulls the largest
    // candidate, which defeats offering a small one at all.
    expect(MEDIA_GRID_SIZES_ATTR).toContain('max-width: 640px');
    expect(MEDIA_GRID_SIZES_ATTR).toContain('max-width: 1024px');
    expect(MEDIA_GRID_SIZES_ATTR.trim().endsWith('320px')).toBe(true);
  });
});

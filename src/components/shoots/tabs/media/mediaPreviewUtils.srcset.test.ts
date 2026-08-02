import { describe, expect, it } from 'vitest';

import { MEDIA_GRID_SIZES_ATTR, getMediaSrcSet } from './mediaPreviewUtils';
import { type MediaFile } from '@/hooks/useShootFiles';

/**
 * Media tiles used to be served the 300px thumbnail while rendering far larger,
 * so the browser upscaled it and the grid looked soft (A1 item 8, meeting
 * complaint about blurry tiles). The fix adds a ~1000px `grid` rendition and
 * offers it through `srcSet`/`sizes`.
 *
 * These cover the selection rules rather than the image pipeline: that the grid
 * rendition is offered at 1000w, that older files without one still get a usable
 * candidate list, and that no duplicate URL is emitted at two widths (which
 * would let the browser pick the small file for a large slot).
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
  it('offers the grid rendition at 1000w alongside the thumbnail and preview', () => {
    const srcSet = getMediaSrcSet(
      buildFile({
        thumb_url: 'https://cdn.test/thumb/shot-001.jpg',
        grid_url: 'https://cdn.test/grid/shot-001.jpg',
        web_url: 'https://cdn.test/web/shot-001.jpg',
      } as Partial<MediaFile>),
    );

    expect(parseSrcSet(srcSet)).toEqual([
      { url: 'https://cdn.test/thumb/shot-001.jpg', width: '300w' },
      { url: 'https://cdn.test/grid/shot-001.jpg', width: '1000w' },
      { url: 'https://cdn.test/web/shot-001.jpg', width: '1600w' },
    ]);
  });

  it('falls back to the web rendition for files processed before grid existed', () => {
    const srcSet = getMediaSrcSet(
      buildFile({
        thumb_url: 'https://cdn.test/thumb/legacy.jpg',
        web_url: 'https://cdn.test/web/legacy.jpg',
      } as Partial<MediaFile>),
    );

    const entries = parseSrcSet(srcSet);

    // The web rendition stands in for grid at 1000w, and is not repeated at
    // 1600w — a browser given the same URL twice cannot make a useful choice.
    expect(entries).toEqual([
      { url: 'https://cdn.test/thumb/legacy.jpg', width: '300w' },
      { url: 'https://cdn.test/web/legacy.jpg', width: '1000w' },
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

import { describe, expect, it } from 'vitest';
import { decodeStudioDeepLink } from './studioDeepLink';
import { buildShootStudioHref, readShootStudioEntry } from './shootStudioDeepLink';

describe('shoot Studio entry links', () => {
  it.each([
    ['images', 'listing-ready'],
    ['videos', 'walkthrough'],
  ] as const)('round trips a %s entry without changing the authorized record contract', (media, presetId) => {
    const href = buildShootStudioHref({ shootId: ' 42 ', media, presetId });
    expect(href).not.toBeNull();
    const url = new URL(href!, 'https://dashboard.test');
    expect(url.pathname).toBe('/ai-editing');
    expect(decodeStudioDeepLink(url.search)).toEqual({
      destination: 'command-center', recordType: 'shoot', recordId: '42',
    });
    expect(readShootStudioEntry(url.search)).toEqual({ shootId: '42', media, presetId });
    expect([...url.searchParams.keys()]).toEqual(['d', 'rec', 'media', 'preset']);
  });

  it('supports a preset-free entry without silently choosing a workflow', () => {
    const href = buildShootStudioHref({ shootId: 42, media: 'videos' });
    const search = new URL(href!, 'https://dashboard.test').searchParams;
    expect(search.has('preset')).toBe(false);
    expect(readShootStudioEntry(search)).toEqual({ shootId: '42', media: 'videos', presetId: null });
  });

  it.each(['', '0', '-1', '1.5', '42&media=videos', 'shoot:42', 'Infinity'])('rejects invalid shoot ID %j', (shootId) => {
    expect(buildShootStudioHref({ shootId, media: 'images' })).toBeNull();
    const params = new URLSearchParams({ d: 'command-center', rec: `shoot:${shootId}`, media: 'images' });
    expect(readShootStudioEntry(params)).toBeNull();
  });

  it('rejects numeric IDs that have already lost integer precision', () => {
    expect(buildShootStudioHref({ shootId: Number.MAX_SAFE_INTEGER + 1, media: 'images' })).toBeNull();
  });

  it.each([
    'd=unknown&rec=shoot:42&media=images',
    'd=command-center&rec=project:42&media=images',
    'd=command-center&rec=shoot:42&media=audio',
    'd=command-center&rec=shoot:42',
    'd=command-center&media=images',
  ])('does not select a shoot from malformed entry %s', (search) => {
    expect(readShootStudioEntry(search)).toBeNull();
  });

  it.each(['walkthrough', 'unknown', '__proto__'])('ignores incompatible or unknown image preset %s', (preset) => {
    expect(readShootStudioEntry(`d=command-center&rec=shoot:42&media=images&preset=${preset}`))
      .toEqual({ shootId: '42', media: 'images', presetId: null });
  });

  it('does not build a video entry with an image-only preset', () => {
    const href = buildShootStudioHref({ shootId: '42', media: 'videos', presetId: 'twilight' });
    expect(new URL(href!, 'https://dashboard.test').searchParams.has('preset')).toBe(false);
  });
});

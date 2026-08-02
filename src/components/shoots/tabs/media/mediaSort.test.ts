import { describe, expect, it } from 'vitest';

import type { MediaFile } from '@/hooks/useShootFiles';

import { normalizeManualOrder, sortMediaFiles } from './mediaSort';

/** Minimal MediaFile stub — only the fields the comparators read. */
const file = (id: string, overrides: Partial<MediaFile> = {}): MediaFile =>
  ({
    id,
    filename: `${id}.jpg`,
    ...overrides,
  }) as MediaFile;

describe('sortMediaFiles — name', () => {
  it('orders a camera counter numerically, not lexicographically', () => {
    const files = [
      file('a', { filename: 'IMG_10.jpg' }),
      file('b', { filename: 'IMG_2.jpg' }),
      file('c', { filename: 'IMG_1.jpg' }),
    ];

    expect(sortMediaFiles(files, 'name').map((f) => f.filename)).toEqual([
      'IMG_1.jpg',
      'IMG_2.jpg',
      'IMG_10.jpg',
    ]);
  });

  it('handles a sequence that does not start at 1', () => {
    const files = [
      file('a', { filename: 'DSC_100.jpg' }),
      file('b', { filename: 'DSC_50.jpg' }),
      file('c', { filename: 'DSC_9.jpg' }),
    ];

    expect(sortMediaFiles(files, 'name').map((f) => f.filename)).toEqual([
      'DSC_9.jpg',
      'DSC_50.jpg',
      'DSC_100.jpg',
    ]);
  });

  it('is idempotent', () => {
    const files = [
      file('a', { filename: 'IMG_10.jpg' }),
      file('b', { filename: 'IMG_2.jpg' }),
    ];

    const once = sortMediaFiles(files, 'name');
    const twice = sortMediaFiles(once, 'name');

    expect(twice.map((f) => f.id)).toEqual(once.map((f) => f.id));
  });

  it('does not mutate the input array', () => {
    const files = [
      file('a', { filename: 'IMG_10.jpg' }),
      file('b', { filename: 'IMG_2.jpg' }),
    ];
    const original = [...files];

    sortMediaFiles(files, 'name');

    expect(files).toEqual(original);
  });
});

describe('sortMediaFiles — manual', () => {
  it('round-trips a saved order including the first position', () => {
    const files = [file('a'), file('b'), file('c')];
    const manualOrder = ['c', 'a', 'b'];

    expect(sortMediaFiles(files, 'manual', manualOrder).map((f) => f.id)).toEqual([
      'c',
      'a',
      'b',
    ]);
  });

  it('appends files that are missing from the saved order', () => {
    const files = [file('a'), file('b'), file('c')];

    expect(sortMediaFiles(files, 'manual', ['c']).map((f) => f.id)).toEqual(['c', 'a', 'b']);
  });
});

describe('normalizeManualOrder', () => {
  it('drops unknown ids and de-duplicates', () => {
    const files = [file('a'), file('b')];

    expect(normalizeManualOrder(['b', 'b', 'zzz', 'a'], files)).toEqual(['b', 'a']);
  });

  it('is stable once normalized', () => {
    const files = [file('a'), file('b'), file('c')];
    const once = normalizeManualOrder(['c', 'a'], files);

    expect(normalizeManualOrder(once, files)).toEqual(once);
  });
});
